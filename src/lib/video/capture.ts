import { ближайшаяЧастота } from "@/lib/video/containerFps";
import { uid } from "@/lib/format";
import type { FrameShot } from "@/lib/types";

type SeekableVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

export const IMAGE_FORMATS = [
  { id: "image/png", ext: "png", label: "PNG", lossless: true },
  { id: "image/jpeg", ext: "jpg", label: "JPEG", lossless: false },
  { id: "image/webp", ext: "webp", label: "WebP", lossless: false },
] as const;

export type ImageFormatId = (typeof IMAGE_FORMATS)[number]["id"];

export function formatExt(id: string): string {
  return IMAGE_FORMATS.find((f) => f.id === id)?.ext ?? "png";
}

export async function loadVideo(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.crossOrigin = "anonymous";
  video.src = src;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(
        new Error(
          "Браузер не смог декодировать это видео. Попробуйте MP4 (H.264) или WebM.",
        ),
      );
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    video.load();
  });

  return video;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать кадр"));
    reader.readAsDataURL(blob);
  });
}

export async function attachSource(
  video: HTMLVideoElement,
  src: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const ok = () => {
      video.removeEventListener("loadeddata", ok);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener("loadeddata", ok);
      video.removeEventListener("error", fail);
      reject(
        new Error(
          "Браузер не смог декодировать видео. Поддерживаются MP4 (H.264), WebM (VP8/VP9) и MOV.",
        ),
      );
    };
    video.addEventListener("loadeddata", ok);
    video.addEventListener("error", fail);
    video.src = src;
    video.load();
  });
}

/*  Запасной замер частоты, когда в файле её не прочесть (редкий кодек,
    фрагментированный MP4). Считаем по ВРЕМЕНИ ВИДЕО: сколько новых кадров
    показано за сколько секунд ролика. Прежний способ делил кадры на
    секунды настоящего времени — фоновая вкладка или тормоза декодера
    давали 48 к/с там, где в файле 24.                                */
export async function probeFps(
  video: HTMLVideoElement,
  budgetMs = 900,
): Promise<{ fps: number; detected: boolean }> {
  const fallback = { fps: 30, detected: false };
  type FrameMeta = { mediaTime: number; presentedFrames: number };
  const withCallback = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: FrameMeta) => void) => number;
  };
  if (!withCallback.requestVideoFrameCallback) return fallback;
  try {
    const samples: FrameMeta[] = [];
    video.currentTime = 0;
    video.muted = true;
    await video.play();
    await new Promise<void>((resolve) => {
      const stopAt = performance.now() + budgetMs;
      const tick = (_now: number, meta: FrameMeta) => {
        samples.push({ mediaTime: meta.mediaTime, presentedFrames: meta.presentedFrames });
        if (performance.now() < stopAt && samples.length < 240) withCallback.requestVideoFrameCallback!(tick);
        else resolve();
      };
      withCallback.requestVideoFrameCallback!(tick);
      setTimeout(resolve, budgetMs + 400);
    });
    video.pause();
    // Разница между соседними кадрами по времени ролика; берём медиану —
    // пропущенные при отрисовке кадры её не сдвигают.
    const steps: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const dt = samples[i].mediaTime - samples[i - 1].mediaTime;
      const df = samples[i].presentedFrames - samples[i - 1].presentedFrames;
      if (dt > 0 && df === 1) steps.push(dt);
    }
    if (steps.length >= 3) {
      steps.sort((x, y) => x - y);
      const median = steps[Math.floor(steps.length / 2)];
      return { fps: snapFps(1 / median), detected: true };
    }
  } catch {
    /* ignore, use fallback */
  }
  try {
    video.pause();
    video.currentTime = 0;
  } catch {
    /* noop */
  }
  return fallback;
}

// Список реальных частот — один на весь проект, в containerFps.
function snapFps(raw: number): number {
  return ближайшаяЧастота(raw) ?? 30;
}

export function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = Math.max(0, Math.min(time, Math.max(0, duration - 0.02)));
  const v = video as SeekableVideo;

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      clearTimeout(timer);
      // Вкладка скрыта — браузер не рисует кадры и тормозит таймеры до
      // секунды и дольше; ожидание отрисовки растягивало съёмку на минуты.
      // После seeked кадр уже декодирован, его можно снимать сразу.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        resolve();
        return;
      }
      // Give the decoder one paint tick so the canvas isn't stale, but never
      // wait forever: on a paused element the frame callback may not fire.
      let painted = false;
      const done = () => {
        if (painted) return;
        painted = true;
        clearTimeout(safety);
        resolve();
      };
      const safety = setTimeout(done, 140);
      if (v.requestVideoFrameCallback) {
        try {
          v.requestVideoFrameCallback(() => done());
          return;
        } catch {
          /* fall back to rAF */
        }
      }
      requestAnimationFrame(() => done());
    };
    const timer = setTimeout(finish, 3500);
    video.addEventListener("seeked", finish);
    if (Math.abs(video.currentTime - target) < 0.0005) {
      finish();
      return;
    }
    video.currentTime = target;
  });
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

