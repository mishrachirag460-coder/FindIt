# Database Architecture, Schema & RPC Reference

## Project: FindIt – Campus Item Recovery & Coordination System
**Database Engine:** Supabase PostgreSQL 15+  
**Security Model:** Row Level Security (RLS) + SECURITY DEFINER Stored Procedures

---

## 1. Schema Overview & Entity Relationships

The FindIt relational schema manages users, lost items, found items, recovery claims, peer custody transfers, and an immutable custody audit ledger.

```text
+-----------------------+           +-----------------------+
|    auth.users         |           |    public.profiles    |
|-----------------------| 1       1 |-----------------------|
| id (UUID)             |<--------->| id (UUID, PK)         |
+-----------------------+           | findit_id (TEXT, UNQ) |
                                    | full_name (TEXT)      |
                                    | email (TEXT)          |
                                    | member_type (ENUM)    |
                                    | course (TEXT)         |
                                    | academic_year (TEXT)  |
                                    | section (TEXT)        |
                                    +-----------------------+
                                                |
          +-------------------------------------+-------------------------------------+
          | 1                                   | 1                                   | 1
          v *                                   v *                                   v *
+-----------------------+           +-----------------------+           +-----------------------+
|  public.lost_reports  |           | public.found_reports  |           | public.recovery_reqs  |
|-----------------------|           |-----------------------|           |-----------------------|
| id (BIGINT, PK)       |           | id (BIGINT, PK)       | 1       * | id (UUID, PK)         |
| reporter_id (UUID, FK)|           | finder_id (UUID, FK)  |<--------->| found_item_id (BIGINT)|
| item_name (TEXT)      |           | current_custodian_id  |           | claimant_id (UUID)    |
| category (TEXT)       |           | is_unregistered_cust  |           | lost_report_id (BIGINT|
| description (TEXT)    |           | unregistered_name     |           | proof_description     |
| lost_location (TEXT)  |           | unregistered_role     |           | status (ENUM)         |
| lost_date (DATE)      |           | unregistered_location |           +-----------------------+
| status (TEXT)         |           | secret_marker (TEXT)  |                       | 1
| secret_marker (TEXT)  |           | status (TEXT)         |                       |
+-----------------------+           +-----------------------+                       |
                                                | 1                                 |
                                                v *                                 v *
                                    +-----------------------+           +-----------------------+
                                    | public.custody_transf |           | public.custody_history|
                                    |-----------------------|           |-----------------------|
                                    | id (UUID, PK)         |           | id (UUID, PK)         |
                                    | found_item_id (BIGINT)|           | found_item_id (BIGINT)|
                                    | sender_id (UUID, FK)  |           | actor_id (UUID, FK)   |
                                    | recipient_id (UUID,FK)|           | recipient_type (TEXT) |
                                    | status (TEXT)         |           | recipient_user_id     |
                                    +-----------------------+           | unregistered_name     |
                                                                        | unregistered_role     |
                                                                        | unregistered_location |
                                                                        | notes (TEXT)          |
                                                                        | created_at (TSTZ)     |
                                                                        +-----------------------+
```

---

## 2. Enums and Custom Types

### 2.1. `public.member_role`
Campus membership tier used for role-based authorization:
```sql
CREATE TYPE public.member_role AS ENUM (
  'STUDENT',
  'TEACHER',
  'HOD',
  'OFFICE_STAFF'
);
```

---

## 3. Tables Detail

### 3.1. `public.profiles`
Campus user profiles extending Supabase `auth.users`.
- `id` (`uuid`, PRIMARY KEY, REFERENCES `auth.users(id)` ON DELETE CASCADE)
- `findit_id` (`text`, UNIQUE NOT NULL) — Human-readable identifier (e.g., `FINDIT-AB123`).
- `full_name` (`text`, NOT NULL)
- `email` (`text`, NOT NULL)
- `member_type` (`public.member_role`, NOT NULL DEFAULT `'STUDENT'`)
- `course` (`text`, NULLABLE) — Academic course (`MCA`, `BCA`, `BBA`, `MBA`, or custom).
- `academic_year` (`text`, NULLABLE) — Academic year (`1st`, `2nd`, `3rd`).
- `section` (`text`, NULLABLE) — Academic section.
- `created_at` (`timestamptz`, NOT NULL DEFAULT `now()`)
- `updated_at` (`timestamptz`, NOT NULL DEFAULT `now()`)

