"use client";

import { IconAlert, IconHistory, IconPlay, IconTrash } from "@/components/icons";
import { EmptyNote } from "@/components/ui";
import { formatBytes, formatTime } from "@/lib/format";
import { STATIC_BUILD } from "@/lib/staticMode";
import type { HistoryItem } from "@/lib/types";

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryPanel({
  items,
  loading,
  error,
  onRefresh,
  onLoad,
  onDelete,
}: {
  items: HistoryItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoad: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">
          <IconHistory width={12} height={12} />
          {items.length} записей
        </span>
        <span
          className="chip"
          title={
            STATIC_BUILD
              ? "История хранится только в этом браузере на этом устройстве"
              : "История хранится в PostgreSQL на сервере"
          }
        >
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          {STATIC_BUILD ? "в этом браузере" : "в базе"}
        </span>
        <button
          type="button"
          className="btn ml-auto px-3 py-1.5 text-[12px]"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Обновляем…" : "Обновить"}
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-bad/40 bg-bad/8 px-3.5 py-3">
          <span className="mt-0.5 text-bad">
            <IconAlert width={15} height={15} />
          </span>
          <div>
            <p className="text-[12.5px] text-chalk">{error}</p>
            <button type="button" className="btn btn-ghost mt-1 px-2 py-1 text-[11.5px]" onClick={onRefresh}>
              Повторить запрос
            </button>
          </div>
        </div>
      ) : null}

      {loading && !items.length ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-xl border border-line-soft bg-raised/40" />
          ))}
        </div>
      ) : null}

      {!loading && !items.length && !error ? (
        <EmptyNote>
          История пуста. Как только вы проанализируете видео и нажмёте «В историю», запись
          с метриками, палитрой, промптом и миниатюрой{" "}
          {STATIC_BUILD
            ? "сохранится в памяти этого браузера — на другом устройстве её не будет."
            : "ляжет в PostgreSQL."}
        </EmptyNote>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex gap-3 rounded-xl border border-line-soft bg-void/45 p-2.5 transition hover:border-edge hover:bg-raised/40"
          >
            <div className="relative h-[58px] w-[96px] shrink-0 overflow-hidden rounded-lg border border-line bg-black">
              {item.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumb}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-dim">
                  <IconHistory width={16} height={16} />
                </span>
              )}
              <span className="absolute bottom-0.5 right-1 font-mono text-[9.5px] text-chalk/85 tabular">
                {formatTime(Number(item.durationSec), false)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-display text-[13px] font-bold text-chalk">
                  {item.title}
                </p>
                <span className="shrink-0 font-mono text-[10px] text-dim">
                  {dateLabel(item.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-dim">
                {item.width}×{item.height} · {item.fps} к/с · {formatBytes(item.sizeBytes)} ·{" "}
                {item.frameCount} кадр(ов)
              </p>
              <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted">
                {item.promptRu || item.promptEn}
              </p>
              {item.palette.length ? (
                <div className="mt-1.5 flex items-center gap-1">
                  {item.palette.slice(0, 7).map((p) => (
                    <span
                      key={p.hex}
                      className="h-2.5 w-2.5 rounded-full border border-white/10"
                      style={{ background: p.hex }}
                      title={`${p.nameRu} ${p.hex}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
                className="btn px-2.5 py-1.5 text-[11.5px]"
                onClick={() => onLoad(item)}
                title="Открыть промпт и метрики записи"
              >
                <IconPlay width={12} height={12} />
                Открыть
              </button>
              <button
                type="button"
                className="btn btn-ghost px-2.5 py-1 text-[11.5px] hover:text-bad"
                onClick={() => onDelete(item.id)}
                title="Удалить запись"
              >
                <IconTrash width={12} height={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
