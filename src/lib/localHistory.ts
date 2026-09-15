import type { HistoryItem } from "@/lib/types";

// История разборов живёт в памяти браузера (localStorage): у сайта на
// GitHub Pages нет сервера и базы. Записи видны только в этом браузере
// на этом устройстве.

const KEY = "revers-lab.history.v1";
const LIMIT = 30;

export function readHistory(): HistoryItem[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    throw new Error("Браузер не даёт доступ к своей памяти — история недоступна (например, в приватном окне)");
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    throw new Error("История в памяти браузера повреждена");
  }
}

// Записывает список и возвращает то, что реально сохранилось. Браузер даёт
// сайту около 5 МБ; если не влезло — выбрасываются самые старые записи.
export function writeHistory(items: HistoryItem[]): { saved: HistoryItem[]; dropped: number } {
  let list = items.slice(0, LIMIT);
  const trimmed = items.length - list.length;
  for (;;) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
      return { saved: list, dropped: items.length - list.length - trimmed };
    } catch {
      if (list.length <= 1) {
        throw new Error("В памяти браузера не хватает места даже для одной записи");
      }
      list = list.slice(0, -1);
    }
  }
}
