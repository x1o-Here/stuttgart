fn main() {
    // Declaring the command generates the `allow-check-for-updates` permission
    // that capabilities/web-app.json grants to the remote web app.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["check_for_updates"]),
    ))
    .expect("failed to run tauri-build");
}
