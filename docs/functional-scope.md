# Kaushalam Employer Outreach CRM — Functional Scope & Role-Based Features

**Project:** Kaushalam EDB Calling & Employer Outreach CRM  
**Stack:** Next.js, PostgreSQL, Better Auth, Tailwind CSS, shadcn/ui  
**Date:** 2 September 2026

---

## 1. What the Application Does

Kaushalam is a **government employer outreach CRM** for the Department of ITE&C, Andhra Pradesh. It manages the lifecycle of employer hiring requirements from initial capture through placement drives and outcomes tracking.

The core workflow:

1. **EDB Import** — ~5,300 companies with ~8,000 role-level hiring requirements are imported from the government Employer Database (EDB).
2. **Requirement Gathering** — Callers contact employers, validate their hiring needs, capture per-role details (qualification, experience, salary, timing), and classify each requirement into one of three routes.
3. **Classification & Handoff** — Each validated requirement is routed to:
   - **Kaushalam (Direct Hiring)** — job-ready candidates, goes to Scheduling team
   - **APSSDC (Needs Training)** — via the EDB training pipeline
   - **Collector (Local Mobilisation)** — unskilled/semi-skilled, district-level drives
4. **Scheduling** — Tracks placement request creation on the Kaushalam platform, drive planning, SOP tasks, and candidate mobilisation.
5. **Outcomes** — Tracks whether employers marked outcomes after drives, fill rates, and requirement fulfilment.
6. **Employer Notifications** — Every change is notified to the employer via WhatsApp and email with a dispute mechanism.
7. **EDB Sync** — All changes are queued in an outbox for replay to the government EDB API.

---

## 2. User Roles

| Role | Description | Team |
|------|-------------|------|
| **Caller** | Makes calls, validates requirements, captures data, hands off | Requirement Gathering |
| **Lead** | Supervises callers, reassigns tasks, views dashboard, handles escalations | Cross-team |
| **Admin** | Full system access — user management, import/export, dashboard, messaging | Platform Admin |
| **Viewer** | Read-only access to handed-over requirements | Scheduling |
| **Scheduler** | Manages placement requests, drives, SOP tasks, candidate lists | Scheduling |
| **Outcomes Manager** | Tracks post-drive outcomes, employer marking, fulfilment | Outcomes |
| **District Coordinator** | Manages Collector tickets for their assigned district | District-level |

**Auth rules:**
- No self-signup. Admin creates all users.
- Username + password login (Better Auth with hashed passwords).
- Session timeout: 12 hours.
- First admin seeded from environment variable.

---

## 3. Role-Wise Feature Breakdown

### 3.1 Caller (Requirement Gathering Team)

**Login lands on:** My Day (`/today`)

#### My Day
- **KPI counters:** Due today, Overdue (with oldest age), Claimed by me today, Requirements validated this week, Handed over this week (split by Scheduling / Collector / APSSDC).
- **Task table** with tabs: *Today & Overdue* (default), *This Week*, *Unassigned*.
  - Each row: company (link), next step, set by (user or system), due date, age badge if overdue, Open button.
  - Overdue tasks persist and show age — they never auto-roll.
- **Side panel:** Claimed today (mine), Handed over this week (team).

#### Universe (`/universe`)
- **Full company list** — all ~5,300 companies visible to all callers.
- **Filters:** search (company name, EDB code, mobile), district, sector, sub-sector, stage, tier (1-4), required-within (3/6/12/>12 months), previously worked on (never / no contact 60d / contacted this month / by disposition), flags, tags, classification, status.
- **Default sort:** tier then rank. Secondary: last contact, district, total required.
- **Columns:** company (name + EDB code + flag chips), sector, district/mandal, headcount, total required (role count), tier, last contact + disposition, calls count, claim (who, today), tags.
- **Claim on open:** Opening a company claims it for the day. One claim per company per day. Others see "X is working this" — warning, not block.
- **Export button:** visible to Admin only, disabled for Callers.

