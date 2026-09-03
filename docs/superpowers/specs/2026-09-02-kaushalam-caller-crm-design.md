# Kaushalam CRM — Caller App Design Spec

**Date:** 2 September 2026  
**Scope:** Caller CRM + Admin (lite dashboard, user management). No claiming, no notifications.  
**Stack:** Next.js 15 (App Router), PostgreSQL, Better Auth, Drizzle ORM, Tailwind CSS, shadcn/ui

---

## 1. Overview

Internal call-logging tool for ~6 users working a list of ~5,300 companies imported from the government Employer Database (EDB). A caller opens a company, calls the employer, and records — in under two minutes — what happened, per-role requirement details, classification, and when to call next.

## 2. Roles

| Role | Access |
|------|--------|
| `caller` | Full caller UI: My Day, Universe, Company Page, Log a Call, Handed Over |
| `admin` | Everything caller can do + Dashboard + User Management (`/admin/*`) |

- No self-signup. Users created via CLI seed script (email, password, role).
- Better Auth with email/password provider. Session timeout 12 hours.
- Role middleware on server actions blocks unauthorized writes.

## 3. Data Model

All tables from `interim/schema.sql` ported to Drizzle ORM, with these adjustments:

- **Removed:** `claim` table (claiming out of scope)
- **`app_user`:** replaced by Better Auth `user` + `session` tables, plus a `role` column (`caller` | `admin`) and `team` column on the user table
- **All UUIDs** as primary keys (via `crypto.randomUUID()`)
- **Append-only tables** (no update/delete in code): `edb_raw`, `requirement_version`, `interaction`, `edb_outbox`, `audit_log`

### Tables

| Table | Purpose | Mutable? |
|-------|---------|----------|
| `user` / `session` / `account` | Better Auth managed | Auth managed |
| `import_batch` | EDB import bookkeeping | Insert only |
| `edb_raw` | Immutable snapshot of EDB rows | Append only |
| `company` | One per `company_code` | Update (denormalized fields) |
| `contact` | Submitter from EDB + caller-added | Update (valid flag) |
| `requirement` | One per role row, current state | Update (captured fields only) |
| `requirement_version` | Every change snapshot | Append only |
| `interaction` | Call log / timeline entries | Append only |
| `task` | Drives "My Day" | Update (status, closed_by) |
| `edb_outbox` | Delta queue for future EDB API | Append only |
| `audit_log` | Every write action | Append only |

### Key Constraints

- EDB keys preserved verbatim: `company_code`, `reference_id`, `role_name`, `created_at_edb`
- Requirement natural key: `reference_id + role_name + created_at_edb`
- `company.last_disposition`, `last_contact_at`, `contact_count` denormalized from `interaction` on every save
- Timestamps ISO-8601 UTC. Dates YYYY-MM-DD. Lists `;`-separated.

## 4. Pages (8 screens)

| Route | Access | Purpose |
|-------|--------|---------|
| `/login` | All | Email + password |
| `/today` | caller, admin | Tasks, KPIs |
| `/universe` | caller, admin | Company list with filters |
| `/company/[code]` | caller, admin | Company details, contacts, requirements, timeline |
| `/company/[code]/call` | caller, admin | Full call form + handoff |
| `/handed-over` | caller, admin | Read-only handed-over list |
| `/admin/dashboard` | admin only | KPIs + per-caller performance |
| `/admin/users` | admin only | User CRUD |

### 4.1 Login (`/login`)

- Email + password form via Better Auth
- Redirect to `/today` on success
- No signup link, no forgot password

### 4.2 My Day (`/today`)

Landing page after login.

**KPI counters:**
- Due today
- Overdue (with oldest age in days)
- Requirements validated this week
- Handed over this week (split: Scheduling / Collector / APSSDC)

**Task table:**
- Tabs: *Today & Overdue* (default), *This Week*, *Unassigned* (tasks with no `user_id`, sorted by company rank)
- Columns: company (link to company page), next step, set by (user or system), due date, age badge if overdue, Open button
- Overdue tasks persist and show age — never auto-roll

**Side panel:**
- Handed over this week (team total)

### 4.3 Universe (`/universe`)

**Filters (server-side, URL search params):**
- Search: company name, EDB code, mobile
- District, sector, sub-sector (contains), stage
- Tier (1–4)
- Required-within: ≤3 / ≤6 / ≤12 / >12 months
- Previously worked on: never / no contact in 60 days / contacted this month / by disposition
- Flags, tags, classification, status

**Default sort:** tier ASC, rank ASC. Secondary sorts: last contact, district, total required.

**Columns:** company (name + EDB code + flag chips), sector, district/mandal, headcount, total required (role count), tier, last contact + disposition, calls count, tags.

**Pagination:** server-side, 25 per page.

**No export button** (admin-only, not built yet).

### 4.4 Company Page (`/company/[code]`)

