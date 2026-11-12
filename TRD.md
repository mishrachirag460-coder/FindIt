# Technical Requirements Document (TRD)

## Project: FindIt – Campus Item Recovery & Coordination System
**Document Version:** 1.2.0  
**Status:** Approved & Implemented  
**Architecture Style:** Single Page Application (SPA) with Backend-as-a-Service (BaaS) & Relational PL/pgSQL RPC Layer

---

## 1. System Architecture Overview

FindIt is built upon a layered client-server architecture:
1. **Presentation Layer:** React 18/19 SPA powered by Vite and Tailwind CSS.
2. **Client State & Services Layer:** React Context API (`AuthContext`) paired with modular service abstractions (`reportService`, `custodyService`, `recoveryService`).
3. **Gateway & Transport Layer:** Supabase JavaScript Client (`@supabase/supabase-js`) communicating over HTTPS / WebSockets.
4. **Data Persistence & Security Layer:** Supabase PostgreSQL with Row Level Security (RLS), security barrier views, and transactional `SECURITY DEFINER` stored procedures.

```text
+---------------------------------------------------------------------------------+
|                                 REACT SPA CLIENT                                |
|  Navbar | Hero | CampusFeed | ClaimModal | Dashboard | Lost/FoundReportModals   |
+---------------------------------------------------------------------------------+
                                       |
                 [React Context API & Service Layer Modules]
                 (AuthContext, reportService, custodyService, recoveryService)
                                       |
+---------------------------------------------------------------------------------+
|                            SUPABASE POSTGREST GATEWAY                           |
+---------------------------------------------------------------------------------+
                                       |
         +-----------------------------+-----------------------------+
         |                                                           |
 [Public Views (SELECT)]                                   [Audited RPC Functions]
 security_barrier = true                                   SECURITY DEFINER
 search_path = ''                                          SET search_path = ''
 (found_items_public_catalog)                              (create_*, submit_*, staff_*)
         |                                                           |
+---------------------------------------------------------------------------------+
|                          SUPABASE POSTGRESQL DATABASE                           |
|  profiles | lost_reports | found_reports | recovery_requests | custody_history  |
+---------------------------------------------------------------------------------+
```

---

## 2. Frontend Specifications

### 2.1. State Management & Authentication
- **`AuthContext.jsx`:**
  - Manages session lifecycle via `supabase.auth.onAuthStateChange`.
  - Exposes `user`, `profile`, `signIn`, `signUpStudent`, `signOut`, `refreshProfile`, and `updateProfile`.
  - Injects `course`, `academic_year`, and `section` into user metadata during signup.
  - Automatically loads full profile record from `public.profiles` on session establishment.
- **`supabase.js`:**
  - Singleton Supabase client configuration.
  - Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` via `import.meta.env` with process fallback.

### 2.2. Service Architecture
- **`reportService.js`:**
  - `fetchPublicFeed()`: Queries `public.found_items_public_catalog` and `public.lost_items_public_catalog`. Excludes sensitive verification markers.
  - `fetchUserReports(userId)`: Fetches user's own lost and found reports. Supports resolved items by removing obsolete `current_custody` column queries.
  - `createLostReport(report)`: Calls PostgreSQL RPC `public.create_lost_report`.
  - `createFoundReport(report)`: Calls PostgreSQL RPC `public.create_found_report`.
  - `closeLostReport(reportId)`: Calls PostgreSQL RPC `public.close_my_lost_report`.
- **`custodyService.js`:**
  - `fetchUserTransfers(userId)`: Retrieves incoming, outgoing, and completed custody transfers.
  - `initiateTransfer(foundItemId, recipientFinditId, notes)`: Initiates peer-to-peer custody transfer RPC.
  - `respondToTransfer(transferId, action, rejectionNotes)`: Accepts or rejects a pending transfer.
  - `handoverToUnregisteredStaff(...)`: Records deposit with campus security or office staff.
  - `fetchItemCustodyHistory(foundItemId)`: Calls `public.get_item_custody_history(p_found_item_id)`.
- **`recoveryService.js`:**
  - `fetchMyClaims()`: Retrieves claims submitted by the logged-in user.
  - `fetchIncomingClaimsForCustodian()`: Retrieves peer claims submitted against items held in the user's custody.
  - `submitClaim(...)`: Submits a recovery claim with proof description.
  - `submitStaffCollectionRequest(foundItemId, proofDescription, lostReportId)`: Calls `public.submit_staff_collection_request`.
  - `staffHandoverItemToOwner(requestId, staffNotes)`: Calls `public.staff_handover_item_to_owner`.
  - `confirmStaffCollectionReceipt(requestId)`: Calls `public.confirm_staff_collection_receipt`.

---

## 3. Database Schema & PL/pgSQL Specifications

### 3.1. Types & Enums
```sql
CREATE TYPE public.member_role AS ENUM ('STUDENT', 'TEACHER', 'HOD', 'OFFICE_STAFF');
CREATE TYPE public.item_status AS ENUM ('OPEN', 'RESOLVED', 'RECOVERED', 'CLOSED');
CREATE TYPE public.claim_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'RELEASED_TO_OWNER', 'CONFIRMED_RECOVERED');
CREATE TYPE public.transfer_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
```

### 3.2. Core Tables
1. **`public.profiles`**: Campus identity with unique human-readable ID (`findit_id`), academic fields (`course`, `academic_year`, `section`), and `member_type`.
2. **`public.found_reports`**: Found item listings. Includes `is_unregistered_custodian`, `unregistered_custodian_name`, `unregistered_custodian_role`, `unregistered_custodian_location`, and `secret_marker`.
3. **`public.lost_reports`**: Lost item listings with reporter foreign key and optional `secret_marker`.
4. **`public.recovery_requests`**: Claim records linking claimant, found item, optional lost report, and private proof.
5. **`public.custody_transfers`**: P2P custody transfer requests between registered campus members.
6. **`public.custody_history`**: Immutable audit ledger recording actors, recipients, and timestamps.
7. **`public.member_lookup_rate_limit`**: Sliding window rate-limiter preventing campus member directory scraping.

### 3.3. Views & Projection Security
- **`public.found_items_public_catalog`**:
  - `WITH (security_barrier = true, security_invoker = false)`
  - Columns: `id`, `item_name`, `category`, `description`, `found_location`, `found_date`, `status`, `is_unregistered_custodian`, `created_at`, `unregistered_custodian_name`, `unregistered_custodian_role`, `unregistered_custodian_location`, `finder_id`.
  - Filter: `WHERE status = 'OPEN'`.
  - Guarantees `secret_marker`, `serial_number_hint`, and `private_notes` are physically excluded from client queries.

---

## 4. Key RPC Functions & Signatures

### 4.1. Complete Custody History Access (Bug 1 Fix)
```sql
CREATE OR REPLACE FUNCTION public.check_user_is_item_party(
  p_user_id pg_catalog.uuid,
  p_found_item_id pg_catalog.int8
)
RETURNS pg_catalog.bool;

