"use client";

import { useEffect, type ReactNode } from "react";
import { IconAlert, IconCheck, IconClose, IconLoader } from "@/components/icons";

export type ToastTone = "info" | "success" | "error" | "busy";
export type Toast = { id: string; tone: ToastTone; title: string; detail?: string };

const TONE: Record<ToastTone, { ring: string; text: string; icon: ReactNode }> = {
  info: { ring: "border-line", text: "text-ice", icon: <IconLoader className="animate-film" /> },
  success: { ring: "border-good/40", text: "text-good", icon: <IconCheck /> },
  error: { ring: "border-bad/45", text: "text-bad", icon: <IconAlert /> },
  busy: { ring: "border-ember/45", text: "text-ember", icon: <IconLoader className="animate-film" /> },
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2">
      {toasts.map((t) => {
        const tone = TONE[t.tone];
        return (
          <div
            key={t.id}
            className={`animate-rise pointer-events-auto flex items-start gap-3 rounded-xl border ${tone.ring} bg-panel/95 px-3.5 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur`}
          >
            <span className={`mt-0.5 shrink-0 ${tone.text}`}>{tone.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-semibold leading-snug text-chalk">
                {t.title}
              </p>
              {t.detail ? (
                <p className="mt-0.5 text-[12px] leading-snug text-muted">{t.detail}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded-md p-1 text-dim transition hover:bg-white/5 hover:text-chalk"
              aria-label="Закрыть уведомление"
            >
              <IconClose width={14} height={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Progress({
  ratio,
  label,
  tone = "ember",
}: {
  ratio: number;
  label?: string;
  tone?: "ember" | "ice";
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="w-full">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            tone === "ember"
              ? "bg-gradient-to-r from-ember-deep via-ember to-flare"
              : "bg-gradient-to-r from-ice/70 to-ice"
          }`}
          style={{ width: `${pct}%` }}
        />
        {pct < 100 ? (
          <div className="animate-sweep absolute inset-0 opacity-70" />
        ) : null}
      </div>
      {label ? (
        <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
          {label}
        </p>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: Array<{ id: T; label: string; icon?: ReactNode }>;
  onChange: (id: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-void/70 p-0.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 rounded-[7px] font-display font-semibold transition ${
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12.5px]"
            } ${
              active
                ? "bg-ember/15 text-ember shadow-[inset_0_0_0_1px_rgba(255,106,43,0.35)]"
                : "text-muted hover:bg-white/5 hover:text-chalk"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel relative overflow-hidden ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[13.5px] font-bold uppercase tracking-[0.12em] text-chalk">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Modal({
  open,
  onClose,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-void/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-rise max-h-full w-full max-w-4xl overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <p className="text-[12.5px] leading-relaxed text-dim">{children}</p>
    </div>
  );
}
