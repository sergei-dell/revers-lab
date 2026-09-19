"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Dropzone } from "@/components/Dropzone";
import { FrameBoard, type ExtractMode } from "@/components/FrameBoard";
import { HistoryPanel } from "@/components/HistoryPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import { PromptPanel, type ApplyMode, type EnrichAnswer, type EnrichState, type SaveState } from "@/components/PromptPanel";
import { VideoStage, type ClipRange } from "@/components/VideoStage";
import {
  IconAlert,
  IconFilm,
  IconHistory,
  IconSpark,
  IconUpload,
  IconWave,
} from "@/components/icons";
import { ToastStack, type Toast } from "@/components/ui";
import {
  aspectLabel,
  clamp,
  copyText,
  downloadBlob,
  formatBytes,
  formatTime,
  mergeTags,
  slugify,
  uid,
} from "@/lib/format";
import { buildPrompt, measurementLines, metricReadouts, type StylePreset } from "@/lib/prompt";
import {
  DEFAULT_ENRICH_FRAMES,
  ENRICH_FRAME_OPTIONS,
  type EnrichFrameCount,
  type FrameLimitInfo,
} from "@/lib/enrichOptions";
import { readHistory, writeHistory } from "@/lib/localHistory";
import { createChoiceStore, useChoice } from "@/lib/prefs";
import { STATIC_BUILD } from "@/lib/staticMode";
import { analysisFromRow, toStoredMetrics } from "@/lib/store";
import type {
  Analysis,
  FrameShot,
  HistoryItem,
  PromptBundle,
  VideoMeta,
} from "@/lib/types";
import {
  attachSource,
  blobToDataUrl,
  buildContactSheet,
  evenTimes,
  extractFrames,
  formatExt,
  grabFrame,
  probeFps,
  recordClip,
  revokeShots,
  sceneTimes,
  shotsToZip,
  type ImageFormatId,
} from "@/lib/video/capture";
import { analyzeVideo, CAMERA_LABELS } from "@/lib/video/analyze";
import { readContainerFps } from "@/lib/video/containerFps";

type Phase = "idle" | "decoding" | "probing" | "analyzing" | "ready";

// Заголовок блока замеров: по нему же окно промпта находит, куда прокрутить.
const MEASURED_HEAD = "— измерено движком:";

// Последний выбранный режим заполнения промпта живёт в памяти браузера.
const APPLY_MODE_KEY = "revers-lab.apply-mode.v1";
const applyModeStore = createChoiceStore<ApplyMode>(APPLY_MODE_KEY, ["model", "both", "metrics"], "model");

// Сколько кадров уходит модели — тоже помнится между заходами.
const frameCountStore = createChoiceStore<EnrichFrameCount>(
  "revers-lab.enrich-frames.v1",
  ENRICH_FRAME_OPTIONS,
  DEFAULT_ENRICH_FRAMES,
);

// Равномерно по списку: первый, последний и поровну между ними.
function spreadEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  if (count <= 1) return [items[Math.floor(items.length / 2)]];
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]);
}

/*  Флаги --ar и --duration стоят в конце промпта измерений. Если ответ
    модели их не содержит, дописываем ту же строку к нему.           */
function withFlags(text: string, localPrompt: string): string {
  if (/--ar\b/.test(text) && /--duration\b/.test(text)) return text;
  const flags = (localPrompt.match(/--ar [^\s]+ --duration \d+/) ?? [])[0];
  return flags ? `${text.trimEnd()}\n\n${flags}` : text;
}
type Tab = "prompt" | "frames" | "metrics" | "history";

const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: "prompt", label: "Промпт", icon: <IconSpark width={14} height={14} /> },
  { id: "frames", label: "Кадры", icon: <IconFilm width={14} height={14} /> },
  { id: "metrics", label: "Метрики", icon: <IconWave width={14} height={14} /> },
  { id: "history", label: "История", icon: <IconHistory width={14} height={14} /> },
];

