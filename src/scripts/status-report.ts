/**
 * Regenerates every figure in the "Employer Requirement Gathering — Status Update"
 * document, live from the CRM database.
 *
 *   npx tsx src/scripts/status-report.ts
 *
 * Output is ordered to match the document section by section so figures can be
 * transcribed directly.
 *
 * NOTE ON SCOPE: sections 2, 8 and 9 describe the Employer Database itself. This
 * CRM holds a point-in-time EDB extract, so those counts reflect the extract
 * loaded here, not the live EDB.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

const CONNECTED =
  "('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')";

const DISPOSITION_LABELS: Record<string, string> = {
  no_answer: "No answer",
  no_requirement: "No requirement",
  hiring_now: "Hiring now",
  do_not_call: "Do not call",
  hiring_later: "Hiring later",
  wrong_contact: "Wrong contact",
  not_operational: "Not operational",
  duplicate: "Duplicate",
};

function n(v: unknown): number {
  return Number(v) || 0;
}
function fmt(v: unknown): string {
  return n(v).toLocaleString("en-IN");
}
function pct(x: number, y: number, dp = 1): string {
  return y > 0 ? `${((x / y) * 100).toFixed(dp)}%` : "—";
}
function row(cells: [string, number][], first: string, firstWidth: number): string {
  return (
    first.padEnd(firstWidth) +
    cells.map(([v, w]) => String(v).padStart(w)).join("")
  );
}
function rule(width: number): string {
  return "-".repeat(width);
}
function section(title: string): void {
  console.log(`\n\n${"═".repeat(76)}`);
  console.log(title);
  console.log("═".repeat(76));
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (text: string) => sql.query(text);

  // ════════ 2. Employer Database — Current Position ════════
  const [[edbCompanies], [edbSubmissions], [edbRoles], [edbOpenings]] =
    await Promise.all([
      q(`SELECT COUNT(*)::int c FROM company`),
      q(`SELECT COUNT(DISTINCT reference_id)::int c FROM requirement`),
      q(`SELECT COUNT(*)::int c FROM requirement`),
      q(`SELECT COALESCE(SUM(required_count),0)::int c FROM requirement`),
    ]);

  section("2. EMPLOYER DATABASE — CURRENT POSITION");
  console.log(`  Companies on EDB                  ${fmt(edbCompanies.c).padStart(10)}`);
  console.log(`  Requirement submissions recorded  ${fmt(edbSubmissions.c).padStart(10)}`);
  console.log(`  Roles recorded                    ${fmt(edbRoles.c).padStart(10)}`);
  console.log(`  Openings recorded                 ${fmt(edbOpenings.c).padStart(10)}`);

  // ════════ 3. Outreach Progress ════════
  const [
    [attempted],
    [connected],
    [validatedByDisposition],
    [validatedByCount],
    [handedCompanies],
    [validatedRoles],
    [dispatchedCompanies],
    [validatedOpenings],
    [handedRoles],
    [handedOpenings],
    [dispatchedRoles],
  ] = await Promise.all([
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM interaction`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM interaction
       WHERE disposition IN ${CONNECTED}`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM interaction
       WHERE disposition = 'hiring_now'`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE required_count_validated > 0`),
    // Handed over = a route has been decided on the role. Classification is the
    // act of handing over; the status flip is a downstream dispatch flag.
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE classification IS NOT NULL AND classification <> ''`),
    q(`SELECT COUNT(*)::int c FROM requirement WHERE required_count_validated > 0`),
    // Of those, how many have additionally been dispatched to the downstream queue
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE status LIKE 'handed_over_%'`),
    q(`SELECT COALESCE(SUM(required_count_validated),0)::int c FROM requirement
       WHERE required_count_validated > 0`),
    q(`SELECT COUNT(*)::int c FROM requirement
       WHERE classification IS NOT NULL AND classification <> ''`),
    q(`SELECT COALESCE(SUM(required_count_validated),0)::int c FROM requirement
       WHERE classification IS NOT NULL AND classification <> ''
         AND required_count_validated > 0`),
    q(`SELECT COUNT(*)::int c FROM requirement WHERE status LIKE 'handed_over_%'`),
  ]);

  const universe = n(edbCompanies.c);
  const att = n(attempted.c);
  const con = n(connected.c);
  const valDisp = n(validatedByDisposition.c);
  const valCount = n(validatedByCount.c);
  const handed = n(handedCompanies.c);
  const dispatched = n(dispatchedCompanies.c);

  section("3. OUTREACH PROGRESS");
  console.log("  Stage                Companies    % of EDB      Roles    Openings");
  console.log(`  ${rule(70)}`);
  console.log(`  EDB universe         ${fmt(universe).padStart(9)}      100.0%  ${fmt(edbRoles.c).padStart(9)}  ${fmt(edbOpenings.c).padStart(10)}`);
  console.log(`  Attempted            ${fmt(att).padStart(9)}  ${pct(att, universe).padStart(10)}          —           —`);
  console.log(`  Not yet contacted    ${fmt(universe - att).padStart(9)}  ${pct(universe - att, universe).padStart(10)}          —           —`);
  console.log(`  Connected            ${fmt(con).padStart(9)}  ${pct(con, universe).padStart(10)}          —           —`);
  console.log(`  Not connected        ${fmt(att - con).padStart(9)}  ${pct(att - con, universe).padStart(10)}          —           —`);
  console.log(`  Validated            ${fmt(valCount).padStart(9)}  ${pct(valCount, universe).padStart(10)}  ${fmt(validatedRoles.c).padStart(9)}  ${fmt(validatedOpenings.c).padStart(10)}`);
  console.log(`  Handed over          ${fmt(handed).padStart(9)}  ${pct(handed, universe).padStart(10)}  ${fmt(handedRoles.c).padStart(9)}  ${fmt(handedOpenings.c).padStart(10)}`);
  console.log(`\n  Conversion between stages`);
  console.log(`    Attempted to Connected       ${pct(con, att)}`);
  console.log(`    Connected to Validated       ${pct(valCount, con)}`);
  console.log(`    Validated to Handed over     ${pct(handed, valCount)}`);
  console.log(`\n  Of the ${fmt(handed)} companies handed over, ${fmt(dispatched)} have additionally been`);
  console.log(`  dispatched to the downstream queue (${fmt(dispatchedRoles.c)} of ${fmt(handedRoles.c)} roles).`);
  console.log(`  The remaining ${fmt(handed - dispatched)} are decided but not yet visible to the`);
  console.log(`  receiving team — see section 6.`);

  if (valDisp !== valCount) {
    console.log(`\n  Note — two definitions of "validated company" are in use:`);
    console.log(`    vacancy count recorded > 0   ${fmt(valCount).padStart(6)}   <- used throughout this report`);
    console.log(`    disposition = Hiring Now     ${fmt(valDisp).padStart(6)}   <- used by the printed status update`);
    console.log(`  The count-based definition is used here because every downstream stage`);
    console.log(`  (Classified, Handed over) is derived from role records, not call disposition.`);
  }

  // ════════ 4. Call Outcomes ════════
  const [dispRows, [totalCalls], [multiCalled]] = await Promise.all([
    q(`SELECT disposition, COUNT(*)::int c FROM interaction
       GROUP BY disposition ORDER BY COUNT(*) DESC`),
    q(`SELECT COUNT(*)::int c FROM interaction`),
    q(`SELECT COUNT(*)::int c FROM (
         SELECT company_code FROM interaction
         GROUP BY company_code HAVING COUNT(*) > 1) s`),
  ]);

  section("4. CALL OUTCOMES");
  console.log("  Outcome                  Calls    Share");
  console.log(`  ${rule(42)}`);
  for (const d of dispRows) {
    const label = DISPOSITION_LABELS[d.disposition as string] ?? (d.disposition as string);
    console.log(`  ${label.padEnd(22)}${fmt(d.c).padStart(7)}  ${pct(n(d.c), n(totalCalls.c), 0).padStart(7)}`);
  }
  console.log(`  ${rule(42)}`);
  console.log(`  ${"Total calls logged".padEnd(22)}${fmt(totalCalls.c).padStart(7)}     100%`);
  console.log(`\n  ${fmt(multiCalled.c)} companies have been called more than once.`);

  // ════════ 5. Requirement Validation ════════
  // Roles still awaiting validation. Roles a caller deliberately closed as
  // "not required any more" are excluded — they are finished work, not pending.
  const [pendingRoles] = await q(
    `SELECT COUNT(*)::int c FROM requirement
     WHERE status = 'captured'
       AND (required_count_validated IS NULL OR required_count_validated = 0)`
  );
  const [closedRoles] = await q(
    `SELECT COUNT(*)::int c FROM requirement WHERE status = 'no_requirement'`
  );

  section("5. REQUIREMENT VALIDATION");
  console.log(`  Companies validated (vacancy count recorded)         ${fmt(valCount).padStart(9)}`);
  console.log(`  Companies that said Hiring Now on the call           ${fmt(valDisp).padStart(9)}`);
  console.log(`  Roles validated (vacancy count confirmed on call)    ${fmt(validatedRoles.c).padStart(9)}`);
  console.log(`  Openings validated (positions confirmed on call)     ${fmt(validatedOpenings.c).padStart(9)}`);
  console.log(`  Roles closed on call (not required any more)         ${fmt(closedRoles.c).padStart(9)}`);
  console.log(`  Roles still pending validation                      ${fmt(pendingRoles.c).padStart(9)}`);
  console.log(`  Roles validated as a share of roles recorded         ${pct(n(validatedRoles.c), n(edbRoles.c)).padStart(9)}`);
  console.log(`  Openings validated as a share of openings recorded   ${pct(n(validatedOpenings.c), n(edbOpenings.c)).padStart(9)}`);

  // ════════ 6. Handover ════════
  const [routeRows, [bothRoutes]] = await Promise.all([
    q(`SELECT classification AS status,
              COUNT(DISTINCT company_code)::int companies,
              COUNT(*)::int roles,
              COALESCE(SUM(required_count_validated),0)::int openings,
              COUNT(*) FILTER (WHERE status LIKE 'handed_over_%')::int dispatched
       FROM requirement
       WHERE classification IS NOT NULL AND classification <> ''
       GROUP BY classification ORDER BY COUNT(*) DESC`),
    q(`SELECT COUNT(*)::int c FROM (
         SELECT company_code FROM requirement
         WHERE classification IS NOT NULL AND classification <> ''
         GROUP BY company_code
         HAVING COUNT(DISTINCT classification) > 1) s`),
  ]);

  const ROUTE_LABELS: Record<string, string> = {
    kaushalam: "Scheduling — Kaushalam direct hiring",
    collector: "District Collector — local mobilisation",
    apssdc: "APSSDC — training-linked",
  };
  const seen = new Set(routeRows.map((r: Record<string, unknown>) => r.status as string));
  for (const k of Object.keys(ROUTE_LABELS)) {
    if (!seen.has(k)) routeRows.push({ status: k, companies: 0, roles: 0 });
  }

  section("6. HANDOVER — ROUTING POSITION");
  console.log("  Route                                  Companies  Roles  Openings  Share");
  console.log(`  ${rule(74)}`);
  for (const r of routeRows) {
    const label = ROUTE_LABELS[r.status as string] ?? (r.status as string);
    console.log(
      `  ${label.padEnd(38)}${fmt(r.companies).padStart(8)}${fmt(r.roles).padStart(8)}${fmt(r.openings).padStart(10)}  ${pct(n(r.roles), n(handedRoles.c), 0).padStart(6)}`
    );
  }
  console.log(`  ${rule(74)}`);
  console.log(`  ${"Total handed over".padEnd(38)}${fmt(handed).padStart(8)}${fmt(handedRoles.c).padStart(8)}${fmt(handedOpenings.c).padStart(10)}    100%`);
  console.log(`\n  ${fmt(bothRoutes.c)} companies have requirements routed to more than one channel,`);
  console.log(`  which is why the unique company total (${fmt(handed)}) is lower than the sum of the rows.`);

  console.log(`\n  Dispatch status of handed-over work:`);
  console.log(`    Dispatched to the downstream queue        ${fmt(dispatchedRoles.c).padStart(7)} roles / ${fmt(dispatched)} companies`);
  console.log(`    Decided, not yet dispatched              ${fmt(n(handedRoles.c) - n(dispatchedRoles.c)).padStart(7)} roles / ${fmt(handed - dispatched)} companies`);
  console.log(`\n  Validated roles with no route decided yet   ${fmt(n(validatedRoles.c) - n(handedRoles.c)).padStart(7)}`);

  // ════════ 7. Validated Openings by Qualification ════════
  const [qualRows, qualMasterRows] = await Promise.all([
    q(`SELECT qualification,
              COUNT(*)::int roles,
              COALESCE(SUM(required_count_validated),0)::int openings
       FROM requirement
       WHERE required_count_validated > 0 AND qualification IS NOT NULL
       GROUP BY qualification
       ORDER BY COALESCE(SUM(required_count_validated),0) DESC`),
    q(`SELECT id, name FROM qualification_master`),
  ]);

  const qualMap: Record<string, string> = {};
  for (const m of qualMasterRows) qualMap[m.id as string] = m.name as string;
  const resolve = (raw: string) =>
    raw.split(";").map((id) => qualMap[id.trim()] ?? id.trim()).filter(Boolean).join(", ");

  section("7. VALIDATED OPENINGS BY QUALIFICATION SOUGHT");
  console.log("  Qualification                                   Roles    Openings");
  console.log(`  ${rule(66)}`);
  const TOP = 10;
  let otherRoles = 0;
  let otherOpenings = 0;
  qualRows.forEach((r: Record<string, unknown>, i: number) => {
    if (i < TOP) {
      const label = resolve(r.qualification as string);
      console.log(
        `  ${(label.length > 42 ? label.slice(0, 41) + "…" : label).padEnd(44)}${fmt(r.roles).padStart(7)}${fmt(r.openings).padStart(12)}`
      );
    } else {
      otherRoles += n(r.roles);
      otherOpenings += n(r.openings);
    }
  });
  if (qualRows.length > TOP) {
    console.log(
      `  ${`All other qualification groups (${qualRows.length - TOP})`.padEnd(44)}${fmt(otherRoles).padStart(7)}${fmt(otherOpenings).padStart(12)}`
    );
  }
  console.log(`  ${rule(66)}`);
  console.log(
    `  ${`Total (${qualRows.length} qualification groups)`.padEnd(44)}${fmt(validatedRoles.c).padStart(7)}${fmt(validatedOpenings.c).padStart(12)}`
  );

  // ════════ 8. Recorded Openings by Required Timeframe ════════
  const timeRows = await q(
    `SELECT required_within_months m,
            COUNT(*)::int roles,
            COALESCE(SUM(required_count),0)::int openings
     FROM requirement
     GROUP BY required_within_months
     ORDER BY required_within_months NULLS LAST`
  );

  section("8. RECORDED OPENINGS BY REQUIRED TIMEFRAME");
  console.log("  Required within        Roles    Openings    Share");
  console.log(`  ${rule(52)}`);
  for (const r of timeRows) {
    const label = r.m === null ? "not specified" : `${r.m} months`;
    console.log(
      `  ${label.padEnd(20)}${fmt(r.roles).padStart(8)}${fmt(r.openings).padStart(12)}  ${pct(n(r.openings), n(edbOpenings.c)).padStart(7)}`
    );
  }
  console.log(`  ${rule(52)}`);
  console.log(`  ${"Total".padEnd(20)}${fmt(edbRoles.c).padStart(8)}${fmt(edbOpenings.c).padStart(12)}     100%`);

  // ════════ 9. Recorded Openings by Sector ════════
  const sectorRows = await q(
    `SELECT TRIM(s) sector,
            COUNT(DISTINCT c.company_code)::int companies,
            COALESCE(SUM(r.required_count),0)::int openings
     FROM company c
     CROSS JOIN LATERAL unnest(string_to_array(c.sectors, ';')) AS s
     LEFT JOIN requirement r ON r.company_code = c.company_code
     WHERE c.sectors IS NOT NULL AND c.sectors <> '' AND TRIM(s) <> ''
     GROUP BY TRIM(s)
     ORDER BY COALESCE(SUM(r.required_count),0) DESC`
  );
  const [multiSector] = await q(
    `SELECT COUNT(*)::int c FROM company
     WHERE sectors IS NOT NULL AND sectors LIKE '%;%'`
  );

  section("9. RECORDED OPENINGS BY SECTOR");
  console.log("  Sector                                      Companies    Openings");
  console.log(`  ${rule(68)}`);
  const SECTOR_TOP = 15;
  let restOpenings = 0;
  sectorRows.forEach((r: Record<string, unknown>, i: number) => {
    if (i < SECTOR_TOP) {
      const label = r.sector as string;
      console.log(
        `  ${(label.length > 40 ? label.slice(0, 39) + "…" : label).padEnd(42)}${fmt(r.companies).padStart(9)}${fmt(r.openings).padStart(12)}`
      );
    } else {
      restOpenings += n(r.openings);
    }
  });
  if (sectorRows.length > SECTOR_TOP) {
    console.log(
      `  ${`All remaining sectors (${sectorRows.length - SECTOR_TOP})`.padEnd(42)}${"—".padStart(9)}${fmt(restOpenings).padStart(12)}`
    );
  }
  console.log(
    `\n  ${sectorRows.length} sectors in total. ${fmt(multiSector.c)} companies are mapped to more than`
  );
  console.log(`  one sector; sector-wise openings therefore sum above the total.`);

  // ════════ 10. Summary ════════
  const bySched = routeRows.find((r: Record<string, unknown>) => r.status === "kaushalam");
  const byColl = routeRows.find((r: Record<string, unknown>) => r.status === "collector");
  const byApssdc = routeRows.find((r: Record<string, unknown>) => r.status === "apssdc");

  section("10. SUMMARY OF POSITION");
  console.log(`  Companies on EDB                        ${fmt(edbCompanies.c).padStart(9)}`);
  console.log(`  Roles recorded                          ${fmt(edbRoles.c).padStart(9)}`);
  console.log(`  Openings recorded                       ${fmt(edbOpenings.c).padStart(9)}`);
  console.log(`  Companies attempted                     ${fmt(att).padStart(9)}`);
  console.log(`  Companies connected                     ${fmt(con).padStart(9)}`);
  console.log(`  Companies validated                     ${fmt(valCount).padStart(9)}`);
  console.log(`  Roles validated                         ${fmt(validatedRoles.c).padStart(9)}`);
  console.log(`  Openings validated                      ${fmt(validatedOpenings.c).padStart(9)}`);
  console.log(`  Companies handed over                   ${fmt(handed).padStart(9)}`);
  console.log(`  Openings handed over                    ${fmt(handedOpenings.c).padStart(9)}`);
  console.log(`  Roles handed over — Scheduling          ${fmt(bySched?.roles ?? 0).padStart(9)}`);
  console.log(`  Roles handed over — District Collector  ${fmt(byColl?.roles ?? 0).padStart(9)}`);
  console.log(`  Roles handed over — APSSDC              ${fmt(byApssdc?.roles ?? 0).padStart(9)}`);
  console.log(`  Total roles handed over                 ${fmt(handedRoles.c).padStart(9)}`);

  console.log(`\n\n  Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  console.log(`  Source: Employer Outreach CRM database (all-time cumulative)\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
