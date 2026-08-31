"use client";

import type {
  ImageQuality,
  PublicStyle,
} from "@visual-style/style-registry";
import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  variantId: string;
  variantLabel: string;
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
  error?: { message?: string };
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

function taskLabel(status: TaskStatus) {
  switch (status) {
    case "queued":
      return "等待中";
    case "generating":
      return "生成中";
    case "success":
      return "已完成";
    case "error":
      return "失败";
    case "cancelled":
      return "已取消";
  }
}

export function StyleStudio({ styles }: { styles: PublicStyle[] }) {
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
  const abortRef = useRef<AbortController | null>(null);
  const uploadsRef = useRef<UploadItem[]>([]);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

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

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter(
      (file) => ACCEPTED_TYPES.has(file.type) && file.size <= MAX_FILE_BYTES,
    );
    const rejected = incoming.length - valid.length;
    setNotice(
      rejected
        ? `已忽略 ${rejected} 个不支持或超过 12 MB 的文件。`
        : "",
    );
    setUploads((current) => {
      const remaining = Math.max(0, MAX_UPLOADS - current.length);
      const additions = valid.slice(0, remaining).map((file) => ({
        id: makeId(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      if (valid.length > remaining) {
        setNotice(`单次最多上传 ${MAX_UPLOADS} 张图片。`);
      }
      return [...current, ...additions];
    });
  }, []);

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
      if (next[style.id]) {
        delete next[style.id];
      } else {
        next[style.id] = style.defaultVariant;
      }
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
      updateTask(task.id, { status: "error", error: "找不到原始上传文件。" });
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
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
        signal,
      });
      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok) {
        throw new Error(payload.error?.message || `请求失败（${response.status}）`);
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
        error: error instanceof Error ? error.message : "生成失败。",
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
          variantId,
          variantLabel: variant?.label ?? variantId,
          status: "queued" as const,
        };
      }),
    );
  }

  async function generateAll() {
    if (!uploads.length || !selectedStyles.length || running) return;
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

  return (
    <main className="studio-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回顶部">
          <span className="brand-mark">艺</span>
          <span>
            <strong>风格画室</strong>
            <small>VISUAL STYLE ATELIER</small>
          </span>
        </a>
        <div className="header-badge">
          <span className="live-dot" />
          GPT-IMAGE-2
        </div>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">CURATED IMAGE TRANSFORMATION</p>
        <h1>
          让一张照片，进入
          <em>七种艺术语言</em>
        </h1>
        <p className="hero-copy">
          上传原图，选择预置风格。模型只生成艺术效果，原图与最终对照版式由程序确定性保留和拼合。
        </p>
        <div className="hero-rule" />
      </section>

      <div className="workspace-grid">
        <section className="control-column">
          <div className="panel" aria-labelledby="upload-title">
            <div className="panel-heading">
              <span className="step-index">01</span>
              <div>
                <h2 id="upload-title">上传原图</h2>
                <p>JPEG、PNG 或 WebP，单张不超过 12 MB</p>
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
              <strong>拖拽图片到这里</strong>
              <span>或点击选择，最多 {MAX_UPLOADS} 张</span>
            </label>

            {notice ? <p className="notice">{notice}</p> : null}

            {uploads.length ? (
              <ol className="upload-list">
                {uploads.map((item, index) => (
                  <li key={item.id}>
                    <span className="upload-order">{String(index + 1).padStart(2, "0")}</span>
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
                        aria-label="向前移动"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveUpload(index, 1)}
                        disabled={index === uploads.length - 1 || running}
                        aria-label="向后移动"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUpload(item.id)}
                        disabled={running}
                        aria-label="移除图片"
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
                <h2 id="style-title">选择艺术风格</h2>
                <p>可多选；每张图片会按上传顺序独立处理</p>
              </div>
            </div>

            <div className="style-grid">
              {styles.map((style) => {
                const selected = Boolean(selection[style.id]);
                return (
                  <article
                    className={`style-card${selected ? " selected" : ""}`}
                    key={style.id}
                    style={
                      {
                        "--accent-a": style.accent[0],
                        "--accent-b": style.accent[1],
                      } as CSSProperties
                    }
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
                        <strong>{style.name}</strong>
                        <small>{style.description}</small>
                      </span>
                    </button>
                    {selected && style.variants.length > 1 ? (
                      <div className="variant-row" aria-label={`${style.name}变体`}>
                        {style.variants.map((variant) => (
                          <button
                            type="button"
                            key={variant.id}
                            className={
                              selection[style.id] === variant.id ? "active" : ""
                            }
                            onClick={() => updateVariant(style.id, variant.id)}
                          >
                            {variant.label}
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
                <h2 id="settings-title">成品设置</h2>
                <p>标准画质适合多数对照成品</p>
              </div>
            </div>

            <div className="settings-grid">
              <fieldset>
                <legend>生成画质</legend>
                <div className="segmented-control">
                  {(["low", "medium", "high"] as ImageQuality[]).map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={quality === value ? "active" : ""}
                      onClick={() => setQuality(value)}
                    >
                      {value === "low" ? "草稿" : value === "medium" ? "标准" : "高清"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>结果页主预览</legend>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={primaryOutput === "comparison" ? "active" : ""}
                    onClick={() => setPrimaryOutput("comparison")}
                  >
                    对照成品
                  </button>
                  <button
                    type="button"
                    className={primaryOutput === "effect" ? "active" : ""}
                    onClick={() => setPrimaryOutput("effect")}
                  >
                    仅效果图
                  </button>
                </div>
              </fieldset>
            </div>

            <label className="instruction-field">
              <span>附加要求 <small>可选，最多 1000 字</small></span>
              <textarea
                value={customInstruction}
                maxLength={1000}
                onChange={(event) => setCustomInstruction(event.target.value)}
                placeholder="例如：保留人物红色外套；整体光线更明亮……"
              />
            </label>

            <div className="run-bar">
              <div>
                <strong>{callCount}</strong>
                <span>次生成调用</span>
                <small>
                  {uploads.length} 张图片 × {selectedStyles.length} 种风格
                </small>
              </div>
              {running ? (
                <button type="button" className="cancel-button" onClick={cancelGeneration}>
                  取消任务
                </button>
              ) : (
                <button
                  type="button"
                  className="generate-button"
                  disabled={!uploads.length || !selectedStyles.length}
                  onClick={generateAll}
                >
                  开始生成 <span>→</span>
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="result-column" aria-labelledby="result-title">
          <div className="result-heading">
            <div>
              <p className="eyebrow">OUTPUT GALLERY</p>
              <h2 id="result-title">输出画廊</h2>
            </div>
            {results.length ? (
              <span>{completedCount}/{results.length}</span>
            ) : null}
          </div>

          {!results.length ? (
            <div className="empty-gallery">
              <span>◇</span>
              <strong>成品将在这里出现</strong>
              <p>上传图片并选择风格后开始生成。默认输出包含未经风格化的真实原图。</p>
            </div>
          ) : (
            <div className="result-list">
              {results.map((task, index) => {
                const primaryImage =
                  primaryOutput === "effect"
                    ? task.effectDataUrl
                    : task.comparisonDataUrl;
                return (
                  <article className={`result-card ${task.status}`} key={task.id}>
                    <header>
                      <span className="result-number">{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        <strong>{task.styleName}</strong>
                        <small>{task.sourceName} · {task.variantLabel}</small>
                      </span>
                      <b>{taskLabel(task.status)}</b>
                    </header>

                    <div className="result-frame">
                      {task.status === "success" && primaryImage ? (
                        <img src={primaryImage} alt={`${task.styleName}生成结果`} />
                      ) : task.status === "error" ? (
                        <div className="result-error">
                          <strong>生成未完成</strong>
                          <p>{task.error}</p>
                          <button type="button" onClick={() => retryTask(task)}>
                            重试当前项
                          </button>
                        </div>
                      ) : task.status === "cancelled" ? (
                        <div className="result-error">
                          <strong>任务已取消</strong>
                          <button type="button" onClick={() => retryTask(task)}>
                            重新生成
                          </button>
                        </div>
                      ) : (
                        <div className="generating-state">
                          <span />
                          <p>{task.status === "queued" ? "等待生成资源" : "正在绘制效果图"}</p>
                          <small>复杂图像可能需要约两分钟</small>
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
                              效果图
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
                              下载对照图 ↓
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
        <p>API 密钥仅保存在服务端环境变量中，不会发送到浏览器。</p>
      </footer>
    </main>
  );
}
