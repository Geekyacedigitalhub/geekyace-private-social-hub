import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

neonConfig.fetchConnectionCache = true;

const globalForDb = globalThis as typeof globalThis & {
  __geekyaceDbPool?: Pool;
};

const pool = globalForDb.__geekyaceDbPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.__geekyaceDbPool = pool;
}

export const db = drizzle(pool, { schema });
