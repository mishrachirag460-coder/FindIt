# Product Requirements Document (PRD)

## Project: FindIt – Campus Item Recovery & Coordination System
**Document Version:** 1.2.0  
**Status:** Approved & Implemented (Core & Security Patched)  
**Target Audience:** Campus Students, Faculty, Department Heads, Administrative & Security Staff

---

## 1. Executive Summary

Colleges and universities experience hundreds of misplaced items weekly—ranging from ID cards and calculators to laptops and keys. Existing informal recovery channels (WhatsApp groups, unorganized bulletin boards, scattered social media posts) fail because:
1. They lack verified campus identity and accountability.
2. Anyone can falsely claim high-value items without independent proof.
3. Custody handovers between peers or campus security are undocumented.
4. Items handed to security desks or department offices become "black boxes" with no visibility into who holds them.

**FindIt** resolves these issues by delivering a structured, role-aware, zero-knowledge verification web platform that connects finders, claimants, peer custodians, and campus staff through auditable recovery workflows.

---

## 2. User Personas & Problems

### Persona 1: The Student Finder ("Rohan")
- **Profile:** 2nd Year BCA Student. Finds a scientific calculator in the computer lab.
- **Pain Points:** Wants to help return it, but does not want strangers calling his personal phone or showing up at his dorm. May need to hand it over to a lab assistant or security guard when rushing to his next lecture.
- **Needs:** Quick reporting, custody logging, ability to record staff handovers, and privacy protection.

### Persona 2: The Student Owner / Claimant ("Priya")
- **Profile:** 1st Year MCA Student. Lost her watch near the cafeteria.
- **Pain Points:** Checks bulletin boards and WhatsApp groups endlessly. Worried someone else will falsely claim it.
- **Needs:** Searchable public catalog, ability to submit verifiable proof privately, and notifications when it is found.

### Persona 3: The Intermediate Peer Custodian ("Amit")
- **Profile:** 3rd Year BBA Student. Received custody of an item from a classmate who had to leave campus.
- **Pain Points:** Wants clear proof that he held the item legitimately and transferred it onward without liability.
- **Needs:** Clear acceptance/rejection of custody transfers and full custody history tracking.

### Persona 4: The Campus Staff / Security Officer ("Rajesh Kumar")
- **Profile:** Campus Security Guard / Departmental Office Assistant. Receives found items handed in by students.
- **Pain Points:** No digital logging. Logbooks get misplaced. Handing items to claimants relies on guesswork.
- **Needs:** Clear digital record of items held at office checkpoints, identity verification step before physical release, and non-repudiable claimant receipt.

---

## 3. Product Scope & Functional Requirements

### 3.1. Authentication & Academic Profiling
- **FR-AUTH-1:** Campus email registration with password verification and standardized campus ID formatting (`FINDIT-XXXXX`).
- **FR-AUTH-2:** Student academic profile capture:
  - Course selection: `MCA`, `BCA`, `BBA`, `MBA`, or `Other` (with custom text field).
  - Academic year selection: `1st`, `2nd`, `3rd`.
  - Section custom input (e.g., `A`, `B`, `Shift 1`).
- **FR-AUTH-3:** Duplicate registration handling: If an email is already registered, display:  
  `"This account is already registered. Please sign in using your existing account."` and provide a one-click navigation link to the Sign-In view.
- **FR-AUTH-4:** In-dashboard academic detail updating for existing profiles with missing course/year/section information.

### 3.2. Item Reporting
- **FR-REP-1:** **Lost Item Reporting:**
  - Item name, category (Electronics, Documents, Personal Accessories, Books/Stationery, Keys, Other), description, location lost, date lost.
  - Optional `secret_marker` for private owner verification (never shown on public feeds).
- **FR-REP-2:** **Found Item Reporting:**
  - Item name, category, general appearance description, location found, date found.
  - Custody toggle:
    - *Option A:* Held by finder (finder retains active custody).
    - *Option B:* Handed over to unregistered campus staff (captures staff name, role e.g., Guard/Clerk, and office location e.g., Main Gate).
  - Optional `secret_marker` (e.g., specific scratch, engraving, wallpaper) stored confidentially.

### 3.3. Public Campus Feed & Discovery
- **FR-FEED-1:** Unified feed displaying active `OPEN` lost and found items.
- **FR-FEED-2:** Real-time search by item name, description, and location.
- **FR-FEED-3:** Category filtering and report-type toggles (All, Lost, Found).
- **FR-FEED-4:** Visual status badges:
  - Items held by finders: `"With student/faculty finder"`.
  - Items in campus staff custody: `"Handed to Campus Staff"` with staff name, role, and physical collection checkpoint.
- **FR-FEED-5:** Action buttons:
  - Finder cannot claim their own found report.
  - For finder-held items: `"Claim Item"`.
  - For staff-held items: `"Collect from Campus Office"`.

### 3.4. Peer-to-Peer Claim & Verification Workflow
- **FR-CLM-1:** Claimant submits detailed proof description (minimum length validation).
- **FR-CLM-2:** Claimant can optionally link an existing open lost report.
- **FR-CLM-3:** Current custodian reviews claim in their Dashboard.
- **FR-CLM-4:** Custodian can Accept (`ACCEPTED`) or Reject (`REJECTED`) with explanatory notes. Rejection triggers a 24-hour claim cooldown for that user on that item.
- **FR-CLM-5:** Upon physical meetup, the custodian confirms recovery, transitioning the found report to `RESOLVED` and linked lost report to `RECOVERED`.

