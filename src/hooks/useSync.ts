import { useState, useEffect, useCallback, useRef } from "react";
import { gitRun, checkOnline, stripWizardTransient } from "../lib/storage";
import { Meta } from "../lib/types";

type SyncState = "idle" | "syncing" | "success" | "error";

export function useSync(
  meta: Meta | null,
  updateSettings: (settings: Partial<Meta["settings"]>) => Promise<void>,
  onSynced?: () => void,
  flushSave?: () => Promise<void>,
  forceResave?: () => Promise<void>,
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

      // Flush any pending board saves before committing
      if (flushSave) await flushSave();

      // Strip wizard-transient data (proposed cards, highlights) before committing
      // These are local-only — only accepted cards should be in git
      await stripWizardTransient();

      // Stage and commit local changes
      await gitRun(["add", "-A"]);
      try {
        await gitRun(["commit", "-m", `sync: ${new Date().toISOString()}`]);
      } catch {
        // Nothing to commit, that's fine
      }

      // Pull with local-wins strategy: local changes are always the source of truth
      try {
        await gitRun(["pull", "-X", "ours", "origin", "main", "--no-edit"]);
      } catch {
        // First push — no remote history yet, that's fine
      }

      await gitRun(["push", "-u", "origin", "main"]);

      // Restore in-memory board state to disk (re-applies any active proposals/highlights
      // that were stripped before git commit). We call forceResave which writes
      // unconditionally, unlike flushSave which checks dirtyRef.
      if (forceResave) await forceResave();

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
  }, [repoUrl, updateSettings, onSynced, flushSave, forceResave]);

  // Auto-sync interval — visibility-aware to avoid firing immediately on wake
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!repoUrl || intervalMinutes <= 0) return;

    // Track last sync time so we can skip stale interval fires on wake
    let lastTick = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastTick;
      lastTick = Date.now();
      // If elapsed time is much longer than the interval, the app was asleep.
      // Skip this tick — the next one will fire normally.
      if (elapsed > intervalMinutes * 60 * 1000 * 1.5) return;
      sync();
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(intervalRef.current);
  }, [repoUrl, intervalMinutes, sync]);

  return { syncState, syncError, sync, hasRepo: !!repoUrl };
}
