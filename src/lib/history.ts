import type { AnalysisRow } from "@/db/schema";
import type { HistoryItem, PaletteEntry, SceneCut, StoredMetrics } from "@/lib/types";

export function rowToHistoryItem(row: AnalysisRow): HistoryItem {
  return {
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    source: row.source,
    durationSec: row.durationSec,
    width: row.width,
    height: row.height,
    fps: row.fps,
    sizeBytes: row.sizeBytes,
    subjectTags: row.subjectTags,
    promptRu: row.promptRu,
    promptEn: row.promptEn,
    negativePrompt: row.negativePrompt,
    structured: (row.structured as Record<string, unknown> | null) ?? null,
    metrics: (row.metrics as StoredMetrics | null) ?? null,
    palette: (row.palette as PaletteEntry[] | null) ?? [],
    scenes: (row.scenes as SceneCut[] | null) ?? [],
    frameCount: row.frameCount,
    thumb: row.thumb,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt ?? new Date().toISOString()),
  };
}
