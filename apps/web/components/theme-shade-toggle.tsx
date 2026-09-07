"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Theme = "light" | "dark";

type DragState = {
  pointerId: number;
  startY: number;
  startProgress: number;
  moved: boolean;
};

const THEME_KEY = "visual-style-theme";
const DRAG_TRAVEL = 56;
const PANEL_TRAVEL = 34;
const DRAG_THRESHOLD = 4;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function ThemeShadeToggle({ locale }: { locale: "zh" | "en" }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const progressRef = useRef(0);
  const settledThemeRef = useRef<Theme>("light");
  const dragRef = useRef<DragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTargetRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [isDark, setIsDark] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const renderProgress = useCallback((progress: number) => {
    const next = clamp(progress);
    const button = buttonRef.current;
    const root = document.documentElement;

    progressRef.current = next;
    root.style.setProperty("--theme-progress", String(next));
    button?.style.setProperty("--shade-p", String(next));
    button?.style.setProperty(
      "--shade-offset",
      `${-(1 - next) * PANEL_TRAVEL}px`,
    );
    button?.style.setProperty(
      "--shade-brightness",
      String(1 - next * 0.46),
    );
  }, []);

  const stopMotion = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    animationTargetRef.current = null;
  }, []);

  const commitTheme = useCallback((target: number) => {
    const theme: Theme = target === 1 ? "dark" : "light";
    const root = document.documentElement;

    if (theme === "dark") root.dataset.theme = "dark";
    else delete root.dataset.theme;
    root.style.removeProperty("--theme-progress");

    settledThemeRef.current = theme;
    setIsDark(theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}

    animationTargetRef.current = null;
  }, []);

  const animateTo = useCallback(
    (target: 0 | 1) => {
      const start = progressRef.current;
      const distance = Math.abs(target - start);
      stopMotion();
      renderProgress(start);
      animationTargetRef.current = target;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion || distance < 0.001) {
        renderProgress(target);
        commitTheme(target);
        return;
      }

      const startedAt = performance.now();
      const duration = Math.max(260, 620 * distance);
      const tick = (now: number) => {
        const elapsed = Math.min(1, (now - startedAt) / duration);
        renderProgress(start + (target - start) * easeInOutCubic(elapsed));
        if (elapsed < 1) {
          animationFrameRef.current = requestAnimationFrame(tick);
          return;
        }
        animationFrameRef.current = null;
        renderProgress(target);
        commitTheme(target);
      };
      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [commitTheme, renderProgress, stopMotion],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const theme: Theme =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      settledThemeRef.current = theme;
      setIsDark(theme === "dark");
      renderProgress(theme === "dark" ? 1 : 0);
    });

    return () => {
      cancelAnimationFrame(frame);
      stopMotion();
      document.documentElement.style.removeProperty("--theme-progress");
    };
  }, [renderProgress, stopMotion]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    stopMotion();
    renderProgress(progressRef.current);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startProgress: progressRef.current,
      moved: false,
    };
    suppressClickRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const movement = event.clientY - drag.startY;
    drag.moved ||= Math.abs(movement) > DRAG_THRESHOLD;
    renderProgress(drag.startProgress + movement / DRAG_TRAVEL);
  };

  const releasePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    dragRef.current = null;
    setIsDragging(false);
    return drag;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = releasePointer(event);
    if (!drag) return;
    suppressClickRef.current = drag.moved;
    if (drag.moved) animateTo(progressRef.current >= 0.5 ? 1 : 0);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = releasePointer(event);
    if (!drag) return;
    suppressClickRef.current = true;
    animateTo(settledThemeRef.current === "dark" ? 1 : 0);
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const activeTarget = animationTargetRef.current;
    const target =
      activeTarget === null
        ? settledThemeRef.current === "dark"
          ? 0
          : 1
        : activeTarget === 1
          ? 0
          : 1;
    animateTo(target);
  };

  const label =
    locale === "zh"
      ? isDark
        ? "打开舷窗挡板，切换到亮色主题"
        : "关闭舷窗挡板，切换到暗色主题"
      : isDark
        ? "Open the window shade and switch to light theme"
        : "Close the window shade and switch to dark theme";

  return (
    <button
      type="button"
      ref={buttonRef}
      className={`theme-shade-toggle${isDragging ? " dragging" : ""}`}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      suppressHydrationWarning
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
    >
      <span className="theme-window" aria-hidden="true">
        <span className="theme-window-sky" />
        <span className="theme-window-shade">
          <i />
        </span>
        <span className="theme-window-frame" />
      </span>
      <span className="theme-shade-caption" aria-hidden="true">
        {locale === "zh" ? "明 · 暗" : "DAY · NIGHT"}
      </span>
    </button>
  );
}
