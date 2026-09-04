import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

// Single HTTP driver for everything — reads AND transactions.
// Neon HTTP batches transaction statements into one HTTP request.
export const db = drizzle(sql, { schema });
