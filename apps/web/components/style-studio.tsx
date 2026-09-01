"use client";

import type {
  ImageQuality,
  PublicStyle,
} from "@visual-style/style-registry";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Locale = "zh" | "en";
type ApiKeyStatus = "loading" | "missing" | "session" | "environment";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
};

type TaskStatus = "queued" | "generating" | "success" | "error" | "cancelled";

type TaskResult = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourcePreviewUrl: string;
  styleId: string;
  styleName: string;
  styleNameEn: string;
  variantId: string;
  variantLabel: string;
  variantLabelEn: string;
  status: TaskStatus;
  error?: string;
  effectDataUrl?: string;
  comparisonDataUrl?: string;
  outputSuffix?: string;
  size?: string;
};

type GenerateResponse = {
  style: { id: string; name: string; outputSuffix: string };
  variant: { id: string; label: string };
  size: string;
  effectDataUrl: string;
  comparisonDataUrl: string;
  error?: { code?: string; message?: string };
};

type ApiKeyResponse = {
  configured?: boolean;
  source?: "environment" | "session" | null;
  error?: { code?: string; message?: string };
};

const COPY = {
  zh: {
    returnTop: "返回顶部",
    language: "界面语言",
    apiKey: "API KEY",
    apiBilling: "API 计费",
    apiBillingAria: "打开 OpenAI API 计费页面（新窗口）",
    keyLoading: "检查中",
    keyMissing: "未配置",
    keySession: "已安全连接",
    keyEnvironment: "服务端已配置",
    heroLead: "让一张照片，进入",
    heroAccent: "不同艺术语言",
    heroCopy:
      "上传原图，选择预置风格。模型只生成艺术效果，原图与最终对照版式由程序确定性保留和拼合。",
    uploadTitle: "上传原图",
    uploadHint: "JPEG、PNG 或 WebP，单张不超过 12 MB",
    drag: "拖拽图片到这里",
    choose: "或点击选择，最多 12 张",
    rejected: (count: number) => `已忽略 ${count} 个不支持或超过 12 MB 的文件。`,
    maxUploads: "单次最多上传 12 张图片。",
    moveEarlier: "向前移动",
    moveLater: "向后移动",
    removeImage: "移除图片",
    styleTitle: "选择艺术风格",
    styleHint: "可多选；每张图片会按上传顺序独立处理",
    styleVariants: (name: string) => `${name}变体`,
    settingsTitle: "成品设置",
    settingsHint: "标准画质适合多数对照成品",
    quality: "生成画质",
    low: "草稿",
    medium: "标准",
    high: "高清",
    primaryPreview: "结果页主预览",
    comparison: "对照成品",
    effectOnly: "仅效果图",
    extra: "附加要求",
    optional: "可选，最多 1000 字",
    placeholder: "例如：保留人物红色外套；整体光线更明亮……",
    calls: "次生成调用",
    countSummary: (images: number, styles: number) =>
      `${images} 张图片 × ${styles} 种风格`,
    cancel: "取消任务",
    generate: "开始生成",
    gallery: "输出画廊",
    emptyTitle: "成品将在这里出现",
    emptyCopy: "上传图片并选择风格后开始生成。默认输出包含未经风格化的真实原图。",
    incomplete: "生成未完成",
    retry: "重试当前项",
    cancelledTitle: "任务已取消",
    regenerate: "重新生成",
    waiting: "等待生成资源",
    drawing: "正在绘制效果图",
    duration: "复杂图像可能需要约两分钟",
    effectImage: "效果图",
    downloadComparison: "下载对照图 ↓",
    generatedAlt: (style: string) => `${style}生成结果`,
    sourceMissing: "找不到原始上传文件。",
    requestFailed: (status: number) => `请求失败（${status}）`,
    generationFailed: "生成失败。",
    status: {
      queued: "等待中",
      generating: "生成中",
      success: "已完成",
      error: "失败",
      cancelled: "已取消",
    },
    dialogTitle: "安全连接 OpenAI API Key",
    dialogIntro:
      "Key 仅保存在当前服务进程的内存中；浏览器 Cookie 只保存随机会话 ID。不会写入 localStorage、普通 Cookie、日志或仓库文件，服务重启后自动清除。",
    dialogEnvironment:
      "当前已从服务端环境变量读取 API Key。页面无法查看、复制或删除该 Key。",
    dialogSession: "当前浏览器会话已连接。你可以替换或清除此临时 Key。",
    dialogMissing: "填写你的 OpenAI API Key 以启用图片生成。",
    keyField: "OpenAI API Key",
    saveKey: "安全保存到服务端内存",
    replaceKey: "替换临时 Key",
    clearKey: "清除临时 Key",
    close: "关闭",
    keySaved: "已安全保存。输入框内容已清除。",
    keyCleared: "临时 Key 已从服务端内存清除。",
    keyInvalid: "Key 格式无效，请检查后重试。",
    keyRequestFailed: "无法更新 API Key，请稍后重试。",
    keyStatusFailed: "暂时无法读取 API Key 状态。",
    footer:
      "API Key 仅存在服务端环境变量或临时内存会话中，不写入浏览器存储。",
  },
  en: {
    returnTop: "Back to top",
    language: "Interface language",
    apiKey: "API KEY",
    apiBilling: "API BILLING",
    apiBillingAria: "Open OpenAI API billing in a new tab",
    keyLoading: "Checking",
    keyMissing: "Not configured",
    keySession: "Securely connected",
    keyEnvironment: "Server configured",
    heroLead: "Let one photograph speak in",
    heroAccent: "different artistic languages",
    heroCopy:
      "Upload source images and choose curated styles. The model creates only the artwork; the original and final comparison layout are preserved and composed deterministically.",
    uploadTitle: "Upload source images",
    uploadHint: "JPEG, PNG, or WebP · up to 12 MB each",
    drag: "Drop images here",
    choose: "or click to choose, up to 12",
    rejected: (count: number) => `Ignored ${count} unsupported or oversized file(s).`,
    maxUploads: "You can upload up to 12 images at once.",
    moveEarlier: "Move earlier",
    moveLater: "Move later",
    removeImage: "Remove image",
    styleTitle: "Choose art styles",
    styleHint: "Select multiple styles; every image is processed independently in upload order",
    styleVariants: (name: string) => `${name} variants`,
    settingsTitle: "Output settings",
    settingsHint: "Standard quality suits most comparison artworks",
    quality: "Generation quality",
    low: "Draft",
    medium: "Standard",
    high: "High",
    primaryPreview: "Primary result preview",
    comparison: "Comparison",
    effectOnly: "Effect only",
    extra: "Additional direction",
    optional: "Optional · up to 1,000 characters",
    placeholder: "For example: keep the subject's red coat; make the lighting brighter…",
    calls: "generation calls",
    countSummary: (images: number, styles: number) =>
      `${images} image(s) × ${styles} style(s)`,
    cancel: "Cancel jobs",
    generate: "Start generating",
    gallery: "Output gallery",
    emptyTitle: "Your artwork will appear here",
    emptyCopy:
      "Upload images and choose styles to begin. Every comparison keeps the authentic, unstyled source image.",
    incomplete: "Generation incomplete",
    retry: "Retry this item",
    cancelledTitle: "Job cancelled",
    regenerate: "Generate again",
    waiting: "Waiting for a worker",
    drawing: "Rendering the artwork",
    duration: "Complex images may take around two minutes",
    effectImage: "Effect image",
    downloadComparison: "Download comparison ↓",
    generatedAlt: (style: string) => `${style} generated result`,
    sourceMissing: "The original upload is no longer available.",
    requestFailed: (status: number) => `Request failed (${status})`,
    generationFailed: "Generation failed.",
    status: {
      queued: "Queued",
      generating: "Generating",
      success: "Complete",
      error: "Failed",
      cancelled: "Cancelled",
    },
    dialogTitle: "Securely connect an OpenAI API key",
    dialogIntro:
      "The key stays only in this server process's memory. The browser cookie contains a random session ID—never the key. Nothing is written to localStorage, a readable cookie, logs, or the repository, and a server restart clears it.",
    dialogEnvironment:
      "An API key is already loaded from the server environment. This page cannot view, copy, or delete it.",
    dialogSession:
      "This browser session is connected. You can replace or clear the temporary key.",
    dialogMissing: "Enter your OpenAI API key to enable image generation.",
    keyField: "OpenAI API key",
    saveKey: "Save securely in server memory",
    replaceKey: "Replace temporary key",
    clearKey: "Clear temporary key",
    close: "Close",
    keySaved: "Saved securely. The input field has been cleared.",
    keyCleared: "The temporary key was cleared from server memory.",
    keyInvalid: "The key format is invalid. Check it and try again.",
    keyRequestFailed: "Unable to update the API key. Try again shortly.",
    keyStatusFailed: "Unable to read API key status right now.",
    footer:
      "API keys remain in server environment variables or temporary server-memory sessions—never browser storage.",
  },
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_UPLOADS = 12;

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function baseName(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^\p{L}\p{N}._-]+/gu, "_") || "image";
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function StyleStudio({ styles }: { styles: PublicStyle[] }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>(() => ({
    [styles[0].id]: styles[0].defaultVariant,
  }));
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [primaryOutput, setPrimaryOutput] = useState<"comparison" | "effect">(
    "comparison",
  );
  const [customInstruction, setCustomInstruction] = useState("");
  const [results, setResults] = useState<TaskResult[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>("loading");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyNotice, setApiKeyNotice] = useState("");
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const uploadsRef = useRef<UploadItem[]>([]);
  const keyDialogRef = useRef<HTMLDialogElement | null>(null);
  const copy = COPY[locale];

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/api-key", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as ApiKeyResponse;
        if (!response.ok) throw new Error("status_failed");
        setApiKeyStatus(
          payload.source === "environment"
            ? "environment"
            : payload.source === "session"
              ? "session"
              : "missing",
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiKeyStatus("missing");
        setApiKeyNotice(COPY[locale].keyStatusFailed);
      });
    return () => controller.abort();
  }, [locale]);

  useEffect(() => {
    return () => {
      uploadsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      abortRef.current?.abort();
    };
  }, []);

  const selectedStyles = useMemo(
    () => styles.filter((style) => selection[style.id]),
    [selection, styles],
  );
  const callCount = uploads.length * selectedStyles.length;
  const completedCount = results.filter(
    (item) => item.status === "success" || item.status === "error",
  ).length;

  const localizedStyleName = useCallback(
    (style: PublicStyle) => (locale === "en" ? style.nameEn : style.name),
    [locale],
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      const valid = incoming.filter(
        (file) => ACCEPTED_TYPES.has(file.type) && file.size <= MAX_FILE_BYTES,
      );
      const rejected = incoming.length - valid.length;
      setNotice(rejected ? copy.rejected(rejected) : "");
      setUploads((current) => {
        const remaining = Math.max(0, MAX_UPLOADS - current.length);
        const additions = valid.slice(0, remaining).map((file) => ({
          id: makeId(),
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        if (valid.length > remaining) setNotice(copy.maxUploads);
        return [...current, ...additions];
      });
    },
    [copy],
  );

  function openKeyDialog() {
    setApiKeyNotice("");
    keyDialogRef.current?.showModal();
  }

  async function saveApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (apiKeyBusy) return;
    setApiKeyBusy(true);
    setApiKeyNotice("");
    try {
      const response = await fetch("/api/api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        cache: "no-store",
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      const payload = (await response.json()) as ApiKeyResponse;
      if (!response.ok) {
        setApiKeyNotice(
          payload.error?.code === "invalid_api_key"
            ? copy.keyInvalid
            : copy.keyRequestFailed,
        );
        return;
      }
      setApiKeyInput("");
      setApiKeyStatus("session");
      setApiKeyNotice(copy.keySaved);
    } catch {
      setApiKeyNotice(copy.keyRequestFailed);
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function clearApiKey() {
    if (apiKeyBusy) return;
    setApiKeyBusy(true);
    setApiKeyNotice("");
    try {
      const response = await fetch("/api/api-key", {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("clear_failed");
      const payload = (await response.json()) as ApiKeyResponse;
      setApiKeyStatus(payload.source === "environment" ? "environment" : "missing");
      setApiKeyInput("");
      setApiKeyNotice(copy.keyCleared);
    } catch {
      setApiKeyNotice(copy.keyRequestFailed);
    } finally {
      setApiKeyBusy(false);
    }
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeUpload(id: string) {
    setUploads((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function moveUpload(index: number, direction: -1 | 1) {
    setUploads((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function toggleStyle(style: PublicStyle) {
    setSelection((current) => {
      const next = { ...current };
      if (next[style.id]) delete next[style.id];
      else next[style.id] = style.defaultVariant;
      return next;
    });
  }

  function updateVariant(styleId: string, variantId: string) {
    setSelection((current) => ({ ...current, [styleId]: variantId }));
  }

  function updateTask(id: string, patch: Partial<TaskResult>) {
    setResults((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function executeTask(task: TaskResult, signal: AbortSignal) {
    const source = uploadsRef.current.find((item) => item.id === task.sourceId);
    if (!source) {
      updateTask(task.id, { status: "error", error: copy.sourceMissing });
      return;
    }

    updateTask(task.id, { status: "generating", error: undefined });
    const formData = new FormData();
    formData.set("image", source.file);
    formData.set("styleId", task.styleId);
    formData.set("variantId", task.variantId);
    formData.set("quality", quality);
    formData.set("customInstruction", customInstruction.trim());

    try {
      const response = await fetch(`/api/generate?locale=${locale}`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: formData,
        signal,
      });
      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok) {
        if (payload.error?.code === "api_key_missing") {
          setApiKeyStatus("missing");
          openKeyDialog();
        }
        throw new Error(payload.error?.message || copy.requestFailed(response.status));
      }
      updateTask(task.id, {
        status: "success",
        effectDataUrl: payload.effectDataUrl,
        comparisonDataUrl: payload.comparisonDataUrl,
        outputSuffix: payload.style.outputSuffix,
        size: payload.size,
      });
    } catch (error) {
      if (signal.aborted) {
        updateTask(task.id, { status: "cancelled", error: undefined });
        return;
      }
      updateTask(task.id, {
        status: "error",
        error: error instanceof Error ? error.message : copy.generationFailed,
      });
    }
  }

  function buildTasks(): TaskResult[] {
    return uploads.flatMap((source) =>
      selectedStyles.map((style) => {
        const variantId = selection[style.id] || style.defaultVariant;
        const variant = style.variants.find((item) => item.id === variantId);
        return {
          id: `${source.id}:${style.id}`,
          sourceId: source.id,
          sourceName: source.file.name,
          sourcePreviewUrl: source.previewUrl,
          styleId: style.id,
          styleName: style.name,
          styleNameEn: style.nameEn,
          variantId,
          variantLabel: variant?.label ?? variantId,
          variantLabelEn: variant?.labelEn ?? variantId,
          status: "queued" as const,
        };
      }),
    );
  }

  async function generateAll() {
    if (!uploads.length || !selectedStyles.length || running) return;
    if (apiKeyStatus === "missing") {
      openKeyDialog();
      return;
    }
    const tasks = buildTasks();
    const controller = new AbortController();
    abortRef.current = controller;
    setResults(tasks);
    setRunning(true);
    setNotice("");

    let cursor = 0;
    const worker = async () => {
      while (!controller.signal.aborted) {
        const task = tasks[cursor];
        cursor += 1;
        if (!task) break;
        await executeTask(task, controller.signal);
      }
    };

    await Promise.all([worker(), worker()]);
    setRunning(false);
    abortRef.current = null;
  }

  async function retryTask(task: TaskResult) {
    if (running) return;
    if (apiKeyStatus === "missing") {
      openKeyDialog();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    await executeTask(task, controller.signal);
    setRunning(false);
    abortRef.current = null;
  }

  function cancelGeneration() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const apiKeyStatusLabel =
    apiKeyStatus === "loading"
      ? copy.keyLoading
      : apiKeyStatus === "environment"
        ? copy.keyEnvironment
        : apiKeyStatus === "session"
          ? copy.keySession
          : copy.keyMissing;

  return (
    <main className="studio-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label={copy.returnTop}>
          <span className="brand-mark">艺</span>
          <span>
            <strong>风格画室</strong>
            <small>VISUAL STYLE ATELIER</small>
          </span>
        </a>
        <div className="header-actions">
          <div className="locale-toggle" role="group" aria-label={copy.language}>
            <button
              type="button"
              className={locale === "zh" ? "active" : ""}
              onClick={() => setLocale("zh")}
              aria-pressed={locale === "zh"}
            >
              中文
            </button>
            <button
              type="button"
              className={locale === "en" ? "active" : ""}
              onClick={() => setLocale("en")}
              aria-pressed={locale === "en"}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            className={`api-key-button ${apiKeyStatus}`}
            onClick={openKeyDialog}
          >
            <span />
            <b>{copy.apiKey}</b>
            <small>{apiKeyStatusLabel}</small>
          </button>
          <a
            className="billing-link"
            href="https://platform.openai.com/settings/organization/billing/overview"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.apiBillingAria}
          >
            <span aria-hidden="true">$</span>
            {copy.apiBilling}
            <b aria-hidden="true">↗</b>
          </a>
          <div className="header-badge">
            <span className="live-dot" />
            GPT-IMAGE-2
          </div>
        </div>
      </header>

      <dialog
        className="api-key-dialog"
        ref={keyDialogRef}
        aria-labelledby="api-key-dialog-title"
        onClose={() => {
          setApiKeyInput("");
          setApiKeyNotice("");
        }}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">SERVER-MEMORY SESSION</p>
            <h2 id="api-key-dialog-title">{copy.dialogTitle}</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={() => keyDialogRef.current?.close()}
            aria-label={copy.close}
          >
            ×
          </button>
        </div>
        <p className="dialog-security-copy">{copy.dialogIntro}</p>
        <div className={`key-status-card ${apiKeyStatus}`}>
          <span />
          <div>
            <strong>{apiKeyStatusLabel}</strong>
            <p>
              {apiKeyStatus === "environment"
                ? copy.dialogEnvironment
                : apiKeyStatus === "session"
                  ? copy.dialogSession
                  : copy.dialogMissing}
            </p>
          </div>
        </div>
        {apiKeyStatus !== "environment" ? (
          <form className="api-key-form" onSubmit={saveApiKey}>
            <label>
              <span>{copy.keyField}</span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                minLength={20}
                maxLength={512}
                placeholder="sk-…"
                required
              />
            </label>
            <div className="dialog-actions">
              {apiKeyStatus === "session" ? (
                <button
                  type="button"
                  className="secondary-action danger"
                  onClick={clearApiKey}
                  disabled={apiKeyBusy}
                >
                  {copy.clearKey}
                </button>
              ) : null}
              <button
                type="submit"
                className="primary-action"
                disabled={apiKeyBusy || apiKeyInput.length < 20}
              >
                {apiKeyStatus === "session" ? copy.replaceKey : copy.saveKey}
              </button>
            </div>
          </form>
        ) : null}
        {apiKeyNotice ? <p className="key-notice" role="status">{apiKeyNotice}</p> : null}
      </dialog>

      <section className="hero" id="top">
        <p className="eyebrow">CURATED IMAGE TRANSFORMATION</p>
        <h1>
          {copy.heroLead}
          <em>{copy.heroAccent}</em>
        </h1>
        <p className="hero-copy">{copy.heroCopy}</p>
        <div className="hero-rule" />
      </section>

      <div className="workspace-grid">
        <section className="control-column">
          <div className="panel" aria-labelledby="upload-title">
            <div className="panel-heading">
              <span className="step-index">01</span>
              <div>
                <h2 id="upload-title">{copy.uploadTitle}</h2>
                <p>{copy.uploadHint}</p>
              </div>
            </div>

            <label
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onFileInput}
              />
              <span className="upload-symbol">＋</span>
              <strong>{copy.drag}</strong>
              <span>{copy.choose}</span>
            </label>

            {notice ? <p className="notice">{notice}</p> : null}

            {uploads.length ? (
              <ol className="upload-list">
                {uploads.map((item, index) => (
                  <li key={item.id}>
                    <span className="upload-order">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <img src={item.previewUrl} alt="" />
                    <span className="upload-name" title={item.file.name}>
                      {item.file.name}
                      <small>{(item.file.size / 1024 / 1024).toFixed(1)} MB</small>
                    </span>
                    <span className="row-actions">
                      <button
                        type="button"
                        onClick={() => moveUpload(index, -1)}
                        disabled={index === 0 || running}
                        aria-label={copy.moveEarlier}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveUpload(index, 1)}
                        disabled={index === uploads.length - 1 || running}
                        aria-label={copy.moveLater}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUpload(item.id)}
                        disabled={running}
                        aria-label={copy.removeImage}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          <div className="panel" aria-labelledby="style-title">
            <div className="panel-heading">
              <span className="step-index">02</span>
              <div>
                <h2 id="style-title">{copy.styleTitle}</h2>
                <p>{copy.styleHint}</p>
              </div>
            </div>

            <div className="style-grid">
              {styles.map((style) => {
                const selected = Boolean(selection[style.id]);
                const styleName = localizedStyleName(style);
                return (
                  <article
                    className={`style-card style-${style.id}${selected ? " selected" : ""}`}
                    key={style.id}
                  >
                    <button
                      type="button"
                      className="style-select"
                      onClick={() => toggleStyle(style)}
                      aria-pressed={selected}
                    >
                      <span className="style-swatch">
                        <i />
                        <b>{selected ? "✓" : ""}</b>
                      </span>
                      <span className="style-card-copy">
                        <strong>{styleName}</strong>
                        <small>
                          {locale === "en" ? style.descriptionEn : style.description}
                        </small>
                      </span>
                    </button>
                    {selected && style.variants.length > 1 ? (
                      <div
                        className="variant-row"
                        aria-label={copy.styleVariants(styleName)}
                      >
                        {style.variants.map((variant) => (
                          <button
                            type="button"
                            key={variant.id}
                            className={
                              selection[style.id] === variant.id ? "active" : ""
                            }
                            onClick={() => updateVariant(style.id, variant.id)}
                          >
                            {locale === "en" ? variant.labelEn : variant.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="panel" aria-labelledby="settings-title">
            <div className="panel-heading">
              <span className="step-index">03</span>
              <div>
                <h2 id="settings-title">{copy.settingsTitle}</h2>
                <p>{copy.settingsHint}</p>
              </div>
            </div>

            <div className="settings-grid">
              <fieldset>
                <legend>{copy.quality}</legend>
                <div className="segmented-control">
                  {(["low", "medium", "high"] as ImageQuality[]).map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={quality === value ? "active" : ""}
                      onClick={() => setQuality(value)}
                    >
                      {copy[value]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>{copy.primaryPreview}</legend>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={primaryOutput === "comparison" ? "active" : ""}
                    onClick={() => setPrimaryOutput("comparison")}
                  >
                    {copy.comparison}
                  </button>
                  <button
                    type="button"
                    className={primaryOutput === "effect" ? "active" : ""}
                    onClick={() => setPrimaryOutput("effect")}
                  >
                    {copy.effectOnly}
                  </button>
                </div>
              </fieldset>
            </div>

            <label className="instruction-field">
              <span>
                {copy.extra} <small>{copy.optional}</small>
              </span>
              <textarea
                value={customInstruction}
                maxLength={1000}
                onChange={(event) => setCustomInstruction(event.target.value)}
                placeholder={copy.placeholder}
              />
            </label>

            <div className="run-bar">
              <div>
                <strong>{callCount}</strong>
                <span>{copy.calls}</span>
                <small>{copy.countSummary(uploads.length, selectedStyles.length)}</small>
              </div>
              {running ? (
                <button type="button" className="cancel-button" onClick={cancelGeneration}>
                  {copy.cancel}
                </button>
              ) : (
                <button
                  type="button"
                  className="generate-button"
                  disabled={
                    !uploads.length ||
                    !selectedStyles.length ||
                    apiKeyStatus === "loading"
                  }
                  onClick={generateAll}
                >
                  {copy.generate} <span>→</span>
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="result-column" aria-labelledby="result-title">
          <div className="result-heading">
            <div>
              <p className="eyebrow">OUTPUT GALLERY</p>
              <h2 id="result-title">{copy.gallery}</h2>
            </div>
            {results.length ? <span>{completedCount}/{results.length}</span> : null}
          </div>

          {!results.length ? (
            <div className="empty-gallery">
              <span>◇</span>
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyCopy}</p>
            </div>
          ) : (
            <div className="result-list">
              {results.map((task, index) => {
                const primaryImage =
                  primaryOutput === "effect"
                    ? task.effectDataUrl
                    : task.comparisonDataUrl;
                const styleName = locale === "en" ? task.styleNameEn : task.styleName;
                const variantLabel =
                  locale === "en" ? task.variantLabelEn : task.variantLabel;
                return (
                  <article className={`result-card ${task.status}`} key={task.id}>
                    <header>
                      <span className="result-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{styleName}</strong>
                        <small>{task.sourceName} · {variantLabel}</small>
                      </span>
                      <b>{copy.status[task.status]}</b>
                    </header>

                    <div className="result-frame">
                      {task.status === "success" && primaryImage ? (
                        <img src={primaryImage} alt={copy.generatedAlt(styleName)} />
                      ) : task.status === "error" ? (
                        <div className="result-error">
                          <strong>{copy.incomplete}</strong>
                          <p>{task.error}</p>
                          <button type="button" onClick={() => retryTask(task)}>
                            {copy.retry}
                          </button>
                        </div>
                      ) : task.status === "cancelled" ? (
                        <div className="result-error">
                          <strong>{copy.cancelledTitle}</strong>
                          <button type="button" onClick={() => retryTask(task)}>
                            {copy.regenerate}
                          </button>
                        </div>
                      ) : (
                        <div className="generating-state">
                          <span />
                          <p>{task.status === "queued" ? copy.waiting : copy.drawing}</p>
                          <small>{copy.duration}</small>
                        </div>
                      )}
                    </div>

                    {task.status === "success" ? (
                      <footer>
                        <span>{task.size} · PNG</span>
                        <div>
                          {task.effectDataUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                downloadDataUrl(
                                  task.effectDataUrl!,
                                  `${baseName(task.sourceName)}_${task.styleId}_effect.png`,
                                )
                              }
                            >
                              {copy.effectImage}
                            </button>
                          ) : null}
                          {task.comparisonDataUrl ? (
                            <button
                              type="button"
                              className="primary-download"
                              onClick={() =>
                                downloadDataUrl(
                                  task.comparisonDataUrl!,
                                  `${baseName(task.sourceName)}_${task.outputSuffix}.png`,
                                )
                              }
                            >
                              {copy.downloadComparison}
                            </button>
                          ) : null}
                        </div>
                      </footer>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <footer className="site-footer">
        <span>VISUAL STYLE SKILLS · 2026</span>
        <p>{copy.footer}</p>
      </footer>
    </main>
  );
}
