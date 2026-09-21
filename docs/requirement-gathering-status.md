# Employer Requirement Gathering — Status Update

**Kaushalam · State Employability Platform, Department of ITE&C, Government of Andhra Pradesh**

Position as on 11 September 2026 · Cumulative, all-time · Source: Employer Outreach CRM database

> Regenerate with `npx tsx src/scripts/status-report.ts`

---

## Scope note

Every figure below is read live from the Employer Outreach CRM database.

The CRM holds a point-in-time extract of the Employer Database, loaded on **27 August 2026**. The live EDB has grown since. Where the printed status document of 11 September reported **5,933 companies / 8,847 roles / 28,679 openings**, this CRM holds **5,317 / 8,046 / 27,146** — a gap of roughly **616 companies and 1,533 openings that exist on EDB but have never been loaded here**.

Two consequences:

- Sections 2, 8 and 9 describe the loaded extract, not the live EDB.
- Percentages computed here use 5,317 as the denominator, so they read higher than the same percentages computed against 5,933.

Outreach, validation and handover figures (sections 3–7) come from live CRM activity and are current as of generation.

---

## 1. Definitions

| Term | Meaning |
|---|---|
| **Employer Database (EDB)** | Master list of companies available for outreach across Andhra Pradesh. Expanded on a continuing basis as new companies are onboarded. |
| **Attempted** | Company against which at least one call has been logged. |
| **Connected** | Company where a call reached a person at the company. |
| **Validated** | Company where a vacancy count was recorded against at least one role. |
| **Handed over** | Company where a fulfilment route has been decided on at least one validated role. |
| **Role** | A distinct job position recorded against a company. |
| **Opening** | A vacancy count recorded against a role. |

### On "Handed over"

A requirement is handed over when the caller has decided which channel will fulfil it — Scheduling, District Collector, or APSSDC — and written the accompanying handoff note.

Earlier versions of this report counted only requirements that had additionally been pushed to the downstream queue, which produced a figure of 72 against 224 validated. That understated the position. Checking the records, roles that carry a route but have not been pushed are **populated identically** to those that have:

| | Route decided, not pushed | Route decided and pushed |
|---|---:|---:|
| Classification set | 244 / 244 | 186 / 186 |
| Handoff note written | 244 / 244 | 186 / 186 |
| District set (Collector route) | 157 / 157 | 66 / 66 |

Not one field describing the requirement differs. The push captures no further information from the employer — it writes a status flag, a timestamp and the caller's name. The decision is the handover; the push is a dispatch mechanism.

This report therefore counts **the decision**. Dispatch status is reported separately in section 6, because it governs when the receiving team can see the work.

### On "Validated"

Two definitions are in circulation:

| Definition | Count |
|---|---:|
| Vacancy count recorded on at least one role | **224** — used throughout this report |
| Call carried disposition *Hiring Now* | 213 — used by the printed status update |

This report uses the count-based definition because handover is derived from role records rather than call disposition. Mixing the two produces a funnel whose stages do not nest.

---

## 2. Employer Database — Current Position

| Measure | Count |
|---|---:|
| Companies on EDB | 5,317 |
| Requirement submissions recorded | 5,434 |
| Roles recorded | 8,046 |
| **Openings recorded** | **27,146** |

---

## 3. Outreach Progress

| Stage | Companies | % of EDB | Roles | Openings |
|---|---:|---:|---:|---:|
| EDB universe | 5,317 | 100.0% | 8,046 | 27,146 |
| Attempted | 1,640 | 30.8% | — | — |
| Not yet contacted | 3,677 | 69.2% | — | — |
| Connected | 787 | 14.8% | — | — |
| Not connected | 853 | 16.0% | — | — |
| Validated | 224 | 4.2% | 462 | 7,006 |
| **Handed over** | **209** | **3.9%** | **430** | **6,665** |

### Conversion between stages

