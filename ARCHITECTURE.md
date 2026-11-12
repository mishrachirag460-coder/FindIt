# System Architecture & Technical Design

## Project: FindIt – Campus Item Recovery & Coordination System

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Presentation Layer (Client)"]
        UI["React 18 / 19 SPA (Vite + Tailwind CSS)"]
        AC["AuthContext (Session & Academic Profile)"]
        Services["Service Layer (reportService, custodyService, recoveryService)"]
        UI --> AC
        UI --> Services
    end

    subgraph BaaS["Transport & API Gateway"]
        SupaClient["@supabase/supabase-js Client"]
        Gateway["Supabase PostgREST Gateway"]
        Services --> SupaClient
        AC --> SupaClient
        SupaClient -->|HTTPS / JSON-RPC| Gateway
    end

    subgraph Database["Database & Security Layer (PostgreSQL 15+)"]
        AuthModule["Supabase Auth Engine"]
        RLS["Row Level Security (RLS) Engine"]
        Views["Public Views (security_barrier = true)"]
        RPCs["SECURITY DEFINER Stored Procedures"]
        Tables[("PostgreSQL Tables\n(profiles, reports, claims, custody_history)")]

        Gateway --> AuthModule
        Gateway --> RLS
        RLS --> Views
        RLS --> RPCs
        Views --> Tables
        RPCs --> Tables
    end
```

---

## 2. Component Hierarchy & Flow

```mermaid
graph TD
    App["App.jsx (Root View Controller)"]
    Navbar["Navbar.jsx"]
    Hero["Hero.jsx"]
    CampusFeed["CampusFeed.jsx"]
    Dashboard["Dashboard.jsx"]
    AuthModal["AuthModal.jsx"]
    LostReportModal["LostReportModal.jsx"]
    FoundReportModal["FoundReportModal.jsx"]
    ClaimModal["ClaimModal.jsx"]

    App --> Navbar
    App --> Hero
    App --> CampusFeed
    App --> Dashboard
    App --> AuthModal
    App --> LostReportModal
    App --> FoundReportModal
    App --> ClaimModal

    CampusFeed -.->|Open Claim Modal| ClaimModal
    CampusFeed -.->|Open Auth Modal| AuthModal
    Dashboard -.->|Open Custody Timeline| Dashboard
```

---

## 3. Sequence Flows

### 3.1. Staff-Held Item Recovery Sequence (Bug 4 Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Claimant as Student Owner (Claimant)
    participant UI as React UI (CampusFeed & ClaimModal)
    participant API as Supabase RPC Gateway
    actor Staff as Campus Staff (OFFICE_STAFF)
    participant DB as PostgreSQL Database

    Claimant->>UI: Spot staff-held item on Campus Feed
    UI->>Claimant: Display "Handed to Campus Staff" badge & office location
    Claimant->>UI: Click "Collect from Campus Office"
    UI->>API: submit_staff_collection_request(item_id, proof_desc, lost_report_id)
    API->>DB: INSERT recovery_requests (status = 'PENDING')
    API->>DB: INSERT custody_history (generic note, no proof leak)
    DB-->>UI: Return request_id
    Note over Claimant, Staff: Claimant visits physical office with campus ID

    Staff->>UI: Inspect claimant proof & verify physical item
    Staff->>API: staff_handover_item_to_owner(request_id, staff_notes)
    Note over API, DB: Checks profiles.member_type IN ('OFFICE_STAFF', 'HOD', 'TEACHER')
    API->>DB: UPDATE recovery_requests (status = 'RELEASED_TO_OWNER')
    API->>DB: UPDATE found_reports (current_custodian_id = claimant_id)
    API->>DB: INSERT custody_history (Staff physical handover event)

    Claimant->>UI: Inspect physical item & click "Confirm Receipt"
    UI->>API: confirm_staff_collection_receipt(request_id)
    API->>DB: UPDATE recovery_requests (status = 'CONFIRMED_RECOVERED')
    API->>DB: UPDATE found_reports (status = 'RESOLVED', resolved_at = now())
    API->>DB: UPDATE lost_reports (status = 'RECOVERED', recovered_at = now())
    API->>DB: INSERT custody_history (Owner confirmed recovery event)
    DB-->>UI: Recovery Finalized
    UI->>Claimant: Display "Recovered ✓" badge
```

---

## 4. Custody Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> REPORTED_BY_FINDER: Found Report Created

    state REPORTED_BY_FINDER {
        [*] --> FINDER_CUSTODY: Held by Finder
        [*] --> STAFF_CUSTODY: Deposited with Staff
    }

    state FINDER_CUSTODY {
        TRANSFER_PENDING --> TRANSFERRED_TO_PEER: Recipient Accepts
        TRANSFER_PENDING --> FINDER_CUSTODY: Recipient Rejects
        FINDER_CUSTODY --> TRANSFER_PENDING: Custodian Initiates Transfer
        FINDER_CUSTODY --> STAFF_CUSTODY: Deposited with Staff Checkpoint
        FINDER_CUSTODY --> PEER_CLAIM_PENDING: Owner Submits Claim
        PEER_CLAIM_PENDING --> PEER_CLAIM_ACCEPTED: Custodian Accepts Proof
        PEER_CLAIM_PENDING --> FINDER_CUSTODY: Custodian Rejects Proof
        PEER_CLAIM_ACCEPTED --> RESOLVED: Custodian Confirms Recovery
    }

    state STAFF_CUSTODY {
        STAFF_COLLECTION_PENDING --> RELEASED_TO_OWNER: Staff Handover (Authorized Role)
        STAFF_CUSTODY --> STAFF_COLLECTION_PENDING: Owner Requests Collection
        RELEASED_TO_OWNER --> RESOLVED: Owner Confirms Physical Receipt
    }

    RESOLVED --> [*]: Recovery Complete (Leaves Active Feed)
```

---

## 5. Security & Isolation Boundaries

1. **Client Isolation:**
   - The browser client is strictly untrusted. No database direct table permissions (`INSERT`/`UPDATE`) are granted to `authenticated` or `anon`.
   - All mutations are handled by server-side PostgreSQL functions running with elevated `SECURITY DEFINER` privileges.
2. **Search Path Isolation:**
   - Every `SECURITY DEFINER` RPC enforces `SET search_path = ''`.
   - Standard system types and functions use explicit `pg_catalog.` qualification, neutralizing schema override attacks.
3. **Role Gating:**
   - `staff_handover_item_to_owner` queries `public.profiles.member_type` for the calling user's ID (`auth.uid()`).
   - Only `OFFICE_STAFF`, `HOD`, and `TEACHER` roles can record physical releases. Calls from `STUDENT` or unauthenticated sessions are aborted before any row lock or state mutation.
4. **Audit Immutability:**
   - `public.custody_history` lacks `UPDATE` and `DELETE` policies, guaranteeing that every transfer event remains permanently recorded.
