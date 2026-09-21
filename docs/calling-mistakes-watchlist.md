# Calling Mistakes Watchlist

**Kaushalam Employer Outreach · Requirement Gathering team**
Data as of 19 Sep 2026, taken from the live CRM database.

This list covers the mistakes found in the call records so far. Each one either inflated the numbers we report or let a real lead slip. The aim is for everyone to recognise the pattern and avoid it, not to single anyone out. Individual names are left out on purpose.

Each item gives what happened, a real example, why it matters, and what to do instead.

---

## Part A. Mistakes that made the numbers wrong

These put a count or a handover on record that was never true. Every one of them inflates the Validated or Handed Over figure sent upward.

### A1. A validated count saved on a call where nobody said yes

**What happened:** Roles were given a validated count on a call logged as *No answer*, *No requirement*, or *Do not call*.

**Scale:** 15 companies.

**Examples:**
- **Stereokem Pharmaceuticals:** 4 roles and 43 openings saved on a *No requirement* call.
- **HAe Anusandhaan Yuva Foundation:** 10 openings saved on a *Do not call* call.
- **Sree Sankar Press, Vibhav Polyners, Sri Gomathi Rice Industries, Lahitya Tailoring:** counts saved on *No answer* calls.

**Why it matters:** If nobody answered, or they said they aren't hiring, there is no requirement to validate. These counts reach the Scheduling team as real demand.

**Do instead:** Enter a validated count only on a call where the employer confirmed they are hiring (*Hiring now*). On any other outcome, use **Save call only** and leave the roles untouched.

### A2. A role marked "No requirement" still carries a count

**What happened:** The role status was set to *No requirement* and the validated count was left in place.

**Scale:** 7 companies.

**Examples:** Sravan Shipping Services (100 openings), Medplus, Modi Metal Industries, Pradeep Paper Plate Industries, Kalyani Hair Style, Siva Durga Engineering Works.

**Why it matters:** The same role now says both "not needed" and "needed". Reports count it as validated.

**Do instead:** When you close a role as *No requirement*, set its count to **0**.

### A3. Timing set to "Not hiring" with counts entered

**What happened:** The call timing was *Not hiring*, yet roles were saved with counts.

**Scale:** 2 companies, 5 roles (Sravan Shipping Services, Stereokem Pharmaceuticals).

**Do instead:** *Not hiring* means every count on that call is **0**.

### A4. A route picked with a count of zero

**What happened:** A role was routed (Kaushalam / APSSDC / Collector) but its validated count is 0 or empty.

**Scale:** 5 companies (Sree Sudha Jewellery, Ramyasri Electrical Automation, Vital Paper Products, Unique Impression, VICS Industries).

**Why it matters:** The receiving team gets a handover with no number of people to fill.

**Do instead:** Route a role only after its validated count is filled in.

### A5. Counts entered from incomplete information

**What happened:** Counts were saved even though the call notes say the details weren't actually collected.

**Examples:**
- **Synergene Active Ingredients:** 4 roles and 35 openings saved. The call note reads *"no proper information… ask details send through WhatsApp"*.
- **Sun X Solars:** count saved. The call note reads *"no proper response yet to call again"*.

**Do instead:** If you couldn't get the role details, log the call, set a follow-up, and **leave the count at 0** until you have them.

### A6. One hire counted across several roles

**What happened:** **Raghavendra Electrical Works** was entered as 3 roles with 3 openings. The note says *"he wants only one person for these 3 roles"*.

**Do instead:** Enter the number of **people** they will hire, not one per skill. If a single person covers three skills, enter one role with count 1 and list the skills in the comment.

---

## Part B. Mistakes that lost or stalled real leads

### B1. Validated but never routed

**What happened:** Counts were confirmed but no route was chosen, so the requirement never reached a receiving team.

**Scale:** 44 roles across 30 companies. At 21 of those companies, not a single role was routed.

**Examples of real leads left waiting:**
- **Flipkart:** 50 people for Vijayawada, confirmed as *Hiring now*.
- **A.C Srikanth Reddy Stone Crusher:** 4 roles and 39 openings, with a detailed breakdown.
- **Ardee Engineering:** 10 openings, *"has requirement right now"*.
- **Bhavani Engineering Works:** 2 helpers and 2 welders.

**Why it matters:** A validated count with no route is demand that nobody acts on. For the employer, the call led nowhere.

**Do instead:** Validating and routing belong in the **same save**. If you confirm a count, pick the route and write the handoff comment before you save.

### B2. A "Hiring now" signal not captured

**What happened:** The employer said they are hiring, but the roles were left untouched.

**Example:** **Apollo Tyres** (220 openings on record). The note reads *"Hiring 150 per month, majorly ITI and Diploma"* and gives the HR head's number. All 10 roles are still *Captured* with no count.

**Do instead:** When you hear a hiring number on a call, validate the matching roles on that call. If you can't finish, create a follow-up task for the next day.

### B3. One attempt, then given up

