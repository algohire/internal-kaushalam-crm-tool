"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { sql } from "drizzle-orm";

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

const ROUTE_LABELS: Record<string, string> = {
  kaushalam: "Scheduling — Kaushalam direct hiring",
  collector: "District Collector — local mobilisation",
  apssdc: "APSSDC — training-linked",
};

type Row = Record<string, unknown>;

function n(v: unknown): number {
  return Number(v) || 0;
}
function fmt(v: unknown): string {
  return n(v).toLocaleString("en-IN");
}
function pct(x: number, y: number, dp = 1): string {
  return y > 0 ? `${((x / y) * 100).toFixed(dp)}%` : "—";
}

/**
 * Builds the Employer Requirement Gathering status report as Markdown,
 * live from the database. Every figure is computed at call time.
 */
export async function generateStatusReport() {
  await requireAdmin();

  const q = async (text: string): Promise<Row[]> => {
    const res = await db.execute(sql.raw(text));
    return (Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? []) as Row[];
  };

  const [
    [edbCompanies], [edbSubs], [edbRoles], [edbOpenings],
    [attempted], [connected], [valDispRow], [valCountRow],
    [handedCompanies], [dispatchedCompanies],
    [validatedRoles], [validatedOpenings],
    [handedRoles], [handedOpenings], [dispatchedRoles],
    [totalCalls], [multiCalled], [pendingRoles], [closedRoles],
    dispRows, routeRows, [bothRoutes],
    qualRows, qualMaster, timeRows, sectorRows, [multiSector],
    tierRows,
    dropRows,
  ] = await Promise.all([
    q(`SELECT COUNT(*)::int c FROM company`),
    q(`SELECT COUNT(DISTINCT reference_id)::int c FROM requirement`),
    q(`SELECT COUNT(*)::int c FROM requirement`),
    q(`SELECT COALESCE(SUM(required_count),0)::int c FROM requirement`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM interaction`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM interaction WHERE disposition IN ${CONNECTED}`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM interaction WHERE disposition = 'hiring_now'`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM requirement WHERE required_count_validated > 0`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM requirement WHERE classification IS NOT NULL AND classification <> ''`),
    q(`SELECT COUNT(DISTINCT company_code)::int c FROM requirement WHERE status LIKE 'handed_over_%'`),
    q(`SELECT COUNT(*)::int c FROM requirement WHERE required_count_validated > 0`),
    q(`SELECT COALESCE(SUM(required_count_validated),0)::int c FROM requirement WHERE required_count_validated > 0`),
    q(`SELECT COUNT(*)::int c FROM requirement WHERE classification IS NOT NULL AND classification <> ''`),
    q(`SELECT COALESCE(SUM(required_count_validated),0)::int c FROM requirement WHERE classification IS NOT NULL AND classification <> '' AND required_count_validated > 0`),
    q(`SELECT COUNT(*)::int c FROM requirement WHERE status LIKE 'handed_over_%'`),
    q(`SELECT COUNT(*)::int c FROM interaction`),
    q(`SELECT COUNT(*)::int c FROM (SELECT company_code FROM interaction GROUP BY company_code HAVING COUNT(*) > 1) s`),
    q(`SELECT COUNT(*)::int c FROM requirement WHERE status = 'captured' AND (required_count_validated IS NULL OR required_count_validated = 0)`),
    q(`SELECT COUNT(*)::int c FROM requirement WHERE status = 'no_requirement'`),
    q(`SELECT disposition, COUNT(*)::int c FROM interaction GROUP BY disposition ORDER BY COUNT(*) DESC`),
    q(`SELECT classification AS route, COUNT(DISTINCT company_code)::int companies, COUNT(*)::int roles,
              COALESCE(SUM(required_count_validated),0)::int openings,
              COUNT(*) FILTER (WHERE status LIKE 'handed_over_%')::int dispatched
       FROM requirement WHERE classification IS NOT NULL AND classification <> ''
       GROUP BY classification ORDER BY COUNT(*) DESC`),
    q(`SELECT COUNT(*)::int c FROM (SELECT company_code FROM requirement
         WHERE classification IS NOT NULL AND classification <> ''
         GROUP BY company_code HAVING COUNT(DISTINCT classification) > 1) s`),
    q(`SELECT qualification, COUNT(*)::int roles,
              COALESCE(SUM(required_count_validated),0)::int openings
       FROM requirement WHERE required_count_validated > 0 AND qualification IS NOT NULL
       GROUP BY qualification ORDER BY COALESCE(SUM(required_count_validated),0) DESC`),
    q(`SELECT id, name FROM qualification_master`),
    q(`SELECT required_within_months m, COUNT(*)::int roles,
              COALESCE(SUM(required_count),0)::int openings
       FROM requirement GROUP BY required_within_months ORDER BY required_within_months NULLS LAST`),
    q(`SELECT TRIM(s) sector, COUNT(DISTINCT c.company_code)::int companies,
              COALESCE(SUM(r.required_count),0)::int openings
       FROM company c
       CROSS JOIN LATERAL unnest(string_to_array(c.sectors, ';')) AS s
       LEFT JOIN requirement r ON r.company_code = c.company_code
       WHERE c.sectors IS NOT NULL AND c.sectors <> '' AND TRIM(s) <> ''
       GROUP BY TRIM(s) ORDER BY COALESCE(SUM(r.required_count),0) DESC`),
    q(`SELECT COUNT(*)::int c FROM company WHERE sectors IS NOT NULL AND sectors LIKE '%;%'`),
    q(`SELECT c.tier,
              COUNT(DISTINCT c.company_code)::int universe,
              COUNT(DISTINCT i.company_code)::int attempted,
              COUNT(DISTINCT ic.company_code)::int connected,
              COUNT(DISTINCT rv.company_code)::int validated,
              COUNT(DISTINCT rc.company_code)::int classified,
              COUNT(DISTINCT rh.company_code)::int handed_over
       FROM company c
       LEFT JOIN (SELECT DISTINCT company_code FROM interaction) i ON i.company_code = c.company_code
       LEFT JOIN (SELECT DISTINCT company_code FROM interaction WHERE disposition IN ${CONNECTED}) ic ON ic.company_code = c.company_code
       LEFT JOIN (SELECT DISTINCT company_code FROM requirement WHERE required_count_validated > 0) rv ON rv.company_code = c.company_code
       LEFT JOIN (SELECT DISTINCT company_code FROM requirement WHERE classification IS NOT NULL AND classification <> '') rc ON rc.company_code = c.company_code
       LEFT JOIN (SELECT DISTINCT company_code FROM requirement WHERE status LIKE 'handed_over_%') rh ON rh.company_code = c.company_code
       WHERE c.tier IS NOT NULL GROUP BY c.tier ORDER BY c.tier`),
    // One row per company with what the drop-off section groups on.
    q(`SELECT c.company_code,
              COALESCE(c.total_required, 0)::int AS edb_openings,
              EXISTS (SELECT 1 FROM contact k WHERE k.company_code = c.company_code AND k.valid
                        AND length(regexp_replace(COALESCE(k.mobile, ''), '[^0-9]', '', 'g')) >= 10) AS has_mobile,
              COALESCE(li.calls, 0)::int AS calls,
              li.last_disp,
              lc.disposition AS con_disp,
              lc.reason_code AS con_reason,
              COALESCE(rv.val_openings, 0)::int AS val_openings,
              sv.disposition AS saved_under,
              EXISTS (SELECT 1 FROM requirement r WHERE r.company_code = c.company_code
                        AND r.classification IS NOT NULL AND r.classification <> '') AS handed
       FROM company c
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS calls, (array_agg(i.disposition ORDER BY i.created_at DESC))[1] AS last_disp
         FROM interaction i WHERE i.company_code = c.company_code) li ON true
       LEFT JOIN LATERAL (
         SELECT i.disposition, i.reason_code FROM interaction i
         WHERE i.company_code = c.company_code AND i.disposition IN ${CONNECTED}
         ORDER BY i.created_at DESC LIMIT 1) lc ON true
       LEFT JOIN LATERAL (
         SELECT SUM(r.required_count_validated) AS val_openings FROM requirement r
         WHERE r.company_code = c.company_code AND r.required_count_validated > 0) rv ON true
       LEFT JOIN LATERAL (
         SELECT i.disposition FROM requirement r
         JOIN requirement_version v ON v.requirement_id = r.id
         JOIN interaction i ON i.id = v.interaction_id
         WHERE r.company_code = c.company_code AND r.required_count_validated > 0
           AND (v.diff_json LIKE '%requiredCountValidated%' OR v.diff_json LIKE '%"_new"%')
         ORDER BY v.changed_at DESC LIMIT 1) sv ON true`),
  ]);

  const universe = n(edbCompanies.c);
  const att = n(attempted.c);
  const con = n(connected.c);
  const valDisp = n(valDispRow.c);
  const valCount = n(valCountRow.c);
  const handed = n(handedCompanies.c);
  const dispatched = n(dispatchedCompanies.c);
  const calls = n(totalCalls.c);

  const qualMap: Record<string, string> = {};
  for (const m of qualMaster) qualMap[m.id as string] = m.name as string;
  const resolveQual = (raw: unknown) =>
    String(raw ?? "").split(";").map((id) => qualMap[id.trim()] ?? id.trim())
      .filter(Boolean).join(", ") || "—";

  const today = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric",
  });
  const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const L: string[] = [];
  const p = (s = "") => L.push(s);

  p(`# Employer Requirement Gathering — Status Update`);
  p();
  p(`**Kaushalam · State Employability Platform, Department of ITE&C, Government of Andhra Pradesh**`);
  p();
  p(`Position as on ${today} · Cumulative, all-time · Source: Employer Outreach CRM`);
  p();
  p(`---`);
  p();

  p(`## 1. Definitions`);
  p();
  p(`| Term | Meaning |`);
  p(`|---|---|`);
  p(`| Employer Database (EDB) | Master list of companies available for outreach across Andhra Pradesh. |`);
  p(`| Attempted | Company against which at least one call has been logged. |`);
  p(`| Connected | Company where a call reached a person at the company. |`);
  p(`| Validated | Company where a vacancy count was recorded against at least one role. |`);
  p(`| Handed over | Company where a fulfilment route has been decided on at least one role. |`);
  p(`| Role | A distinct job position recorded against a company. |`);
  p(`| Opening | A vacancy count recorded against a role. |`);
  p();
  p(`Handover is counted at the point the route is decided. Dispatch to the receiving`);
  p(`team's queue is reported separately in section 7.`);
  p();

  p(`## 2. Employer Database — Current Position`);
  p();
  p(`| Measure | Count |`);
  p(`|---|---:|`);
  p(`| Companies on EDB | ${fmt(edbCompanies.c)} |`);
  p(`| Requirement submissions recorded | ${fmt(edbSubs.c)} |`);
  p(`| Roles recorded | ${fmt(edbRoles.c)} |`);
  p(`| **Openings recorded** | **${fmt(edbOpenings.c)}** |`);
  p();

  p(`## 3. Outreach Progress`);
  p();
  p(`| Stage | Companies | % of EDB | Roles | Openings |`);
  p(`|---|---:|---:|---:|---:|`);
  p(`| EDB universe | ${fmt(universe)} | 100.0% | ${fmt(edbRoles.c)} | ${fmt(edbOpenings.c)} |`);
  p(`| Attempted | ${fmt(att)} | ${pct(att, universe)} | — | — |`);
  p(`| Not yet contacted | ${fmt(universe - att)} | ${pct(universe - att, universe)} | — | — |`);
  p(`| Connected | ${fmt(con)} | ${pct(con, universe)} | — | — |`);
  p(`| Not connected | ${fmt(att - con)} | ${pct(att - con, universe)} | — | — |`);
  p(`| Validated | ${fmt(valCount)} | ${pct(valCount, universe)} | ${fmt(validatedRoles.c)} | ${fmt(validatedOpenings.c)} |`);
  p(`| **Handed over** | **${fmt(handed)}** | **${pct(handed, universe)}** | **${fmt(handedRoles.c)}** | **${fmt(handedOpenings.c)}** |`);
  p();
  p(`### Conversion between stages`);
  p();
  p(`| Transition | Rate |`);
  p(`|---|---:|`);
  p(`| Attempted to Connected | ${pct(con, att)} |`);
  p(`| Connected to Validated | ${pct(valCount, con)} |`);
  p(`| Validated to Handed over | ${pct(handed, valCount)} |`);
  p();
  p(`Of the ${fmt(handed)} companies handed over, ${fmt(dispatched)} have additionally been dispatched`);
  p(`to the downstream queue (${fmt(dispatchedRoles.c)} of ${fmt(handedRoles.c)} roles). The remaining`);
  p(`${fmt(handed - dispatched)} are decided but not yet visible to the receiving team.`);
  p();
  if (valDisp !== valCount) {
    p(`> Two definitions of "validated company" exist: vacancy count recorded (${fmt(valCount)}),`);
    p(`> and disposition Hiring Now (${fmt(valDisp)}). This report uses the count-based definition,`);
    p(`> because handover is derived from role records rather than call disposition.`);
    p();
  }

  // ── Where the drops happen ──
  type DropCo = {
    edb_openings: number; has_mobile: boolean; calls: number; last_disp: string | null;
    con_disp: string | null; con_reason: string | null; val_openings: number;
    saved_under: string | null; handed: boolean;
  };
  const cos = dropRows as unknown as DropCo[];
  const isAtt = (c: DropCo) => n(c.calls) > 0;
  const isCon = (c: DropCo) => !!c.con_disp;
  const isVal = (c: DropCo) => n(c.val_openings) > 0;

  const dispLabel = (d: string | null) =>
    d ? DISPOSITION_LABELS[d] ?? d : "Not recorded";

  /** Groups companies by key and prints a table whose total equals the drop. */
  const dropTable = (
    heading: string,
    rows: DropCo[],
    keyOf: (c: DropCo) => string,
    openingsOf: (c: DropCo) => number,
    openingsLabel: string,
  ) => {
    const groups = new Map<string, { companies: number; openings: number }>();
    for (const c of rows) {
      const k = keyOf(c);
      const g = groups.get(k) ?? { companies: 0, openings: 0 };
      g.companies++;
      g.openings += n(openingsOf(c));
      groups.set(k, g);
    }
    const sorted = [...groups.entries()].sort((a, b) => b[1].companies - a[1].companies);
    const totalOpen = sorted.reduce((s, [, g]) => s + g.openings, 0);
    p(`| ${heading} | Companies | Share of drop | ${openingsLabel} |`);
    p(`|---|---:|---:|---:|`);
    for (const [k, g] of sorted) {
      p(`| ${k} | ${fmt(g.companies)} | ${pct(g.companies, rows.length)} | ${fmt(g.openings)} |`);
    }
    p(`| **Total drop** | **${fmt(rows.length)}** | **100%** | **${fmt(totalOpen)}** |`);
    p();
    return sorted;
  };
  const lead = (sorted: [string, { companies: number }][], total: number, what: string) => {
    if (sorted.length === 0 || total === 0) return;
    const [k, g] = sorted[0];
    p(`${k} accounts for ${pct(g.companies, total)} of ${what} (${fmt(g.companies)} of ${fmt(total)} companies).`);
    p();
  };

  const d1 = cos.filter((c) => !isAtt(c));
  const d2 = cos.filter((c) => isAtt(c) && !isCon(c));
  const d3 = cos.filter((c) => isCon(c) && !isVal(c));
  const d4 = cos.filter((c) => isVal(c) && !c.handed);
  const valNotCon = cos.filter((c) => isVal(c) && !isCon(c)).length;
  const handedNotVal = cos.filter((c) => c.handed && !isVal(c)).length;

  p(`## 4. Where the Drops Happen`);
  p();
  p(`Each table below takes the companies that reached one stage but not the next,`);
  p(`and groups them by the call outcome recorded against them. Openings are the`);
  p(`vacancies at stake: EDB openings for the first three stages, validated openings`);
  p(`for the last.`);
  p();

  p(`### Universe to Attempted — not yet called`);
  p();
  const s1 = dropTable("Contact position", d1,
    (c) => (c.has_mobile ? "Valid mobile on file, not yet called" : "No valid mobile on file"),
    (c) => c.edb_openings, "EDB openings");
  lead(s1, d1.length, "companies not yet called");

  p(`### Attempted to Connected — called, not reached`);
  p();
  const s2 = dropTable("Latest call outcome", d2, (c) => dispLabel(c.last_disp),
    (c) => c.edb_openings, "EDB openings");
  lead(s2, d2.length, "this drop");
  const attemptsBucket = (c: DropCo) =>
    n(c.calls) >= 3 ? "3 or more attempts" : n(c.calls) === 2 ? "2 attempts" : "1 attempt";
  dropTable("Attempts made", d2, attemptsBucket, (c) => c.edb_openings, "EDB openings");

  p(`### Connected to Validated — reached, no vacancy count recorded`);
  p();
  const s3 = dropTable("Latest connected outcome", d3,
    (c) => (c.con_disp === "hiring_now" ? "Hiring now — count not yet recorded" : dispLabel(c.con_disp)),
    (c) => c.edb_openings, "EDB openings");
  lead(s3, d3.length, "this drop");
  const noReq = d3.filter((c) => c.con_disp === "no_requirement");
  if (noReq.length > 0) {
    p(`Reasons given where the outcome was No requirement:`);
    p();
    dropTable("Reason", noReq, (c) => c.con_reason || "Not recorded",
      (c) => c.edb_openings, "EDB openings");
  }

  p(`### Validated to Handed over — count recorded, no route decided`);
  p();
  const s4 = dropTable("Outcome of the call that recorded the count", d4,
    (c) => dispLabel(c.saved_under), (c) => c.val_openings, "Validated openings");
  lead(s4, d4.length, "this drop");

  if (valNotCon > 0 || handedNotVal > 0) {
    p(`> Out of sequence: ${fmt(valNotCon)} companies have a vacancy count without any connected call,`);
    p(`> and ${fmt(handedNotVal)} have a route decided without a vacancy count. These are recording`);
    p(`> errors, now blocked at entry. They are why each stage-to-stage drop above can differ`);
    p(`> from the simple difference between the stage totals in section 3.`);
    p();
  }

  p(`## 5. Call Outcomes`);
  p();
  p(`| Outcome | Calls | Share |`);
  p(`|---|---:|---:|`);
  for (const d of dispRows) {
    const label = DISPOSITION_LABELS[d.disposition as string] ?? String(d.disposition);
    p(`| ${label} | ${fmt(d.c)} | ${pct(n(d.c), calls, 0)} |`);
  }
  p(`| **Total calls logged** | **${fmt(calls)}** | **100%** |`);
  p();
  p(`Outcomes are recorded per call. ${fmt(multiCalled.c)} companies have been called more than once.`);
  p();

  p(`## 6. Requirement Validation`);
  p();
  p(`| Measure | Count |`);
  p(`|---|---:|`);
  p(`| Companies validated (vacancy count recorded) | ${fmt(valCount)} |`);
  p(`| Companies that said Hiring Now on the call | ${fmt(valDisp)} |`);
  p(`| Roles validated | ${fmt(validatedRoles.c)} |`);
  p(`| Openings validated | ${fmt(validatedOpenings.c)} |`);
  p(`| Roles closed on call (not required any more) | ${fmt(closedRoles.c)} |`);
  p(`| Roles still pending validation | ${fmt(pendingRoles.c)} |`);
  p(`| Roles validated as a share of roles recorded | ${pct(n(validatedRoles.c), n(edbRoles.c))} |`);
  p(`| Openings validated as a share of openings recorded | ${pct(n(validatedOpenings.c), n(edbOpenings.c))} |`);
  p();

  p(`## 7. Handover — Routing Position`);
  p();
  p(`| Route | Companies | Roles | Openings | Share of roles |`);
  p(`|---|---:|---:|---:|---:|`);
  for (const r of routeRows) {
    const label = ROUTE_LABELS[r.route as string] ?? String(r.route);
    p(`| ${label} | ${fmt(r.companies)} | ${fmt(r.roles)} | ${fmt(r.openings)} | ${pct(n(r.roles), n(handedRoles.c), 0)} |`);
  }
  for (const k of Object.keys(ROUTE_LABELS)) {
    if (!routeRows.some((r) => r.route === k)) {
      p(`| ${ROUTE_LABELS[k]} | 0 | 0 | 0 | 0% |`);
    }
  }
  p(`| **Total handed over** | **${fmt(handed)}** | **${fmt(handedRoles.c)}** | **${fmt(handedOpenings.c)}** | **100%** |`);
  p();
  p(`${fmt(bothRoutes.c)} companies have requirements routed to more than one channel, which is why`);
  p(`the unique company total (${fmt(handed)}) is lower than the sum of the rows.`);
  p();
  p(`### Dispatch status`);
  p();
  p(`| | Roles | Companies |`);
  p(`|---|---:|---:|`);
  p(`| Dispatched — visible to the receiving team | ${fmt(dispatchedRoles.c)} | ${fmt(dispatched)} |`);
  p(`| Decided, not yet dispatched | ${fmt(n(handedRoles.c) - n(dispatchedRoles.c))} | ${fmt(handed - dispatched)} |`);
  p(`| **Total handed over** | **${fmt(handedRoles.c)}** | **${fmt(handed)}** |`);
  p();

  p(`## 8. Validated Openings by Qualification Sought`);
  p();
  p(`| Qualification | Roles | Openings |`);
  p(`|---|---:|---:|`);
  const TOP = 10;
  let oR = 0, oO = 0;
  qualRows.forEach((r, i) => {
    if (i < TOP) p(`| ${resolveQual(r.qualification)} | ${fmt(r.roles)} | ${fmt(r.openings)} |`);
    else { oR += n(r.roles); oO += n(r.openings); }
  });
  if (qualRows.length > TOP) {
    p(`| All other qualification groups (${qualRows.length - TOP}) | ${fmt(oR)} | ${fmt(oO)} |`);
  }
  p(`| **Total (${qualRows.length} qualification groups)** | **${fmt(validatedRoles.c)}** | **${fmt(validatedOpenings.c)}** |`);
  p();

  p(`## 9. Recorded Openings by Required Timeframe`);
  p();
  p(`| Required within | Roles | Openings | Share |`);
  p(`|---|---:|---:|---:|`);
  for (const r of timeRows) {
    const label = r.m === null ? "Not specified" : `${r.m} months`;
    p(`| ${label} | ${fmt(r.roles)} | ${fmt(r.openings)} | ${pct(n(r.openings), n(edbOpenings.c))} |`);
  }
  p(`| **Total** | **${fmt(edbRoles.c)}** | **${fmt(edbOpenings.c)}** | **100%** |`);
  p();

  p(`## 10. Recorded Openings by Sector`);
  p();
  p(`| Sector | Companies | Openings |`);
  p(`|---|---:|---:|`);
  const STOP = 15;
  let restO = 0;
  sectorRows.forEach((r, i) => {
    if (i < STOP) p(`| ${r.sector} | ${fmt(r.companies)} | ${fmt(r.openings)} |`);
    else restO += n(r.openings);
  });
  if (sectorRows.length > STOP) {
    p(`| All remaining sectors (${sectorRows.length - STOP}) | — | ${fmt(restO)} |`);
  }
  p();
  p(`${sectorRows.length} sectors in total. ${fmt(multiSector.c)} companies are mapped to more than one`);
  p(`sector; sector-wise openings therefore sum above the total of ${fmt(edbOpenings.c)}.`);
  p();

  p(`## 11. Position by Tier`);
  p();
  p(`| Tier | Universe | Attempted | Connected | Validated | Classified | Handed over |`);
  p(`|---|---:|---:|---:|---:|---:|---:|`);
  for (const t of tierRows) {
    p(`| Tier ${t.tier} | ${fmt(t.universe)} | ${fmt(t.attempted)} | ${fmt(t.connected)} | ${fmt(t.validated)} | ${fmt(t.classified)} | ${fmt(t.handed_over)} |`);
  }
  p();
  p(`### As a share of each tier's own universe`);
  p();
  p(`| Tier | Universe | Attempted | Connected | Validated | Handed over |`);
  p(`|---|---:|---:|---:|---:|---:|`);
  for (const t of tierRows) {
    const u = n(t.universe);
    p(`| Tier ${t.tier} | ${fmt(u)} | ${pct(n(t.attempted), u, 0)} | ${pct(n(t.connected), u, 0)} | ${pct(n(t.validated), u, 0)} | ${pct(n(t.handed_over), u, 0)} |`);
  }
  p();

  p(`## 12. Summary of Position`);
  p();
  p(`| Measure | Count |`);
  p(`|---|---:|`);
  p(`| Companies on EDB | ${fmt(edbCompanies.c)} |`);
  p(`| Roles recorded | ${fmt(edbRoles.c)} |`);
  p(`| Openings recorded | ${fmt(edbOpenings.c)} |`);
  p(`| Companies attempted | ${fmt(att)} |`);
  p(`| Companies connected | ${fmt(con)} |`);
  p(`| Companies validated | ${fmt(valCount)} |`);
  p(`| Roles validated | ${fmt(validatedRoles.c)} |`);
  p(`| Openings validated | ${fmt(validatedOpenings.c)} |`);
  p(`| Companies handed over | ${fmt(handed)} |`);
  p(`| Openings handed over | ${fmt(handedOpenings.c)} |`);
  for (const r of routeRows) {
    p(`| Roles handed over — ${ROUTE_LABELS[r.route as string] ?? r.route} | ${fmt(r.roles)} |`);
  }
  p(`| **Total roles handed over** | **${fmt(handedRoles.c)}** |`);
  p();
  p(`---`);
  p();
  p(`*Generated ${stamp} IST from the Employer Outreach CRM database, all-time cumulative view.*`);
  p();

  return { markdown: L.join("\n"), generatedAt: stamp };
}