| Transition | Rate |
|---|---:|
| Attempted to Connected | 48.0% |
| Connected to Validated | 28.5% |
| **Validated to Handed over** | **93.3%** |

**93.3% of validated companies have a route decided.** Once an employer confirms a requirement, it is almost always classified and routed. Only 15 companies and 32 roles are validated without a route.

---

## 4. Call Outcomes

| Outcome | Calls | Share |
|---|---:|---:|
| No answer | 866 | 51% |
| No requirement | 372 | 22% |
| Hiring now | 223 | 13% |
| Do not call | 116 | 7% |
| Hiring later | 96 | 6% |
| Wrong contact | 26 | 2% |
| Not operational | 5 | 0% |
| Duplicate | 1 | 0% |
| **Total calls logged** | **1,705** | **100%** |

Outcomes are recorded per call. 61 companies have been called more than once.

### Reading the Connected-to-Validated drop

787 companies were reached; 224 validated. The difference is not lost work — it is the market answering:

| Best outcome the company gave | Share of reached |
|---|---:|
| Hiring now | 27% |
| Hiring later — future demand | 12% |
| No requirement | 46% |
| Do not call | 14% |
| Not operational | 1% |

**86% of the drop is hard nos** — no requirement, do not call, or not operational. Calling them again changes nothing. A further 12% said *hiring later* and already sit in the task list for a callback. A 27% hit rate on reached companies is a normal outreach yield.

---

## 5. Requirement Validation

| Measure | Count |
|---|---:|
| Companies validated (vacancy count recorded) | 224 |
| Companies that said Hiring Now on the call | 213 |
| Roles validated (vacancy count confirmed on call) | 462 |
| Openings validated (positions confirmed on call) | 7,006 |
| Roles closed on call (not required any more) | 952 |
| Roles still pending validation | 6,632 |
| Roles validated as a share of roles recorded | 5.7% |
| Openings validated as a share of openings recorded | 25.8% |

Openings validated run well ahead of roles validated as a share — 25.8% against 5.7% — because callers have prioritised the largest requirements first. The 462 validated roles average 15 openings each; the 8,046 recorded roles average 3.

### Partial validation is normal and is being handled correctly

An employer with 16 roles listed on EDB may confirm only 2. That is a complete outcome, not a partial one.

| Shape | Companies |
|---|---:|
| All roles validated | 143 |
| Partial — remaining roles explicitly closed | 69 |
| Partial — remaining roles left untouched | 9 |

**212 of 221 validated companies have a complete picture.** When only some roles are confirmed, callers mark the rest *not required any more* rather than leaving them open. Only **8 roles across 7 companies** sit genuinely ambiguous, out of 8,046.

Worked example: TEXANA WORLD PRIVATE LIMITED had 39 roles on EDB. The employer confirmed one — worth **500 openings**. The caller closed the other 38 and routed the live one. One role, complete outcome, substantial value.

This is why role count is a weak measure of progress and **openings is the honest one**.

---

## 6. Handover — Routing Rule and Position

Every validated requirement is classified by the qualification and skill level sought, and routed to one of three channels:

| Route | Requirement classified to this route |
|---|---|
| **Scheduling**<br>*Kaushalam direct hiring* | Requirements seeking Graduate, Diploma, ITI and above qualifications. Fulfilled by Kaushalam through candidate matching from the assessed pool and scheduled recruitment drives. |
| **District Collector**<br>*Local mobilisation* | Requirements for unskilled and semi-skilled positions. Routed to the Collector of the concerned district for local mobilisation through the district administration and the Secretariat network. |
| **APSSDC**<br>*Training-linked* | Requirements where candidates need training before they can be placed. Routed to APSSDC for skilling ahead of placement. |

### Position by route

| Route | Companies | Roles | Openings | Share of roles |
|---|---:|---:|---:|---:|
| District Collector — local mobilisation | 143 | 225 | 3,083 | 52% |
| Scheduling — Kaushalam direct hiring | 91 | 205 | 3,582 | 48% |
| APSSDC — training-linked | 0 | 0 | 0 | 0% |
| **Total handed over** | **209** | **430** | **6,665** | **100%** |