**What happened:** 148 Tier 1 companies were called and never reached. **146 of them were called only once.** Several notes say *"Call back"* or *"Havent answered. Call back"*, and no second call followed.

**Examples:** RAM Software Solutions (501 openings, one call), Automotive Manufacturers (179, one call), Lemon Tree Premier Tirupati (56, one call).

**Why it matters:** This is the single biggest drop in the funnel, and most of it can be recovered.

**Do instead:** Make **at least 3 attempts, on different days and at different times**, before treating a company as unreachable. When you write "call back", set the follow-up date to match.

### B4. Top-ranked companies skipped

**What happened:** 10 high-ranked Tier 1 companies from the first data load have never been called, even though they have a phone number on file.

**Examples:** **Aruna Motors** (rank 9, 350 openings, 36 roles), Jasper Industries (98), BSR Modular Industries (64).

**Do instead:** Work the queue **by rank**. A company ranked 9 should never wait behind companies ranked in the hundreds.

### B5. "Do not call" used too freely

**What happened:** 18 Tier 1 companies are marked *Do not call* with the reason *Other*. In at least one case (HAe Anusandhaan), the same company was also given a validated count.

**Why it matters:** *Do not call* removes a company from outreach permanently. These are our highest-value employers.

**Do instead:** Use *Do not call* only when the employer **explicitly asks** not to be contacted again. For "not now", use *Hiring later* with a date. For "no need", use *No requirement* with the proper reason.

### B6. "Hiring later" with no follow-up date

**What happened:** 9 Tier 1 companies were marked *Hiring later* with no date recorded.

**Do instead:** Always enter the month they expect to hire. Without a date, no follow-up is ever scheduled and the lead is lost.

### B7. Wrong number, no replacement found

**What happened:** Companies such as **Valley Green Garments** (300 openings), **Saanso Pharma** and **Weiss Textil** now have **no valid phone number** after a wrong-contact call. No alternate contact has been added.

**Do instead:** After *Wrong contact*, find a new number the next day (company website, GST or Udyam record, district office) and add it as a new contact.

### B8. "Other" picked when a proper reason was in the list

**What happened:** When the outcome was *No requirement*, callers chose **Other (comment)** and typed the answer as a comment, instead of picking the matching reason from the dropdown.

**Scale:** **778 of the 1,036 companies** closed as *No requirement* (75%) are marked *Other*. Only 239 used *Requirement already filled*, and each of the other five reasons was used 4–7 times.

All 778 comments were read one by one. They fall into three groups:

| What the comment shows | Companies | Problem |
|---|---:|---|
| **No reason at all** ("not required", "not looking for manpower", "no need") | 574 | The employer's reason was never asked or never written down |
| **A reason that was already in the list**, or the wrong outcome entirely | 109 | Should have been picked from the dropdown |
| A genuine reason the list doesn't cover | 95 | *Other* was right here, but the comment should say it clearly |

**The 109 that were already in the list:**

| The caller wrote… | Companies | Should have picked |
|---|---:|---|
| "already hired", "already filled", "enough staff", "hired local candidates" | 56 | Reason: **Requirement already filled** |
| "business closed", "plant is not running", "did not start their business yet", "they stopped their work" | 20 | Outcome: **Not operational**. If not yet started: reason **Unit not yet commissioned** |
| "yet to start hiring after 6 months", "will hire after Nov", "contact us after 1 year", "for summer season he looks for manpower" | 17 | Outcome: **Hiring later** with the date. For seasonal: reason **Seasonal — not this season** |
| "call back after 10 mins", "hung up", "not answered", "he is busy, will call back", "wrong number" | 13 | Outcome: **No answer** or **Wrong contact**. This was never a conversation |
| "Looking for daily labor", "looking for sharp candidate", "based on availability, no qualification required" | 3 | Outcome: **Hiring now**. These employers are hiring |

**Real examples:**
- **Sri Balaji Builders** (Tier 1, 134 openings): *"Looking for daily labor"*, closed as No requirement / Other. This is live demand for the Collector route, and it was lost.
- **Nandini Foods and Feeds, Sowmya Sree Apparels, Vihaan Nuts** (Tier 1, 78 openings between them): *"yet to start hiring process after 6 months"*. All three belong under *Hiring later* with a date. As *Other*, none of them will ever get a follow-up call.
- **Sri Vasudha Mineral Industries**: *"he is in Rajasthan… he will get back tomorrow"*. This is a callback, not a no.
- **Narayana Hostel**: *"call back after 10 mins"*. The call was logged as the employer saying no.
- **Viyash Scientific**: *"all requirements are filled"*. Logged as *Other* even though *Requirement already filled* was in the list.

**The 574 with no reason.** The most common comments, word for word:

| Comment | Times used |
|---|---:|
| not looking for manpower | 107 |
| not required | 107 |
| no need manpower | 49 |
| currently not looking for manpower | 43 |
| no need any manpower | 41 |
| no requirement | 35 |

These comments just repeat the outcome. "Not required" as the reason for *No requirement* tells us nothing.

