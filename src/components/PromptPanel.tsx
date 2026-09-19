"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconBolt,
  IconCheck,
  IconCopy,
  IconDownload,
  IconSpark,
} from "@/components/icons";
import { Segmented } from "@/components/ui";
import { ENRICH_FRAME_OPTIONS, type EnrichFrameCount, type FrameLimitInfo } from "@/lib/enrichOptions";
import { copyText, mergeTags } from "@/lib/format";
import { STATIC_BUILD } from "@/lib/staticMode";
import { STYLE_PRESETS, type StylePreset } from "@/lib/prompt";
import type { PromptBundle } from "@/lib/types";

type View = "prompt" | "json" | "negative";
export type EnrichState = "idle" | "loading" | "done" | "error";

// Чем заполнять окно промпта по кнопке.
export type ApplyMode = "model" | "both" | "metrics";

export const APPLY_MODES: Array<{ id: ApplyMode; label: string; hint: string }> = [
  { id: "model", label: "Только модель", hint: "описание сцены от нейросети" },
  {
    id: "both",
    label: "Модель + замеры",
    hint: "описание сцены плюс палитра с кодами, движение камеры, монтаж и зерно",
  },
  { id: "metrics", label: "Только замеры", hint: "промпт из измерений, как до нейросети" },
];

// Что возвращает /api/enrich: готовый промпт, теги и разбор по частям.
export type EnrichAnswer = {
  ru: string;
  en: string;
  tags: string[];
  replacements: Array<{ from: string; to: string }>;
  negative: string;
  action: Array<{ t: string; beat: string }>;
  /** сколько кадров ушло и сколько что заняло — показывается под ответом */
  timing?: { frames: number; captureMs: number; modelMs: number | null; totalMs: number; requestKb: number | null };
};
export type SaveState = "idle" | "saving" | "saved" | "error";