#### Company Page (`/company/<company_code>`)
- **Header:** name, EDB code, tier/rank, status chips, tags (editable multi-select from 5 fixed + free text).
- **Action buttons:** Log a Call, Add Contact, Log Inbound.
- **"Since last contact" notice:** EDB changes since last interaction + open tasks.
- **Left column:**
  - Company details (from EDB, read-only, blue border): legal name, GSTIN, PAN, Udyam, sector, sub-sectors, line of activity, plant location, district/mandal/village, stage, headcount, project name, flags.
  - Contacts: name, designation, mobile (tap-to-call), email, POC for, source, valid status. Add / mark invalid.
  - Requirements (one card per role): EDB values vs. captured values side-by-side, version number, flags.
  - Version history per requirement (collapsible) + claim history.
- **Right column:** Timeline — reverse-chronological interactions, EDB events, backfill entries, with diff chips. Filter by user/channel.

#### Log a Call (`/company/<company_code>/call`)
Single form, one Save. Sections:

**Call section:**
- Contact (dropdown of company contacts + "add new"), channel, disposition, reason code (conditional).
- Mandatory on every save: contact, channel, disposition, comment, next step, next action date.

**"Do they require now?"**
- Now / Later (date) / Not hiring (next call date + reason). Company-level; per-role can override.

**Requirement per role (table):**
- Per row: role title (EDB, editable copy), standard role (type-ahead), validated count, qualification (dropdown), experience (dropdown), gender, age limit, salary, shift, monthly intake, comment.
- "Add role" button — new requirement with `reference_id = 'CALLER-' + company_code`.
- Mark role as "Not required any more" (status `no_requirement`).

**Classification & Handoff per role:**
- Radio: Kaushalam / APSSDC / Collector.
- **Collector** → district dropdown (mandatory).
- **APSSDC** → need-training checkbox + optional QP code.
- Handoff comment (mandatory).
- **Hand Off button** — disabled until gate passes. Button label shows what's missing.
- **Gate requirements:** role title, validated count, qualification, experience, classification, handoff comment, valid 10-digit mobile on company contact; Collector → district; APSSDC → need-training ticked.

**Next Step:**
- Next step text + next action date. Both mandatory. Date cap: today + 12 months.

**On Save (single transaction):**
- Insert `interaction`
- Update requirement rows + `requirement_version` per changed requirement
- Update company denormalised fields (`last_disposition`, `last_contact_at`, `contact_count`)
- Close/create `task`
- Insert `claim` if not present
- Insert `edb_outbox` for each changed requirement
- Insert `audit_log`

#### What Callers CANNOT Do
- Export data
- Edit EDB-owned fields (read-only in UI)
- Delete anything
- User admin

---

### 3.2 Lead (Team Lead)

**Login lands on:** Escalations & Reassignment

**Everything a Caller can do, plus:**

#### Escalations & Reassignment (`/escalations`)
- **KPI counters:** Open escalations, Employer disputes, Overdue tasks (all teams, split RG/Scheduling/Outcomes), Reassignments this week.
- **Escalations table:** rule-triggered rows (request pending >5 days, unmarked >72h, employer dispute, task overdue >3 days, Collector ticket idle >7 days) — company, owner, since when, detail, action button.
- **Reassign panel:** select "From" user → "To" user, checkbox list of open tasks, reassign with reason (logged to `audit_log`).
- **This week by person:** table of dials, connects, validated, overdue per team member.

#### Dashboard (same as Admin dashboard)
- See section 3.3 Dashboard below.

#### What Lead CANNOT Do
- Export data
- User admin
- Import/Backfill

---

### 3.3 Admin (Platform Admin)

**Login lands on:** Dashboard

**Everything a Lead can do, plus:**

#### Dashboard (`/admin/dashboard`)
- **Hero KPI:** Job opportunities created this week (vs target, with weekly trend bar chart).
- **KPIs:** Requirements validated cumulative, Handover → request created median, Drives unmarked >72h, Fill rate.
- **Funnel table (cumulative):** Universe → Attempted → Connected → Validated → Handed over (S/C/A split) → Placement request created → Drive held → Outcome marked → Fulfilled. With openings count, conversion %, median TAT per stage.
- **Collector tickets by district:** handed, in progress, done, oldest.
- **APSSDC training status:** request raised, mobilisation, training, completed.
- **Per-team tables:**
  - RG: dials, connects, connect %, requirements validated, openings validated, validated within 24h, handoffs (S/C/A), next-action compliance, overdue count + oldest. Per caller + team total.
  - Scheduling: handover → request created median, pending >48h / >5 days, drives scheduled, openings on platform, SOP tasks on time, district activation on time, confirmations vs target.
  - Outcomes: drives held, marked within 72h, unmarked >72h, selected count, fill rate, fulfilled on EDB, awaiting close >14 days.
