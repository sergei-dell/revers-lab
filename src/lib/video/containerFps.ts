// ЧАСТОТА КАДРОВ ИЗ МЕТАДАННЫХ ФАЙЛА.
//
// Браузер частоту видео не сообщает. Раньше она считалась по воспроизведению
// — сколько кадров показано за столько-то секунд настоящего времени — и
// врала: вкладка в фоне, тормоза декодера или перемотка давали 48 к/с там,
// где в файле 24. Здесь частота читается из самого контейнера:
//   MP4 / MOV / M4V — дорожка vide: mdhd (шкала времени) и stts (число и длина
//                     сэмплов), частота = сэмплы / длительность;
//   WebM / MKV      — TrackEntry с TrackType=1: DefaultDuration (нс на кадр).
// Читаются только нужные куски файла, целиком он в память не грузится.

const MAX_MOOV_BYTES = 64 * 1024 * 1024;
const WEBM_HEAD_BYTES = 8 * 1024 * 1024;

export async function readContainerFps(file: Blob): Promise<number | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (head.length < 8) return null;
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
      return snap(await webmFps(file));
    }
    const type = ascii(head, 4, 4);
    if (["ftyp", "moov", "mdat", "free", "wide", "skip", "pnot"].includes(type)) {
      return snap(await mp4Fps(file));
    }
  } catch {
    /* файл необычный — пусть решает запасной путь */
  }
  return null;
}

// Частоты вроде 23.976 в контейнере записаны дробью — округляем к привычным.
function snap(fps: number | null): number | null {
  if (!fps || !Number.isFinite(fps) || fps < 1 || fps > 1000) return null;
  const known = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 100, 119.88, 120, 240];
  // Самое близкое, а не первое подходящее: 24 и 23.976 разнятся на 0.1%.
  let best = known[0];
  for (const k of known) if (Math.abs(fps - k) < Math.abs(fps - best)) best = k;
  return Math.abs(fps - best) / best < 0.002 ? best : Number(fps.toFixed(3));
}

function ascii(bytes: Uint8Array, at: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[at + i] ?? 0);
  return s;
}

/* ─── MP4 / MOV ──────────────────────────────────────────────────────── */

async function mp4Fps(file: Blob): Promise<number | null> {
  // moov ищем по верхнему уровню: он бывает и в начале, и в самом конце файла.
  let offset = 0;
  while (offset + 8 <= file.size) {
    const h = new DataView(await file.slice(offset, offset + 16).arrayBuffer());
    let size = h.getUint32(0);
    const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
    let header = 8;
    if (size === 1) {
      size = Number(h.getBigUint64(8));
      header = 16;
    } else if (size === 0) {
      size = file.size - offset;
    }
    if (size < header) return null;
    if (type === "moov") {
      if (size > MAX_MOOV_BYTES) return null;
      const moov = new DataView(await file.slice(offset + header, offset + size).arrayBuffer());
      return fpsFromMoov(moov);
    }
    offset += size;
  }
  return null;
}

type Box = { type: string; start: number; end: number };

function children(view: DataView, start: number, end: number): Box[] {
  const out: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    let size = view.getUint32(at);
    const type = String.fromCharCode(view.getUint8(at + 4), view.getUint8(at + 5), view.getUint8(at + 6), view.getUint8(at + 7));
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < header || at + size > end) break;
    out.push({ type, start: at + header, end: at + size });
    at += size;
  }
  return out;
}

function find(view: DataView, box: Box, type: string): Box | undefined {
  return children(view, box.start, box.end).find((b) => b.type === type);
}

