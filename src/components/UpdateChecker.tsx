import { useState, useEffect, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState = "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "up-to-date";

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>("idle");
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  // Silent check on mount
  useEffect(() => {
    const timer = setTimeout(() => checkForUpdate(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const checkForUpdate = useCallback(async (silent = false) => {
    if (!silent) setState("checking");
    setError("");

    try {
      const update = await check();
      if (update) {
        setVersion(update.version);
        setState("available");
      } else {
        if (!silent) {
          setState("up-to-date");
          setTimeout(() => setState("idle"), 3000);
        } else {
          setState("idle");
        }
      }
    } catch {
      // Silently fail — network issues, private repo, etc.
      setState("idle");
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setState("downloading");
    setProgress(0);
    try {
      const update = await check();
      if (!update) { setState("idle"); return; }

      let totalBytes = 0;
      let downloadedBytes = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        }
      });

      setState("ready");
    } catch (err) {
      setError(String(err));
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }, []);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  const versionButton = (
    <button
      onClick={() => checkForUpdate(false)}
      title="Check for updates"
      style={{
        background: "transparent",
        border: "none",
        color: "rgba(255,255,255,0.2)",
        fontSize: 11,
        cursor: "pointer",
        padding: "4px 0",
        fontWeight: 500,
      }}
    >
      v{__APP_VERSION__}
    </button>
  );

  if (state === "idle") {
    return versionButton;
  }

  if (state === "checking") {
    return (
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", padding: "4px 0", fontWeight: 500 }}>
        Checking for updates...
      </div>
    );
  }

  if (state === "up-to-date") {
    return (
      <div style={{ fontSize: 11, color: "rgba(134,239,172,0.6)", padding: "4px 0", fontWeight: 500 }}>
        v{__APP_VERSION__} — up to date
      </div>
    );
  }

  if (state === "available") {
    return (
      <button
        onClick={downloadAndInstall}
        style={{
          background: "rgba(134,239,172,0.1)",
          border: "1px solid rgba(134,239,172,0.2)",
          borderRadius: 8,
          color: "rgba(134,239,172,0.8)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          padding: "6px 12px",
          width: "100%",
          textAlign: "left",
        }}
      >
        Update to v{version}
      </button>
    );
  }

  if (state === "downloading") {
    return (
      <div style={{ padding: "4px 0" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginBottom: 6 }}>
          Downloading{progress > 0 ? ` ${progress}%` : "..."}
        </div>
        <div style={{
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: "rgba(134,239,172,0.5)",
            borderRadius: 2,
            transition: "width 0.2s",
          }} />
        </div>
      </div>
    );
  }

  if (state === "ready") {
    return (
      <button
        onClick={handleRelaunch}
        style={{
          background: "rgba(134,239,172,0.15)",
          border: "1px solid rgba(134,239,172,0.25)",
          borderRadius: 8,
          color: "rgba(134,239,172,0.9)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          padding: "6px 12px",
          width: "100%",
          textAlign: "left",
        }}
      >
        Restart to finish update
      </button>
    );
  }

  if (state === "error") {
    return (
      <div style={{ fontSize: 11, color: "rgba(248,113,113,0.5)", padding: "4px 0", fontWeight: 500 }} title={error}>
        Update failed — try again later
      </div>
    );
  }

  return null;
}

declare const __APP_VERSION__: string;