export function drawVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("Canvas 2D context недоступен");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality = 0.94,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Не удалось сохранить кадр в ${type}`));
      },
      type,
      type === "image/png" ? undefined : quality,
    );
  });
}

export async function grabFrame(
  video: HTMLVideoElement,
  time: number,
  format: ImageFormatId = "image/png",
  quality = 0.94,
  maxWidth?: number,
): Promise<FrameShot> {
  await seekVideo(video, time);
  let w = video.videoWidth || 1280;
  let h = video.videoHeight || 720;
  if (maxWidth && w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }
  const canvas = makeCanvas(w, h);
  drawVideo(video, canvas);
  const blob = await canvasToBlob(canvas, format, quality);
  return {
    id: uid("fr"),
    time,
    url: URL.createObjectURL(blob),
    blob,
    width: w,
    height: h,
    bytes: blob.size,
    format,
    source: "manual",
  };
}

export async function extractFrames(
  video: HTMLVideoElement,
  times: number[],
  opts: {
    format: ImageFormatId;
    quality?: number;
    maxWidth?: number;
    source?: FrameShot["source"];
  },
  onProgress?: (done: number, total: number, time: number) => void,
): Promise<FrameShot[]> {
  const shots: FrameShot[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const shot = await grabFrame(
      video,
      times[i],
      opts.format,
      opts.quality ?? 0.94,
      opts.maxWidth,
    );
    shot.source = opts.source ?? "auto";
    shots.push(shot);
    onProgress?.(i + 1, times.length, times[i]);
  }
  return shots;
}

export function evenTimes(duration: number, count: number): number[] {
  if (duration <= 0) return [];
  if (count <= 1) return [duration / 2];
  const step = duration / count;
  return Array.from({ length: count }, (_, i) =>
    Math.min(duration - 0.02, step * i + step / 2),
  );
}

export function sceneTimes(
  scenes: Array<{ start: number; end: number; keyframe: number }>,
): number[] {
  return scenes.map((s) => s.keyframe);
}

export async function buildContactSheet(
  shots: FrameShot[],
  opts: { columns: number; labelColor?: string; title?: string },
): Promise<Blob> {
  if (!shots.length) throw new Error("Нет кадров для контактного листа");
  const first = await loadImage(shots[0].url);
  const thumbW = 320;
  const thumbH = Math.max(1, Math.round((first.height * thumbW) / first.width));
  const pad = 10;
  const labelH = 26;
  const cols = Math.max(1, Math.min(opts.columns, shots.length));
  const rows = Math.ceil(shots.length / cols);
  const headerH = opts.title ? 54 : 0;

  const canvas = makeCanvas(
    cols * thumbW + pad * (cols + 1),
    headerH + rows * (thumbH + labelH + pad) + pad,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context недоступен");
  ctx.fillStyle = "#0b0b10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (opts.title) {
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "600 24px 'JetBrains Mono', monospace";
    ctx.fillText(opts.title, pad + 4, 36);
  }

  for (let i = 0; i < shots.length; i += 1) {
    const img = await loadImage(shots[i].url);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (thumbW + pad);
    const y = headerH + pad + row * (thumbH + labelH + pad);
    ctx.drawImage(img, x, y, thumbW, thumbH);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, thumbW - 1, thumbH - 1);
    ctx.fillStyle = opts.labelColor ?? "#ff6a2b";
    ctx.font = "500 14px 'JetBrains Mono', monospace";
    ctx.fillText(
      `${String(i + 1).padStart(3, "0")}  ${shots[i].time.toFixed(2)}s`,
      x + 2,
      y + thumbH + 18,
    );
  }

  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось загрузить изображение кадра"));
    img.src = src;
  });
}

export async function recordClip(
  video: HTMLVideoElement,
  start: number,
  end: number,
  fps = 30,
): Promise<Blob> {
  if (end <= start) throw new Error("Конец отрезка должен быть позже начала");
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const scale = w > 1280 ? 1280 / w : 1;
  const canvas = makeCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context недоступен");

  const stream = canvas.captureStream(fps);
  const v = video as SeekableVideo;
  const srcStream = v.captureStream?.() ?? v.mozCaptureStream?.();
  if (srcStream) {
    for (const track of srcStream.getAudioTracks()) stream.addTrack(track);
  }

  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType =
    typeof MediaRecorder !== "undefined"
      ? (mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "")
      : "";
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder не поддерживается этим браузером");
  }

  await seekVideo(video, start);
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
    recorder.onerror = () => reject(new Error("Ошибка записи клипа"));
  });

  let raf = 0;
  const guard = setTimeout(() => {
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      /* noop */
    }
  }, (end - start) * 1000 + 4000);

  recorder.start(120);
  await video.play();

  const tick = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (video.currentTime >= end || video.ended) {
      cancelAnimationFrame(raf);
      clearTimeout(guard);
      video.pause();
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* noop */
      }
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return done;
}

export function revokeShots(shots: FrameShot[]) {
  for (const s of shots) {
    try {
      URL.revokeObjectURL(s.url);
    } catch {
      /* noop */
    }
  }
}

export async function shotsToZip(
  shots: FrameShot[],
  baseName: string,
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const ext = formatExt(shots[0]?.format ?? "image/png");
  shots.forEach((shot, i) => {
    const stamp = shot.time.toFixed(3).replace(".", "-");
    zip.file(`${baseName}_frame-${String(i + 1).padStart(3, "0")}_${stamp}s.${ext}`, shot.blob);
  });
  const manifest = shots
    .map(
      (s, i) =>
        `${String(i + 1).padStart(3, "0")}\t${s.time.toFixed(3)}s\t${s.width}x${s.height}\t${s.bytes} bytes\t${s.source}`,
    )
    .join("\n");
  zip.file(
    "manifest.tsv",
    `index\ttime\tsize\tbytes\tsource\n${manifest}\n`,
  );
  return zip.generateAsync({ type: "blob" });
}