**Header:** company name, EDB code, tier/rank, status chips (last disposition, last contact, next step + date), tags (editable multi-select from 5 fixed tags + free text).

**Action buttons:** Log a Call, Add Contact, Log Inbound (creates interaction with channel `inbound`).

**"Since last contact" notice:** open tasks for this company.

**Left column:**
- **Company details** (EDB, read-only, blue-bordered): legal name, GSTIN, PAN, Udyam, sector, sub-sectors, line of activity, plant location, district/mandal/village, stage, headcount, project name, flags.
- **Contacts table:** name, designation, mobile (tap-to-call `tel:` link), email, POC for, source, valid. Add contact form. Mark invalid button.
- **Requirements** (one card per role): EDB values vs captured values side-by-side. Version number. Flag chips.
- **Version history** per requirement (collapsible).

**Right column:**
- **Timeline:** reverse-chronological interactions. Each entry: user, team, channel, time, disposition badge, comment, field diff chips, next step + date. EDB import events (blue). Filter by user / channel.

### 4.5 Log a Call (`/company/[code]/call`)

Single form, one Save button. All in one page.

**Call section:**
- Contact: dropdown of company contacts + "Add new contact" option
- Channel: call | whatsapp | email | visit | inbound
- Disposition: from `dropdowns.json`
- Reason code: shown when disposition requires it (`no_requirement`, `do_not_call`)
- Comment: textarea, mandatory

**"Do they require now?":**
- Radio: Now / Later (shows date picker) / Not hiring (shows next call date + reason)
- Company-level; per-role timing can override

**Requirement per role (table):**
- Rows = company's existing requirements
- Per row: role title (EDB value shown, editable copy), standard role (free text with type-ahead from distinct roles in DB), validated count, qualification (dropdown), experience (dropdown), gender, age limit, salary, shift, monthly intake, comment
- "Add role" button: new requirement with `reference_id = 'CALLER-' + company_code`
- "Not required any more" toggle: sets status `no_requirement` for that role

**Classification & handoff per role:**
- Radio: Kaushalam / APSSDC / Collector
- Collector → district dropdown (mandatory, from `reference/districts.txt`)
- APSSDC → need-training checkbox (mandatory) + QP code (optional)
- Handoff comment: textarea, mandatory for handoff

**Handoff gate (client-side validation):**
Per-role button disabled until: role title, validated count, qualification, experience, classification, handoff comment all filled + company has contact with valid 10-digit mobile. Collector → district selected. APSSDC → need-training ticked. Button label shows what's missing.

**Next step section:**
- Next step text: mandatory
- Next action date: mandatory, max today + 12 months

**Mandatory on every save:** contact, channel, disposition, comment, next step, next action date. Save button disabled until all filled.

**On Save (single DB transaction via server action):**
1. Insert `interaction`
2. For each changed requirement: update `requirement`, insert `requirement_version` (diff_json + snapshot_json)
3. Update `company`: `last_disposition`, `last_contact_at`, `contact_count`
4. Close caller's open task for this company (status → `done`, `closed_by_interaction`)
5. Create new task from next step (title, due_date, source = `next_step`)
6. Insert `edb_outbox` per changed requirement / handoff
7. Insert `audit_log`
8. If `wrong_contact` disposition: set contact `valid = 0`, create task "Find alternate contact"
9. If handoff: set requirement status to `handed_over_scheduling` / `handed_over_collector` / `handed_over_apssdc`, set `handed_over_at`, `handed_over_by`
10. Redirect to company page

**3-attempt no-answer rule:** After 3 `no_answer` interactions within 5 working days, prompt caller to set a future date instead of immediate retry.

### 4.6 Handed Over (`/handed-over`)

Read-only list of requirements with status `handed_over_*`.

**Columns:** company, role, validated count, qualification, experience, classification, Collector district, handoff comment, handed over by, handed over at, contact (name + mobile).

**Filters:** route (Scheduling / Collector / APSSDC), date range.

**No CSV download** (admin-only feature, not built).

## 5. Admin Pages

### 5.1 Dashboard (`/admin/dashboard`)

Admin-only. Role middleware blocks callers.

**KPI cards:**
- Total companies (from `company`)
- Attempted (companies with ≥1 interaction)
- Connected (companies with ≥1 interaction where disposition is `connected = true`)
- Requirements validated (requirements with `required_count_validated` set)
- Openings validated (sum of `required_count_validated`)
- Handed over (requirements with status `handed_over_*`, split: Scheduling / Collector / APSSDC)

**Per-caller table:**
| Column | Source |
|--------|--------|
| Caller name | `user.name` |
| Dials | count of `interaction` by user |
| Connects | count where disposition `connected = true` |
| Connect % | connects / dials |
| Requirements validated | count where `required_count_validated` set, by `updated_by` |
| Openings validated | sum of `required_count_validated`, by `updated_by` |
| Handoffs (S / C / A) | count by classification route, by `handed_over_by` |
| Overdue tasks | count of open tasks past `due_date`, by `user_id` |

