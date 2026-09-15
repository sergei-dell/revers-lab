import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { PaletteEntry, SceneCut, StoredMetrics } from "@/lib/types";

export const analyses = pgTable("analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  fileName: text("file_name").notNull().default("clip"),
  source: text("source").notNull().default("upload"),
  durationSec: numeric("duration_sec", { precision: 12, scale: 3 })
    .notNull()
    .default("0"),
  width: integer("width").notNull().default(0),
  height: integer("height").notNull().default(0),
  fps: numeric("fps", { precision: 8, scale: 2 }).notNull().default("0"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  subjectTags: text("subject_tags").notNull().default(""),
  promptRu: text("prompt_ru").notNull().default(""),
  promptEn: text("prompt_en").notNull().default(""),
  structured: jsonb("structured").$type<Record<string, unknown>>(),
  negativePrompt: text("negative_prompt").notNull().default(""),
  metrics: jsonb("metrics").$type<StoredMetrics>(),
  palette: jsonb("palette").$type<PaletteEntry[]>().notNull().default([]),
  scenes: jsonb("scenes").$type<SceneCut[]>().notNull().default([]),
  frameCount: integer("frame_count").notNull().default(0),
  thumb: text("thumb"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AnalysisRow = typeof analyses.$inferSelect;
export type AnalysisInsert = typeof analyses.$inferInsert;
