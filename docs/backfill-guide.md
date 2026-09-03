# Backfill Export/Import Guide

**Purpose:** Bulk-update requirement data captured offline (in Excel) back into the CRM. Covers ~2,000+ role-level records that were validated via calls but recorded in spreadsheets instead of the app.

---

## Workflow

```
Export CSV → Fill in Excel → Validate (dry run) → Import
```

### Step 1: Export requirements

```bash
# Export all captured (unvalidated) requirements
npx tsx src/scripts/export-for-backfill.ts

# Export only Tier 1
npx tsx src/scripts/export-for-backfill.ts --tier 1

# Export only a specific status
npx tsx src/scripts/export-for-backfill.ts --status captured

# Export specific district
npx tsx src/scripts/export-for-backfill.ts --district Guntur
```

Output: `data/backfill-export-YYYY-MM-DD.csv`

### Step 2: Fill in Excel

Open the CSV in Excel/Google Sheets. The **left columns are read-only context** (grey). The **right columns are editable** (fill these in).

Save as CSV (UTF-8) when done.

### Step 3: Validate (dry run)

```bash
npx tsx src/scripts/import-backfill.ts --file data/backfill-filled.csv --dry-run
```

Shows what would change, reports validation errors. Fix errors in the CSV and re-run until clean.

### Step 4: Import

```bash
npx tsx src/scripts/import-backfill.ts --file data/backfill-filled.csv --user ravi+admin@algohire.ai
```

The `--user` flag is the email of the user to attribute the updates to.

---

## CSV Structure

### Read-Only Columns (context, do not edit)

| Column | Source | Description |
|--------|--------|-------------|
| `company_code` | company | EDB company key, e.g. `APIND-083` |
| `company_name` | company | Company display name |
| `district` | company | District from EDB |
| `sector` | company | Company sector |
| `tier` | company | 1–4, derived from rank |
| `requirement_id` | requirement | Internal UUID (used for matching on import) |
| `reference_id` | requirement | EDB submission ID, e.g. `EDB-2026-CBW3AD` |
| `role_name` | requirement | Role title from EDB |
| `required_count` | requirement | Openings count from EDB |
| `required_within_months` | requirement | Timeline from EDB |
| `skills` | requirement | Skills from EDB (`;`-separated) |
| `current_status` | requirement | Current status in the CRM |

### Editable Columns (fill these)

| Column | Required? | Type | Validation | Description |
|--------|-----------|------|------------|-------------|
| `required_count_validated` | Yes for handoff | Integer | 0–99999 | Validated openings count |
| `qualification` | Yes for handoff | Text | Must be one of the allowed values (see below) | Minimum qualification |
| `experience_from` | Yes for handoff | Integer | 0–15 | Minimum experience in years |
| `experience_to` | Yes for handoff | Integer | 0–15, must be ≥ `experience_from` | Maximum experience in years |
| `gender_preference` | No | Text | `Any`, `Male`, or `Female` | Gender preference |
| `age_limit` | No | Text | Free text | e.g. `18–35` |
| `salary` | No | Integer | 0–9999999 | Monthly salary in ₹ |
| `pwd` | No | Text | `yes` or `no` | Persons with Disabilities — diversity hiring |
| `classification` | Yes for handoff | Text | `kaushalam`, `apssdc`, or `collector` | Routing classification |
| `collector_district` | If collector | Text | Must be a valid AP district name | Required when classification = `collector` |
| `handoff_comment` | If handoff | Text | Max 2000 chars | Context for receiving team |
| `new_status` | No | Text | See allowed values below | Set to update the requirement status |

### Allowed Qualification Values

```
No formal qualification
8th
10th
Intermediate
ITI
Diploma
Graduate — Arts / Science / Commerce
Graduate — B.Sc
Graduate — B.Tech / BE
Graduate — B.Pharm
Post-graduate — M.Sc
Post-graduate — MBA / MCA / M.Tech
Post-graduate — M.Pharm
Other (comment)
```

### Allowed Status Values

```
captured          (default, no action taken)
attempting        (call attempted)
validated         (requirement confirmed by employer)
handed_over_scheduling  (handed to Kaushalam scheduling team)
handed_over_collector   (handed to district Collector)
handed_over_apssdc      (handed to APSSDC for training)
future            (employer hiring later)
no_requirement    (employer not hiring)
not_operational   (company closed/not operational)
do_not_call       (employer asked not to be contacted)
duplicate         (duplicate company record)
```

### Allowed District Values (for `collector_district`)

```
Alluri Sitharama Raju, Anakapalli, Anantapuramu, Annamayya, Bapatla,
Chittoor, Dr. B.R. Ambedkar Konaseema, East Godavari, Eluru, Guntur,
Kakinada, Krishna, Kurnool, Nandyal, NTR, Palnadu,
Parvathipuram Manyam, Prakasam, Sri Potti Sriramulu Nellore,
Sri Sathya Sai, Srikakulam, Tirupati, Visakhapatnam, Vizianagaram,
West Godavari, YSR Kadapa
```

