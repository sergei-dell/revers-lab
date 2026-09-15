"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  IconArchive,
  IconClose,
  IconDownload,
  IconFilm,
  IconPlay,
  IconSheet,
  IconShutter,
  IconTrash,
} from "@/components/icons";
import { EmptyNote, Modal, Progress, Segmented } from "@/components/ui";
import { formatBytes, formatTime, readableOn } from "@/lib/format";
import { IMAGE_FORMATS, type ImageFormatId } from "@/lib/video/capture";
import type { FrameShot } from "@/lib/types";

export type ExtractMode = "even" | "scenes";

const WIDTHS = [
  { id: 0, label: "Оригинал" },
  { id: 1920, label: "1920" },
  { id: 1280, label: "1280" },
  { id: 720, label: "720" },
];

const COUNTS = [6, 8, 12, 16, 24, 36, 48];

export function FrameBoard({
  shots,
  mode,
  onModeChange,
  count,
  onCountChange,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  maxWidth,
  onMaxWidthChange,
  extracting,
  extractProgress,
  onExtract,
  onDownloadOne,
  onDownloadAll,
  onZip,
  onContactSheet,
  onDelete,
  onClear,
  onSeekTo,
  zipping,
  disabled,
}: {
  shots: FrameShot[];
  mode: ExtractMode;
  onModeChange: (mode: ExtractMode) => void;
  count: number;
  onCountChange: (n: number) => void;
  format: ImageFormatId;
  onFormatChange: (f: ImageFormatId) => void;
  quality: number;
  onQualityChange: (q: number) => void;
  maxWidth: number;
  onMaxWidthChange: (w: number) => void;
  extracting: boolean;
  extractProgress: { done: number; total: number } | null;
  onExtract: () => void;
  onDownloadOne: (shot: FrameShot) => void;
  onDownloadAll: () => void;
  onZip: () => void;
  onContactSheet: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onSeekTo: (t: number) => void;
  zipping: boolean;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    if (preview === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPreview((p) => (p === null ? p : Math.min(shots.length - 1, p + 1)));
      if (e.key === "ArrowLeft") setPreview((p) => (p === null ? p : Math.max(0, p - 1)));
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, shots.length]);

  const lossy = format !== "image/png";
  const totalBytes = shots.reduce((a, s) => a + s.bytes, 0);
  const active = preview !== null ? shots[preview] : null;

  return (
    <div className="space-y-3.5">
      <div className="panel-flat space-y-3 p-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="hud-label mb-1.5">Схема нарезки</p>
            <Segmented
              size="sm"
              value={mode}
              onChange={onModeChange}
              options={[
                { id: "even", label: "Равномерно" },
                { id: "scenes", label: "По сценам" },
              ]}
            />
          </div>

          {mode === "even" ? (
            <div>
              <p className="hud-label mb-1.5">Количество</p>
              <div className="flex flex-wrap gap-1">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onCountChange(n)}
                    className={`h-[30px] min-w-[34px] rounded-md border px-1.5 font-mono text-[11.5px] transition ${
                      n === count
                        ? "border-ember/60 bg-ember/14 text-ember"
                        : "border-line bg-void/50 text-muted hover:text-chalk"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-1">
              <p className="text-[12px] text-muted">
                Берём по ключевому кадру из каждой найденной сцены.
              </p>
            </div>
          )}

          <div>
            <p className="hud-label mb-1.5">Формат</p>
            <Segmented
              size="sm"
              value={format}
              onChange={(v) => onFormatChange(v as ImageFormatId)}
              options={IMAGE_FORMATS.map((f) => ({ id: f.id, label: f.label }))}
            />
          </div>

          <div>
            <p className="hud-label mb-1.5">Ширина</p>
            <div className="flex gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onMaxWidthChange(w.id)}
                  className={`h-[30px] rounded-md border px-2 font-mono text-[11px] transition ${
                    w.id === maxWidth
                      ? "border-ice/55 bg-ice/12 text-ice"
                      : "border-line bg-void/50 text-muted hover:text-chalk"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {lossy ? (
            <div className="min-w-[150px] flex-1">
              <p className="hud-label mb-1.5">
                Качество · {Math.round(quality * 100)}%
              </p>
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.02}
                value={quality}
                onChange={(e) => onQualityChange(Number(e.target.value))}
                className="timeline"
                style={{ "--track": "#212130" } as CSSProperties}
                aria-label="Качество сжатия"
              />
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-primary ml-auto"
            onClick={onExtract}
            disabled={disabled || extracting}
          >
            <IconShutter width={15} height={15} />
            {extracting ? "Извлекаем…" : "Нарезать кадры"}
          </button>
        </div>

        {extracting && extractProgress ? (
          <Progress
            ratio={extractProgress.total ? extractProgress.done / extractProgress.total : 0}
            label={`кадр ${extractProgress.done} из ${extractProgress.total}`}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">
          <IconFilm width={12} height={12} />
          {shots.length} кадр(ов)
        </span>
        {shots.length ? (
          <span className="chip tabular">{formatBytes(totalBytes)}</span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className="btn px-3 py-1.5 text-[12px]"
            onClick={onDownloadAll}
            disabled={!shots.length}
          >
            <IconDownload width={14} height={14} />
            Скачать все
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-[12px]"
            onClick={onZip}
            disabled={!shots.length || zipping}
          >
            <IconArchive width={14} height={14} />
            {zipping ? "Пакуем…" : "ZIP архив"}
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-[12px]"
            onClick={onContactSheet}
            disabled={!shots.length}
          >
            <IconSheet width={14} height={14} />
            Контактный лист
          </button>
          <button
            type="button"
            className="btn btn-ghost px-3 py-1.5 text-[12px]"
            onClick={onClear}
            disabled={!shots.length}
          >
            <IconTrash width={14} height={14} />
            Очистить
          </button>
        </div>
      </div>

      {shots.length === 0 ? (
        <EmptyNote>
          Кадров пока нет. Нажмите «Нарезать кадры» — движок пройдётся по таймлайну и
          сохранит изображения в выбранном формате. Точечный кадр можно снять кнопкой
          «Кадр в эту точку» под плеером.
        </EmptyNote>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shots.map((shot, i) => (
            <figure
              key={shot.id}
              className="group relative overflow-hidden rounded-xl border border-line-soft bg-void/60 transition hover:border-edge"
            >
              <button
                type="button"
                className="block w-full"
                onClick={() => setPreview(i)}
                aria-label={`Открыть кадр ${i + 1}`}
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.url}
                    alt={`Кадр ${i + 1} на ${formatTime(shot.time)}`}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <span
                    className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                    style={{
                      background: shot.source === "scene" ? "#62d9e8" : shot.source === "manual" ? "#ffc247" : "#ff6a2b",
                      color: readableOn(shot.source === "scene" ? "#62d9e8" : shot.source === "manual" ? "#ffc247" : "#ff6a2b"),
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-chalk tabular">
                    {formatTime(shot.time)}
                  </span>
                </div>
              </button>

              <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate font-mono text-[10px] text-dim">
                  {shot.width}×{shot.height} · {formatBytes(shot.bytes)}
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 text-dim transition hover:bg-white/8 hover:text-ice"
                    title="Перейти к этому времени"
                    onClick={() => onSeekTo(shot.time)}
                  >
                    <IconPlay width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-dim transition hover:bg-white/8 hover:text-chalk"
                    title="Скачать кадр"
                    onClick={() => onDownloadOne(shot)}
                  >
                    <IconDownload width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-dim transition hover:bg-bad/15 hover:text-bad"
                    title="Удалить кадр"
                    onClick={() => onDelete(shot.id)}
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Modal open={active !== null} onClose={() => setPreview(null)} label="Просмотр кадра">
        {active ? (
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[13px] font-bold uppercase tracking-[0.1em] text-ember tabular">
                  кадр {(preview ?? 0) + 1} / {shots.length}
                </span>
                <span className="font-mono text-[11.5px] text-muted tabular">
                  {formatTime(active.time)} · {active.width}×{active.height} ·{" "}
                  {formatBytes(active.bytes)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost px-2 py-1"
                onClick={() => setPreview(null)}
                aria-label="Закрыть"
              >
                <IconClose width={15} height={15} />
              </button>
            </div>
            <div className="bg-black p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={`Кадр на ${formatTime(active.time)}`}
                className="mx-auto max-h-[64vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <button
                type="button"
                className="btn"
                onClick={() => setPreview((p) => Math.max(0, (p ?? 0) - 1))}
                disabled={preview === 0}
              >
                ← Предыдущий
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPreview((p) => Math.min(shots.length - 1, (p ?? 0) + 1))}
                disabled={preview === shots.length - 1}
              >
                Следующий →
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => onSeekTo(active.time)}
              >
                <IconPlay width={14} height={14} />
                К этому моменту
              </button>
              <button
                type="button"
                className="btn btn-primary ml-auto"
                onClick={() => onDownloadOne(active)}
              >
                <IconDownload width={15} height={15} />
                Скачать изображение
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
