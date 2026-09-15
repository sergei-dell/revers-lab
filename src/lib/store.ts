import { CAMERA_LABELS } from "@/lib/video/analyze";
import type { Analysis, HistoryItem, StoredMetrics } from "@/lib/types";

export function toStoredMetrics(a: Analysis): StoredMetrics {
  return {
    brightness: round(a.brightness),
    contrast: round(a.contrast),
    saturation: round(a.saturation),
    warmth: round(a.warmth),
    edges: round(a.edges),
    grain: round(a.grain),
    flicker: round(a.flicker),
    motion: {
      mean: round(a.motionMean),
      peak: round(a.motionPeak),
      shake: round(a.motionShake),
      staticRatio: round(a.staticRatio),
    },
    camera: {
      label: a.camera,
      labelRu: CAMERA_LABELS[a.camera].ru,
      labelEn: CAMERA_LABELS[a.camera].en,
      dx: a.cameraVector.dx,
      dy: a.cameraVector.dy,
      zoom: a.cameraVector.zoom,
      confidence: round(a.cameraConfidence),
    },
    exposure: a.exposure,
    sampledFrames: a.sampledFrames,
    dominantHues: a.dominantHues,
  };
}

export function analysisFromRow(row: HistoryItem): Analysis | null {
  const m = row.metrics;
  if (!m) return null;
  const cam = m.camera?.label ?? "static";
  return {
    sampledFrames: m.sampledFrames ?? 0,
    brightness: m.brightness,
    contrast: m.contrast,
    saturation: m.saturation,
    warmth: m.warmth,
    edges: m.edges,
    grain: m.grain,
    flicker: m.flicker,
    motionMean: m.motion?.mean ?? 0,
    motionPeak: m.motion?.peak ?? 0,
    motionShake: m.motion?.shake ?? 0,
    staticRatio: m.motion?.staticRatio ?? 1,
    camera: CAMERA_LABELS[cam] ? cam : "static",
    cameraConfidence: m.camera?.confidence ?? 0.5,
    cameraVector: {
      dx: m.camera?.dx ?? 0,
      dy: m.camera?.dy ?? 0,
      zoom: m.camera?.zoom ?? 0,
    },
    scenes: row.scenes ?? [],
    palette: row.palette ?? [],
    dominantHues: m.dominantHues ?? [],
    stats: [],
    exposure: m.exposure ?? "mid",
  };
}

function round(v: number, digits = 5): number {
  const f = 10 ** digits;
  return Math.round((Number.isFinite(v) ? v : 0) * f) / f;
}
