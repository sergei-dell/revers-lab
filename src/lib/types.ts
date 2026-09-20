export type FrameSource = "manual" | "auto" | "scene";

export type FrameShot = {
  id: string;
  time: number;
  url: string;
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  format: string;
  source: FrameSource;
};

export type VideoMeta = {
  fileName: string;
  source: "upload" | "url";
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  fpsDetected: boolean;
  sizeBytes: number;
  mime: string;
  aspect: string;
};

export type CameraMove =
  | "static"
  | "pan-left"
  | "pan-right"
  | "tilt-up"
  | "tilt-down"
  | "push-in"
  | "pull-out"
  | "handheld"
  | "whip";

export type FrameStat = {
  t: number;
  luma: number;
  contrast: number;
  saturation: number;
  warmth: number;
  edges: number;
  grain: number;
  diff: number;
  dx: number;
  dy: number;
};

export type SceneCut = {
  index: number;
  start: number;
  end: number;
  keyframe: number;
  intensity: number;
};

export type PaletteEntry = {
  hex: string;
  rgb: [number, number, number];
  weight: number;
  name: string;
  nameRu: string;
};

export type Analysis = {
  sampledFrames: number;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  edges: number;
  grain: number;
  flicker: number;
  motionMean: number;
  motionPeak: number;
  motionShake: number;
  staticRatio: number;
  camera: CameraMove;
  cameraConfidence: number;
  cameraVector: { dx: number; dy: number; zoom: number };
  scenes: SceneCut[];
  palette: PaletteEntry[];
  dominantHues: string[];
  stats: FrameStat[];
  exposure: "low-key" | "mid" | "high-key";
  /*  Размер самой картинки без чёрных полей и какие поля нашлись.
      По нему считается формат кадра: вертикальный ролик внутри широкого
      файла — это 9:16, а не 16:9.                                    */
  picture?: { width: number; height: number; bars: "нет" | "по бокам" | "сверху и снизу" };
};

export type PromptBundle = {
  ru: string;
  en: string;
  negative: string;
  structured: Record<string, unknown>;
  headline: string;
  tags: string[];
};

export type StoredMetrics = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  edges: number;
  grain: number;
  flicker: number;
  motion: { mean: number; peak: number; shake: number; staticRatio: number };
  camera: {
    label: CameraMove;
    labelRu: string;
    labelEn: string;
    dx: number;
    dy: number;
    zoom: number;
    confidence: number;
  };
  exposure: Analysis["exposure"];
  sampledFrames: number;
  dominantHues: string[];
};

export type HistoryItem = {
  id: string;
  title: string;
  fileName: string;
  source: string;
  durationSec: string;
  width: number;
  height: number;
  fps: string;
  sizeBytes: number;
  subjectTags: string;
  promptRu: string;
  promptEn: string;
  negativePrompt: string;
  structured: Record<string, unknown> | null;
  metrics: StoredMetrics | null;
  palette: PaletteEntry[];
  scenes: SceneCut[];
  frameCount: number;
  thumb: string | null;
  createdAt: string;
};
