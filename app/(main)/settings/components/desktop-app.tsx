"use client";

import { format } from "date-fns";
import { Download, Laptop, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  checkForDesktopUpdate,
  type DesktopPlatform,
  type DesktopRelease,
  detectDesktopPlatform,
  fetchLatestDesktopRelease,
  getDesktopVersion,
  isDesktopApp,
} from "@/lib/desktop";

const PLATFORM_LABELS: Record<DesktopPlatform, string> = {
  mac: "macOS",
  windows: "Windows",
};

type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "current" }
  | { state: "downloading"; version: string }
  | { state: "failed" };

export function DesktopAppSettings() {
  // Resolved after mount: the server render cannot know it runs in the app.
  const [inDesktop, setInDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    setInDesktop(isDesktopApp());
  }, []);

  return (
    <section className="flex flex-col">
      <div className="border-b px-5 py-3">
        <span className="eyebrow">( Desktop app )</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6 border-b px-5 py-4">
        <div className="flex min-w-0 max-w-xl flex-col gap-1">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Laptop className="size-4 text-muted-foreground" />
            Stuttgart for desktop
          </span>
          <p className="text-sm text-muted-foreground">
            The ledger in its own window on macOS 11.3+ (Apple silicon and
            Intel) and Windows 10+. Installed apps update automatically.
          </p>
        </div>
        {inDesktop === true && <InstalledApp />}
        {inDesktop === false && <DownloadLinks />}
      </div>
    </section>
  );
}

function InstalledApp() {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });

  useEffect(() => {
    getDesktopVersion()
      .then(setVersion)
      .catch((error) => console.error("Failed to read app version", error));
  }, []);

  async function handleCheck() {
    setStatus({ state: "checking" });
    try {
      const update = await checkForDesktopUpdate();
      setStatus(
        update
          ? { state: "downloading", version: update }
          : { state: "current" },
      );
    } catch (error) {
      console.error("Failed to check for updates", error);
      setStatus({ state: "failed" });
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-6">
      <VersionFigure version={version} caption="installed" />
      <div className="flex flex-col items-end gap-1.5">
        <Button
          variant="outline"
          onClick={() => void handleCheck()}
          disabled={status.state === "checking"}
        >
          <RefreshCw
            className={status.state === "checking" ? "animate-spin" : ""}
          />
          {status.state === "checking" ? "Checking…" : "Check for updates"}
        </Button>
        <UpdateStatusLine status={status} />
      </div>
    </div>
  );
}

function UpdateStatusLine({ status }: { status: UpdateStatus }) {
  const message = {
    idle: null,
    checking: null,
    current: "You're on the latest version.",
    downloading:
      status.state === "downloading"
        ? `Downloading v${status.version}. You'll be asked to restart.`
        : null,
    failed: "Couldn't check for updates. Try again later.",
  }[status.state];

  if (!message) return null;
  return (
    <p
      className={
        status.state === "failed"
          ? "text-xs text-destructive"
          : "text-xs text-muted-foreground"
      }
    >
      {message}
    </p>
  );
}

function DownloadLinks() {
  const [release, setRelease] = useState<DesktopRelease | null | undefined>(
    undefined,
  );
  const [failed, setFailed] = useState(false);
  const [platform, setPlatform] = useState<DesktopPlatform | null>(null);

  useEffect(() => {
    setPlatform(detectDesktopPlatform());
    fetchLatestDesktopRelease()
      .then(setRelease)
      .catch((error) => {
        console.error("Failed to load the latest desktop release", error);
        setFailed(true);
      });
  }, []);

  if (failed) {
    return (
      <p className="text-sm text-destructive">
        Couldn't load the latest release. Try again later.
      </p>
    );
  }

  if (release === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No desktop release has been published yet.
      </p>
    );
  }

  // The visitor's own platform comes first and gets the ink button.
  const platforms: DesktopPlatform[] =
    platform === "windows" ? ["windows", "mac"] : ["mac", "windows"];

  return (
    <div className="flex flex-wrap items-end gap-6">
      <VersionFigure
        version={release?.version ?? null}
        caption={
          release
            ? `latest · ${format(new Date(release.publishedAt), "d MMM yyyy")}`
            : "latest"
        }
      />
      <div className="flex flex-wrap gap-2">
        {platforms.map((option, index) => {
          const href = release?.downloads[option];
          const label = `Download for ${PLATFORM_LABELS[option]}`;
          const variant =
            index === 0 && platform !== null ? "default" : "outline";
          return href ? (
            <Button key={option} variant={variant} asChild>
              <a href={href}>
                <Download />
                {label}
              </a>
            </Button>
          ) : (
            <Button key={option} variant={variant} disabled>
              <Download />
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function VersionFigure({
  version,
  caption,
}: {
  version: string | null;
  caption: string;
}) {
  return (
    <p className="flex shrink-0 items-baseline gap-1.5">
      <span className="font-mono text-2xl font-light tabular-nums text-foreground">
        {version ? `v${version}` : "–"}
      </span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </p>
  );
}
