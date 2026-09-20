import { clamp, rgbToHex } from "@/lib/format";
import { seekVideo, makeCanvas, drawVideo } from "@/lib/video/capture";
import { рамкаКартинки, размерКартинки, type Рамка } from "@/lib/video/letterbox";
import type {
  Analysis,
  CameraMove,
  FrameStat,
  PaletteEntry,
  SceneCut,
} from "@/lib/types";

const ANALYSIS_WIDTH = 208;
const SHIFT_RANGE = 6;

type NamedColor = {
  name: string;
  ru: string;
  rgb: [number, number, number];
};

const COLOR_NAMES: NamedColor[] = [
  { name: "near black", ru: "почти чёрный", rgb: [10, 10, 12] },
  { name: "charcoal", ru: "угольный", rgb: [42, 42, 48] },
  { name: "slate grey", ru: "серый сланец", rgb: [104, 108, 120] },
  { name: "silver", ru: "серебристый", rgb: [186, 190, 198] },
  { name: "pure white", ru: "чистый белый", rgb: [248, 248, 246] },
  { name: "ivory", ru: "слоновая кость", rgb: [240, 232, 208] },
  { name: "deep red", ru: "глубокий красный", rgb: [140, 26, 32] },
  { name: "crimson", ru: "багровый", rgb: [214, 48, 62] },
  { name: "ember orange", ru: "раскалённый оранжевый", rgb: [236, 108, 34] },
  { name: "amber", ru: "янтарный", rgb: [244, 176, 62] },
  { name: "sunflower", ru: "жёлтый солнца", rgb: [240, 214, 84] },
  { name: "olive", ru: "олива", rgb: [118, 128, 62] },
  { name: "forest green", ru: "лесной зелёный", rgb: [38, 96, 58] },
  { name: "emerald", ru: "изумрудный", rgb: [56, 190, 122] },
  { name: "mint", ru: "мятный", rgb: [150, 226, 196] },
  { name: "teal", ru: "сине-зелёный", rgb: [40, 142, 152] },
  { name: "cyan", ru: "циан", rgb: [86, 204, 232] },
  { name: "steel blue", ru: "стальной синий", rgb: [70, 108, 152] },
  { name: "cobalt", ru: "кобальт", rgb: [32, 62, 154] },
  { name: "navy", ru: "тёмно-синий", rgb: [16, 24, 58] },
  { name: "indigo", ru: "индиго", rgb: [70, 60, 160] },
  { name: "violet", ru: "фиолетовый", rgb: [134, 82, 190] },
  { name: "magenta", ru: "маджента", rgb: [206, 60, 168] },
  { name: "blush pink", ru: "пудровый розовый", rgb: [238, 168, 186] },
  { name: "skin tone", ru: "тон кожи", rgb: [214, 168, 138] },
  { name: "umber brown", ru: "умбра", rgb: [108, 72, 46] },
  { name: "sand", ru: "песочный", rgb: [206, 180, 138] },
];

function nearestColorName(r: number, g: number, b: number): NamedColor {
  let best = COLOR_NAMES[0];
  let bestDist = Infinity;
  for (const c of COLOR_NAMES) {
    const dr = (c.rgb[0] - r) * 0.3;
    const dg = (c.rgb[1] - g) * 0.59;
    const db = (c.rgb[2] - b) * 0.11;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

const HUE_NAMES: Array<[number, string]> = [
  [15, "красный"],
  [42, "оранжевый"],
  [68, "жёлтый"],
  [160, "зелёный"],
  [196, "бирюзовый"],
  [250, "синий"],
  [292, "фиолетовый"],
  [334, "пурпурный"],
  [361, "красный"],
];

function hueName(h: number): string {
  for (const [limit, label] of HUE_NAMES) if (h < limit) return label;
  return "красный";
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function toGray(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i += 1, p += 4) {
    gray[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  }
  return gray;
}

function sobelMean(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] -
        2 * gray[i - 1] -
        gray[i + w - 1] +
        gray[i - w + 1] +
        2 * gray[i + 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      sum += Math.sqrt(gx * gx + gy * gy);
      n += 1;
    }
  }
  return n ? sum / n / 255 : 0;
}

function grainEstimate(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      const grad =
        Math.abs(gray[i + 1] - gray[i - 1]) + Math.abs(gray[i + w] - gray[i - w]);
      if (grad < 14) {
        sum += lap;
        sq += lap * lap;
        n += 1;
      }
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sq / n - mean * mean)) / 255;
}