25 companies have requirements routed to more than one channel. The unique company total is therefore 209, not 234.

Roles split close to evenly between the two active routes, but Scheduling carries more openings per role — 205 roles against 3,582 openings, versus 225 roles against 3,083 for Collector.

### Dispatch status

Handover is the decision. Pushing to the downstream queue is a separate mechanical step, and the two have diverged:

| | Roles | Companies |
|---|---:|---:|
| Dispatched — visible to the receiving team | 186 | 72 |
| **Decided, not yet dispatched** | **244** | **137** |
| **Total handed over** | **430** | **209** |

**137 companies have a route decided that the receiving team cannot see.** Their records are complete — classification, handoff note, and district where the route is Collector. What has not happened is the push that makes them visible on the handover queue and writes them to the EDB outbox.

This is a product defect, not outstanding fieldwork. The dispatch is triggered by a per-role button that sits separately from the save action, and callers are completing the form without pressing it. No further information is required from the employer to clear this.

**No requirement has been routed to APSSDC to date.** Worth confirming whether the training-linked route is genuinely not applicable to the requirements gathered so far, or whether callers are not reaching for it during classification.

| Measure | Count |
|---|---:|
| Validated roles with no route decided yet | 32 |

---

## 7. Validated Openings by Qualification Sought

| Qualification | Roles | Openings |
|---|---:|---:|
| 10th Class | 214 | 2,999 |
| ITI, Diploma | 20 | 2,287 |
| ITI | 56 | 254 |
| Diploma | 4 | 205 |
| B.Sc / M.Sc | 15 | 152 |
| 10th Class, Intermediate | 4 | 117 |
| Bachelor | 22 | 115 |
| B.Pharm | 3 | 106 |
| B.A. / B.Sc / B.Com / B.E. / B.Tech | 1 | 100 |
| Intermediate | 19 | 70 |
| All other qualification groups (44) | 104 | 601 |
| **Total (54 qualification groups)** | **462** | **7,006** |

Two groups carry three-quarters of validated demand: 10th Class alone accounts for 2,999 openings, and the ITI + Diploma combination a further 2,287 — 5,286 of 7,006 between them.

---

## 8. Recorded Openings by Required Timeframe

| Required within | Roles | Openings | Share |
|---|---:|---:|---:|
| 3 months | 1,166 | 7,929 | 29.2% |
| 6 months | 918 | 3,532 | 13.0% |
| 9 months | 1,604 | 5,831 | 21.5% |
| 12 months | 1,934 | 4,429 | 16.3% |
| 24 months | 1,543 | 3,777 | 13.9% |
| 120 months | 823 | 1,648 | 6.1% |
| Not specified | 58 | 0 | 0.0% |
| **Total** | **8,046** | **27,146** | **100%** |

7,929 openings — 29.2% of all recorded demand — are required within 3 months. The 120-month bucket is a form default rather than a real timeline and is flagged as such during import.

---

## 9. Recorded Openings by Sector

| Sector | Companies | Openings |
|---|---:|---:|
| Apparel | 152 | 2,846 |
| Construction | 429 | 2,816 |
| Automotive | 183 | 2,616 |
| Food Industry / Food Processing | 923 | 2,420 |
| Electronics & Hardware | 171 | 2,383 |
| Textile & Handloom | 480 | 2,287 |
| Power | 48 | 1,810 |
| Transportation, Logistics & Warehousing | 439 | 1,654 |
| Chemicals & Petrochemicals | 188 | 1,044 |
| Agriculture | 290 | 983 |
| Iron & Steel | 254 | 942 |
| Rubber Industry | 51 | 929 |
| Capital Goods & Manufacturing | 175 | 900 |
| Aerospace & Aviation | 5 | 850 |
| Shipping | 9 | 709 |
| All remaining sectors (34) | — | 7,053 |

