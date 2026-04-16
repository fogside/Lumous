import { invoke } from "@tauri-apps/api/core";

type LogLevel = "ERROR" | "WARN" | "INFO";

async function writeLog(level: LogLevel, message: string) {
  try {
    await invoke("write_log", { level, message });
  } catch {
    // Can't log if invoke itself fails — fall through to console
  }
  if (level === "ERROR") console.error(`[${level}]`, message);
  else if (level === "WARN") console.warn(`[${level}]`, message);
  else console.log(`[${level}]`, message);
}

export const logger = {
  error: (msg: string) => writeLog("ERROR", msg),
  warn: (msg: string) => writeLog("WARN", msg),
  info: (msg: string) => writeLog("INFO", msg),
};

// Install global handlers — call once at app startup
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (e) => {
    const msg = [
      e.message,
      e.filename ? `at ${e.filename}:${e.lineno}:${e.colno}` : "",
      e.error?.stack || "",
    ].filter(Boolean).join("\n");
    writeLog("ERROR", `Uncaught: ${msg}`);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error
      ? `${e.reason.message}\n${e.reason.stack || ""}`
      : String(e.reason);
    writeLog("ERROR", `Unhandled rejection: ${reason}`);
  });
}