### 3.2. `public.found_reports`
Found item reports submitted by finders.
- `id` (`int8`, PRIMARY KEY GENERATED ALWAYS AS IDENTITY)
- `finder_id` (`uuid`, NOT NULL REFERENCES `public.profiles(id)`)
- `current_custodian_id` (`uuid`, NULLABLE REFERENCES `public.profiles(id)`)
- `item_name` (`text`, NOT NULL)
- `category` (`text`, NOT NULL)
- `description` (`text`, NOT NULL)
- `found_location` (`text`, NOT NULL)
- `found_date` (`date`, NOT NULL)
- `status` (`text`, NOT NULL DEFAULT `'OPEN'`) — Values: `OPEN`, `RESOLVED`, `CLOSED`.
- `is_unregistered_custodian` (`bool`, NOT NULL DEFAULT `false`)
- `unregistered_custodian_name` (`text`, NULLABLE)
- `unregistered_custodian_role` (`text`, NULLABLE)
- `unregistered_custodian_location` (`text`, NULLABLE)
- `secret_marker` (`text`, NULLABLE) — Confidential proof detail (never exposed in public feed).
- `created_at` (`timestamptz`, NOT NULL DEFAULT `now()`)
- `updated_at` (`timestamptz`, NOT NULL DEFAULT `now()`)
- `resolved_at` (`timestamptz`, NULLABLE)

### 3.3. `public.lost_reports`
Lost item declarations submitted by owners.
- `id` (`int8`, PRIMARY KEY GENERATED ALWAYS AS IDENTITY)
- `reporter_id` (`uuid`, NOT NULL REFERENCES `public.profiles(id)`)
- `item_name` (`text`, NOT NULL)
- `category` (`text`, NOT NULL)
- `description` (`text`, NOT NULL)
- `lost_location` (`text`, NOT NULL)
- `lost_date` (`date`, NOT NULL)
- `status` (`text`, NOT NULL DEFAULT `'OPEN'`) — Values: `OPEN`, `RECOVERED`, `CLOSED`.
- `secret_marker` (`text`, NULLABLE)
- `created_at` (`timestamptz`, NOT NULL DEFAULT `now()`)
- `updated_at` (`timestamptz`, NOT NULL DEFAULT `now()`)
- `recovered_at` (`timestamptz`, NULLABLE)

### 3.4. `public.recovery_requests`
Recovery claims submitted by owners.
- `id` (`uuid`, PRIMARY KEY DEFAULT `gen_random_uuid()`)
- `found_item_id` (`int8`, NOT NULL REFERENCES `public.found_reports(id)`)
- `claimant_id` (`uuid`, NOT NULL REFERENCES `public.profiles(id)`)
- `lost_report_id` (`int8`, NULLABLE REFERENCES `public.lost_reports(id)`)
- `proof_description` (`text`, NOT NULL) — Confidential claim proof.
- `status` (`text`, NOT NULL DEFAULT `'PENDING'`) — Values: `PENDING`, `ACCEPTED`, `REJECTED`, `RELEASED_TO_OWNER`, `CONFIRMED_RECOVERED`.
- `custodian_response_note` (`text`, NULLABLE)
- `created_at` (`timestamptz`, NOT NULL DEFAULT `now()`)
- `updated_at` (`timestamptz`, NOT NULL DEFAULT `now()`)