CREATE OR REPLACE FUNCTION public.get_item_custody_history(
  p_found_item_id pg_catalog.int8
)
RETURNS TABLE (
  history_id pg_catalog.uuid,
  found_item_id pg_catalog.int8,
  actor_id pg_catalog.uuid,
  actor_name pg_catalog.text,
  actor_findit_id pg_catalog.text,
  recipient_type pg_catalog.text,
  recipient_user_id pg_catalog.uuid,
  recipient_name pg_catalog.text,
  recipient_findit_id pg_catalog.text,
  recipient_role pg_catalog.text,
  location pg_catalog.text,
  custody_status pg_catalog.text,
  notes pg_catalog.text,
  created_at pg_catalog.timestamptz
);
```

### 4.2. Campus Office Handover & Recovery (Bug 4 Fix & Security Patch)
```sql
-- Owner initiates collection request
CREATE OR REPLACE FUNCTION public.submit_staff_collection_request(
  p_found_item_id pg_catalog.int8,
  p_proof_description pg_catalog.text,
  p_lost_report_id pg_catalog.int8 DEFAULT NULL
)
RETURNS pg_catalog.uuid;

-- Authorized campus staff (OFFICE_STAFF, HOD, TEACHER) physically releases item
CREATE OR REPLACE FUNCTION public.staff_handover_item_to_owner(
  p_request_id pg_catalog.uuid,
  p_staff_notes pg_catalog.text DEFAULT NULL
)
RETURNS pg_catalog.bool;

-- Owner inspects item and confirms receipt
CREATE OR REPLACE FUNCTION public.confirm_staff_collection_receipt(
  p_request_id pg_catalog.uuid
)
RETURNS pg_catalog.bool;
```

---

## 5. Security Architecture & Threat Mitigations

| Threat Vector | Mitigation Strategy |
| :--- | :--- |
| **Search Path Injection** | All `SECURITY DEFINER` functions explicitly set `SET search_path = ''` and fully qualify built-ins with `pg_catalog.*`. |
| **Direct Table Tampering** | RLS blocks direct client `INSERT` and `UPDATE` on `found_reports`, `lost_reports`, `recovery_requests`, and `custody_history`. All state transitions require audited RPCs. |
| **False Claim Exploitation** | Claimants cannot see `secret_marker` on public feeds. Claims require descriptive independent proof. Rejections enforce a 24-hour claim cooldown. |
| **Unauthorized Staff Handover** | `staff_handover_item_to_owner` verifies caller's `member_type` server-side: only `OFFICE_STAFF`, `HOD`, and `TEACHER` are allowed; `STUDENT` and unauthenticated sessions are strictly rejected. |
| **History Leakage of Private Clues** | `submit_staff_collection_request` stores only a generic note (`'Owner submitted a campus office collection request.'`) in `custody_history`, keeping proof restricted to `recovery_requests.proof_description`. |
| **Directory Scraping** | `member_lookup_rate_limit` tracks lookups by `user_id` in a sliding 1-hour window, throwing an exception if threshold is exceeded. |

---

## 6. Build, Bundle & Deployment Configuration

- **Bundler:** Vite v6.4.6 with React plugin (`@vitejs/plugin-react`).
- **CSS Preprocessor:** Tailwind CSS via PostCSS.
- **Linting:** Oxlint (`.oxlintrc.json`) configured with React, React Hooks, and standard ESLint rules.
- **Bundle Optimization:** Production chunk size optimized with gzip compression (<155 kB JS, <10 kB CSS).
