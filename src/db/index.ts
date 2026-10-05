import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __reversDbPool?: Pool;
};

export const pool =
  globalForDb.__reversDbPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__reversDbPool = pool;
}

export const db = drizzle(pool);

/*  НОВЫЕ КОЛОНКИ БЕЗ РУЧНОЙ МИГРАЦИИ.

    База могла быть создана до того, как появился режим «ДНК ролика».
    Разбор не должен падать с «column dnk does not exist» только потому,
    что никто не прогнал миграцию руками: колонка добавляется сама при
    первом обращении и ровно один раз за жизнь процесса.             */
let подготовка: Promise<void> | null = null;

export function готоваяБаза(): Promise<typeof db> {
  подготовка ??= pool
    .query('alter table if exists "analyses" add column if not exists "dnk" jsonb')
    .then(() => undefined)
    .catch((беда) => {
      /*  Не свалить весь сайт из-за колонки: если прав не хватило,
          скажет сам запрос, который её ждёт.                       */
      console.error("[база] не удалось добавить колонку dnk:", беда);
    });
  return подготовка.then(() => db);
}