### 3.5. `public.custody_history`
Append-only immutable audit trail of item movements.
- `id` (`uuid`, PRIMARY KEY DEFAULT `gen_random_uuid()`)
- `found_item_id` (`int8`, NOT NULL REFERENCES `public.found_reports(id)`)
- `actor_id` (`uuid`, NOT NULL REFERENCES `public.profiles(id)`)
- `recipient_type` (`text`, NOT NULL) — `REGISTERED` or `UNREGISTERED`.
- `recipient_user_id` (`uuid`, NULLABLE REFERENCES `public.profiles(id)`)
- `unregistered_recipient_name` (`text`, NULLABLE)
- `unregistered_recipient_role` (`text`, NULLABLE)
- `unregistered_location` (`text`, NULLABLE)
- `notes` (`text`, NULLABLE) — Generic audit descriptions only; never claimant proof.
- `created_at` (`timestamptz`, NOT NULL DEFAULT `now()`)

---

## 4. Public Catalog Views

### 4.1. `public.found_items_public_catalog`
```sql
CREATE OR REPLACE VIEW public.found_items_public_catalog
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  id,
  item_name,
  category,
  description,
  found_location,
  found_date,
  status,
  is_unregistered_custodian,
  created_at,
  unregistered_custodian_name,
  unregistered_custodian_role,
  unregistered_custodian_location,
  finder_id
FROM public.found_reports
WHERE status = 'OPEN';
```
- **Security:** `security_barrier = true` ensures that PostgreSQL optimizer does not push user-defined functions ahead of the view filter.
- **Privacy:** `secret_marker` is omitted from the SELECT clause.
- **Grants:** `GRANT SELECT ... TO anon, authenticated;`

---

## 5. Stored Procedures (RPCs) Reference

All RPCs are defined with `LANGUAGE plpgsql SECURITY DEFINER` and `SET search_path = ''`.

| RPC Name | Parameters | Return Type | Role / Security Gate | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `create_lost_report` | `(item_name, category, description, lost_location, lost_date, secret_marker)` | `int8` | Authenticated | Inserts lost report for `auth.uid()`. |
| `create_found_report` | `(item_name, category, description, found_location, found_date, is_unreg, unreg_name, unreg_role, unreg_loc, secret_marker)` | `int8` | Authenticated | Inserts found report & logs first custody step. |
| `close_my_lost_report` | `(report_id)` | `bool` | Authenticated (Owner only) | Closes own open lost report. |
| `check_user_is_item_party` | `(user_id, found_item_id)` | `bool` | Authenticated | Authorizes view of custody chain (finder, custodian, recipient, or prior party). |
| `get_item_custody_history` | `(found_item_id)` | `TABLE (...)` | Authenticated (Party only) | Returns full ordered custody history chain. |
| `submit_staff_collection_request` | `(found_item_id, proof_desc, lost_report_id)` | `uuid` | Authenticated (Non-finder) | Submits office collection request for staff-held item. |
| `staff_handover_item_to_owner` | `(request_id, staff_notes)` | `bool` | `OFFICE_STAFF`, `HOD`, `TEACHER` only | Physical release of item to owner at campus office. |
| `confirm_staff_collection_receipt` | `(request_id)` | `bool` | Authenticated (Claimant only) | Finalizes recovery, marks report `RESOLVED`. |
| `expire_stale_staff_reports` | `(days_threshold)` | `int4` | Superuser / Admin only | Administrative procedure to close abandoned staff items. |

---

## 6. Migration Execution Guide

To deploy the FindIt database schema cleanly from scratch:

1. **Step 1:** Run `database/incremental_findit_migration.sql` in the Supabase SQL Editor.
   - Creates enums, base tables, views, RLS policies, triggers, and baseline RPCs.
2. **Step 2:** Run `database/incremental_fix_bugs_1_3_4.sql` in the Supabase SQL Editor.
   - Extends views with safe staff fields (`unregistered_custodian_name`, etc.).
   - Replaces `get_item_custody_history` with full-chain authorization.
   - Deploys staff office collection RPCs with server-side role gating.
   - Revokes public client access from `expire_stale_staff_reports`.
