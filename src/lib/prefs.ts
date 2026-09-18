"use client";

import { useSyncExternalStore } from "react";

// Выборы, которые помнятся между заходами: режим заполнения промпта, число
// кадров для модели. Живут в памяти браузера. На сервере памяти нет — там
// значение по умолчанию, и разметка при первом показе совпадает; браузер
// сразу подставляет запомненное.

export type ChoiceStore<T> = {
  read: () => T;
  save: (value: T) => void;
  subscribe: (notify: () => void) => () => void;
  fallback: T;
};

export function createChoiceStore<T extends string | number>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): ChoiceStore<T> {
  const listeners = new Set<() => void>();
  let current: T = fallback; // если память браузера закрыта — держим в заходе

  const parse = (raw: string | null): T | null => {
    if (raw === null) return null;
    const hit = allowed.find((a) => String(a) === raw);
    return hit === undefined ? null : hit;
  };

  return {
    fallback,
    read() {
      try {
        return parse(window.localStorage.getItem(key)) ?? current;
      } catch {
        return current;
      }
    },
    save(value) {
      current = value;
      try {
        window.localStorage.setItem(key, String(value));
      } catch {
        /* не запомнилось между заходами — в этом заходе значение держится */
      }
      listeners.forEach((notify) => notify());
    },
    subscribe(notify) {
      listeners.add(notify);
      window.addEventListener("storage", notify);
      return () => {
        listeners.delete(notify);
        window.removeEventListener("storage", notify);
      };
    },
  };
}

export function useChoice<T>(store: ChoiceStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.read, () => store.fallback);
}
