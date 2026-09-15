"use client";

import { useState } from "react";
import { IconBolt, IconCheck, IconCopy, IconDownload, IconSplit } from "@/components/icons";
import { EmptyNote } from "@/components/ui";
import { copyText, formatTime, readableOn } from "@/lib/format";
import { metricReadouts } from "@/lib/prompt";
import { CAMERA_LABELS } from "@/lib/video/analyze";
import type { Analysis } from "@/lib/types";

const TONE_COLOR: Record<string, string> = {
  ember: "#ff6a2b",
  ice: "#62d9e8",
  flare: "#ffc247",
  good: "#35d07f",
  bad: "#ff4d6d",
  warn: "#ffb020",
};

export function MetricsPanel({
  analysis,
  onSeekTo,
  onExportReport,
}: {
  analysis: Analysis | null;
  onSeekTo: (t: number) => void;
  onExportReport: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!analysis) {
    return <EmptyNote>Метрики появятся после анализа видео.</EmptyNote>;
  }

  const readouts = metricReadouts(analysis);
  const cam = CAMERA_LABELS[analysis.camera];
  const stats = analysis.stats;

  const chartPath = (pick: (i: number) => number) => {
    if (stats.length < 2) return "";
    const w = 300;
    const h = 54;
    return stats
      .map((_, i) => {
        const x = (i / (stats.length - 1)) * w;
        const y = h - Math.max(0, Math.min(1, pick(i))) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const copyHex = async (hex: string) => {
    const ok = await copyText(hex);
    if (ok) {
      setCopied(hex);
      setTimeout(() => setCopied(null), 1400);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="hud-label">Измерения · {analysis.sampledFrames} выборок</p>
        <button type="button" className="btn px-3 py-1.5 text-[12px]" onClick={onExportReport}>
          <IconDownload width={14} height={14} />
          Отчёт .json
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {readouts.map((r) => (
          <div key={r.label} className="panel-flat px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-[12.5px] font-semibold uppercase tracking-[0.06em] text-chalk">
                {r.label}
              </span>
              <span
                className="font-mono text-[12px] font-bold tabular"
                style={{ color: TONE_COLOR[r.tone] }}
              >
                {r.value}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(2, Math.min(100, r.ratio * 100))}%`,
                  background: TONE_COLOR[r.tone],
                }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-dim">{r.note}</p>
          </div>
        ))}
      </div>

      {/* camera */}
      <div className="panel-flat p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-ember">
            <IconSplit width={15} height={15} />
          </span>
          <p className="font-display text-[12.5px] font-bold uppercase tracking-[0.09em] text-chalk">
            Движение камеры
          </p>
          <span className="chip ml-auto">{cam.en}</span>
        </div>
        <p className="mt-2 text-[13px] text-muted">{cam.ru}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Смещение X", `${analysis.cameraVector.dx > 0 ? "+" : ""}${analysis.cameraVector.dx} px`],
            ["Смещение Y", `${analysis.cameraVector.dy > 0 ? "+" : ""}${analysis.cameraVector.dy} px`],
            ["Зум", `${analysis.cameraVector.zoom > 0 ? "+" : ""}${analysis.cameraVector.zoom}`],
            ["Уверенность", `${Math.round(analysis.cameraConfidence * 100)}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line-soft bg-void/60 px-2.5 py-2">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">{k}</p>
              <p className="mt-0.5 font-display text-[13px] font-bold text-chalk tabular">{v}</p>
            </div>
          ))}
        </div>
        {analysis.dominantHues.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="hud-label">Оттенки в кадре:</span>
            {analysis.dominantHues.map((h) => (
              <span key={h} className="chip border-flare/35 text-flare">
                {h}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* palette */}
      <div>
        <p className="hud-label mb-2">Палитра · клик копирует HEX</p>
        <div className="flex flex-wrap gap-2">
          {analysis.palette.length ? (
            analysis.palette.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => copyHex(p.hex)}
                className="group flex items-center gap-2 rounded-lg border border-line bg-void/60 p-1.5 pr-2.5 transition hover:border-edge"
                title={`${p.nameRu} · ${(p.weight * 100).toFixed(1)}% кадра`}
              >
                <span
                  className="h-7 w-7 rounded-md border border-white/10"
                  style={{ background: p.hex }}
                />
                <span className="text-left">
                  <span
                    className="block font-mono text-[11px] font-bold"
                    style={{ color: readableOn(p.hex) === "#0b0b10" ? p.hex : "#f4f1ea" }}
                  >
                    {copied === p.hex ? <IconCheck width={12} height={12} className="inline text-good" /> : null}{" "}
                    {p.hex.toUpperCase()}
                  </span>
                  <span className="block text-[10.5px] text-dim">
                    {p.nameRu} · {(p.weight * 100).toFixed(1)}%
                  </span>
                </span>
              </button>
            ))
          ) : (
            <span className="text-[12px] text-dim">Палитра не собрана</span>
          )}
        </div>
      </div>

      {/* curves */}
      {stats.length > 1 ? (
        <div className="panel-flat p-3.5">
          <div className="flex items-center justify-between">
            <p className="hud-label">Кривые по таймлайну</p>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em]">
              <span className="flex items-center gap-1.5 text-flare">
                <span className="h-[2px] w-4 rounded bg-flare" /> яркость
              </span>
              <span className="flex items-center gap-1.5 text-ice">
                <span className="h-[2px] w-4 rounded bg-ice" /> межкадровое движение
              </span>
            </div>
          </div>
          <svg
            viewBox="0 0 300 54"
            preserveAspectRatio="none"
            className="mt-2 h-[74px] w-full"
            role="img"
            aria-label="График яркости и движения по времени"
          >
            <defs>
              <linearGradient id="motionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#62d9e8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#62d9e8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                x1="0"
                x2="300"
                y1={54 * g}
                y2={54 * g}
                stroke="#212130"
                strokeWidth="0.6"
              />
            ))}
            <path
              d={`${chartPath((i) => Math.min(1, stats[i].diff * 5))} L300,54 L0,54 Z`}
              fill="url(#motionFill)"
            />
            <path
              d={chartPath((i) => Math.min(1, stats[i].diff * 5))}
              fill="none"
              stroke="#62d9e8"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={chartPath((i) => stats[i].luma)}
              fill="none"
              stroke="#ffc247"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
            {analysis.scenes.slice(1).map((s) => {
              const idx = stats.findIndex((st) => st.t >= s.start);
              if (idx < 0) return null;
              const x = (idx / (stats.length - 1)) * 300;
              return (
                <line
                  key={s.index}
                  x1={x}
                  x2={x}
                  y1="0"
                  y2="54"
                  stroke="#ff4d6d"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-dim tabular">
            <span>00:00</span>
            <span>{formatTime(stats[stats.length - 1].t, false)}</span>
          </div>
        </div>
      ) : null}

      {/* scenes */}
      <div>
        <div className="flex items-center gap-2">
          <p className="hud-label">Монтажные планы</p>
          <span className="chip">
            <IconBolt width={11} height={11} />
            {analysis.scenes.length}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {analysis.scenes.map((s) => (
            <li key={s.index}>
              <button
                type="button"
                onClick={() => onSeekTo(s.keyframe)}
                className="flex w-full items-center gap-3 rounded-lg border border-line-soft bg-void/50 px-3 py-2 text-left transition hover:border-ember/45 hover:bg-ember/6"
              >
                <span className="font-mono text-[11px] font-bold text-ember tabular">
                  #{String(s.index + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11.5px] text-chalk tabular">
                  {formatTime(s.start)} → {formatTime(s.end)}
                </span>
                <span className="font-mono text-[11px] text-dim tabular">
                  {(s.end - s.start).toFixed(2)} с
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-1 w-14 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-flare"
                      style={{ width: `${Math.min(100, s.intensity * 55)}%` }}
                    />
                  </span>
                  <span className="font-mono text-[10px] text-dim">
                    {s.intensity > 1.6 ? "жёсткая склейка" : "плавный переход"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
          <IconCopy width={11} height={11} /> клик по плану перематывает плеер к ключевому кадру
        </p>
      </div>
    </div>
  );
}