function fpsFromMoov(view: DataView): number | null {
  const moov: Box = { type: "moov", start: 0, end: view.byteLength };
  for (const trak of children(view, moov.start, moov.end).filter((b) => b.type === "trak")) {
    const mdia = find(view, trak, "mdia");
    if (!mdia) continue;
    const hdlr = find(view, mdia, "hdlr");
    // hdlr: версия и флаги (4), pre_defined (4), handler_type (4)
    if (!hdlr || hdlr.start + 12 > hdlr.end) continue;
    const handler = String.fromCharCode(
      view.getUint8(hdlr.start + 8), view.getUint8(hdlr.start + 9),
      view.getUint8(hdlr.start + 10), view.getUint8(hdlr.start + 11),
    );
    if (handler !== "vide") continue;

    const mdhd = find(view, mdia, "mdhd");
    if (!mdhd) continue;
    const version = view.getUint8(mdhd.start);
    const timescale = view.getUint32(mdhd.start + (version === 1 ? 20 : 12));
    if (!timescale) continue;

    const stbl = (() => {
      const minf = find(view, mdia, "minf");
      return minf ? find(view, minf, "stbl") : undefined;
    })();
    const stts = stbl ? find(view, stbl, "stts") : undefined;
    if (!stts) continue;
    const entries = view.getUint32(stts.start + 4);
    let samples = 0;
    let ticks = 0;
    for (let i = 0; i < entries; i++) {
      const at = stts.start + 8 + i * 8;
      if (at + 8 > stts.end) break;
      const count = view.getUint32(at);
      const delta = view.getUint32(at + 4);
      samples += count;
      ticks += count * delta;
    }
    // Фрагментированный MP4 держит сэмплы не здесь — отдаём запасному пути.
    if (samples < 2 || !ticks) continue;
    return samples / (ticks / timescale);
  }
  return null;
}

/* ─── WebM / Matroska ───────────────────────────────────────────────── */

const ID_SEGMENT = 0x18538067;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_TYPE = 0x83;
const ID_DEFAULT_DURATION = 0x23e383;
const ID_CLUSTER = 0x1f43b675;

async function webmFps(file: Blob): Promise<number | null> {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, WEBM_HEAD_BYTES)).arrayBuffer());
  return scanEbml(bytes, 0, bytes.length);
}

function readVint(bytes: Uint8Array, at: number, keepMarker: boolean): { value: number; length: number; unknown: boolean } | null {
  const first = bytes[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || at + length > bytes.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = value === (0xff >> length);
  for (let i = 1; i < length; i++) {
    value = value * 256 + bytes[at + i];
    if (bytes[at + i] !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

function readUint(bytes: Uint8Array, at: number, size: number): number {
  let v = 0;
  for (let i = 0; i < size; i++) v = v * 256 + bytes[at + i];
  return v;
}

function scanEbml(bytes: Uint8Array, start: number, end: number): number | null {
  let at = start;
  while (at < end) {
    const id = readVint(bytes, at, true);
    if (!id) return null;
    const size = readVint(bytes, at + id.length, false);
    if (!size) return null;
    const dataStart = at + id.length + size.length;
    const dataEnd = size.unknown ? end : Math.min(end, dataStart + size.value);

    if (id.value === ID_SEGMENT || id.value === ID_TRACKS) {
      const found = scanEbml(bytes, dataStart, dataEnd);
      if (found) return found;
    } else if (id.value === ID_TRACK_ENTRY) {
      const fps = trackEntryFps(bytes, dataStart, dataEnd);
      if (fps) return fps;
    } else if (id.value === ID_CLUSTER) {
      return null; // до кластеров с кадрами дорожки уже описаны — дальше искать нечего
    }
    if (size.unknown) return null;
    at = dataEnd;
  }
  return null;
}

function trackEntryFps(bytes: Uint8Array, start: number, end: number): number | null {
  let at = start;
  let type = 0;
  let duration = 0;
  while (at < end) {
    const id = readVint(bytes, at, true);
    if (!id) break;
    const size = readVint(bytes, at + id.length, false);
    if (!size || size.unknown) break;
    const dataStart = at + id.length + size.length;
    if (id.value === ID_TRACK_TYPE) type = readUint(bytes, dataStart, size.value);
    if (id.value === ID_DEFAULT_DURATION) duration = readUint(bytes, dataStart, size.value);
    at = dataStart + size.value;
  }
  return type === 1 && duration > 0 ? 1e9 / duration : null;
}
