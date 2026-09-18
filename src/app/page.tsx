import { Workspace } from "@/components/Workspace";
import { STATIC_BUILD } from "@/lib/staticMode";
import {
  ApertureMark,
  IconBolt,
  IconFilm,
  IconScissors,
  IconSheet,
  IconSpark,
  IconSplit,
  IconWave,
} from "@/components/icons";

const CAPABILITIES = [
  {
    n: "01",
    title: "Обратный промпт",
    text: "RU и EN версия, JSON-разбор по блокам (свет, цвет, оптика, камера, монтаж, настроение) и негативный промпт для видеомоделей.",
    icon: <IconSpark width={16} height={16} />,
    span: "lg:col-span-5",
    tone: "ember",
  },
  {
    n: "02",
    title: "Видео → изображения",
    text: "Покадровая нарезка с любым шагом, ключевые кадры по сценам, PNG / JPEG / WebP, ZIP-архив с manifest.tsv и контактный лист.",
    icon: <IconFilm width={16} height={16} />,
    span: "lg:col-span-4",
    tone: "ice",
  },
  {
    n: "03",
    title: "Движение камеры",
    text: "Блочный поиск оптического сдвига: панорама, тилт, наезд, отъезд, ручная камера и whip pan — с процентом уверенности.",
    icon: <IconSplit width={16} height={16} />,
    span: "lg:col-span-3",
    tone: "flare",
  },
  {
    n: "04",
    title: "Свет, цвет и фактура",
    text: "Экспозиция, контраст, насыщенность, температура, доминирующие оттенки, квантованная палитра из 7 цветов, Sobel-детализация и оценка зерна.",
    icon: <IconWave width={16} height={16} />,
    span: "lg:col-span-5",
    tone: "flare",
  },
  {
    n: "05",
    title: "Монтажные планы",
    text: "Адаптивный порог по межкадровой разнице находит склейки, делит ролик на сцены и предлагает ключевой кадр каждой.",
    icon: <IconBolt width={16} height={16} />,
    span: "lg:col-span-3",
    tone: "good",
  },
  {
    n: "06",
    title: "Экспорт отрезка",
    text: "Точки A и B на таймлайне → отдельный WebM-клип, записанный через MediaRecorder вместе со звуком.",
    icon: <IconScissors width={16} height={16} />,
    span: "lg:col-span-4",
    tone: "ice",
  },
];

const TONE_TEXT: Record<string, string> = {
  ember: "text-ember",
  ice: "text-ice",
  flare: "text-flare",
  good: "text-good",
};

const OUTPUTS = [
  "prompt.txt (RU + EN + negative + tags)",
  "prompt.json (структурный разбор)",
  "report.json (метрики и кривые)",
  "frame_001.png / .jpg / .webp",
  "frames.zip + manifest.tsv",
  "contact-sheet.jpg",
  "clip_A-B.webm",
];

export default function Page() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-void" />
        <div className="stage-grid absolute inset-x-0 top-0 h-[520px]" />
        <div
          className="absolute -left-40 top-[-10rem] h-[30rem] w-[30rem] rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: "radial-gradient(circle,#ff6a2b 0%,transparent 70%)" }}
        />
        <div
          className="absolute right-[-8rem] top-[16rem] h-[26rem] w-[26rem] rounded-full opacity-[0.1] blur-[120px]"
          style={{ background: "radial-gradient(circle,#62d9e8 0%,transparent 70%)" }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-line-soft bg-void/82 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1420px] items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ember/40 bg-ember/10 text-ember">
              <ApertureMark width={20} height={20} />
            </span>
            <div className="leading-none">
              <p className="font-display text-[17px] font-bold uppercase tracking-[0.18em] text-chalk">
                Реверс
              </p>
              <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-dim">
                video → prompt → frames
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden chip sm:inline-flex">
              <IconSheet width={12} height={12} />
              декодер в браузере
            </span>
            <span className="chip border-good/35 text-good">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot bg-good text-good" />
              {STATIC_BUILD ? "без сервера" : "анализ в браузере"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1420px] px-4 pb-14 pt-5 sm:px-6">
        <Workspace />

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="max-w-[22ch] font-display text-[clamp(1.3rem,2.4vw,1.9rem)] font-bold uppercase leading-tight tracking-[-0.01em] text-chalk">
              Что измеряет движок
            </h2>
            <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-muted">
              Всё считается на клиенте: кадр декодируется в canvas, затем по пикселям
              снимаются метрики. Ни файл, ни полноразмерные изображения на сервер не уходят.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-12">
            {CAPABILITIES.map((c) => (
              <article
                key={c.n}
                className={`panel group relative overflow-hidden p-4 transition hover:border-edge ${c.span}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-void transition group-hover:scale-105 ${TONE_TEXT[c.tone]}`}
                  >
                    {c.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] tracking-[0.14em] text-dim">{c.n}</span>
                      <h3 className="font-display text-[13.5px] font-bold uppercase tracking-[0.06em] text-chalk">
                        {c.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{c.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="panel mt-3 flex flex-col gap-4 p-4 md:flex-row md:items-center">
            <div className="md:w-[240px] md:shrink-0">
              <p className="hud-label">Файлы на выходе</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Каждый результат можно скачать прямо из панели.
              </p>
            </div>
            <ul className="grid flex-1 gap-1.5 sm:grid-cols-2">
              {OUTPUTS.map((o) => (
                <li
                  key={o}
                  className="flex items-center gap-2 rounded-lg border border-line-soft bg-void/50 px-2.5 py-1.5 font-mono text-[11px] text-chalk/85"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <span className="truncate">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-soft bg-ink/60">
        <div className="mx-auto flex w-full max-w-[1420px] flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
            Реверс · лаборатория обратной генерации
          </p>
          <p className="text-[11.5px] text-dim sm:ml-auto">
            Hotkeys: Space — play/pause · ← → — кадр · Shift + ← → — секунда · C — снять кадр
          </p>
        </div>
      </footer>
    </div>
  );
}