export function PromptPanel({
  bundle,
  lang,
  onLangChange,
  view,
  onViewChange,
  preset,
  onPresetChange,
  tags,
  onTagsChange,
  draft,
  onDraftChange,
  onResetDraft,
  onDownload,
  enrichState,
  enrichResult,
  enrichError,
  onEnrich,
  onApplyEnrich,
  applyMode,
  frameCount,
  onFrameCountChange,
  frameLimit,
  scrollHint,
  applied,
  onDismissEnrich,
  saveState,
  onSave,
}: {
  bundle: PromptBundle | null;
  lang: "ru" | "en";
  onLangChange: (lang: "ru" | "en") => void;
  view: View;
  onViewChange: (view: View) => void;
  preset: StylePreset;
  onPresetChange: (preset: StylePreset) => void;
  tags: string;
  onTagsChange: (tags: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onResetDraft: () => void;
  onDownload: (kind: "txt" | "json") => void;
  enrichState: EnrichState;
  enrichResult: EnrichAnswer | null;
  enrichError: string | null;
  onEnrich: () => void;
  onApplyEnrich: (mode: ApplyMode) => void;
  applyMode: ApplyMode;
  frameCount: EnrichFrameCount;
  onFrameCountChange: (count: EnrichFrameCount) => void;
  frameLimit: FrameLimitInfo | null;
  /** куда прокрутить окно промпта после подстановки */
  scrollHint: { share: number; key: number } | null;
  /** чем закончилось последнее нажатие режима — окно сверит это с собой */
  applied: { mode: ApplyMode; length: number; key: number } | null;
  onDismissEnrich: () => void;
  saveState: SaveState;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const checked = useRef<number | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  /*  СВЕРКА: то ли лежит в окне, что собрал обработчик. Если нет — видно
      сразу и в консоли, и человеку: раньше «ничего не происходит» нельзя
      было отличить от «текст собрался, но не доехал».                 */
  useEffect(() => {
    if (!applied || checked.current === applied.key) return;
    const вОкне = area.current?.value.length ?? -1;
    const сошлось = вОкне === applied.length;
    // Сошлось — больше не сверяем: дальше текст меняет уже человек.
    if (сошлось) checked.current = applied.key;
    console.info(
      `[режимы] ${applied.mode}: в окне ${вОкне} знаков, собрано ${applied.length} — ${сошлось ? "совпало" : "НЕ СОВПАЛО"}`,
    );
  }, [applied, draft]);

  /*  Показать то, что добавилось. Окно промпта невысокое: при ответе модели
      в три-пять предложений блок замеров уходит ниже видимой части, и первый
      экран выглядит точно как в режиме «только модель». Прокрутка повторяется
      на следующем кадре: после подстановки идут ещё перерисовки (теги, язык),
      и они возвращают окно наверх.                                        */
  useEffect(() => {
    if (!scrollHint) return;
    const прокрутить = () => {
      const узел = area.current;
      if (!узел) return;
      const цель = узел.scrollHeight * scrollHint.share - узел.clientHeight / 3;
      узел.scrollTop = Math.max(0, Math.min(узел.scrollHeight, цель));
    };
    прокрутить();
    const кадр = requestAnimationFrame(прокрутить);
    const позже = setTimeout(прокрутить, 80);
    return () => {
      cancelAnimationFrame(кадр);
      clearTimeout(позже);
    };
  }, [scrollHint]);

  if (!bundle) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
        <p className="text-[12.5px] text-dim">
          Промпт появится сразу после анализа видео.
        </p>
      </div>
    );
  }

  const json = JSON.stringify(bundle.structured, null, 2);
  const body =
    view === "json" ? json : view === "negative" ? bundle.negative : draft;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  const copy = async (text: string, key: string) => {
    const ok = await copyText(text);
    setCopied(ok ? key : null);
    if (!ok) setCopied("fail");
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={lang}
          onChange={onLangChange}
          options={[
            { id: "ru", label: "RU" },
            { id: "en", label: "EN" },
          ]}
        />
        <Segmented
          size="sm"
          value={view}
          onChange={onViewChange}
          options={[
            { id: "prompt", label: "Промпт" },
            { id: "json", label: "JSON" },
            { id: "negative", label: "Негатив" },
          ]}
        />
      </div>

      <div>
        <p className="hud-label mb-1.5">Стилевой пресет</p>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((p) => {
            const active = p.id === preset;
            return (
              <button
                key={p.id}
                type="button"
                title={p.hint}
                onClick={() => onPresetChange(p.id)}
                className={`rounded-lg border px-2.5 py-1.5 font-display text-[12px] font-semibold transition ${
                  active
                    ? "border-ember/60 bg-ember/14 text-ember"
                    : "border-line bg-void/50 text-muted hover:border-edge hover:text-chalk"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="hud-label mb-1.5 block" htmlFor="subject-tags">
          Что в кадре · теги объекта
        </label>
        <input
          id="subject-tags"
          className="field"
          placeholder="например: девушка в дождевике, ночная улица, неон, отражения в лужах"
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {bundle.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagsChange(mergeTags(tags, t))}
              className="chip transition hover:border-ice/50 hover:text-ice"
              title="Добавить в теги объекта"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={area}
          className={`field resize-y font-mono text-[12.5px] leading-relaxed ${
            view === "prompt" ? "min-h-[230px]" : "min-h-[230px] bg-void/70"
          }`}
          value={body}
          readOnly={view !== "prompt"}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck={false}
        />
        <div className="pointer-events-none absolute bottom-2.5 right-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
          <span>{words} слов</span>
          <span>·</span>
          <span>{body.length} симв.</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          onClick={() => copy(view === "json" ? json : view === "negative" ? bundle.negative : draft, "main")}
        >
          {copied === "main" ? (
            <IconCheck width={15} height={15} className="text-good" />
          ) : (
            <IconCopy width={15} height={15} />
          )}
          {copied === "main" ? "Скопировано" : "Копировать"}
        </button>
        <button type="button" className="btn" onClick={() => onDownload("txt")}>
          <IconDownload width={15} height={15} />
          .txt
        </button>
        <button type="button" className="btn" onClick={() => onDownload("json")}>
          <IconDownload width={15} height={15} />
          .json
        </button>
        <button
          type="button"
          className="btn"
          onClick={onResetDraft}
          disabled={view !== "prompt"}
          title="Пересобрать промпт из измерений"
        >
          Пересобрать
        </button>
        <button
          type="button"
          className={`btn ml-auto ${
            saveState === "saved" ? "border-good/45 text-good" : "btn-primary"
          }`}
          onClick={onSave}
          disabled={saveState === "saving" || saveState === "saved"}
        >
          {saveState === "saving" ? (
            <>
              <IconSpark width={15} height={15} className="animate-film" />
              Сохраняем…
            </>
          ) : saveState === "saved" ? (
            <>
              <IconCheck width={15} height={15} />В базе
            </>
          ) : saveState === "error" ? (
            <>Повторить сохранение</>
          ) : (
            <>
              <IconSpark width={15} height={15} />В историю
            </>
          )}
        </button>
      </div>

      {copied === "fail" ? (
        <p className="rounded-lg border border-warn/40 bg-warn/8 px-3 py-2 text-[12px] text-warn">
          Браузер заблокировал буфер обмена — выделите текст вручную.
        </p>
      ) : null}

      {/* ---------- AI enrichment ---------- */}
      {STATIC_BUILD ? (
        <div className="panel-flat p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-flare">
              <IconBolt width={15} height={15} />
            </span>
            <p className="font-display text-[12.5px] font-bold uppercase tracking-[0.09em] text-chalk">
              Усиление нейросетью
            </p>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            В этой версии описания сцены нейросетью нет: страница работает без сервера, а ключ
            модели в браузер отдавать нельзя. Весь остальной разбор — свет, цвет, оптика,
            движение камеры, монтаж, промпт и кадры — считается прямо здесь.
          </p>
        </div>
      ) : (
      <div className="panel-flat p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-flare">
              <IconBolt width={15} height={15} />
            </span>
            <p className="font-display text-[12.5px] font-bold uppercase tracking-[0.09em] text-chalk">
              Усиление нейросетью
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="Сколько кадров отправить модели">
              {ENRICH_FRAME_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onFrameCountChange(n)}
                  disabled={enrichState === "loading"}
                  title={`Отправить модели ${n} кадров, равномерно по всему ролику`}
                  className={`min-w-[34px] rounded-md border px-2 py-1 font-mono text-[11.5px] transition ${
                    n === frameCount
                      ? "border-ember/60 bg-ember/14 text-ember"
                      : "border-line bg-void/50 text-muted hover:border-edge hover:text-chalk"
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="ml-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim">кадров</span>
            </div>
            <button
              type="button"
              className="btn px-3 py-1.5 text-[12px]"
              onClick={onEnrich}
              disabled={enrichState === "loading" || frameLimit?.fits === false}
            >
              {enrichState === "loading" ? "Модель думает…" : "Описать кадры моделью"}
            </button>
          </div>
        </div>

        {frameLimit?.fits === false && frameLimit.frames === frameCount && frameLimit.message ? (
          <div className="animate-rise mt-3 rounded-lg border border-warn/40 bg-warn/8 px-3 py-2.5">
            <p className="text-[12.5px] leading-snug text-chalk/90">{frameLimit.message}</p>
          </div>
        ) : null}

        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Локальный движок измеряет физику кадра. Если на сервере задан{" "}
          <code className="rounded bg-void px-1 py-0.5 font-mono text-[11px] text-ice">
            POLLINATIONS_API_KEY
          </code>
          , {frameCount} кадров, взятых равномерно по всему ролику, и метрики уходят в vision-модель
          {frameLimit?.maxImages ? ` (она принимает до ${frameLimit.maxImages} картинок)` : ""} — она называет объекты,
          среду и действие по секундам. Бренды, франшизы, персонажей и реальных людей модель
          заменяет архетипами и показывает список замен.
        </p>

        {enrichState === "error" && enrichError ? (
          <div className="animate-rise mt-3 rounded-lg border border-warn/40 bg-warn/8 px-3 py-2.5">
            <p className="text-[12.5px] leading-snug text-chalk/90">{enrichError}</p>
            <button
              type="button"
              className="btn btn-ghost mt-1.5 px-2 py-1 text-[11.5px]"
              onClick={onDismissEnrich}
            >
              Понятно, остаться на локальном анализе
            </button>
          </div>
        ) : null}

        {enrichState === "done" && enrichResult ? (
          <div className="animate-rise mt-3 space-y-2.5">
            <div className="rounded-lg border border-good/35 bg-good/6 p-3">
              {enrichResult.timing ? (
                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-dim">
                  {enrichResult.timing.frames} кадров · снимали {(enrichResult.timing.captureMs / 1000).toFixed(1)} с
                  {enrichResult.timing.modelMs !== null
                    ? ` · модель ответила за ${(enrichResult.timing.modelMs / 1000).toFixed(1)} с`
                    : ""}
                  {` · всего ${(enrichResult.timing.totalMs / 1000).toFixed(1)} с`}
                  {enrichResult.timing.requestKb !== null ? ` · ${enrichResult.timing.requestKb} КБ` : ""}
                </p>
              ) : null}
              <p className="hud-label mb-1 text-good/80">Ответ модели · RU</p>
              <p className="text-[12.5px] leading-relaxed text-chalk">{enrichResult.ru}</p>
              <p className="hud-label mb-1 mt-2.5 text-good/80">EN</p>
              <p className="text-[12.5px] leading-relaxed text-chalk/85">{enrichResult.en}</p>
              {enrichResult.tags.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {enrichResult.tags.map((t) => (
                    <span key={t} className="chip border-good/30 text-good/90">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {enrichResult.action.length ? (
              <div className="rounded-lg border border-line-soft bg-void/50 p-3">
                <p className="hud-label mb-1.5">Действие по секундам</p>
                <ul className="space-y-1">
                  {enrichResult.action.map((b, i) => (
                    <li key={`${b.t}-${i}`} className="flex gap-2 text-[12px] leading-snug text-muted">
                      <span className="shrink-0 font-mono text-[11px] text-ice">{b.t || "—"}</span>
                      <span className="text-chalk/85">{b.beat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {enrichResult.replacements.length ? (
              <div className="rounded-lg border border-warn/35 bg-warn/6 p-3">
                <p className="hud-label mb-1.5 text-warn/90">Заменено архетипами</p>
                <ul className="space-y-1">
                  {enrichResult.replacements.map((r, i) => (
                    <li key={`${r.from}-${i}`} className="text-[12px] leading-snug text-muted">
                      <span className="text-chalk/90">{r.from}</span> → {r.to}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {enrichResult.negative ? (
              <div className="rounded-lg border border-line-soft bg-void/50 p-3">
                <p className="hud-label mb-1.5">Негативный промпт от модели</p>
                <p className="font-mono text-[11.5px] leading-relaxed text-muted">{enrichResult.negative}</p>
                <button
                  type="button"
                  className="btn btn-ghost mt-2 px-2 py-1 text-[11.5px]"
                  onClick={() => copy(enrichResult.negative, "ai-neg")}
                >
                  {copied === "ai-neg" ? "Скопировано" : "Копировать негатив"}
                </button>
              </div>
            ) : null}
            <div>
              <p className="hud-label mb-1.5">Чем заполнить промпт</p>
              <div className="flex flex-wrap gap-1.5">
                {APPLY_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.hint}
                    onClick={() => onApplyEnrich(m.id)}
                    className={`rounded-lg border px-3 py-2 font-display text-[12px] font-semibold transition ${
                      m.id === applyMode
                        ? "border-ember/60 bg-ember/14 text-ember"
                        : "border-line bg-void/50 text-muted hover:border-edge hover:text-chalk"
                    }`}
                  >
                    {m.id === applyMode ? <IconCheck width={13} height={13} className="mr-1 inline" /> : null}
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-dim">
                Флаги --ar и --duration добавляются в любом режиме. Выбранный режим запомнится.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => copy(enrichResult.en, "ai-en")}
              >
                {copied === "ai-en" ? "Скопировано" : "Копировать EN"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onDismissEnrich}>
                Отклонить
              </button>
            </div>
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
