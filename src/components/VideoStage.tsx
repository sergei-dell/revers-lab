"use client";

import type { CSSProperties, RefObject } from "react";
import {
  IconClose,
  IconDownload,
  IconPause,
  IconPlay,
  IconScissors,
  IconShutter,
} from "@/components/icons";
import { Progress } from "@/components/ui";
import { formatBytes, formatTime } from "@/lib/format";
import type { Analysis, VideoMeta } from "@/lib/types";

export type ClipRange = { a: number | null; b: number | null };

export function VideoStage({
  videoRef,
  meta,
  analysis,
  currentTime,
  duration,
  playing,
  busy,
  progress,
  capturing,
  exporting,
  exportRatio,
  clip,
  onTogglePlay,
  onSeek,
  onStep,
  onCaptureHere,
  onSetClipPoint,
  onResetClip,
  onExportClip,
  onReplace,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  meta: VideoMeta;
  analysis: Analysis | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  busy: boolean;
  progress: { done: number; total: number; label: string } | null;
  capturing: boolean;
  exporting: boolean;
  exportRatio: number;
  clip: ClipRange;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onStep: (frames: number) => void;
  onCaptureHere: () => void;
  onSetClipPoint: (which: "a" | "b") => void;
  onResetClip: () => void;
  onExportClip: () => void;
  onReplace: () => void;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const track = `linear-gradient(90deg,#ff6a2b 0%,#ffc247 ${pct.toFixed(2)}%,#212130 ${pct.toFixed(2)}%,#212130 100%)`;
  const scenes = analysis?.scenes ?? [];

  const clipReady =
    clip.a !== null && clip.b !== null && clip.b > clip.a + 0.05 && !exporting && !busy;

  return (
    <div className="panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_290px]">
        {/* ---------- screen ---------- */}
        <div className="relative border-b border-line-soft lg:border-b-0 lg:border-r">
          <div className="relative bg-[#050507] p-3">
            <div
              className="relative mx-auto overflow-hidden rounded-lg bg-black"
              style={{
                aspectRatio: `${meta.width || 16} / ${meta.height || 9}`,
                maxHeight: "58vh",
              }}
            >
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                playsInline
                muted
                onClick={onTogglePlay}
              />

              {/* HUD corners */}
              <div className="pointer-events-none absolute inset-0">
                {[
                  "left-2 top-2 border-l border-t",
                  "right-2 top-2 border-r border-t",
                  "left-2 bottom-2 border-b border-l",
                  "right-2 bottom-2 border-b border-r",
                ].map((pos) => (
                  <span
                    key={pos}
                    className={`absolute h-4 w-4 border-ember/50 ${pos}`}
                  />
                ))}
              </div>

              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
                <span className="chip border-white/15 bg-black/60 text-[9.5px] text-chalk/85 backdrop-blur">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      playing ? "animate-pulse-dot bg-bad text-bad" : "bg-dim text-dim"
                    }`}
                  />
                  {playing ? "PLAY" : busy ? "ANALYZE" : "PAUSE"}
                </span>
                <span className="chip border-white/15 bg-black/60 text-[9.5px] text-chalk/85 backdrop-blur tabular">
                  {formatTime(currentTime)}
                </span>
              </div>

              {analysis?.scenes.length ? (
                <div className="pointer-events-none absolute right-3 top-3">
                  <span className="chip border-white/15 bg-black/60 text-[9.5px] text-chalk/85 backdrop-blur">
                    {analysis.scenes.length} план{analysis.scenes.length > 1 ? "ов" : ""}
                  </span>
                </div>
              ) : null}

              {busy || exporting ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void/78 px-6 backdrop-blur-[2px]">
                  <div className="relative h-1 w-full max-w-xs overflow-hidden rounded-full bg-line">
                    <div className="animate-sweep absolute inset-0" />
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-chalk">
                    {exporting
                      ? `запись отрезка · ${Math.round(exportRatio * 100)}%`
                      : (progress?.label ?? "декодирование…")}
                  </p>
                  {progress && !exporting ? (
                    <p className="font-mono text-[10.5px] text-dim tabular">
                      {progress.done}/{progress.total}
                    </p>
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-8 animate-scan bg-gradient-to-b from-transparent via-ember/25 to-transparent" />
                </div>
              ) : null}
            </div>
          </div>

          {/* ---------- transport ---------- */}
          <div className="border-t border-line-soft px-3 py-3">
            <div className="relative">
              <input
                type="range"
                className="timeline relative z-10"
                min={0}
                max={Math.max(0.01, duration)}
                step={0.001}
                value={Math.min(currentTime, duration)}
                disabled={busy}
                onChange={(e) => onSeek(Number(e.target.value))}
                style={{ "--track": track } as CSSProperties}
                aria-label="Позиция воспроизведения"
              />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-6 -translate-y-1/2">
                {scenes.slice(1).map((s) => (
                  <span
                    key={s.index}
                    title={`Склейка · ${formatTime(s.start)}`}
                    className="absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded bg-flare/85"
                    style={{ left: `${(s.start / Math.max(0.001, duration)) * 100}%` }}
                  />
                ))}
                {clip.a !== null ? (
                  <span
                    className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded bg-ice"
                    style={{ left: `${(clip.a / Math.max(0.001, duration)) * 100}%` }}
                  />
                ) : null}
                {clip.b !== null ? (
                  <span
                    className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded bg-ice"
                    style={{ left: `${(clip.b / Math.max(0.001, duration)) * 100}%` }}
                  />
                ) : null}
                {clip.a !== null && clip.b !== null && clip.b > clip.a ? (
                  <span
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded bg-ice/25"
                    style={{
                      left: `${(clip.a / Math.max(0.001, duration)) * 100}%`,
                      width: `${((clip.b - clip.a) / Math.max(0.001, duration)) * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onTogglePlay}
                disabled={busy}
              >
                {playing ? <IconPause width={15} height={15} /> : <IconPlay width={15} height={15} />}
                {playing ? "Пауза" : "Смотреть"}
              </button>
              <button type="button" className="btn" onClick={() => onStep(-1)} disabled={busy}>
                −1 кадр
              </button>
              <button type="button" className="btn" onClick={() => onStep(1)} disabled={busy}>
                +1 кадр
              </button>
              <button
                type="button"
                className="btn border-ember/45 text-ember hover:bg-ember/12"
                onClick={onCaptureHere}
                disabled={busy || capturing}
              >
                <IconShutter width={15} height={15} />
                {capturing ? "Снимаем…" : "Кадр в эту точку"}
              </button>

              <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-muted tabular">
                <span className="text-chalk">{formatTime(currentTime)}</span>
                <span className="text-dim">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- side rail ---------- */}
        <aside className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="hud-label">Параметры источника</p>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-[11.5px]"
              onClick={onReplace}
              disabled={busy}
            >
              <IconClose width={13} height={13} />
              Другое видео
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft">
            {[
              ["Разрешение", `${meta.width}×${meta.height}`],
              ["Соотношение", meta.aspect],
              ["Длительность", `${meta.durationSec.toFixed(2)} с`],
              ["Частота", `${meta.fps} к/с${meta.fpsDetected ? "" : " ≈"}`],
              ["Размер", formatBytes(meta.sizeBytes)],
              ["Источник", meta.source === "url" ? "по ссылке" : "файл"],
            ].map(([k, v]) => (
              <div key={k} className="bg-panel px-2.5 py-2">
                <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">{k}</dt>
                <dd className="mt-0.5 truncate font-display text-[12.5px] font-semibold text-chalk tabular">
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <p className="truncate font-mono text-[10.5px] text-dim" title={meta.fileName}>
            {meta.fileName}
          </p>

          <div className="panel-flat mt-auto p-3">
            <div className="flex items-center gap-2">
              <span className="text-ice">
                <IconScissors width={15} height={15} />
              </span>
              <p className="font-display text-[12px] font-bold uppercase tracking-[0.1em] text-chalk">
                Отрезок → WebM
              </p>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn px-2 py-1.5 text-[11.5px]"
                onClick={() => onSetClipPoint("a")}
                disabled={busy}
              >
                A · {clip.a === null ? "—" : formatTime(clip.a, false)}
              </button>
              <button
                type="button"
                className="btn px-2 py-1.5 text-[11.5px]"
                onClick={() => onSetClipPoint("b")}
                disabled={busy}
              >
                B · {clip.b === null ? "—" : formatTime(clip.b, false)}
              </button>
            </div>

            <button
              type="button"
              className="btn mt-2 w-full"
              onClick={onExportClip}
              disabled={!clipReady}
            >
              <IconDownload width={15} height={15} />
              {exporting ? `Запись ${Math.round(exportRatio * 100)}%` : "Экспорт клипа"}
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-1 w-full px-2 py-1 text-[11.5px]"
              onClick={onResetClip}
              disabled={busy || (clip.a === null && clip.b === null)}
            >
              Сбросить точки
            </button>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-dim">
              Пишется в реальном времени через MediaRecorder: длина записи ≈ длине отрезка.
            </p>
          </div>
        </aside>
      </div>

      {exporting ? (
        <div className="border-t border-line-soft px-4 py-3">
          <Progress ratio={exportRatio} label="идёт захват отрезка, не закрывайте вкладку" tone="ice" />
        </div>
      ) : null}
    </div>
  );
}