function shiftInRegion(
  prev: Float32Array,
  cur: Float32Array,
  w: number,
  h: number,
  x0: number,
  x1: number,
): { dx: number; dy: number; sad: number } {
  let best = { dx: 0, dy: 0, sad: Infinity };
  const step = 2;
  for (let dy = -SHIFT_RANGE; dy <= SHIFT_RANGE; dy += 1) {
    for (let dx = -SHIFT_RANGE; dx <= SHIFT_RANGE; dx += 1) {
      let sad = 0;
      let n = 0;
      for (let y = SHIFT_RANGE + 1; y < h - SHIFT_RANGE - 1; y += step) {
        for (let x = Math.max(x0, SHIFT_RANGE + 1); x < Math.min(x1, w - SHIFT_RANGE - 1); x += step) {
          const a = prev[y * w + x];
          const b = cur[(y + dy) * w + (x + dx)];
          sad += Math.abs(a - b);
          n += 1;
        }
      }
      if (n === 0) continue;
      const norm = sad / n;
      if (norm < best.sad) best = { dx, dy, sad: norm };
    }
  }
  if (!Number.isFinite(best.sad)) return { dx: 0, dy: 0, sad: 0 };
  return best;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdev(values: number[], mean?: number): number {
  if (values.length < 2) return 0;
  const m = mean ?? values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export async function analyzeVideo(
  video: HTMLVideoElement,
  duration: number,
  opts: {
    samples?: number;
    onProgress?: (done: number, total: number, label: string) => void;
  } = {},
): Promise<Analysis> {
  const samples = clamp(opts.samples ?? 28, 6, 96);
  const w0 = video.videoWidth || 640;
  const h0 = video.videoHeight || 360;
  const aw = ANALYSIS_WIDTH;
  const ah = Math.max(8, Math.round((h0 * aw) / w0));
  const canvas = makeCanvas(aw, ah);

  const paletteBuckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  const hueWeights = new Map<string, number>();

  const stats: FrameStat[] = [];
  // Где в каждом кадре сама картинка — по этому считаются чёрные поля.
  const рамки: Рамка[] = [];
  let prevGray: Float32Array | null = null;
  let prevTime = 0;

  const step = duration > 0 ? duration / samples : 0;

  for (let i = 0; i < samples; i += 1) {
    const t = duration > 0 ? Math.min(duration - 0.03, step * i + step / 2) : 0;
    await seekVideo(video, t);
    const ctx = drawVideo(video, canvas);
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, aw, ah);
    } catch {
      throw new Error(
        "Не удалось прочитать пиксели видео — источник защищён от кросс-доменного доступа.",
      );
    }
    const data = imageData.data;
    рамки.push(рамкаКартинки(data, aw, ah));
    const gray = toGray(data, aw, ah);

    let lumaSum = 0;
    let lumaSq = 0;
    let satSum = 0;
    let warmSum = 0;
    const px = aw * ah;

    for (let p = 0, idx = 0; idx < px; idx += 1, p += 4) {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const l = gray[idx];
      lumaSum += l;
      lumaSq += l * l;
      warmSum += r - b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      satSum += sat;

      if (idx % 3 === 0) {
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const bucket = paletteBuckets.get(key);
        if (bucket) {
          bucket.count += 1;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
        } else {
          paletteBuckets.set(key, { count: 1, r, g, b });
        }
        if (sat > 0.18 && max > 34) {
          const [h] = rgbToHsl(r, g, b);
          const label = hueName(h);
          hueWeights.set(label, (hueWeights.get(label) ?? 0) + sat * (max / 255));
        }
      }
    }

    const luma = lumaSum / px / 255;
    const contrast = Math.sqrt(Math.max(0, lumaSq / px - (lumaSum / px) ** 2)) / 255;
    const saturation = satSum / px;
    const warmth = warmSum / px / 255;
    const edges = sobelMean(gray, aw, ah);
    const grain = grainEstimate(gray, aw, ah);

    let diff = 0;
    let dx = 0;
    let dy = 0;
    if (prevGray) {
      let acc = 0;
      for (let idx = 0; idx < px; idx += 2) acc += Math.abs(gray[idx] - prevGray[idx]);
      diff = acc / (px / 2) / 255;
      const full = shiftInRegion(prevGray, gray, aw, ah, 0, aw);
      dx = full.dx;
      dy = full.dy;
    }

    stats.push({
      t,
      luma,
      contrast,
      saturation,
      warmth,
      edges,
      grain,
      diff,
      dx,
      dy,
    });

    prevGray = gray;
    prevTime = t;
    opts.onProgress?.(i + 1, samples, `кадр ${i + 1}/${samples} · ${t.toFixed(2)}s`);
  }

  void prevTime;

  // ---- palette ----
  const totalBucketed = [...paletteBuckets.values()].reduce((a, b) => a + b.count, 0) || 1;
  const rawColors = [...paletteBuckets.entries()]
    .map(([, v]) => ({
      r: v.r / v.count,
      g: v.g / v.count,
      b: v.b / v.count,
      weight: v.count / totalBucketed,
    }))
    .filter((c) => c.weight > 0.004)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 22);

  const merged: typeof rawColors = [];
  for (const c of rawColors) {
    const hit = merged.find(
      (m) => Math.hypot(m.r - c.r, m.g - c.g, m.b - c.b) < 46,
    );
    if (hit) {
      const sum = hit.weight + c.weight;
      hit.r = (hit.r * hit.weight + c.r * c.weight) / sum;
      hit.g = (hit.g * hit.weight + c.g * c.weight) / sum;
      hit.b = (hit.b * hit.weight + c.b * c.weight) / sum;
      hit.weight = sum;
    } else {
      merged.push({ ...c });
    }
  }
  const palette: PaletteEntry[] = merged
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7)
    .map((c) => {
      const named = nearestColorName(c.r, c.g, c.b);
      return {
        hex: rgbToHex(c.r, c.g, c.b),
        rgb: [Math.round(c.r), Math.round(c.g), Math.round(c.b)],
        weight: Number(c.weight.toFixed(4)),
        name: named.name,
        nameRu: named.ru,
      };
    });

  const dominantHues = [...hueWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  // ---- motion ----
  const diffs = stats.slice(1).map((s) => s.diff);
  const motionMean = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  const motionPeak = diffs.length ? Math.max(...diffs) : 0;
  const staticRatio = diffs.length
    ? diffs.filter((d) => d < 0.018).length / diffs.length
    : 1;

  const dxs = stats.slice(1).map((s) => s.dx);
  const dys = stats.slice(1).map((s) => s.dy);
  const medDx = median(dxs);
  const medDy = median(dys);
  const shake =
    stdev(diffs.length ? diffs : [0]) * 0.6 +
    stdev(dxs.length ? dxs : [0]) * 0.05 +
    stdev(dys.length ? dys : [0]) * 0.05;

  // zoom: content divergence between left and right halves
  let zoom = 0;
  let zoomSamples = 0;
  for (let i = 1; i < stats.length; i += 3) {
    const t = stats[i].t;
    await seekVideo(video, Math.max(0, t - (step || 0.1)));
    const ctxA = drawVideo(video, canvas);
    const grayA = toGray(ctxA.getImageData(0, 0, aw, ah).data, aw, ah);
    await seekVideo(video, t);
    const ctxB = drawVideo(video, canvas);
    const grayB = toGray(ctxB.getImageData(0, 0, aw, ah).data, aw, ah);
    const left = shiftInRegion(grayA, grayB, aw, ah, 0, Math.floor(aw / 2));
    const right = shiftInRegion(grayA, grayB, aw, ah, Math.ceil(aw / 2), aw);
    zoom += (left.dx - right.dx) / 2;
    zoomSamples += 1;
  }
  const zoomScore = zoomSamples ? zoom / zoomSamples : 0;

  let camera: CameraMove = "static";
  let cameraConfidence = 0.5;

  if (motionPeak > 0.16 && Math.abs(medDx) >= 2) {
    camera = "whip";
    cameraConfidence = clamp(motionPeak * 3, 0.4, 0.95);
  } else if (zoomScore > 0.55) {
    camera = "push-in";
    cameraConfidence = clamp(zoomScore / 2, 0.4, 0.9);
  } else if (zoomScore < -0.55) {
    camera = "pull-out";
    cameraConfidence = clamp(-zoomScore / 2, 0.4, 0.9);
  } else if (Math.abs(medDx) > 0.65 && Math.abs(medDx) > Math.abs(medDy)) {
    camera = medDx > 0 ? "pan-left" : "pan-right";
    cameraConfidence = clamp(Math.abs(medDx) / 3, 0.4, 0.92);
  } else if (Math.abs(medDy) > 0.55) {
    camera = medDy > 0 ? "tilt-up" : "tilt-down";
    cameraConfidence = clamp(Math.abs(medDy) / 2.4, 0.4, 0.9);
  } else if (motionMean > 0.035 && shake > 0.035) {
    camera = "handheld";
    cameraConfidence = clamp(shake * 6, 0.4, 0.88);
  } else if (staticRatio > 0.82 || motionMean < 0.012) {
    camera = "static";
    cameraConfidence = clamp(0.55 + staticRatio * 0.4, 0.5, 0.97);
  } else {
    camera = "handheld";
    cameraConfidence = 0.35;
  }

  // ---- scenes ----
  const diffMean = motionMean;
  const diffStd = stdev(diffs.length ? diffs : [0]);
  const cutThreshold = Math.max(0.11, diffMean + 2.4 * diffStd);
  const scenes: SceneCut[] = [];
  let sceneStart = 0;
  let sceneIndex = 0;
  for (let i = 1; i < stats.length; i += 1) {
    const s = stats[i];
    const isCut = s.diff > cutThreshold;
    const isLast = i === stats.length - 1;
    if (isCut || isLast) {
      const end = isCut ? (stats[i - 1].t + s.t) / 2 : s.t;
      if (end - sceneStart > 0.12 || isLast) {
        const seg = stats.filter((x) => x.t >= sceneStart && x.t <= end);
        const keyframeIdx = seg.length
          ? seg.reduce((best, x) => (x.edges > best.edges ? x : best), seg[0]).t
          : sceneStart;
        scenes.push({
          index: sceneIndex,
          start: Number(sceneStart.toFixed(3)),
          end: Number(end.toFixed(3)),
          keyframe: Number(keyframeIdx.toFixed(3)),
          intensity: Number((s.diff / Math.max(0.0001, cutThreshold)).toFixed(2)),
        });
        sceneIndex += 1;
        sceneStart = end;
      }
    }
  }
  if (!scenes.length) {
    scenes.push({
      index: 0,
      start: 0,
      end: Number(duration.toFixed(3)),
      keyframe: Number((duration / 2).toFixed(3)),
      intensity: 1,
    });
  }

  const avg = (pick: (s: FrameStat) => number) =>
    stats.reduce((a, s) => a + pick(s), 0) / (stats.length || 1);

  /*  Картинка без полей — в пикселях исходника, а не разборного кадра. */
  const кадр = размерКартинки(рамки, aw, ah);
  const picture = {
    width: Math.max(1, Math.round((кадр.width * w0) / aw)),
    height: Math.max(1, Math.round((кадр.height * h0) / ah)),
    bars: кадр.поля,
  };

  const brightness = avg((s) => s.luma);
  const contrastMean = avg((s) => s.contrast);
  const exposure: Analysis["exposure"] =
    brightness < 0.28 ? "low-key" : brightness > 0.62 ? "high-key" : "mid";

  return {
    sampledFrames: stats.length,
    brightness,
    contrast: contrastMean,
    saturation: avg((s) => s.saturation),
    warmth: avg((s) => s.warmth),
    edges: avg((s) => s.edges),
    grain: avg((s) => s.grain),
    flicker: stdev(stats.map((s) => s.luma)),
    motionMean,
    motionPeak,
    motionShake: shake,
    staticRatio,
    camera,
    cameraConfidence,
    cameraVector: {
      dx: Number(medDx.toFixed(2)),
      dy: Number(medDy.toFixed(2)),
      zoom: Number(zoomScore.toFixed(2)),
    },
    scenes,
    palette,
    dominantHues,
    stats,
    exposure,
    picture,
  };
}

export const CAMERA_LABELS: Record<CameraMove, { ru: string; en: string }> = {
  static: { ru: "статичная камера", en: "locked-off static camera" },
  "pan-left": { ru: "панорама влево", en: "smooth pan left" },
  "pan-right": { ru: "панорама вправо", en: "smooth pan right" },
  "tilt-up": { ru: "наезд вверх (тилт)", en: "tilt up" },
  "tilt-down": { ru: "тилт вниз", en: "tilt down" },
  "push-in": { ru: "медленный наезд (push-in)", en: "slow push-in dolly" },
  "pull-out": { ru: "отъезд камеры (pull-out)", en: "slow pull-out dolly" },
  handheld: { ru: "ручная камера, лёгкое дрожание", en: "handheld camera with subtle shake" },
  whip: { ru: "резкая проводка (whip pan)", en: "fast whip pan" },
};
