"use client";

import { useEffect, useState } from "react";
import {
  IconBolt,
  IconCheck,
  IconCopy,
  IconDownload,
  IconSpark,
} from "@/components/icons";
import { Segmented } from "@/components/ui";
import { copyText } from "@/lib/format";
import { STYLE_PRESETS, type StylePreset } from "@/lib/prompt";
import type { PromptBundle } from "@/lib/types";

type View = "prompt" | "json" | "negative";
export type EnrichState = "idle" | "loading" | "done" | "error";
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
  enrichResult: { ru: string; en: string; tags: string[] } | null;
  enrichError: string | null;
  onEnrich: () => void;
  onApplyEnrich: () => void;
  onDismissEnrich: () => void;
  saveState: SaveState;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

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
              onClick={() =>
                onTagsChange(
                  tags.trim() ? `${tags.replace(/[,;]\s*$/, "")}, ${t}` : t,
                )
              }
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
          <button
            type="button"
            className="btn px-3 py-1.5 text-[12px]"
            onClick={onEnrich}
            disabled={enrichState === "loading"}
          >
            {enrichState === "loading" ? "Модель думает…" : "Описать кадры моделью"}
          </button>
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Локальный движок измеряет физику кадра. Если на сервере задан{" "}
          <code className="rounded bg-void px-1 py-0.5 font-mono text-[11px] text-ice">
            OPENAI_API_KEY
          </code>
          , три ключевых кадра дополнительно уходят в vision-модель — она называет объекты
          и действие.
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
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={onApplyEnrich}>
                <IconCheck width={15} height={15} />
                Подставить в промпт
              </button>
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
    </div>
  );
}