**Why it matters:**
- The status report's reason table shows **75% "Other"**, so we can't say why employers are declining.
- Leads get buried. *Hiring later*, *Hiring now* and callback cases filed as *Other* never get a follow-up task, and they drop out of the funnel for good.
- Calls that never connected are counted as **Connected**, which inflates our reach.

**Do instead:**

1. **Ask why, every time.** When an employer says "no need", ask one follow-up:
   - *"Have you already filled these positions?"* → **Requirement already filled**
   - *"Do you hire through your own people or an agency?"* → **Hiring through own channels** / **Hiring through contractor / agency**
   - *"Is the unit running at the moment?"* → **Not operational** or **Unit not yet commissioned**
   - *"Will you need people later — which month?"* → **Hiring later** with the date
   - *"Is this seasonal work?"* → **Seasonal — not this season**
   - *"Any plans to expand?"* → **No expansion planned**
2. **Read the dropdown before choosing Other.** If what the employer said matches a listed reason, pick that reason.
3. **Check the outcome, not just the reason.** A hang-up, "call back later" or no answer is **No answer**, not *No requirement*. "We will need people after November" is **Hiring later**, not a no.
4. **Use Other only when nothing in the list fits**, and then write the actual reason in plain words. For example:
   - ✅ *"Self-employed driver, no staff"*
   - ✅ *"Says he never submitted this requirement on EDB; filled the form for a subsidy"*
   - ❌ *"not required"*
   - ❌ *"no need manpower"*

**Genuine cases where Other was right (95).** These are fine as *Other* because the list doesn't cover them yet, as long as the comment states the reason:
- **Never submitted on EDB, or wrongly entered** (55): *"filled for subsidy, not for manpower"*, *"filled this information for license"*, *"wrongly entered, she is a housewife"*
- **Self-employed or family-run** (23): *"he himself is a driver"*, *"managed by family members"*, *"tea shop, they can handle"*
- **Not right now, will contact us if needed** (8)
- **Not a hiring business or roles don't fit** (6): *"they are farmers, no company"*, *"sales company, those roles are wrong"*
- **Business slow** (3)

The full list of all 778 companies, with each caller's comment and the reason it should have had, is in `data/no-requirement-other-reasons-2026-09-19.csv`.

**Update, 21 September.** The back-catalogue has been corrected where the comment made the reason clear: **218 calls were re-tagged** from *Other* to the right reason or outcome, and **five new reasons were added to the dropdown**:

- Not submitted by employer / wrongly entered on EDB
- Self-employed / family-run — no staff
- May need later — no date given
- No need now — will contact if required
- Not a hiring business / roles don't match

*Other* on No requirement calls has dropped from **75% to 56%**. The remaining **601** could not be corrected because the comment gives no reason at all. Those stay as *Other* until somebody asks the employer why, so please ask on the next call.

---

## Quick checklist before you press Save

| If the call outcome is… | Then… |
|---|---|
| No answer / Wrong contact | **Save call only.** No counts. Set a retry for another day. |
| No requirement | **Ask why.** Pick the matching reason from the list. Use *Other* only if none fits, and write the actual reason, never just "not required". Close the roles with a **count of 0**. |
| Hiring later | Enter the **expected date**. Counts stay 0 for now. |
| Do not call | Only if they **asked** not to be called again. |
| Hiring now | Validate the count, then fill in **qualification, experience, route and handoff comment in the same save.** |

And always:

- Count **people**, not skills.
- If you didn't get the details, **don't guess a number**. Log the call and follow up.
- **3 attempts** before giving up on a company.
- Work the list **by rank**.
- A hang-up or "call back later" is **No answer**, not *No requirement*.
- "Not required" is not a reason. **Ask why.**

---

## What the system now blocks

These rules are **live in the call form**. **Save & Validate Roles** refuses to save until they pass, and the server checks the same rules again, so they can't be bypassed.

| Rule | What the form now requires | Stops |
|---|---|---|
| R1 | A new or changed count can only be entered on a *Hiring now* call | A1 |
| R2 | A role ticked "not required any more" has count 0 and no route (the form now clears them for you) | A2 |
| R3 | On *No requirement*, *Not operational* or *Do not call*, every count must be 0 | A3 |
| R4 | A count needs the route, qualification, experience, handoff comment and a valid mobile, **in the same save** | A5, B1 |
| R5 | A route needs a count above 0 | A4 |
| R6 | *Hiring now* needs at least one role with a count, or use **Save Call Only** | B2 |
| Date | *Hiring later* must have a follow-up date, and it can't be in the past | B6 |

What this means for you:

- On any outcome other than *Hiring now*, use **Save Call Only**. Use **Save & Validate Roles** only to close roles that are no longer required.
- Older records that break these rules will block **Save & Validate Roles** at that company until they're corrected. Fix the flagged role, or use **Save Call Only**.
- Counts saved on an earlier *Hiring now* call stay as they are. You don't need to re-enter them on a follow-up call.

Items B3, B4, B7 and B8 (retrying, working by rank, replacing wrong numbers, picking the right reason) are still up to each caller. Please keep following the checklist above.