- **Period selector:** today / this week / last week / month / since start.

#### User Management (`/admin/users`)
- Create user (username, display name, role, team, password).
- Deactivate user.
- Reset password.
- Change role/team.

#### Import (`/admin/import`)
- Upload new EDB extract CSV.
- Runs loader logic (idempotent — re-import adds new batch, never edits caller-captured fields).
- Shows batch report: rows, companies inserted/updated, flags.
- Import flags shown: `timeline_default_120m`, `required_count_missing`, `outlier_high_vs_headcount`, `custom_role_title`, `test_record`, `no_working_contact`, `gstin_shared_by_multiple_codes`, `gstin_format_invalid`, `district_missing`.

#### Backfill (`/admin/backfill`)
- Upload Tier-1 calling outcomes CSV.
- Runs backfill logic (matches by mobile then normalised company name).
- Shows matched/unmatched with unmatched CSV download.

#### Export (`/admin/export`)
- Runs export logic → zip download (one CSV per table + MANIFEST.csv).
- Logged to `audit_log`.
- Weekly exports serve as backups.

#### Messaging Centre (`/admin/messaging`)
- **Audience builder:** filter on sector, district, employees, previously worked on, classification, tag.
- **Saved audiences** with company counts.
- **Compose:** Email and WhatsApp tabs. Template with merge fields (`{{company}}`, `{{contact}}`, `{{district}}`, `{{requirement}}`).
- **Send test** and **Send to audience** buttons.
- **Campaigns log:** sent date, campaign name, audience, channel, sent/delivered/open-reply counts, requirements generated after.

#### EDB Send Log & Audit Log (`/admin/logs`)
- **EDB send log:** every delta posted to EDB with acknowledgement status. Columns: time, company/requirement, delta (diff chips), version, trigger, status (acknowledged/retrying/failed), ack ID. KPIs: deltas sent, acknowledged, retrying, failed, median ack time.
- **Audit log:** every user action. Columns: time, user, action, object, detail. Actions: login, claim, call_logged, requirement_edit, handoff, reassign, export, import, user_admin.

---

### 3.4 Viewer (Scheduling Team — Read-Only)

**Login lands on:** Handed Over list

#### Handed Over (`/handed-over`)
- Read-only list of requirements with status `handed_over_*`.
- Columns: company, role, validated count, qualification, experience, classification, Collector district, handoff comment, handed over by/at, contact.
- Filter by route (Scheduling / Collector / APSSDC) and date.
- CSV download for Lead/Admin only.

#### What Viewer CANNOT Do
- Any writes
- Export (unless Lead/Admin)

---

### 3.5 Scheduler (Scheduling Team)

**Login lands on:** Scheduling Queue

#### Scheduling Queue (`/scheduling`)
- **KPIs:** Openings created on platform this week (vs target + progress bar), Openings validated but request not yet created, Pending >48h, Pending >5 days (escalated), Placement requests live, Drives in next 7 days.
- **Placement request pending table:** companies where employer hasn't created the request yet. Columns: company, roles, openings, handed over date, age, chase status (48h task, 5-day escalation), employer POC + login status. Call button.
- **Placement requests live table (synced from platform, read-only):** request ID, company/role, openings, venue district, drive date, platform status, candidates count, SOP tasks. Open button.
- **Weekly calendar:** drives and SOP tasks keyed to drive dates. Legend: drive (orange dot), Collector-route drive (grey dot), SOP task (dashed).

#### Requirement & Drives Detail (`/scheduling/<requirement_id>`)
- **Header:** EDB code, requirement ID, company/role, classification badge, status badge, tags.
- **KPIs:** Openings on requirement, Selected (employer-marked), Remaining, Placement requests on parent.
- **Placement requests table:** request ID, venue, drive date, platform status, list/walk-in/selected counts, marking status.
- **SOP tasks table:** when (T-5, T-2, T-1, T+1), task description, owner, status.
- **Timeline:** scheduling-specific entries.
- **Side panels:** Requirement details (standard role, qualification, experience, timing, training, comment), Contacts, "What the employer does" checklist.