49 sectors in total. 134 companies are mapped to more than one sector; sector-wise openings therefore sum above the total of 27,146.

---

## 10. Summary of Position

| Measure | Count |
|---|---:|
| Companies on EDB | 5,317 |
| Roles recorded | 8,046 |
| Openings recorded | 27,146 |
| Companies attempted | 1,640 |
| Companies connected | 787 |
| Companies validated | 224 |
| Roles validated | 462 |
| Openings validated | 7,006 |
| **Companies handed over** | **209** |
| **Openings handed over** | **6,665** |
| Roles handed over — Scheduling | 205 |
| Roles handed over — District Collector | 225 |
| Roles handed over — APSSDC | 0 |
| **Total roles handed over** | **430** |

---

## 11. Position by Tier

Companies are ranked by total openings and banded into four tiers at load time. Tier 1 is the top 300 by demand.

| Tier | Universe | Attempted | Connected | Validated |
|---|---:|---:|---:|---:|
| Tier 1 | 300 | 274 | 135 | 59 |
| Tier 2 | 700 | 659 | 359 | 108 |
| Tier 3 | 1,843 | 611 | 259 | 50 |
| Tier 4 | 2,474 | 1 | 1 | 0 |

### As a share of each tier's own universe

| Tier | Universe | Attempted | Connected | Validated |
|---|---:|---:|---:|---:|
| Tier 1 | 300 | 91% | 45% | 20% |
| Tier 2 | 700 | 94% | 51% | 15% |
| Tier 3 | 1,843 | 33% | 14% | 3% |
| Tier 4 | 2,474 | 0% | 0% | 0% |

### Roles and openings by tier

| Tier | Roles | Validated | Openings (EDB) | Openings validated |
|---|---:|---:|---:|---:|
| Tier 1 | 1,395 | 156 | 16,083 | 5,575 |
| Tier 2 | 1,491 | 208 | 4,214 | 879 |
| Tier 3 | 2,677 | 89 | 4,375 | 514 |
| Tier 4 | 2,474 | 0 | 2,474 | 0 |

Three observations:

**Tier prioritisation is holding.** Tier 1 and Tier 2 are 91% and 94% attempted. Tier 3 sits at 33% and Tier 4 is effectively untouched — one company called out of 2,474.

**Demand is concentrated in Tier 1.** 16,083 of 27,146 recorded openings sit in Tier 1 — 59% of all demand across 300 companies. Tier 1 roles average 12 openings each; Tier 4 roles average exactly 1, consistent with those records being form defaults rather than real demand.

**Tier 1 validates at a higher rate on openings.** 5,575 of Tier 1's 16,083 openings are validated — 35%, against 21% for Tier 2 and 12% for Tier 3.

*Tier figures are from an earlier extraction in the same day and lag sections 3–7 slightly. Proportions are unaffected.*

---

## Data quality notes

**137 companies are decided but not dispatched.** Their routing is complete; the downstream teams cannot see them. This requires no further contact with the employer — see section 6.

**616 companies on EDB are not in this CRM.** The loaded extract is from 27 August. Companies onboarded since then cannot be called, because they do not appear in the Universe. A refreshed extract would close this.

**2,474 Tier 4 roles are almost certainly not real demand.** Each carries exactly one opening and one role, matching the signature of an unedited submission form. They are loaded and flagged rather than discarded, and the default Universe sort places them last.

**823 roles carry a 120-month timeline.** This is the form default, flagged at import as `timeline_default_120m`. These need confirmation on the call before the timeline can be relied on.

**6,632 of 8,046 roles remain pending validation** — 82%. This excludes the 952 roles callers have deliberately closed as not required.

---

*Kaushalam — State Employability Platform, Department of ITE&C, Government of Andhra Pradesh. All figures extracted live from the Employer Outreach CRM database, all-time cumulative view. Employer Database figures reflect the extract loaded on 27 August 2026.*
