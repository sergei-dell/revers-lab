"use client";

import { useRef, useState } from "react";
import {
  IconAlert,
  IconBolt,
  IconFilm,
  IconSpark,
  IconSplit,
  IconUpload,
} from "@/components/icons";
import { formatBytes } from "@/lib/format";

const ACCEPTED_EXT = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg", ".mkv", ".avi"];
const MAX_BYTES = 800 * 1024 * 1024;

const STEPS = [
  {
    n: "01",
    title: "Захват",
    text: "Файл открывается в браузере, декодер видео остаётся локальным — никуда ничего не уходит.",
    icon: <IconUpload width={15} height={15} />,
  },
  {
    n: "02",
    title: "Анализ",
    text: "28+ выборок по таймлайну: экспозиция, контраст, палитра, Sobel-детализация, зерно, оптический сдвиг.",
    icon: <IconSplit width={15} height={15} />,
  },
  {
    n: "03",
    title: "Обратный промпт",
    text: "Измерения складываются в готовый промпт RU/EN, JSON-разбор и негативный промпт для видеомоделей.",
    icon: <IconSpark width={15} height={15} />,
  },
  {
    n: "04",
    title: "Видео → изображения",
    text: "Покадровая нарезка, ключевые кадры по сценам, контактный лист, ZIP-архив и экспорт отрезка в WebM.",
    icon: <IconFilm width={15} height={15} />,
  },
];

export function Dropzone({
  onFile,
  busy,
}: {
  onFile: (file: File) => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSend = (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    const looksVideo =
      file.type.startsWith("video/") || ACCEPTED_EXT.some((ext) => name.endsWith(ext));
    if (!looksVideo) {
      setError(
        `«${file.name}» не похож на видео. Поддерживаются MP4 (H.264), WebM, MOV, M4V, OGV.`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Файл ${formatBytes(file.size)} — слишком тяжёлый для браузерного декодирования. Limit ${formatBytes(MAX_BYTES)}.`,
      );
      return;
    }
    if (file.size === 0) {
      setError("Файл пустой.");
      return;
    }
    onFile(file);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (busy) return;
            const file = e.dataTransfer.files?.[0];
            if (file) validateAndSend(file);
            else setError("Не удалось прочитать файл из перетаскивания.");
          }}
          className={`noise-overlay panel relative flex min-h-[380px] flex-col justify-between overflow-hidden p-6 transition ${
            drag ? "border-ember/70 shadow-[0_0_0_3px_rgba(255,106,43,0.12)]" : ""
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] sprocket-strip opacity-40" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] sprocket-strip opacity-40" />
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.16] blur-3xl"
            style={{ background: "radial-gradient(circle,#ff6a2b 0%,transparent 70%)" }}
          />

          <div className="relative">
            <span className="chip border-ember/40 text-ember">
              <IconBolt width={12} height={12} /> локальный анализ · файл не покидает браузер
            </span>
            <h2 className="mt-4 max-w-[16ch] font-display text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[0.98] tracking-[-0.02em] text-chalk">
              Разберите видео
              <br />
              <span className="text-ember">обратно</span> на промпт
              <br />и на кадры
            </h2>
            <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
              Перетащите ролик сюда — движок измерит свет, цвет, оптику и движение камеры,
              соберёт промпт для генеративных моделей и нарежет видео на изображения.
            </p>
          </div>

          <div className="relative mt-6">
            <div
              className={`rounded-xl border-2 border-dashed p-5 text-center transition ${
                drag ? "border-ember bg-ember/8" : "border-edge bg-void/50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                >
                  <IconUpload width={16} height={16} />
                  Выбрать видеофайл
                </button>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
                  MP4 · WebM · MOV · до 800 МБ
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="video/*,.mkv,.avi"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) validateAndSend(file);
                  e.target.value = "";
                }}
              />
            </div>

            {error ? (
              <div className="animate-rise mt-3 flex items-start gap-2.5 rounded-lg border border-bad/40 bg-bad/8 px-3 py-2.5">
                <span className="mt-0.5 text-bad">
                  <IconAlert width={15} height={15} />
                </span>
                <p className="text-[12.5px] leading-snug text-chalk/90">{error}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="panel h-full p-5">
          <p className="hud-label">Пайплайн реверса</p>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="group flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-void text-ember transition group-hover:border-ember/60 group-hover:bg-ember/10">
                    {s.icon}
                  </span>
                  <span className="mt-1.5 w-px flex-1 bg-line" />
                </div>
                <div className="pb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10.5px] tracking-[0.14em] text-dim">{s.n}</span>
                    <h3 className="font-display text-[14px] font-bold uppercase tracking-[0.06em] text-chalk">
                      {s.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2 rounded-xl border border-line-soft bg-void/60 p-3.5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">
              Что сохраняется в историю
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Только метаданные, метрики, палитра, промпт и миниатюра 320 px — в памяти
              этого браузера. Сам файл и полноразмерные кадры не сохраняются нигде.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
