# Testing & Quality Assurance Guide

## Project: FindIt – Campus Item Recovery & Coordination System
**Status:** All Test Suites Passing (0 Errors, 0 Failures)  
**Verification Suite:** `scratch/test_combined_bugs_1_3_4.js`  
**Linter:** Oxlint  
**Bundler:** Vite v6.4.6

---

## 1. Testing Strategy Overview

The FindIt platform uses a multi-layered verification strategy combining:
1. **Automated Unit & Scenario Simulation:** Node.js assertion suites verifying state transitions, security boundaries, and custody authorization logic.
2. **Static SQL Consistency & Schema Audit:** Automated script-based parsing of database migration files to enforce strict security invariants.
3. **Static Code Analysis & Linting:** Oxlint checking JavaScript, JSX, and React syntax.
4. **Production Build Compilation:** Vite bundle building ensuring zero missing imports, typing errors, or dead code paths.

---

## 2. Test Suite Breakdown (`test_combined_bugs_1_3_4.js`)

The end-to-end verification script is located at `scratch/test_combined_bugs_1_3_4.js`.

### Suite 1: Bug 1 – Complete Custody History Chain & Authorization
- **Test 1.1 (Party Authorization):**
  - Confirms original finder (Account A) is authorized to view custody history.
  - Confirms intermediate registered custodian (Account B) is authorized to view custody history.
  - Confirms unrelated campus member (Account C) is strictly rejected with an access denied error.
- **Test 1.2 (Chain Completeness):**
  - Verifies that both Account A and Account B receive the full 2-step history chain (peer handover + subsequent staff handover).

### Suite 2: Bug 3 – Campus Feed Staff Handover UI
- **Test 2.1 (Open Item State):**
  - Confirms normal open items display standard `"Open"` status and allow peer claims.
- **Test 2.2 (Staff Handover State):**
  - Confirms items in staff custody display the `"Handed to Campus Staff"` badge along with staff member name, role, and physical checkpoint location.
- **Test 2.3 (Action Visibility):**
  - Confirms rightful owner sees `"Collect from Campus Office"`.
  - Confirms the original finder is blocked from claiming their own found item.

### Suite 3: Bug 4 – Staff Collection & Recovery Workflow
- **Test 3.1 (Finder Exclusion):**
  - Finder attempting to submit an office collection request throws an error.
- **Test 3.2 (Premature Resolution Prevention):**
  - Found item remains in `OPEN` status on the public feed after collection request submission.
- **Test 3.3 (Staff Role Verification & Handover):**
  - Student caller attempting `staffHandoverItemToOwner` is rejected with:  
    `"Unauthorized: Only authorized campus staff (OFFICE_STAFF, HOD, TEACHER) may record physical handover."`
  - Unauthenticated caller is rejected with `"Authentication required"`.
  - Authorized staff member (`OFFICE_STAFF`) successfully releases item to owner (`RELEASED_TO_OWNER`).
- **Test 3.4 (Claimant Protection):**
  - Unrelated third party attempting to confirm receipt is rejected with `"Only claimant can confirm receipt"`.
- **Test 3.5 (Two-Step Final Resolution):**
  - Owner confirmation transitions found item to `RESOLVED` and linked lost report to `RECOVERED` with timestamps.
- **Test 3.6 (Feed Cleanup):**
  - Resolved item automatically leaves the active public catalog feed (`WHERE status = 'OPEN'`).
- **Test 3.7 (Audit Trail Completeness):**
  - All 3 lifecycle events (submission, staff release, owner confirmation) are recorded immutably in custody history.

### Suite 4: Regression & Static Security Audit
- **Test 4.1 (Bug 2 Regression):**
  - Verifies dashboard status badge mapping handles `RESOLVED`, `RECOVERED`, `CONFIRMED_RECOVERED`, `OPEN`, and `PENDING`.
- **Test 4.2 (Migration SQL Invariants):**
  - Validates `database/incremental_fix_bugs_1_3_4.sql` is wrapped in exactly 1 `BEGIN;` and 1 `COMMIT;` transaction block.
  - Confirms all RPCs enforce `SECURITY DEFINER` and `SET search_path = ''`.
  - Confirms `found_items_public_catalog` does NOT project `secret_marker`, `serial_number_hint`, or `private_notes`.
  - Confirms `found_items_public_catalog` preserves all 9 original columns in their exact original order and appends new columns only at the end.
  - Confirms `submit_staff_collection_request` never copies `v_clean_proof` into `custody_history.notes`.
  - Confirms `expire_stale_staff_reports` revokes execute from `PUBLIC`, `anon`, and `authenticated`, with zero client execution grants.

---

## 3. How to Run Tests Locally

### Run Verification Script:
```bash
node scratch/test_combined_bugs_1_3_4.js
```

**Expected Output:**
```text
=================================================================
RUNNING COMPLETE VERIFICATION SUITE: BUGS 1, 3 & 4 + REGRESSIONS
=================================================================

--- SUITE 1: BUG 1 CUSTODY HISTORY & AUTHORIZATION ---
✓ TEST 1.1: Authorization check authorizes A & B, denies C
✓ TEST 1.2: Account A and Account B see complete 2-step history chain including staff details

--- SUITE 2: BUG 3 CAMPUS FEED STAFF HANDOVER UI ---
✓ TEST 2.1: Normal OPEN item allows claim
✓ TEST 2.2: Staff item shows Handed to Campus Staff & staff details
✓ TEST 2.3: Rightful owner sees Collect from Campus Office; Finder cannot collect own report

--- SUITE 3: BUG 4 STAFF COLLECTION AND RECOVERY WORKFLOW ---
✓ TEST 3.1: Finder blocked from requesting collection
✓ TEST 3.2: Item remains OPEN after owner request; premature resolution prevented
✓ TEST 3.3: Self-handover blocked; staff verifies and releases item
✓ TEST 3.4: Unrelated user blocked from confirming receipt
✓ TEST 3.5: Owner confirmation transitions found item to RESOLVED and lost item to RECOVERED
✓ TEST 3.6: Resolved item automatically leaves active feed
✓ TEST 3.7: Custody history audit trail remains complete and immutable

--- SUITE 4: REGRESSION AUDIT ---
✓ TEST 4.1: Bug 2 status mapping preserved
✓ TEST 4.2: Migration SQL has single transaction, security definers, and safe view projection

=================================================================
ALL TESTS PASSED PERFECTLY WITH ZERO FAILURES!
=================================================================
```

### Run Static Code Linting:
```bash
npx oxlint
```

**Result:**
```text
Found 0 errors. Finished in 137ms on 16 files.
```

### Run Production Build:
```bash
npm run build
```

**Result:**
```text
vite v6.4.6 building for production...
✓ 85 modules transformed.
dist/index.html                   0.46 kB │ gzip:   0.29 kB
dist/assets/index-CjkRVaRG.css   44.05 kB │ gzip:   8.20 kB
dist/assets/index-Cb0etSo5.js   588.17 kB │ gzip: 154.96 kB
✓ built in 3.46s
```
