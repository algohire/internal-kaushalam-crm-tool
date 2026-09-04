import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// HTTP driver for fast reads (no connection overhead, single HTTP request per query)
const sql = neon(connectionString);
export const db = drizzleHttp(sql, { schema });

// Pool driver for transactions (logCall needs multi-statement atomicity)
const pool = new Pool({ connectionString });
export const dbPool = drizzlePool(pool, { schema });
