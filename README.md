# FindIt – Campus Item Recovery & Coordination System

FindIt is an enterprise-grade, campus-specific lost and found coordination platform designed for universities and colleges. It replaces unstructured social media posts, scattered physical bulletin boards, and informal messaging channels with a secure, auditable, and role-aware recovery ecosystem.

Built on React, Vite, Tailwind CSS, and Supabase PostgreSQL with strict Row Level Security (RLS) and cryptographic access controls, FindIt guarantees that items are safely tracked from initial discovery through custodian handovers to verified owner recovery.

---

## 🚀 Key Highlights

- **Role-Aware Campus System:** Purpose-built for students, faculty, department heads, and campus administrative/security staff.
- **Zero-Knowledge Proof Claiming:** Finder reports protect sensitive identifying markers (`secret_marker`, serial number hints). Claimants must provide verifiable independent proof.
- **Auditable Custody Chains:** Complete, immutable ledger of all item transfers—whether between student peers or campus office staff.
- **Two-Step Campus Office Recovery:** Structured release flow preventing premature item closure and unauthorized staff handovers.
- **Strict Server-Side Authorization:** Database mutations run exclusively through audited PostgreSQL `SECURITY DEFINER` RPCs with `search_path = ''` isolation.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 / 19 | Reactive UI and modular component architecture |
| **Build Tool** | Vite | Instant Hot Module Replacement and production bundling |
| **Styling** | Tailwind CSS | Modern, responsive campus design system |
| **Database & Auth** | Supabase PostgreSQL | Relational persistence, Auth engine, and RLS policies |
| **Business Logic** | PostgreSQL PL/pgSQL | Transactional RPC functions and immutable audit logging |
| **Code Quality** | Oxlint & ESLint | High-speed linting and static code quality verification |

---

## 👥 Campus User Roles

| Role | Identifiers | Permissions & Capabilities |
| :--- | :--- | :--- |
| **Student** (`STUDENT`) | Course, Year, Section | Report lost/found items, claim items with proof, transfer custody to peers, collect from office. |
| **Faculty / Teacher** (`TEACHER`) | Department / Staff ID | Report items, receive custody, verify and release items deposited at faculty offices. |
| **Department Head** (`HOD`) | Department Head | Authorize campus recoveries, verify high-value items, view departmental custody trails. |
| **Campus Office Staff** (`OFFICE_STAFF`) | Campus Security / Admin Office | Manage physical item intake, verify claimant identity, execute server-authorized physical releases. |

---

## 🔄 Core Workflows

### 1. Item Reporting
- **Lost Item:** Campus member logs lost item with date, location, description, and optional secret detail.
- **Found Item:** Finder reports found item with location and chooses whether they hold custody or deposited it with campus staff (security gate, departmental office, lost & found desk).

### 2. Peer-to-Peer Claim & Verification
- Rightful owner spots item on the public campus feed.
- Owner submits a recovery claim with independent proof (e.g., color of internal clasp, serial number suffix).
- Current student custodian reviews proof in their Dashboard and approves or rejects with feedback.
- Claimant confirms physical handover, marking the item `RESOLVED`.

### 3. Campus Office Collection Workflow
- For items in campus staff custody, claimants submit an office collection request.
- The item remains `OPEN` on the public feed to avoid premature disappearance.
- Claimants visit the physical office; authorized staff (`OFFICE_STAFF`, `HOD`, `TEACHER`) verify identity and execute `staff_handover_item_to_owner` (`RELEASED_TO_OWNER`).
- Claimant inspects the item and confirms receipt (`confirm_staff_collection_receipt`), safely resolving both found and lost records simultaneously.

---

## 📁 Repository Structure

```text
frontend/
├── dist/                    # Production bundle output (git-ignored)
├── public/                  # Static assets, favicon, SVGs
├── src/
│   ├── assets/              # Branding and imagery
│   ├── components/          # Reusable UI components
│   │   ├── AuthModal.jsx        # Login, registration with academic info
│   │   ├── CampusFeed.jsx       # Public feed with search, filters & cards
│   │   ├── ClaimModal.jsx       # Peer claim & office collection modal
│   │   ├── Dashboard.jsx        # Custody hub, claims manager, timeline modal
│   │   ├── FoundReportModal.jsx # Found report form with custody selection
│   │   ├── Hero.jsx             # Landing hero and statistics banner
│   │   ├── LostReportModal.jsx  # Lost report form with proof hints
│   │   └── Navbar.jsx           # Top navigation, notifications & user badge
│   ├── context/
│   │   └── AuthContext.jsx      # Authentication session & academic profile
│   ├── services/
│   │   ├── custodyService.js    # Transfers, timeline history, staff handover
│   │   ├── recoveryService.js   # Peer claims and office collection requests
│   │   └── reportService.js     # Public feed and personal report queries
│   ├── App.jsx              # Main view controller and modal manager
│   ├── main.jsx             # React entry point
│   └── supabase.js          # Supabase client singleton
├── Screenshots/             # UI walkthroughs and visual references
├── ARCHITECTURE.md          # System architecture and sequence diagrams
├── DATABASE.md              # Database schema, RLS policies, and RPC definitions
├── FEATURES.md              # Complete feature checklist and status matrix
├── PRD.md                   # Product Requirements Document
├── TESTING.md               # Test suites, static checks, and validation report
├── TRD.md                   # Technical Requirements Document
├── package.json             # NPM dependencies and scripts
└── vite.config.js           # Vite build configuration
```

---

## 💻 Local Setup & Development

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher
- **Supabase Account**: An active Supabase project with PostgreSQL 15+

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mishrachirag460-coder/FindIt.git
   cd FindIt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (never commit this file):
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

4. **Apply Database Migrations:**
   Execute the migration SQL scripts located in the project's `database/` directory in sequential order:
   - `database/incremental_findit_migration.sql`
   - `database/incremental_fix_bugs_1_3_4.sql`

5. **Run the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

6. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🔒 Security Architecture Highlights

- **Row Level Security (RLS):** All base tables have zero public writes. Client sessions cannot insert or update records directly.
- **Atomic RPC Mutations:** State transitions occur inside single-transaction stored procedures enforcing ownership and role checks.
- **Search Path Isolation:** Every function specifies `SET search_path = ''` to prevent search path injection attacks.
- **Confidentiality by Design:** Public catalog views filter out `secret_marker` and `proof_description` using PostgreSQL `security_barrier = true`.

---

## 📖 Extended Documentation

- [Product Requirements Document (PRD)](./PRD.md)
- [Technical Requirements Document (TRD)](./TRD.md)
- [Features Checklist & Implementation Status](./FEATURES.md)
- [Database Schema & RPC Reference](./DATABASE.md)
- [System Architecture & Sequence Flows](./ARCHITECTURE.md)
- [Testing & Quality Assurance Guide](./TESTING.md)

---

## 📄 License
This project is developed for campus item recovery and coordination. All rights reserved.