---

## Example CSV

```csv
company_code,company_name,district,sector,tier,requirement_id,reference_id,role_name,required_count,required_within_months,skills,current_status,required_count_validated,qualification,experience_from,experience_to,gender_preference,age_limit,salary,pwd,classification,collector_district,handoff_comment,new_status
APIND-083,Sri Venkateswara Textiles Pvt Ltd,Guntur,Textile & Handloom,1,a1b2c3d4-uuid,EDB-2026-01184,Sewing Machine Operator,120,6,Operation and Control; Quality Control,captured,100,10th,0,1,Female,18–35,12500,no,kaushalam,,Walk-in at Guntur unit. Two shifts. ESI/PF included.,handed_over_scheduling
APIND-083,Sri Venkateswara Textiles Pvt Ltd,Guntur,Textile & Handloom,1,e5f6g7h8-uuid,EDB-2026-01184,Quality Checker,15,6,Quality Control Analysis,captured,15,Intermediate,1,3,Any,,14000,no,kaushalam,,Same unit. Day shift only.,handed_over_scheduling
APIND-291,Krishna Agro Foods Pvt Ltd,Krishna,Food Processing,2,i9j0k1l2-uuid,EDB-2026-01502,Packing Helper,60,3,,captured,60,No formal qualification,0,0,Any,18–40,11000,no,collector,Krishna,Festive-season hiring. 60 heads within 15 km of Gannavaram. Start 15 Sep.,handed_over_collector
APIND-418,Coastal Marine Engineering Works,Visakhapatnam,Engineering,2,m3n4o5p6-uuid,EDB-2026-00418,Welder,25,6,Welding; Fabrication,captured,25,ITI,1,3,Male,,16000,no,apssdc,,APSSDC batch mobilisation started. Need 6S welding cert.,handed_over_apssdc
APIND-500,Rayalaseema Ceramics Ltd,Anantapuramu,Building Materials,3,q7r8s9t0-uuid,EDB-2026-01077,Kiln Operator,12,12,,captured,,,,,,,,,,,,
```

**Row 1–2:** Fully validated, classified as Kaushalam direct hiring, status set to `handed_over_scheduling`.

**Row 3:** Collector handoff — `collector_district` is filled, status set to `handed_over_collector`.

**Row 4:** APSSDC route — classification `apssdc`, status set to `handed_over_apssdc`.

**Row 5:** Left blank — requirement stays as `captured`, no changes applied.

---

## What the Import Does (per row with changes)

1. **Updates `requirement` table** — only the editable fields, never EDB-owned fields
2. **Inserts `requirement_version`** — field-level diff + full snapshot, attributed to the `--user`
3. **If status is `handed_over_*`:**
   - Sets `handed_over_at` to import timestamp
   - Sets `handed_over_by` to the user
4. **Inserts `edb_outbox` row** — queues the change for future EDB API replay
5. **Closes the open task** for that company (sets `status = done`, `closed_at = now`)
6. **Inserts `audit_log`** entry

### Validation Rules (import rejects the row if any fail)

| Rule | Error message |
|------|---------------|
| `requirement_id` not found in DB | `Unknown requirement ID` |
| `required_count_validated` not a number or negative | `Invalid validated count` |
| `qualification` not in allowed list | `Unknown qualification value` |
| `experience_to` < `experience_from` | `Experience "to" must be ≥ "from"` |
| `experience_from` or `experience_to` > 15 | `Experience must be 0–15` |
| `salary` not a number or > 9,999,999 | `Invalid salary` |
| `classification` not `kaushalam`/`apssdc`/`collector` | `Unknown classification` |
| `classification = collector` but `collector_district` empty | `Collector handoff requires a district` |
| `collector_district` not in allowed list | `Unknown district` |
| `new_status` not in allowed list | `Unknown status value` |
| `handed_over_*` status but missing required fields | `Handoff requires: validated count, qualification, experience, classification, handoff comment` |

### Dry Run Output Example

```
Dry run — no changes will be written.

Processing 2,147 rows...
  Row 1: APIND-083 / Sewing Machine Operator → UPDATE validated_count 120→100, qualification →10th, experience →0-1yr, classification →kaushalam, status →handed_over_scheduling
  Row 2: APIND-083 / Quality Checker → UPDATE validated_count →15, qualification →Intermediate, experience →1-3yr, classification →kaushalam, status →handed_over_scheduling
  Row 3: APIND-291 / Packing Helper → UPDATE validated_count →60, classification →collector (Krishna), status →handed_over_collector
  Row 5: APIND-500 / Kiln Operator → SKIP (no changes)

Summary:
  Rows processed: 2,147
  Updates:         1,823
  Skipped:         312
  Errors:          12
  Tasks closed:    1,420

Errors:
  Row 47: APIND-612 / Helper — Unknown qualification "Graduate"
  Row 118: APIND-890 / Operator — Experience "to" (2) < "from" (5)
  ...
```
