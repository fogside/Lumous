import { useState, useEffect, useCallback, useRef } from "react";
import { gitRun, checkOnline } from "../lib/storage";
import { Meta } from "../lib/types";

type SyncState = "idle" | "syncing" | "success" | "error";

export function useSync(
  meta: Meta | null,
  updateSettings: (settings: Partial<Meta["settings"]>) => Promise<void>,
  onSynced?: () => void
) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const repoUrl = meta?.settings.syncRepoUrl || "";
  const intervalMinutes = meta?.settings.syncIntervalMinutes || 5;

  const sync = useCallback(async () => {
    if (!repoUrl) return;
    setSyncState("syncing");
    setSyncError("");

    try {
      const isOnline = await checkOnline();
      if (!isOnline) {
        setSyncState("idle");
        return;
      }

      // Check if git is initialized
      try {
        await gitRun(["status"]);
      } catch {
        // Init git repo and set remote
        await gitRun(["init"]);
        await gitRun(["remote", "add", "origin", repoUrl]);
        await gitRun(["checkout", "-b", "main"]);
      }

      // Stage and commit local changes
      await gitRun(["add", "-A"]);
      try {
        await gitRun(["commit", "-m", `sync: ${new Date().toISOString()}`]);
      } catch {
        // Nothing to commit, that's fine
      }

      // Try to pull then push
      try {
        await gitRun(["pull", "--rebase", "origin", "main"]);
      } catch {
        // If rebase fails, abort and try merge with ours strategy
        try {
          await gitRun(["rebase", "--abort"]);
        } catch { /* noop */ }
        try {
          await gitRun(["pull", "-X", "ours", "origin", "main", "--no-edit"]);
        } catch { /* first push, no remote yet */ }
      }

      await gitRun(["push", "-u", "origin", "main"]);

      await updateSettings({ lastSyncedAt: new Date().toISOString() });
      setSyncState("success");
      onSynced?.();

      // Reset to idle after 3 seconds
      setTimeout(() => setSyncState("idle"), 3000);
    } catch (err) {
      setSyncError(String(err));
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 5000);
    }
  }, [repoUrl, updateSettings, onSynced]);

  // Auto-sync interval
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!repoUrl || intervalMinutes <= 0) return;

    intervalRef.current = setInterval(() => {
      sync();
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(intervalRef.current);
  }, [repoUrl, intervalMinutes, sync]);

  return { syncState, syncError, sync, hasRepo: !!repoUrl };
}
