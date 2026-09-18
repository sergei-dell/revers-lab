export function formatTime(sec: number, withMs = true): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 100);
  const base = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return withMs ? `${base}.${String(ms).padStart(2, "0")}` : base;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// Соотношения, которые понимают генераторы видео. Любой кадр приводится к
// ближайшему из них: «0.81:1» ни одна модель не примет.
const RATIOS: Array<[number, number, string]> = [
  [9, 16, "9:16"],
  [3, 4, "3:4"],
  [1, 1, "1:1"],
  [4, 3, "4:3"],
  [16, 9, "16:9"],
];

export function aspectLabel(w: number, h: number): string {
  if (!w || !h) return "—";
  // Сравниваем в логарифмах: 9:16 и 16:9 должны быть одинаково «далеки» от 1:1.
  const r = Math.log(w / h);
  let best = RATIOS[0];
  let bestDiff = Infinity;
  for (const entry of RATIOS) {
    const diff = Math.abs(r - Math.log(entry[0] / entry[1]));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best[2];
}

// ТЕГИ. Разбирает строки и списки тегов, убирает пустые и повторы без учёта
// регистра — первое написание сохраняется. Внутри одного промпта теги
// всегда уникальны.
export function uniqueTags(...sources: Array<string | string[] | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    const parts = Array.isArray(source) ? source : source.split(/[,;]/);
    for (const part of parts) {
      const tag = part.trim().replace(/\s+/g, " ");
      if (!tag) continue;
      const key = tag.toLocaleLowerCase("ru");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

export function mergeTags(...sources: Array<string | string[] | undefined | null>): string {
  return uniqueTags(...sources).join(", ");
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function readableOn(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return relativeLuminance(r, g, b) > 0.55 ? "#0b0b10" : "#f4f1ea";
}

export function slugify(value: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const translit = value
    .toLowerCase()
    .split("")
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join("");
  return (
    translit
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "clip"
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}
