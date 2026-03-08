import { useState, useEffect } from "react";

export type ViewMode = "full" | "medium" | "compact";

function getMode(width: number): ViewMode {
  if (width < 450) return "compact";
  if (width <= 800) return "medium";
  return "full";
}

export function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  const mode = getMode(width);

  useEffect(() => {
    let raf: number;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
    });
    observer.observe(document.documentElement);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return { width, mode };
}
