/**
 * Current database state + what caller work exists that a re-import must not destroy.
 *
 *   npx tsx src/scripts/db-state.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

function f(v: unknown): string {
  return (Number(v) || 0).toLocaleString("en-IN");
}
function head(t: string) {
  console.log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  head("TABLE COUNTS");
  const tables = [
    "company", "requirement", "contact", "interaction", "task",
    "requirement_version", "edb_outbox", "audit_log", "edb_raw",
    "import_batch", "qualification_master",
  ];
  for (const t of tables) {
    const [r] = await q(`SELECT COUNT(*)::int c FROM "${t}"`);
    console.log(`  ${t.padEnd(22)}${f(r.c).padStart(9)}`);
  }

  head("IMPORT BATCHES ALREADY RUN");
  const batches = await q(`
    SELECT source_file, extract_date, imported_at, row_count,
           company_count, requirement_count
    FROM import_batch ORDER BY imported_at`);
  for (const b of batches) {
    console.log(`  ${b.source_file}`);
    console.log(`    extract ${b.extract_date} · imported ${String(b.imported_at).slice(0, 10)}`);
    console.log(`    ${f(b.row_count)} rows · ${f(b.company_count)} companies · ${f(b.requirement_count)} requirements`);
  }

  head("CALLER WORK AT RISK IF RE-IMPORT OVERWRITES");
  const [work] = await q(`
    SELECT
      COUNT(*) FILTER (WHERE required_count_validated > 0)::int          AS validated,
      COUNT(*) FILTER (WHERE classification IS NOT NULL
                         AND classification <> '')::int                  AS classified,
      COUNT(*) FILTER (WHERE status <> 'captured')::int                  AS status_changed,
      COUNT(*) FILTER (WHERE qualification IS NOT NULL
                         AND qualification <> '')::int                   AS qualification,
      COUNT(*) FILTER (WHERE handoff_comment IS NOT NULL
                         AND handoff_comment <> '')::int                 AS handoff_comment,
      COUNT(*) FILTER (WHERE version > 1)::int                           AS versioned
    FROM requirement`);
  console.log(`  roles with validated count   ${f(work.validated).padStart(7)}`);
  console.log(`  roles classified             ${f(work.classified).padStart(7)}`);
  console.log(`  roles with status changed    ${f(work.status_changed).padStart(7)}`);
  console.log(`  roles with qualification     ${f(work.qualification).padStart(7)}`);
  console.log(`  roles with handoff comment   ${f(work.handoff_comment).padStart(7)}`);
  console.log(`  roles edited (version > 1)   ${f(work.versioned).padStart(7)}`);

  const [co] = await q(`
    SELECT COUNT(*) FILTER (WHERE contact_count > 0)::int AS called,
           COUNT(*) FILTER (WHERE tags IS NOT NULL AND tags <> '')::int AS tagged,
           COUNT(*) FILTER (WHERE bookmarked_by IS NOT NULL)::int AS bookmarked
    FROM company`);
  console.log(`\n  companies with calls logged  ${f(co.called).padStart(7)}`);
  console.log(`  companies tagged             ${f(co.tagged).padStart(7)}`);
  console.log(`  companies bookmarked         ${f(co.bookmarked).padStart(7)}`);

  head("CONTACTS BY SOURCE");
  const contacts = await q(`
    SELECT source, COUNT(*)::int c FROM contact GROUP BY source ORDER BY COUNT(*) DESC`);
  for (const r of contacts) {
    console.log(`  ${String(r.source).padEnd(14)}${f(r.c).padStart(8)}`);
  }

  head("TASKS BY SOURCE AND STATUS");
  const tasks = await q(`
    SELECT source, status, COUNT(*)::int c
    FROM task GROUP BY source, status ORDER BY COUNT(*) DESC`);
  for (const r of tasks) {
    console.log(`  ${String(r.source).padEnd(18)}${String(r.status).padEnd(10)}${f(r.c).padStart(8)}`);
  }

  head("UNIQUE KEYS THAT PROTECT AGAINST DUPLICATES");
  const idx = await q(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname='public' AND indexdef LIKE '%UNIQUE%'
      AND tablename IN ('company','requirement','contact','task')
    ORDER BY tablename`);
  for (const r of idx) {
    console.log(`  ${String(r.tablename).padEnd(14)}${r.indexname}`);
    console.log(`    ${String(r.indexdef).replace(/^CREATE UNIQUE INDEX \S+ ON \S+ /, "")}`);
  }
  if (idx.length === 0) console.log("  (none found)");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