export function Workspace() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const thumbRef = useRef<string | null>(null);
  const pendingRef = useRef<{ name: string; size: number; mime: string; source: "upload" | "url"; blob?: Blob } | null>(null);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [fatal, setFatal] = useState<{ title: string; detail: string } | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [restored, setRestored] = useState<HistoryItem | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clip, setClip] = useState<ClipRange>({ a: null, b: null });
  const [exporting, setExporting] = useState(false);
  const [exportRatio, setExportRatio] = useState(0);
  const [capturing, setCapturing] = useState(false);

  const [shots, setShots] = useState<FrameShot[]>([]);
  const [mode, setMode] = useState<ExtractMode>("scenes");
  const [count, setCount] = useState(12);
  const [format, setFormat] = useState<ImageFormatId>("image/png");
  const [quality, setQuality] = useState(0.92);
  const [maxWidth, setMaxWidth] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(null);
  const [zipping, setZipping] = useState(false);

  const [tab, setTab] = useState<Tab>("prompt");
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [view, setView] = useState<"prompt" | "json" | "negative">("prompt");
  const [preset, setPreset] = useState<StylePreset>("cinema");
  const [tags, setTags] = useState("");
  const [draftRu, setDraftRu] = useState("");
  const [draftEn, setDraftEn] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedId, setSavedId] = useState<string | null>(null);

  const [enrichState, setEnrichState] = useState<EnrichState>("idle");
  const [enrichResult, setEnrichResult] = useState<EnrichAnswer | null>(null);
  /*  Последний выбор «чем заполнить промпт» живёт в памяти браузера. На
      сервере памяти нет — там режим по умолчанию, и разметка при первом
      показе совпадает; браузер сразу подставляет запомненный.         */
  const applyMode = useChoice(applyModeStore);
  const frameCount = useChoice(frameCountStore);
  const [frameLimitInfo, setFrameLimitInfo] = useState<FrameLimitInfo | null>(null);
  /*  Куда прокрутить окно промпта после подстановки: доля от начала текста
      и ключ, чтобы прокрутка срабатывала и на повторное нажатие.        */
  const [scrollHint, setScrollHint] = useState<{ share: number; key: number } | null>(null);
  /*  Чем закончилось последнее нажатие режима: окно промпта сверит это с
      тем, что реально лежит в поле, и скажет, если текст не доехал.   */
  const [applied, setApplied] = useState<{ mode: ApplyMode; length: number; key: number } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  /*  Влезает ли выбранное число кадров в модель — спрашиваем сервер при
      каждой смене числа. Не ответил — предел неизвестен, кнопку не прячем:
      сервер всё равно проверит перед отправкой.                       */
  useEffect(() => {
    if (STATIC_BUILD) return;
    const controller = new AbortController();
    fetch(`/api/enrich?frames=${frameCount}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<FrameLimitInfo>) : null))
      .then((info) => setFrameLimitInfo(info))
      .catch(() => {
        if (!controller.signal.aborted) setFrameLimitInfo(null);
      });
    return () => controller.abort();
  }, [frameCount]);


  const busy = phase === "decoding" || phase === "probing" || phase === "analyzing";

  const pushToast = useCallback((tone: Toast["tone"], title: string, detail?: string) => {
    const id = uid("t");
    setToasts((prev) => [...prev.slice(-3), { id, tone, title, detail }]);
    const ttl = tone === "busy" ? 2600 : 5200;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---------------- derived prompt ----------------
  const bundle: PromptBundle | null = useMemo(() => {
    if (!analysis || !meta) return null;
    return buildPrompt({ analysis, meta, tags, preset });
  }, [analysis, meta, tags, preset]);

  useEffect(() => {
    if (!bundle || dirty) return;
    setDraftRu(bundle.ru);
    setDraftEn(bundle.en);
  }, [bundle, dirty]);

  const draft = lang === "ru" ? draftRu : draftEn;
  const setDraft = (value: string) => {
    setDirty(true);
    if (lang === "ru") setDraftRu(value);
    else setDraftEn(value);
  };

  // ---------------- history ----------------
  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      // Со статической сборки сервера нет: история живёт в памяти браузера.
      if (STATIC_BUILD) {
        setHistory(readHistory());
      } else {
        const res = await fetch("/api/analyses?limit=30", { cache: "no-store" });
        const data = (await res.json()) as { items?: HistoryItem[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setHistory(data.items ?? []);
      }
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Не удалось получить историю");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  // ---------------- video transport ----------------
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !sourceUrl) return;
    let raf = 0;
    const tick = () => {
      setCurrentTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      setCurrentTime(v.currentTime);
    };
    const onSeeked = () => setCurrentTime(v.currentTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
    };
  }, [sourceUrl]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || !meta) return;
    v.currentTime = clamp(t, 0, Math.max(0, meta.durationSec - 0.02));
    setCurrentTime(v.currentTime);
  }, [meta]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || busy) return;
    if (v.paused) void v.play().catch(() => pushToast("error", "Не удалось запустить воспроизведение"));
    else v.pause();
  }, [busy, pushToast]);

  const stepFrames = useCallback(
    (frames: number) => {
      const v = videoRef.current;
      if (!v || !meta) return;
      v.pause();
      seek(v.currentTime + frames / (meta.fps || 30));
    },
    [meta, seek],
  );

  // ---------------- ingest pipeline ----------------
  const startFromSource = useCallback(
    (url: string, info: { name: string; size: number; mime: string; source: "upload" | "url"; blob?: Blob }) => {
      pendingRef.current = info;
      revokeShots(shots);
      setShots([]);
      setAnalysis(null);
      setRestored(null);
      // Плеер должен быть смонтирован до запуска async-декодирования.
      // Реальные размеры, длительность и FPS будут подставлены ниже после load().
      setMeta({
        fileName: info.name,
        source: info.source,
        durationSec: 0,
        width: 16,
        height: 9,
        fps: 30,
        fpsDetected: false,
        sizeBytes: info.size,
        mime: info.mime,
        aspect: "16:9",
      });
      setPhase("decoding");
      setDirty(false);
      /*  Новый ролик — новый разбор с чистого листа. Теги, черновики и ответ
          модели прежнего видео здесь жили дальше и копились: в разбор спальни
          попадали «noir, rainy night» из прошлого ролика.              */
      setTags("");
      setDraftRu("");
      setDraftEn("");
      setSaveState("idle");
      setSavedId(null);
      setEnrichState("idle");
      setEnrichResult(null);
      setEnrichError(null);
      setClip({ a: null, b: null });
      setFatal(null);
      setTab("prompt");
      objectUrlRef.current = url;
      setSourceUrl(url);
    },
    [shots],
  );

  const handleFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      startFromSource(url, {
        name: file.name,
        size: file.size,
        mime: file.type || "video/mp4",
        source: "upload",
        blob: file,
      });
    },
    [startFromSource],
  );

  const handleUrl = useCallback(
    async (raw: string) => {
      setPhase("decoding");
      setProgress({ done: 0, total: 1, label: "скачиваем видео через серверный прокси…" });
      setFatal(null);
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(raw)}`);
        const type = res.headers.get("content-type") ?? "video/mp4";
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Источник ответил ${res.status}`);
        }
        const blob = await res.blob();
        if (!blob.size) throw new Error("Источник вернул пустой файл");
        const guess = decodeURIComponent(raw.split("/").pop()?.split("?")[0] ?? "") || "clip.mp4";
        const url = URL.createObjectURL(blob);
        startFromSource(url, {
          name: guess,
          size: blob.size,
          mime: type,
          source: "url",
          blob,
        });
      } catch (e) {
        setPhase("idle");
        setProgress(null);
        setFatal({
          title: "Не удалось загрузить видео по ссылке",
          detail: e instanceof Error ? e.message : "Неизвестная ошибка сети",
        });
        pushToast("error", "Ссылка не открылась", e instanceof Error ? e.message : undefined);
      }
    },
    [pushToast, startFromSource],
  );

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    const run = async () => {
      const info = pendingRef.current ?? { name: "clip.mp4", size: 0, mime: "video/mp4", source: "upload" as const };
      try {
        setPhase("decoding");
        setProgress({ done: 0, total: 1, label: "декодируем контейнер…" });
        const visible = videoRef.current;
        if (!visible) throw new Error("Плеер не смонтирован");
        await attachSource(visible, sourceUrl);
        if (cancelled) return;

        const duration =
          Number.isFinite(visible.duration) && visible.duration > 0 ? visible.duration : 0;
        if (!duration) throw new Error("Не удалось определить длительность — файл повреждён");
        if (!visible.videoWidth) throw new Error("Видеодорожка пустая: нет изображения");

        setPhase("probing");
        setProgress({ done: 0, total: 1, label: "читаем частоту кадров из файла…" });
        // Частота — из метаданных контейнера; замер воспроизведением только
        // если файл её не хранит.
        const fromFile = info.blob ? await readContainerFps(info.blob) : null;
        const { fps, detected } = fromFile
          ? { fps: fromFile, detected: true }
          : await probeFps(visible, 700);
        if (cancelled) return;

        const nextMeta: VideoMeta = {
          fileName: info.name,
          source: info.source,
          durationSec: duration,
          width: visible.videoWidth || 0,
          height: visible.videoHeight || 0,
          fps,
          fpsDetected: detected,
          sizeBytes: info.size,
          mime: info.mime,
          aspect: aspectLabel(visible.videoWidth, visible.videoHeight),
        };
        setMeta(nextMeta);

        setPhase("analyzing");
        const result = await analyzeVideo(visible, duration, {
          samples: 28,
          onProgress: (done, total, label) => {
            if (!cancelled) setProgress({ done, total, label });
          },
        });
        if (cancelled) return;
        setAnalysis(result);

        // thumbnail for history
        try {
          const th = await grabFrame(visible, duration / 2, "image/jpeg", 0.72, 320);
          thumbRef.current = await blobToDataUrl(th.blob);
          URL.revokeObjectURL(th.url);
        } catch {
          thumbRef.current = null;
        }

        // automatic scene keyframes
        try {
          visible.pause();
          const times = sceneTimes(result.scenes).slice(0, 8);
          const auto = times.length
            ? times
            : evenTimes(duration, Math.min(6, Math.max(3, Math.round(duration))));
          const got = await extractFrames(
            visible,
            auto,
            { format: "image/png", maxWidth: 1600, source: times.length ? "scene" : "auto" },
            (done, total) => !cancelled && setProgress({ done, total, label: "снимаем ключевые кадры" }),
          );
          if (!cancelled) setShots(got);
        } catch {
          /* keyframes are optional */
        }

        if (cancelled) return;
        visible.currentTime = 0;
        setProgress(null);
        setPhase("ready");
        setMode(result.scenes.length > 1 ? "scenes" : "even");
        pushToast(
          "success",
          "Анализ завершён",
          `${result.sampledFrames} выборок · ${result.scenes.length} план(ов) · палитра из ${result.palette.length} цветов`,
        );
      } catch (e) {
        if (cancelled) return;
        setPhase("idle");
        setProgress(null);
        const detail = e instanceof Error ? e.message : "Неизвестная ошибка";
        setFatal({ title: "Видео не обработано", detail });
        pushToast("error", "Сбой обработки", detail);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  // ---------------- capture ----------------
  const captureHere = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !meta || busy) return;
    setCapturing(true);
    try {
      v.pause();
      const shot = await grabFrame(v, v.currentTime, format, quality, maxWidth || undefined);
      shot.source = "manual";
      setShots((prev) => [...prev, shot]);
      setTab("frames");
      pushToast("success", "Кадр снят", `${shot.width}×${shot.height} · ${formatBytes(shot.bytes)}`);
    } catch (e) {
      pushToast("error", "Не удалось снять кадр", e instanceof Error ? e.message : undefined);
    } finally {
      setCapturing(false);
    }
  }, [busy, format, maxWidth, meta, pushToast, quality]);

  const extractAll = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !meta || busy) return;
    const times =
      mode === "even"
        ? evenTimes(meta.durationSec, count)
        : sceneTimes(analysis?.scenes ?? []);
    if (!times.length) {
      pushToast("error", "Нет точек для нарезки", "Сначала переключитесь на равномерную схему");
      return;
    }
    setExtracting(true);
    setExtractProgress({ done: 0, total: times.length });
    const wasPlaying = playing;
    try {
      v.pause();
      revokeShots(shots);
      const got = await extractFrames(
        v,
        times,
        { format, quality, maxWidth: maxWidth || undefined, source: mode === "even" ? "auto" : "scene" },
        (done, total) => setExtractProgress({ done, total }),
      );
      setShots(got);
      pushToast(
        "success",
        `Готово: ${got.length} изображений`,
        `${formatExt(format).toUpperCase()} · ${formatBytes(got.reduce((a, s) => a + s.bytes, 0))}`,
      );
    } catch (e) {
      pushToast("error", "Нарезка прервана", e instanceof Error ? e.message : undefined);
    } finally {
      setExtracting(false);
      setExtractProgress(null);
      v.currentTime = 0;
      setCurrentTime(0);
      if (wasPlaying) void v.play().catch(() => undefined);
    }
  }, [analysis, busy, count, format, maxWidth, meta, mode, playing, pushToast, quality, shots]);

  const downloadOne = useCallback(
    (shot: FrameShot) => {
      const base = slugify(meta?.fileName ?? "clip");
      downloadBlob(shot.blob, `${base}_t${shot.time.toFixed(3).replace(".", "-")}.${formatExt(shot.format)}`);
      pushToast("success", "Изображение сохранено", `${shot.width}×${shot.height}`);
    },
    [meta, pushToast],
  );

  const downloadAll = useCallback(() => {
    if (!shots.length) return;
    shots.forEach((s, i) => setTimeout(() => downloadOne(s), i * 220));
    pushToast("info", `Отдаём ${shots.length} файлов`, "Браузер может спросить разрешение на множественную загрузку");
  }, [downloadOne, pushToast, shots]);

  const downloadZip = useCallback(async () => {
    if (!shots.length) return;
    setZipping(true);
    try {
      const blob = await shotsToZip(shots, slugify(meta?.fileName ?? "clip"));
      downloadBlob(blob, `${slugify(meta?.fileName ?? "clip")}_frames.zip`);
      pushToast("success", "ZIP собран", `${shots.length} кадров + manifest.tsv`);
    } catch (e) {
      pushToast("error", "Не удалось собрать архив", e instanceof Error ? e.message : undefined);
    } finally {
      setZipping(false);
    }
  }, [meta, pushToast, shots]);

  const downloadSheet = useCallback(async () => {
    if (!shots.length) return;
    try {
      const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(shots.length))));
      const blob = await buildContactSheet(shots, {
        columns: cols,
        title: `${meta?.fileName ?? "clip"} — ${shots.length} frames`,
      });
      downloadBlob(blob, `${slugify(meta?.fileName ?? "clip")}_contact-sheet.jpg`);
      pushToast("success", "Контактный лист готов", `${cols} колонки · JPEG`);
    } catch (e) {
      pushToast("error", "Контактный лист не собрался", e instanceof Error ? e.message : undefined);
    }
  }, [meta, pushToast, shots]);

  const exportClip = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !meta || clip.a === null || clip.b === null) return;
    const a = Math.min(clip.a, clip.b);
    const b = Math.max(clip.a, clip.b);
    setExporting(true);
    setExportRatio(0);
    const timer = setInterval(() => {
      setExportRatio(clamp((v.currentTime - a) / Math.max(0.05, b - a), 0, 1));
    }, 120);
    try {
      const blob = await recordClip(v, a, b, meta.fps || 30);
      downloadBlob(blob, `${slugify(meta.fileName)}_clip_${a.toFixed(1)}-${b.toFixed(1)}.webm`);
      pushToast("success", "Клип записан", `${(b - a).toFixed(2)} с · ${formatBytes(blob.size)} · WebM`);
    } catch (e) {
      pushToast("error", "Экспорт отрезка не удался", e instanceof Error ? e.message : undefined);
    } finally {
      clearInterval(timer);
      setExporting(false);
      setExportRatio(0);
      try {
        v.pause();
        v.currentTime = a;
        setCurrentTime(a);
      } catch {
        /* noop */
      }
    }
  }, [clip, meta, pushToast]);

  // ---------------- prompt actions ----------------
  const downloadPrompt = useCallback(
    (kind: "txt" | "json") => {
      if (!bundle || !meta) return;
      const base = slugify(meta.fileName);
      if (kind === "json") {
        downloadBlob(
          new Blob([JSON.stringify(bundle.structured, null, 2)], { type: "application/json" }),
          `${base}_prompt.json`,
        );
      } else {
        const text = [
          `# РЕВЕРС — обратный промпт`,
          `файл: ${meta.fileName}`,
          `параметры: ${meta.width}×${meta.height} ${meta.aspect} · ${meta.durationSec.toFixed(2)} с · ${meta.fps} к/с`,
          ``,
          `## RU`,
          draftRu || bundle.ru,
          ``,
          `## EN`,
          draftEn || bundle.en,
          ``,
          `## NEGATIVE`,
          bundle.negative,
          ``,
          `## TAGS`,
          bundle.tags.join(", "),
        ].join("\n");
        downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${base}_prompt.txt`);
      }
      pushToast("success", `Файл ${kind.toUpperCase()} сохранён`);
    },
    [bundle, draftEn, draftRu, meta, pushToast],
  );

  const downloadReport = useCallback(() => {
    if (!analysis || !meta || !bundle) return;
    const report = {
      source: meta,
      prompt: { ru: draftRu, en: draftEn, negative: bundle.negative, tags: bundle.tags },
      analysis: {
        ...analysis,
        stats: analysis.stats.map((s) => ({
          t: Number(s.t.toFixed(3)),
          luma: Number(s.luma.toFixed(4)),
          diff: Number(s.diff.toFixed(4)),
          dx: s.dx,
          dy: s.dy,
        })),
      },
      structured: bundle.structured,
    };
    downloadBlob(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
      `${slugify(meta.fileName)}_report.json`,
    );
    pushToast("success", "Отчёт выгружен");
  }, [analysis, bundle, draftEn, draftRu, meta, pushToast]);

  const enrich = useCallback(async () => {
    if (!analysis || !bundle) return;
    setEnrichState("loading");
    setEnrichError(null);
    try {
      // Сколько выбрано — столько и уходит, равномерно по ВСЕЙ длине ролика.
      // Раньше при шести и больше склейках брались первые восемь сцен, и все
      // они оказывались в начале видео.
      if (frameLimitInfo?.fits === false && frameLimitInfo.frames === frameCount) {
        throw new Error(frameLimitInfo.message ?? "Модель не принимает столько кадров");
      }
      const startedAt = performance.now();
      const frames: string[] = [];
      const v = videoRef.current;
      if (v && sourceUrl && meta) {
        v.pause();
        for (const t of evenTimes(meta.durationSec, frameCount)) {
          const shot = await grabFrame(v, t, "image/jpeg", 0.72, 640);
          frames.push(await blobToDataUrl(shot.blob));
          URL.revokeObjectURL(shot.url);
        }
        v.currentTime = currentTime;
      } else if (shots.length) {
        const ordered = [...shots].sort((x, y) => x.time - y.time);
        for (const s of spreadEvenly(ordered, frameCount)) frames.push(await blobToDataUrl(s.blob));
      } else if (thumbRef.current) {
        frames.push(thumbRef.current);
      }
      if (!frames.length) throw new Error("Нет ни одного кадра для отправки модели");
      const captureMs = performance.now() - startedAt;

      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames,
          tags,
          summary: JSON.stringify(bundle.structured, null, 2),
          metrics: toStoredMetrics(analysis),
        }),
      });
      const data = (await res.json()) as EnrichAnswer & {
        error?: string;
        timing?: { frames: number; requestKb: number; modelMs: number };
      };
      if (!res.ok) throw new Error(data.error ?? `Сервис описания ответил ${res.status}`);
      if (!data.ru && !data.en) throw new Error("Пустой ответ модели");
      setEnrichResult({
        ru: data.ru ?? "",
        en: data.en ?? "",
        tags: data.tags ?? [],
        replacements: data.replacements ?? [],
        negative: data.negative ?? "",
        action: data.action ?? [],
        timing: {
          frames: frames.length,
          captureMs,
          modelMs: data.timing?.modelMs ?? null,
          totalMs: performance.now() - startedAt,
          requestKb: data.timing?.requestKb ?? null,
        },
      });
      setEnrichState("done");
      pushToast("success", "Модель описала кадры");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
      setEnrichError(msg);
      setEnrichState("error");
    }
  }, [analysis, bundle, currentTime, frameCount, frameLimitInfo, meta, pushToast, shots, sourceUrl, tags]);

  /*  ТРИ РЕЖИМА ЗАПОЛНЕНИЯ. «Только модель» — описание сцены; «модель +
      замеры» — описание плюс то, что модель по кадрам не измерит: коды
      палитры, движение камеры, монтаж, зерно; «только замеры» — как было
      до нейросети. Флаги --ar и --duration стоят в промпте измерений и
      дописываются к ответу модели, если их там нет.                  */
  /*  ТРИ РЕЖИМА ЗАПОЛНЕНИЯ. «Только модель» — описание сцены; «модель +
      замеры» — описание плюс то, что модель по кадрам не измерит: коды
      палитры, движение камеры, монтаж, зерно; «только замеры» — как было
      до нейросети. Флаги --ar и --duration стоят в промпте измерений и
      дописываются к ответу модели, если их там нет.

      Каждое нажатие пишет в консоль браузера строку «[режимы] …»: что
      нажали, что собралось и какой длины. Молча не сделать ничего этот
      обработчик больше не может: раньше одна ошибка внутри — и ни одна
      из трёх кнопок не отзывалась, а человек видел просто неподвижный
      текст.                                                          */
  const applyEnrich = useCallback(
    (mode: ApplyMode) => {
      const было = (lang === "ru" ? draftRu : draftEn).length;
      const скажем = (что: string, ещё?: Record<string, unknown>) =>
        console.info(`[режимы] ${mode}: ${что}`, { былоЗнаков: было, ...(ещё ?? {}) });
      try {
        applyModeStore.save(mode);
        if (!bundle) {
          скажем("разбор ещё не готов — подставлять нечего");
          pushToast("error", "Разбор ещё не готов", "Дождитесь конца анализа или откройте видео заново");
          return;
        }
        if (mode !== "metrics" && !enrichResult) {
          скажем("ответа модели нет");
          pushToast("error", "Ответа модели нет", "Сначала нажмите «Описать кадры моделью»");
          return;
        }

        const measured = analysis && meta ? measurementLines(analysis, meta) : null;
        const build = (local: string, ai: string, measures: string) => {
          if (mode === "metrics") return local;
          const head = ai.trim();
          if (!head) return local;
          const body = mode === "both" && measures ? `${head}\n\n${MEASURED_HEAD}\n${measures}` : head;
          return withFlags(body, local);
        };

        const ru = build(bundle.ru, enrichResult?.ru ?? "", measured?.ru ?? "");
        const en = build(bundle.en, enrichResult?.en ?? "", measured?.en ?? "");
        const прежний = lang === "ru" ? draftRu : draftEn;
        const новый = lang === "ru" ? ru : en;

        setDraftRu(ru);
        setDraftEn(en);
        setDirty(true);
        setLang("ru");
        setView("prompt");
        /*  Ответ модели — три-пять предложений, и блок замеров уходит вниз,
            за край окна промпта. Прокручиваем к нему.                   */
        const mark = ru.indexOf(MEASURED_HEAD);
        setScrollHint(mark >= 0 && ru.length ? { share: mark / ru.length, key: Date.now() } : null);
        setApplied({ mode, length: новый.length, key: Date.now() });

        скажем("собрано", {
          сталоЗнаков: новый.length,
          ответМоделиЗнаков: (enrichResult?.ru ?? "").length,
          замеры: measured ? `${measured.ru.split("\n").length} строк` : "не собрались",
          текстИзменился: новый !== прежний,
        });

        if (mode === "both" && !measured) {
          pushToast("error", "Замеры не готовы", "Подставлено только описание модели");
        } else if (новый === прежний) {
          pushToast(
            "info",
            "Текст не изменился",
            mode === "metrics"
              ? "В окне уже стоял промпт из измерений"
              : "Ответ модели совпал с тем, что было в окне",
          );
        } else if (mode === "metrics") {
          pushToast("success", "Промпт собран из измерений");
        } else if (mode === "both" && measured) {
          pushToast("success", "Описание модели и замеры вместе", `Строк замеров: ${measured.ru.split("\n").length}`);
        } else {
          pushToast("success", "Описание модели подставлено");
        }
      } catch (error) {
        const текст = error instanceof Error ? error.message : String(error);
        console.error(`[режимы] ${mode}: НЕ СРАБОТАЛО —`, error);
        pushToast("error", "Режим не сработал", текст);
      }
    },
    [analysis, bundle, draftEn, draftRu, enrichResult, lang, meta, pushToast],
  );

  const save = useCallback(async () => {
    if (!meta || !bundle || !analysis) return;
    setSaveState("saving");
    try {
      const title =
        tags.trim().split(/[,;]/)[0].trim().slice(0, 70) ||
        meta.fileName.replace(/\.[^.]+$/, "").slice(0, 70) ||
        "Клип";
      if (STATIC_BUILD) {
        const item: HistoryItem = {
          id: uid("h"),
          title,
          fileName: meta.fileName,
          source: meta.source,
          durationSec: meta.durationSec.toFixed(3),
          width: meta.width,
          height: meta.height,
          fps: meta.fps.toFixed(2),
          sizeBytes: meta.sizeBytes,
          subjectTags: tags,
          promptRu: draftRu || bundle.ru,
          promptEn: draftEn || bundle.en,
          negativePrompt: bundle.negative,
          structured: bundle.structured,
          metrics: toStoredMetrics(analysis),
          palette: analysis.palette,
          scenes: analysis.scenes,
          frameCount: shots.length,
          thumb: thumbRef.current,
          createdAt: new Date().toISOString(),
        };
        const { saved, dropped } = writeHistory([item, ...readHistory()]);
        setHistory(saved);
        setHistoryError(null);
        setSaveState("saved");
        setSavedId(item.id);
        pushToast(
          "success",
          "Сохранено в историю",
          dropped
            ? `Память браузера заполнена — удалено старых записей: ${dropped}`
            : "Запись хранится в этом браузере",
        );
        return;
      }
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fileName: meta.fileName,
          source: meta.source,
          durationSec: meta.durationSec,
          width: meta.width,
          height: meta.height,
          fps: meta.fps,
          sizeBytes: meta.sizeBytes,
          subjectTags: tags,
          promptRu: draftRu || bundle.ru,
          promptEn: draftEn || bundle.en,
          negativePrompt: bundle.negative,
          structured: bundle.structured,
          metrics: toStoredMetrics(analysis),
          palette: analysis.palette,
          scenes: analysis.scenes,
          frameCount: shots.length,
          thumb: thumbRef.current,
        }),
      });
      const data = (await res.json()) as { item?: HistoryItem; error?: string; detail?: string };
      if (!res.ok) throw new Error(data.error ?? data.detail ?? `HTTP ${res.status}`);
      setSaveState("saved");
      setSavedId(data.item?.id ?? null);
      pushToast("success", "Сохранено в PostgreSQL", `Запись ${data.item?.id.slice(0, 8) ?? ""}`);
      void refreshHistory();
    } catch (e) {
      setSaveState("error");
      pushToast("error", "Не удалось сохранить", e instanceof Error ? e.message : undefined);
    }
  }, [analysis, bundle, draftEn, draftRu, meta, pushToast, refreshHistory, shots.length, tags]);

  const openHistoryItem = useCallback((item: HistoryItem) => {
    const a = analysisFromRow(item);
    const v = videoRef.current;
    try {
      v?.pause();
      v?.removeAttribute("src");
      v?.load();
    } catch {
      /* noop */
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setRestored(item);
    setSourceUrl(null);
    setMeta({
      fileName: item.fileName,
      source: item.source === "url" ? "url" : "upload",
      durationSec: Number(item.durationSec),
      width: item.width,
      height: item.height,
      fps: Number(item.fps),
      fpsDetected: true,
      sizeBytes: item.sizeBytes,
      mime: "video/mp4",
      aspect: aspectLabel(item.width, item.height),
    });
    setAnalysis(a);
    /*  Ответ модели относился к прежнему ролику: с ним кнопки режимов
        остаются на экране, но подставлять им уже нечего.             */
    setEnrichState("idle");
    setEnrichResult(null);
    setEnrichError(null);
    setTags(item.subjectTags || "");
    setDraftRu(item.promptRu);
    setDraftEn(item.promptEn);
    setDirty(true);
    setSaveState("saved");
    setSavedId(item.id);
    setPhase("ready");
    setTab("prompt");
    revokeShots(shots);
    setShots([]);
  }, [shots]);

  const deleteHistoryItem = useCallback(
    async (id: string) => {
      const previous = history;
      setHistory((prev) => prev.filter((h) => h.id !== id));
      try {
        if (STATIC_BUILD) {
          setHistory(writeHistory(readHistory().filter((h) => h.id !== id)).saved);
        } else {
          const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
        }
        if (savedId === id) {
          setSavedId(null);
          setSaveState("idle");
        }
        pushToast("success", "Запись удалена");
      } catch (e) {
        setHistory(previous);
        pushToast("error", "Удаление не удалось", e instanceof Error ? e.message : undefined);
      }
    },
    [history, pushToast, savedId],
  );

  const resetAll = useCallback(() => {
    const v = videoRef.current;
    try {
      v?.pause();
      if (v) v.removeAttribute("src");
      v?.load();
    } catch {
      /* noop */
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    revokeShots(shots);
    setShots([]);
    setSourceUrl(null);
    setMeta(null);
    setAnalysis(null);
    setRestored(null);
    setPhase("idle");
    setProgress(null);
    setFatal(null);
    setDirty(false);
    setTags("");
    setDraftRu("");
    setDraftEn("");
    setSaveState("idle");
    setSavedId(null);
    setEnrichState("idle");
    setEnrichResult(null);
    setClip({ a: null, b: null });
    setCurrentTime(0);
  }, [shots]);

  // ---------------- keyboard ----------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (!meta || busy) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seek(currentTime + (e.shiftKey ? 1 : 1 / (meta.fps || 30)));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seek(currentTime - (e.shiftKey ? 1 : 1 / (meta.fps || 30)));
      } else if (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "с") {
        e.preventDefault();
        void captureHere();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, captureHere, currentTime, meta, seek, togglePlay]);

  // ---------------- cleanup ----------------
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const readouts = analysis ? metricReadouts(analysis) : [];

  return (
    <div className="space-y-4">
      {phase === "idle" && !meta ? (
        <>
          {fatal ? (
            <div className="animate-rise flex items-start gap-3 rounded-xl border border-bad/40 bg-bad/8 px-4 py-3">
              <span className="mt-0.5 text-bad">
                <IconAlert width={17} height={17} />
              </span>
              <div>
                <p className="font-display text-[13.5px] font-bold text-chalk">{fatal.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{fatal.detail}</p>
              </div>
            </div>
          ) : null}
          <Dropzone onFile={handleFile} onUrl={(u) => void handleUrl(u)} busy={busy} />
        </>
      ) : null}

      {meta ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.03fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {sourceUrl ? (
              <VideoStage
                videoRef={videoRef}
                meta={meta}
                analysis={analysis}
                currentTime={currentTime}
                duration={meta.durationSec}
                playing={playing}
                busy={busy}
                progress={progress}
                capturing={capturing}
                exporting={exporting}
                exportRatio={exportRatio}
                clip={clip}
                onTogglePlay={togglePlay}
                onSeek={seek}
                onStep={stepFrames}
                onCaptureHere={() => void captureHere()}
                onSetClipPoint={(which) =>
                  setClip((prev) => ({ ...prev, [which]: currentTime }))
                }
                onResetClip={() => setClip({ a: null, b: null })}
                onExportClip={() => void exportClip()}
                onReplace={resetAll}
              />
            ) : (
              <RestoredCard item={restored} meta={meta} onReplace={resetAll} />
            )}

            <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-line-soft sm:grid-cols-4">
              {(analysis
                ? [
                    { k: "Свет", v: `${Math.round(analysis.brightness * 100)}%`, s: analysis.exposure },
                    {
                      k: "Камера",
                      v: CAMERA_LABELS[analysis.camera].ru.split(",")[0],
                      s: `${Math.round(analysis.cameraConfidence * 100)}% уверенности`,
                    },
                    { k: "Планы", v: String(analysis.scenes.length), s: `${analysis.sampledFrames} выборок` },
                    {
                      k: "Движение",
                      v: `${Math.round(analysis.motionMean * 1000) / 10}%`,
                      s: analysis.motionMean > 0.06 ? "активно" : "спокойно",
                    },
                  ]
                : [
                    { k: "Свет", v: "—", s: "анализ…" },
                    { k: "Камера", v: "—", s: "анализ…" },
                    { k: "Планы", v: "—", s: "анализ…" },
                    { k: "Движение", v: "—", s: "анализ…" },
                  ]
              ).map((cell) => (
                <div key={cell.k} className="bg-panel px-3 py-2.5">
                  <p className="hud-label">{cell.k}</p>
                  <p className="mt-0.5 truncate font-display text-[14px] font-bold text-chalk">
                    {cell.v}
                  </p>
                  <p className="truncate font-mono text-[10px] text-dim">{cell.s}</p>
                </div>
              ))}
            </div>

            {readouts.length ? (
              <div className="panel flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="hud-label mr-1">Палитра</span>
                {analysis?.palette.slice(0, 7).map((p) => (
                  <span
                    key={p.hex}
                    className="h-5 w-5 rounded-md border border-white/12"
                    style={{ background: p.hex }}
                    title={`${p.nameRu} · ${p.hex}`}
                  />
                ))}
                <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.12em] text-dim sm:block">
                  space · play/pause · ← → · кадр · shift+← → · ±1 с · C · снять
                </span>
              </div>
            ) : null}

            {fatal && sourceUrl ? (
              <div className="flex items-start gap-3 rounded-xl border border-bad/40 bg-bad/8 px-4 py-3">
                <span className="mt-0.5 text-bad">
                  <IconAlert width={16} height={16} />
                </span>
                <div>
                  <p className="font-display text-[13px] font-bold text-chalk">{fatal.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{fatal.detail}</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* ---------- right column ---------- */}
          <div className="panel flex min-h-[420px] flex-col overflow-hidden">
            <div className="flex items-center gap-1 border-b border-line-soft px-2 py-2">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-display text-[12.5px] font-bold uppercase tracking-[0.07em] transition ${
                      active
                        ? "bg-ember/14 text-ember shadow-[inset_0_0_0_1px_rgba(255,106,43,0.35)]"
                        : "text-muted hover:bg-white/5 hover:text-chalk"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                    {t.id === "frames" && shots.length ? (
                      <span className="ml-0.5 rounded bg-void/70 px-1 font-mono text-[10px] text-chalk/80 tabular">
                        {shots.length}
                      </span>
                    ) : null}
                    {t.id === "history" && history.length ? (
                      <span className="ml-0.5 rounded bg-void/70 px-1 font-mono text-[10px] text-chalk/80 tabular">
                        {history.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              <span className="ml-auto hidden pr-2 font-mono text-[10px] uppercase tracking-[0.12em] text-dim lg:block">
                {saveState === "saved" ? `в базе${savedId ? ` · ${savedId.slice(0, 8)}` : ""}` : "черновик"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5">
              {tab === "prompt" ? (
                <PromptPanel
                  bundle={bundle}
                  lang={lang}
                  onLangChange={setLang}
                  view={view}
                  onViewChange={setView}
                  preset={preset}
                  onPresetChange={setPreset}
                  tags={tags}
                  onTagsChange={setTags}
                  draft={draft}
                  draftEn={draftEn}
                  onDraftChange={setDraft}
                  onResetDraft={() => {
                    setDirty(false);
                    if (bundle) {
                      setDraftRu(bundle.ru);
                      setDraftEn(bundle.en);
                    }
                  }}
                  onDownload={downloadPrompt}
                  enrichState={enrichState}
                  enrichResult={enrichResult}
                  enrichError={enrichError}
                  onEnrich={() => void enrich()}
                  onApplyEnrich={applyEnrich}
                  applyMode={applyMode}
                  frameCount={frameCount}
                  onFrameCountChange={(n) => frameCountStore.save(n)}
                  frameLimit={frameLimitInfo}
                  scrollHint={scrollHint}
                  applied={applied}
                  onDismissEnrich={() => {
                    setEnrichState("idle");
                    setEnrichResult(null);
                    setEnrichError(null);
                  }}
                  saveState={saveState}
                  onSave={() => void save()}
                />
              ) : null}

              {tab === "frames" ? (
                <FrameBoard
                  shots={shots}
                  mode={mode}
                  onModeChange={setMode}
                  count={count}
                  onCountChange={setCount}
                  format={format}
                  onFormatChange={setFormat}
                  quality={quality}
                  onQualityChange={setQuality}
                  maxWidth={maxWidth}
                  onMaxWidthChange={setMaxWidth}
                  extracting={extracting}
                  extractProgress={extractProgress}
                  onExtract={() => void extractAll()}
                  onDownloadOne={downloadOne}
                  onDownloadAll={downloadAll}
                  onZip={() => void downloadZip()}
                  onContactSheet={() => void downloadSheet()}
                  onDelete={(id) => {
                    const target = shots.find((s) => s.id === id);
                    if (target) {
                      URL.revokeObjectURL(target.url);
                      setShots((prev) => prev.filter((s) => s.id !== id));
                    }
                  }}
                  onClear={() => {
                    revokeShots(shots);
                    setShots([]);
                  }}
                  onSeekTo={(t) => {
                    seek(t);
                    setTab("prompt");
                  }}
                  zipping={zipping}
                  disabled={busy || !sourceUrl}
                />
              ) : null}

              {tab === "metrics" ? (
                <MetricsPanel
                  analysis={analysis}
                  onSeekTo={(t) => {
                    if (sourceUrl) seek(t);
                  }}
                  onExportReport={downloadReport}
                />
              ) : null}

              {tab === "history" ? (
                <HistoryPanel
                  items={history}
                  loading={historyLoading}
                  error={historyError}
                  onRefresh={() => void refreshHistory()}
                  onLoad={openHistoryItem}
                  onDelete={(id) => void deleteHistoryItem(id)}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {phase !== "idle" && !meta ? (
        <div className="panel flex flex-col items-start gap-3 p-6">
          <p className="font-display text-[15px] font-bold uppercase tracking-[0.1em] text-chalk">
            {phase === "decoding" ? "Открываем видео" : "Готовим плеер"}
          </p>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="animate-sweep absolute inset-0" />
          </div>
          <p className="font-mono text-[11px] text-dim">{progress?.label ?? "…"}</p>
        </div>
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function RestoredCard({
  item,
  meta,
  onReplace,
}: {
  item: HistoryItem | null;
  meta: VideoMeta;
  onReplace: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-ice">
            <IconHistory width={16} height={16} />
          </span>
          <p className="font-display text-[13px] font-bold uppercase tracking-[0.1em] text-chalk">
            Запись из истории
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn px-3 py-1.5 text-[12px]"
            onClick={async () => {
              const ok = await copyText(item?.promptRu ?? "");
              setCopied(ok);
              setTimeout(() => setCopied(false), 1600);
            }}
            disabled={!item?.promptRu}
          >
            {copied ? "Скопировано" : "Копировать промпт"}
          </button>
          <button type="button" className="btn btn-primary px-3 py-1.5 text-[12px]" onClick={onReplace}>
            <IconUpload width={14} height={14} />
            Новое видео
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="relative h-[112px] w-full shrink-0 overflow-hidden rounded-lg border border-line bg-black sm:w-[200px]">
          {item?.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-dim">
              <IconFilm width={20} height={20} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-bold text-chalk">{item?.title ?? meta.fileName}</p>
          <p className="mt-1 font-mono text-[11px] text-dim">
            {meta.width}×{meta.height} · {meta.aspect} · {formatTime(meta.durationSec)} · {meta.fps} к/с ·{" "}
            {formatBytes(meta.sizeBytes)} · {item?.frameCount ?? 0} кадров в сессии
          </p>
          <p className="mt-2 rounded-lg border border-line-soft bg-void/50 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
            Видеофайл не загружен — из базы восстановлены метрики, палитра, планы и промпт.
            Чтобы снять новые кадры, откройте исходник заново.
          </p>
        </div>
      </div>
    </div>
  );
}