**Period selector:** Today / This week / This month / All time. Filters `interaction.created_at` and relevant timestamps.

### 5.2 User Management (`/admin/users`)

Admin-only.

**User list table:**
- Columns: name, email, role, status (active/inactive), created at
- Actions per row: deactivate/reactivate, reset password, change role

**Create user form:**
- Fields: display name, email, password, role (`caller` | `admin`)
- On submit: create user via Better Auth admin API

**Reset password:**
- Admin sets new password directly (no email flow)

**Deactivate:**
- Sets `active = false` (or Better Auth equivalent). User cannot login. Does not delete.

## 6. Static Configuration

`reference/dropdowns.json` loaded as static config at build time. Contains:
- Disposition codes (with `connected`, `requires_reason`, `requires_date` flags)
- No-requirement reason codes
- Timing options
- Qualification options
- Experience options
- Gender preference options
- Classification options (with labels)
- Requirement status values
- Tags (5 fixed)
- Channel options
- Company stage values
- User roles
- Rules (date caps, retry thresholds, mandatory field lists, handoff gate requirements)

`reference/districts.txt` loaded as static list for Collector district dropdown.

## 6. Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, auth provider
│   ├── login/page.tsx          # Login form
│   ├── (authenticated)/        # Route group with auth middleware
│   │   ├── layout.tsx          # Sidebar nav, user context
│   │   ├── today/page.tsx      # My Day
│   │   ├── universe/page.tsx   # Universe list
│   │   ├── company/
│   │   │   ├── [code]/
│   │   │   │   ├── page.tsx    # Company page
│   │   │   │   └── call/
│   │   │   │       └── page.tsx # Log a call
│   │   ├── handed-over/page.tsx # Handed over list
│   │   └── admin/              # Admin-only route group
│   │       ├── layout.tsx      # Admin role guard
│   │       ├── dashboard/page.tsx # Lite dashboard
│   │       └── users/page.tsx  # User management
├── lib/
│   ├── auth.ts                 # Better Auth server config
│   ├── auth-client.ts          # Better Auth client
│   ├── db/
│   │   ├── index.ts            # Drizzle client + connection
│   │   ├── schema.ts           # Drizzle schema (all tables)
│   │   └── migrations/         # Drizzle migrations
│   ├── config/
│   │   ├── dropdowns.ts        # Typed dropdowns from JSON
│   │   └── districts.ts        # District list
│   └── actions/
│       ├── call.ts             # Log a call server action (the big transaction)
│       ├── contact.ts          # Add contact, mark invalid
│       ├── company.ts          # Update tags
│       ├── task.ts             # Task queries
│       ├── admin.ts            # Dashboard queries (KPIs, per-caller stats)
│       └── user-management.ts  # Create, deactivate, reset password, change role
├── components/
│   ├── ui/                     # shadcn components
│   ├── call-form/              # Call form sub-components
│   │   ├── call-section.tsx
│   │   ├── requirement-table.tsx
│   │   ├── classification.tsx
│   │   ├── handoff-gate.tsx
│   │   └── next-step.tsx
│   ├── company/                # Company page sub-components
│   │   ├── company-header.tsx
│   │   ├── edb-details.tsx
│   │   ├── contacts-table.tsx
│   │   ├── requirements-list.tsx
│   │   ├── version-history.tsx
│   │   └── timeline.tsx
│   ├── universe/
│   │   ├── filters.tsx
│   │   └── company-table.tsx
│   ├── today/
│   │   ├── kpi-cards.tsx
│   │   └── task-table.tsx
│   ├── admin/
│   │   ├── kpi-cards.tsx
│   │   ├── caller-table.tsx
│   │   ├── user-list.tsx
│   │   └── create-user-form.tsx
│   └── layout/
│       ├── sidebar.tsx
│       └── topbar.tsx
├── scripts/
│   └── create-user.ts          # CLI: create user with email, password, role
drizzle.config.ts
```

## 7. Non-Functional

- **Desktop only** — no mobile responsive needed
- **~6 concurrent users** — no performance concerns
- **Display timezone:** IST (`Asia/Kolkata`) via `Intl.DateTimeFormat`
- **Store timezone:** UTC
- **Brand colors:** maroon `#620124`, cream `#FBEFE3`, orange `#D9601F`
- **No real-time** — standard request/response

## 8. Out of Scope

- Claiming system (no `claim` table)
- Admin import/export UI, messaging centre, full dashboard, audit log viewer
- Lead screens (escalations, reassignment)
- Scheduler screens (scheduling queue, requirement & drives)
- Outcomes screens (outcomes board)
- District Coordinator screens (collector tickets)
- Employer notifications (WhatsApp, email)
- EDB outbox send mechanism (write-only)
- Data seeding / EDB import (future script)
- User creation via CLI only (admin UI now included)
- CSV export
- Self-signup / forgot password
