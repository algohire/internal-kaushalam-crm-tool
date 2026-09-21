/**
 * Full call log for the gap companies — validated but no route decided.
 * Prints the actual comment text so the reason can be read, not inferred.
 *
 *   npx tsx src/scripts/gap-call-logs.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

const VALID = `required_count_validated > 0`;
const ROUTED = `classification IS NOT NULL AND classification <> ''`;
const GAP = `
  SELECT DISTINCT company_code FROM requirement WHERE ${VALID}
  EXCEPT
  SELECT DISTINCT company_code FROM requirement WHERE ${ROUTED}`;

function wrap(s: string, width: number, indent: string): string {
  const words = String(s ?? "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur += " " + w;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.map((l, i) => (i === 0 ? l : indent + l)).join("\n");
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  const rows = await q(`
    WITH gap AS (${GAP})
    SELECT c.company_name, c.company_code, c.tier, c.district,
           i.username, i.disposition, i.channel, i.reason_code,
           i.created_at, i.comment, i.next_step, i.next_action_date,
           (SELECT COUNT(*)::int FROM interaction i2
              WHERE i2.company_code = i.company_code) AS call_count,
           (SELECT COALESCE(SUM(r2.required_count_validated),0)::int
              FROM requirement r2 WHERE r2.company_code = i.company_code
                AND r2.required_count_validated > 0) AS openings,
           (SELECT COUNT(*)::int FROM requirement r3
              WHERE r3.company_code = i.company_code
                AND r3.required_count_validated > 0) AS validated_roles
    FROM interaction i
    INNER JOIN gap g ON g.company_code = i.company_code
    INNER JOIN company c ON c.company_code = i.company_code
    ORDER BY
      (SELECT COALESCE(SUM(r4.required_count_validated),0)
         FROM requirement r4 WHERE r4.company_code = i.company_code
           AND r4.required_count_validated > 0) DESC,
      c.company_name, i.created_at`);

  console.log(`\n${"═".repeat(84)}`);
  console.log(`CALL LOGS — GAP COMPANIES (validated, no route decided)`);
  console.log(`${"═".repeat(84)}`);

  let current = "";
  for (const r of rows) {
    const name = String(r.company_name ?? "");
    if (name !== current) {
      current = name;
      console.log(`\n${"─".repeat(84)}`);
      console.log(
        `${name}   [T${r.tier} · ${r.district ?? "?"}]`
      );
      console.log(
        `${r.openings} openings across ${r.validated_roles} validated role(s) · ${r.call_count} call(s) logged`
      );
      console.log(`${"─".repeat(84)}`);
    }

    const when = r.created_at
      ? new Date(String(r.created_at)).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })
      : "?";

    console.log(`\n  ${when} · ${r.username} · ${r.channel} · ${r.disposition}` +
      (r.reason_code ? ` · reason: ${r.reason_code}` : ""));
    console.log(`    note : ${wrap(String(r.comment ?? "(none)"), 70, "           ")}`);
    console.log(`    next : ${wrap(String(r.next_step ?? "(none)"), 70, "           ")}  [due ${r.next_action_date ?? "?"}]`);
  }

  console.log(`\n${"═".repeat(84)}\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