### 3.5. Campus Office Collection & Handover Workflow
- **FR-STF-1:** Claimant submits office collection request (`PENDING`).
- **FR-STF-2:** Item remains `OPEN` on the public feed until collection is completed (preventing premature feed disappearance).
- **FR-STF-3:** Claimant visits the designated campus office.
- **FR-STF-4:** Authorized campus staff (`OFFICE_STAFF`, `HOD`, `TEACHER`) verifies claimant identity and proof, then triggers `staff_handover_item_to_owner` (`RELEASED_TO_OWNER`).
- **FR-STF-5:** Claimant inspects item and confirms receipt (`confirm_staff_collection_receipt`), safely resolving both found and lost records simultaneously (`RESOLVED`).

### 3.6. Complete Custody History Chain
- **FR-CUST-1:** Every transfer, staff deposit, and physical release is logged in an immutable `custody_history` table.
- **FR-CUST-2:** All legitimate historical parties (original finder, intermediate custodians, staff depositors, and final claimant) have authorization to inspect the complete custody history timeline modal.
- **FR-CUST-3:** Unrelated third parties are denied access to custody history.
- **FR-CUST-4:** Private verification clues (`secret_marker`, claimant proof description) are never copied into public history notes.

### 3.7. User Dashboard & Management Hub
- **FR-DASH-1:** "Items in My Custody": Active items currently held by the user, with a "Transfer Custody" action.
- **FR-DASH-2:** "Incoming Transfer Requests": P2P transfer requests requiring acceptance or rejection.
- **FR-DASH-3:** "Transferred Items": Historical records showing `"Transferred to [Recipient Name]"`, recipient FindIt ID, and timestamp.
- **FR-DASH-4:** "My Claims": Status of claims submitted by the user (`PENDING`, `ACCEPTED`, `RELEASED_TO_OWNER`, `CONFIRMED_RECOVERED`, `REJECTED`).
- **FR-DASH-5:** "Incoming Claims": Claims submitted by peers on items held by the user.
- **FR-DASH-6:** "My Reports": Open and resolved lost/found reports. Finder can see resolved items with recovery date and `"Recovered ✓"` badge.

---

## 4. Implementation Status Matrix

| Requirement Area | Feature / Capability | Status | Verification Reference |
| :--- | :--- | :--- | :--- |
| **Auth & Profile** | Course, Year, Section in Registration | **Completed** | Verified in `AuthModal.jsx` & `AuthContext.jsx` |
| **Auth & Profile** | Duplicate Email Detection & Flow | **Completed** | Verified in `AuthModal.jsx` |
| **Auth & Profile** | In-Dashboard Academic Update | **Completed** | Verified in `Dashboard.jsx` |
| **Reporting** | Lost Report with Secret Marker | **Completed** | Verified in `LostReportModal.jsx` |
| **Reporting** | Found Report with Staff Custody Option | **Completed** | Verified in `FoundReportModal.jsx` |
| **Feed Discovery** | Search & Category Filters | **Completed** | Verified in `CampusFeed.jsx` |
| **Feed Discovery** | Staff Handover Badge & Office Checkpoint | **Completed** | Verified in `CampusFeed.jsx` (Bug 3) |
| **Feed Discovery** | Finder Exclusion from Self-Claims | **Completed** | Verified in `CampusFeed.jsx` |
| **Custody Management** | P2P Custody Transfers & Responses | **Completed** | Verified in `custodyService.js` |
| **Custody Management** | Complete Custody Timeline for Parties | **Completed** | Verified in `incremental_fix_bugs_1_3_4.sql` (Bug 1) |
| **Claims & Recovery** | Peer-to-Peer Claim & Cooldown | **Completed** | Verified in `recoveryService.js` |
| **Claims & Recovery** | Two-Step Office Handover & Release | **Completed** | Verified in `incremental_fix_bugs_1_3_4.sql` (Bug 4) |
| **Security** | Staff-Only Handover Server Check | **Completed** | Role-gated to `OFFICE_STAFF`, `HOD`, `TEACHER` |
| **Security** | Secret Marker Non-Disclosure in Views | **Completed** | `found_items_public_catalog` |
| **Reports Visibility** | Finder View of Resolved Reports | **Completed** | `reportService.js` (Bug 2) |
| **Notifications** | In-App Feedback Banners | **Completed** | Verified in `Dashboard.jsx` & `App.jsx` |
| **Notifications** | Push / SMS Alerts | *Pending (Roadmap)* | Planned for v2.0 |
| **Media** | Item Photo Uploads | *Pending (Roadmap)* | Planned with auto-blurring for v2.0 |

---

## 5. Non-Functional Requirements (NFRs)

- **Security & Authorization:** Database zero-trust model. Direct client `INSERT`/`UPDATE` blocked via RLS. All sensitive actions executed through PostgreSQL `SECURITY DEFINER` RPCs with `search_path = ''`.
- **Data Integrity:** Strict foreign key constraints and transactional integrity (`BEGIN ... COMMIT`). Custody chain is append-only.
- **Performance:** Vite production bundle with compressed JavaScript (<160kB gzipped) and instant client-side memoized filtering.
- **Accessibility & Usability:** Clean campus theme with responsive layouts for mobile and desktop screens.
