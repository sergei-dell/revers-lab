// РАЗБОР ПО ОТРЕЗКАМ: длинный ролик делится на куски, и каждый описывается
// своим запросом к модели. На весь ролик модель отвечает общими словами —
// по отрезку она говорит про конкретную сцену.
//
// Кусок — пять секунд; последний бывает короче. Каждый отрезок стоит
// отдельного запроса, поэтому число запросов человеку показывается заранее.

export const SEGMENT_SECONDS = 5;

export type Segment = { index: number; start: number; end: number };

export function splitIntoSegments(duration: number, seconds = SEGMENT_SECONDS): Segment[] {
  const длина = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (!длина) return [];
  const сколько = Math.max(1, Math.ceil(длина / seconds));
  return Array.from({ length: сколько }, (_, index) => ({
    index,
    start: index * seconds,
    end: Math.min(длина, (index + 1) * seconds),
  }));
}

export function segmentLabel(segment: Segment): string {
  const метка = (s: number) => {
    const м = Math.floor(s / 60);
    const сек = Math.floor(s - м * 60);
    return `${String(м).padStart(2, "0")}:${String(сек).padStart(2, "0")}`;
  };
  return `${метка(segment.start)}–${метка(segment.end)}`;
}
