import { Component, ReactNode } from "react";
import { DARK_INK } from "../lib/types";
import { logger } from "../lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: `${error.message}\n${error.stack || ""}` };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const msg = [
      error.message,
      error.stack || "",
      info.componentStack || "",
    ].join("\n");
    logger.error(`React crash: ${msg}`);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: DARK_INK, padding: 40, gap: 16,
      }}>
        <span style={{ fontSize: 32 }}>{"🧙‍♂️"}</span>
        <div style={{
          color: "rgba(232,131,106,0.9)", fontSize: 15, fontWeight: 600,
          textAlign: "center",
        }}>
          Something went wrong
        </div>
        <div style={{
          color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center",
          maxWidth: 400, lineHeight: 1.5,
        }}>
          The error has been logged. Click below to reload the app.
        </div>

        {/* Error details (collapsed by default) */}
        <details style={{ maxWidth: 480, width: "100%" }}>
          <summary style={{
            color: "rgba(255,255,255,0.25)", fontSize: 11, cursor: "pointer",
            textAlign: "center",
          }}>
            Error details
          </summary>
          <pre style={{
            marginTop: 8, padding: 12, borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)", fontSize: 10,
            whiteSpace: "pre-wrap", wordBreak: "break-all",
            maxHeight: 200, overflow: "auto",
            fontFamily: "SF Mono, Menlo, monospace",
          }}>
            {this.state.error}
          </pre>
        </details>

        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600,
            color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
        >
          Reload app
        </button>
      </div>
    );
  }
}
