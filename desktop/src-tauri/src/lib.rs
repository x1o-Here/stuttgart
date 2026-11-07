use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::utils::config::FrontendDist;
use tauri::webview::{DownloadEvent, NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Manager, RunEvent, Runtime, Url, Webview, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::{Update, UpdaterExt};

const UPDATE_CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

/// Google blocks OAuth in user agents it recognises as embedded webviews, and
/// WKWebView's default one lacks the Safari token. WebView2 already reports Edge.
#[cfg(target_os = "macos")]
const POPUP_USER_AGENT: Option<&str> = Some(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
);
#[cfg(not(target_os = "macos"))]
const POPUP_USER_AGENT: Option<&str> = None;

static POPUP_COUNT: AtomicUsize = AtomicUsize::new(0);
static UPDATE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// An update that was downloaded but postponed; it installs when the app quits.
#[derive(Default)]
struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);

/// Checks for a newer release. When one exists it downloads in the background
/// and the user is asked to restart once it is ready. Returns the new version.
#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<Option<String>, String> {
    check_for_update(&app).await.map_err(|err| err.to_string())
}

async fn check_for_update(app: &AppHandle) -> tauri_plugin_updater::Result<Option<String>> {
    if tauri::is_dev() {
        return Ok(None);
    }

    if let Some((update, bytes)) = app.state::<PendingUpdate>().0.lock().unwrap().take() {
        let version = update.version.clone();
        prompt_restart(app.clone(), update, bytes);
        return Ok(Some(version));
    }

    let Some(update) = app.updater()?.check().await? else {
        return Ok(None);
    };
    let version = update.version.clone();

    if !UPDATE_IN_PROGRESS.swap(true, Ordering::SeqCst) {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            match update.download(|_, _| {}, || {}).await {
                Ok(bytes) => prompt_restart(app, update, bytes),
                Err(err) => {
                    eprintln!("update download failed: {err}");
                    UPDATE_IN_PROGRESS.store(false, Ordering::SeqCst);
                }
            }
        });
    }

    Ok(Some(version))
}

fn prompt_restart(app: AppHandle, update: Update, bytes: Vec<u8>) {
    let message = format!(
        "Stuttgart {} has been downloaded. Restart now to finish updating?",
        update.version
    );
    let handle = app.clone();
    app.dialog()
        .message(message)
        .title("Update ready")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Restart now".into(),
            "Later".into(),
        ))
        .show(move |restart| {
            if !restart {
                *handle.state::<PendingUpdate>().0.lock().unwrap() = Some((update, bytes));
                return;
            }
            match update.install(&bytes) {
                Ok(()) => handle.restart(),
                Err(err) => {
                    eprintln!("update install failed: {err}");
                    UPDATE_IN_PROGRESS.store(false, Ordering::SeqCst);
                }
            }
        });
}

/// Opens `window.open` requests (Google sign-in, PDF previews) as real child
/// windows so `window.opener` keeps working for Firebase's popup flow.
fn open_popup<R: Runtime>(
    app: &AppHandle<R>,
    features: NewWindowFeatures,
) -> NewWindowResponse<R> {
    let label = format!("popup-{}", POPUP_COUNT.fetch_add(1, Ordering::Relaxed));
    let mut builder = WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .window_features(features)
    .title("Stuttgart")
    .on_document_title_changed(|window, title| {
        let _ = window.set_title(&title);
    })
    .on_download(handle_download);
    if let Some(user_agent) = POPUP_USER_AGENT {
        builder = builder.user_agent(user_agent);
    }

    match builder.build() {
        Ok(window) => NewWindowResponse::Create { window },
        Err(err) => {
            eprintln!("failed to open popup: {err}");
            NewWindowResponse::Deny
        }
    }
}

/// Saves exports (`<a download>` blobs, `jsPDF.save`) to the Downloads folder.
fn handle_download<R: Runtime>(webview: Webview<R>, event: DownloadEvent<'_>) -> bool {
    match event {
        DownloadEvent::Requested { destination, .. } => {
            if let Ok(dir) = webview.path().download_dir() {
                let name = destination
                    .file_name()
                    .map(|name| name.to_os_string())
                    .unwrap_or_else(|| "download".into());
                *destination = unique_path(&dir, Path::new(&name));
            }
        }
        DownloadEvent::Finished {
            path: Some(path),
            success: true,
            ..
        } => {
            webview
                .dialog()
                .message(format!("Saved to {}", path.display()))
                .title("Download complete")
                .show(|_| {});
        }
        _ => {}
    }
    true
}

/// Appends " (1)", " (2)", … so downloads never overwrite an existing file.
fn unique_path(dir: &Path, name: &Path) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let stem = name.file_stem().unwrap_or_default().to_string_lossy();
    let extension = name
        .extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_default();
    (1..)
        .map(|n| dir.join(format!("{stem} ({n}){extension}")))
        .find(|path| !path.exists())
        .unwrap()
}

/// The hosted web app: `devUrl` under `tauri dev`, otherwise `frontendDist`.
fn web_app_url(app: &tauri::App) -> Result<Url, Box<dyn std::error::Error>> {
    let build = &app.config().build;
    match (&build.dev_url, &build.frontend_dist) {
        (Some(url), _) if tauri::is_dev() => Ok(url.clone()),
        (_, Some(FrontendDist::Url(url))) => Ok(url.clone()),
        _ => Err("build.frontendDist must be the web app's URL".into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![check_for_updates])
        .setup(|app| {
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(web_app_url(app)?))
                .title("Stuttgart")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 640.0)
                .center()
                .on_new_window(move |_url, features| open_popup(&handle, features))
                .on_download(handle_download)
                .build()?;

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    if let Err(err) = check_for_update(&handle).await {
                        eprintln!("update check failed: {err}");
                    }
                    tokio::time::sleep(UPDATE_CHECK_INTERVAL).await;
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Stuttgart desktop app")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some((update, bytes)) = app.state::<PendingUpdate>().0.lock().unwrap().take() {
                    let _ = update.install(bytes);
                }
            }
        });
}