---

### 3.6 Outcomes Manager

**Login lands on:** Outcomes Board

#### Outcomes Board (`/outcomes`)
- **KPIs:** Drives held not yet marked, Unmarked >72h (escalated), Marked this week + selected count, Fill rate (August), Drives in next 7 days.
- **Drives held table:** request, company/role, route (Direct/Collector), drive date/venue, walked-in count, employer marking status, days since drive, tasks (T+1 call, T+3 escalation), drive POC + phone. Call button.
- **Upcoming drives table (next 14 days):** date, company/role, venue, confirmed count, drive POC, "what to do" instructions.
- **Requirements awaiting employer close table:** company/role, selected/openings ratio, age. Note: "Only the employer closes."

---

### 3.7 District Coordinator

**Login lands on:** Collector Tickets (filtered to their district)

#### Collector Tickets (`/district/<district_name>`)
- **KPIs:** Handed over (no plan yet), In progress, Fulfilled (since month start), Oldest open ticket.
- **Tickets table:** ticket ID, company/role, openings, handed over date, drive date, status badge (Handed over / Drive planned / Mobilising / Drive held / Awaiting close / Fulfilled). Filter: Open / Fulfilled / All.
- **Ticket detail panel:**
  - Requirement info: role, openings, qualification, experience, classification.
  - Origin: EDB reference + received date.
  - Employer contact: name, designation, phone.
  - Handoff comment from Kaushalam caller.
  - **Drive details form (editable):** drive date, venue, mandals mobilising, secretariats engaged, candidates mobilised so far, status dropdown.
  - Update note (free text).
  - **Save update** button — update goes to employer, Kaushalam, and EDB.
  - Timeline: coordinator updates, Kaushalam handoff, EDB events.
  - Note: "Closure is the employer's" — employer closes from their login.

---

### 3.8 Employer (Notification View — Not a Login)

Employers don't log into this CRM. They receive notifications:

#### Change Notice (WhatsApp + Email)
- Triggered on every save that changes employer's requirement or company data.
- Lists every field changed in a table (role, field, before, after).
- Includes next step instruction (e.g., "create hiring request on your Kaushalam login").
- **Dispute mechanism:** "NOT AUTHORISED" reply → logged as inbound interaction → escalation task to the person who made the change → lead copied.

---

## 4. Cross-Cutting Business Rules

| Rule | Enforcement Point |
|------|-------------------|
| Mandatory on every call: contact, channel, disposition, comment, next step, next action date | Save button disabled until filled |
| `no_requirement` and `do_not_call` need a reason code; `hiring_later` needs a date | Conditional fields |
| Next action date ≤ today + 12 months | Date picker max |
| After 3 no-answer attempts within 5 working days → prompt caller to set a future date | Call form |
| Handoff gate per role: title, count, qualification, experience, classification, handoff comment, valid 10-digit mobile | Hand Off button disabled + reason label |
| Collector handoff → district mandatory | Classification section |
| APSSDC → need-training ticked | Classification section |
| `wrong_contact` disposition marks contact `valid = 0`, creates "Find alternate contact" task | On save |
| Claim on open; one per company per day; others see warning, not block | Company page load |
| Overdue tasks never auto-roll; they age | My Day |
| Callers cannot export; all exports logged | Admin only |
| EDB-owned fields are read-only in UI | Company page, call form |
| No UPDATE/DELETE on append-only tables: `edb_raw`, `requirement_version`, `interaction`, `edb_outbox`, `audit_log` | Data layer |
| All timestamps ISO-8601 UTC; display in IST | Everywhere |
| Dropdown values from `reference/dropdowns.json`, not hard-coded | All forms |

---

## 5. Data Import & Export

### Import (EDB Extract)
- Source: EDB Skill Requirement CSV (29 columns, one row per role per submission).
- Loader creates: `edb_raw` (append-only snapshot), `company` (one per `company_code`), `contact` (de-duped submitter), `requirement` (one per role row), `task` (first-call task per company).
- Idempotent: re-running on same file inserts 0 new companies. Re-running on new extract updates EDB-owned columns only — caller-captured fields never overwritten.
- Import flags identify data quality issues.

### Backfill (August Calling History)
- Matches by mobile then normalised company name.
- Creates interaction per matched company under system user `backfill`.
- Closes first-call task.
- Writes `backfill_unmatched.csv` for manual resolution.

### Export (Migration Contract)
- One CSV per table + `MANIFEST.csv` in a zip.
- Referential integrity guaranteed: every interaction has valid company_code and username.
- Every requirement has at least one requirement_version.

---

## 6. Key Entities

| Entity | Grain | Key |
|--------|-------|-----|
| Company | One per EDB `company_code` (legal entity) | `company_code` (e.g., `EDB-6ZF-26LW`) |
| Contact | Submitter from EDB + caller-added contacts | UUID; de-duped on normalised mobile |
| Requirement | One per role per submission | UUID; natural key: `reference_id + role_name + created_at_edb` |
| Interaction | One per call/inbound event (append-only) | UUID |
| Task | Derived from next_step / system rules | UUID |
| Claim | Who is working a company today | UUID; unique per company per day |
| Requirement Version | Every change to a requirement (append-only) | UUID |
| EDB Outbox | Delta queue for EDB API (append-only) | UUID |
| Audit Log | Every write action (append-only) | UUID |

---

## 7. Screens Summary by Role

| Screen | Caller | Lead | Admin | Viewer | Scheduler | Outcomes | District Coord. |
|--------|--------|------|-------|--------|-----------|----------|-----------------|
| Login | Y | Y | Y | Y | Y | Y | Y |
| My Day | Y | Y | Y | - | Y | Y | - |
| Universe | Y | Y | Y | - | Y | - | - |
| Company Page | Y | Y | Y | - | Y | - | - |
| Log a Call | Y | Y | Y | - | Y | Y | - |
| Handed Over | - | Y | Y | Y (read-only) | Y | - | - |
| Scheduling Queue | - | - | Y | - | Y | - | - |
| Requirement & Drives | - | - | Y | - | Y | - | - |
| Outcomes Board | - | - | Y | - | - | Y | - |
| Escalations & Reassign | - | Y | Y | - | - | - | - |
| Dashboard | - | Y | Y | - | - | - | - |
| User Management | - | - | Y | - | - | - | - |
| Import / Backfill | - | - | Y | - | - | - | - |
| Export | - | - | Y | - | - | - | - |
| Messaging Centre | - | - | Y | - | - | - | - |
| EDB Send Log / Audit Log | - | - | Y | - | - | - | - |
| Collector Tickets | - | - | Y | - | - | - | Y (own district) |

---

## 8. Disposition Codes

| Code | Label | Connected? | Requires |
|------|-------|------------|----------|
| `no_answer` | Attempted — no answer | No | — |
| `wrong_contact` | Wrong contact / invalid number | No | Marks contact invalid, creates task |
| `hiring_now` | Connected — hiring now | Yes | — |
| `hiring_later` | Connected — hiring later | Yes | Date |
| `no_requirement` | Connected — no requirement | Yes | Reason code |
| `not_operational` | Not operational / closed | Yes | — |
| `do_not_call` | Do not call | Yes | Reason code |
| `duplicate` | Duplicate of another company | No | — |

---

## 9. Classification Routes

| Route | Label | Goes To | Extra Requirements |
|-------|-------|---------|--------------------|
| `kaushalam` | Direct hiring — Kaushalam | Scheduling team | — |
| `apssdc` | Needs training — APSSDC | EDB training pipeline | Need-training flag, optional QP code |
| `collector` | Collector handoff | District Coordinator | District dropdown (mandatory) |

---

## 10. Brand & UI

- **Maroon:** `#620124` (primary)
- **Cream:** `#FBEFE3` (background accent)
- **Orange:** `#D9601F` (secondary/warning)
- **Desktop only** — no mobile layout required.
- **System font** (IBM Plex Sans in mockups, system font acceptable).
- **EDB data** styled with blue border/badges (read-only).
- **Kaushalam data** styled with green badges.
- **Collector/APSSDC data** styled with grey badges.
