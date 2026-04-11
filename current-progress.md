# CC Tracker — Current Progress

## ⚠️ SUPER IMPORTANT — WORKFLOW RULE
**NEVER commit or push to git until the user explicitly says to.**
All new features must be built and tested on localhost first.
Only after the user confirms it works locally do we commit and push.

---

## What This App Is
A credit card spending tracker built with React + Vite (frontend) and Express (backend).
Users can add cards, log transactions, record payments, and share cards with other users.

---

## Deployment Setup
| Layer | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://cc-tracker-psi.vercel.app |
| Backend (Express) | Render | https://cctracker.onrender.com |
| Database + Auth | Supabase | (project dashboard) |

**Render config:**
- Root Directory: *(empty)*
- Build Command: `npm install`
- Start Command: `node server/index.js`
- Env vars: `EMAIL_USER`, `EMAIL_PASS`, `CLIENT_ORIGIN=https://cc-tracker-psi.vercel.app`

**Vercel config:**
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL=https://cctracker.onrender.com`

**Supabase config (must be set):**
- Authentication → URL Configuration → Site URL: `https://cc-tracker-psi.vercel.app`
- Redirect URLs: `https://cc-tracker-psi.vercel.app/**`

---

## Tech Stack
- **Frontend:** React 18, Vite, Tailwind CSS, React Router v6, React Query, Zustand, React Hook Form, Zod
- **Backend:** Express, Nodemailer (Gmail), CORS
- **DB/Auth:** Supabase (Postgres + GoTrue)

---

## Features Built

### Auth
- Email/password login, register, forgot password
- Google OAuth (sign in with Google)
- Auth guard on all protected routes

### Dashboard
- Shows all cards owned by the logged-in user
- Add card modal (with bank presets, color pickers, spending limit)
- Edit card modal
- Delete card with inline confirmation UI (no browser alert)
- Share button → opens ShareManagerModal
- **My Borrowers section** — borrower tiles with initials avatar, totals, progress bar, overdue badge

### Card Tile
- Displays bank, nickname, cardholder, last 4 digits, expiry
- Spending bar: outstanding balance vs credit limit (color-coded: green → amber → red)
- Clicking tile navigates to Tracker page

### Tracker Page
- Sticky summary header: Total Charged, Total Paid, Outstanding
- Add Transaction form (date capped at today, amount validated against available credit)
- Transaction table with Pay / Archive actions (inline confirmation, no browser alerts)
- Read-only mode for shared cards

### Payment Modal
- Record partial or full payments
- Payment history log per transaction
- Auto-updates payment status (unpaid → partial → paid)

### Card Sharing
- Owner can share cards with other users by email
- Shared cards visible to recipient under "Shared with me" tab
- Email notification sent via Render backend
- Pending invites badge on Navbar

### Borrowers & Lending (COMPLETE — committed b41a908)
- **BorrowerTile** — initials avatar (deterministic color), totals (loaned/paid/outstanding), progress bar, overdue badge
- **BorrowerForm** — add/edit borrower modal (full_name, address, phone, email)
- **LoanPage** — borrower detail page with summary header, loan table, add loan, record payment
- **LoanTable** — per-loan remaining, overdue status (computed frontend), progress bar per loan
- **LoanForm** — one-time/weekly/monthly frequency, notarization fields (conditional)
- **LoanPaymentModal** — partial/full payment, payment history, auto-advances next_payment_date, marks completed
- **22 Vitest tests** for loan utility functions (loans.js)
- 3 Supabase tables: `borrowers`, `loans`, `loan_payments` (all with RLS)

---

## Borrower Sharing Feature — IN PROGRESS (NOT YET CODED)

### Status: Plan written, SQL not yet run, Tasks 2–7 not yet implemented

### What needs to happen next session
Use keyword: **"continue borrower sharing"** → read this file → pick up from Task 1

### Task Checklist
- [ ] **Task 1 (MANUAL):** Run SQL in Supabase — create `borrower_shares` table + RLS + RPC
- [ ] **Task 2:** Create `src/hooks/useBorrowerShares.js` (8 hooks)
- [ ] **Task 3:** Create `src/components/borrowers/BorrowerShareModal.jsx`
- [ ] **Task 4:** Add `readOnly` prop to `BorrowerTile` + `LoanTable`
- [ ] **Task 5:** Modify `src/pages/LoanPage.jsx` (Share button + read-only mode)
- [ ] **Task 6:** Create `src/pages/SharedBorrowersPage.jsx`
- [ ] **Task 7:** Modify `Navbar.jsx` + `App.jsx` (link, badge, route, RPC call)

### Plan file
`docs/superpowers/plans/2026-04-11-borrower-sharing.md`

### Design spec
`docs/superpowers/specs/2026-04-11-borrower-sharing-design.md`

### SQL to run (Task 1 — full SQL is in the plan file)
```sql
create table borrower_shares (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null,
  owner_email text not null,
  viewer_email text not null,
  viewer_id uuid references auth.users,
  borrower_id uuid references borrowers(id) on delete cascade not null,
  borrower_name text not null,
  borrower_phone text not null,
  borrower_email text not null,
  status text not null default 'unclaimed',
  created_at timestamptz default now()
);
-- + RLS policies + viewer policies on loans/loan_payments + RPC
-- See full SQL in docs/superpowers/plans/2026-04-11-borrower-sharing.md Task 1
```

### Key design decisions
- `borrower_shares` is SEPARATE from `shares` (card sharing table) — no mixing
- Denormalized `borrower_name`, `borrower_phone`, `borrower_email` stored on share row — viewer reads these instead of querying `borrowers` table (avoids RLS complexity)
- Viewer RLS added to `loans` and `loan_payments` tables
- `claim_pending_borrower_shares` RPC called on login (mirrors existing `claim_pending_shares`)
- Viewer mode: read-only — no Pay, no Add Loan, no Share button
- Shared borrowers appear in separate `/shared-borrowers` page (not mixed with card "Shared with me")
- `useSharedBorrowerInfo(borrowerId, { enabled: readOnly })` used in LoanPage to get borrower data for viewer
- Subagent-Driven Development chosen as execution approach

---

## Known Issues / Not Yet Done
- Email sending on production not confirmed working (Render free tier sleeps — first request after sleep can time out)
  - Diagnose: DevTools → Network → trigger share → check `/api/notify` request status
  - Possible cause: Gmail App Password may be wrong format (must be 16-char app password)
- Render free tier spins down after inactivity — first load of backend takes ~30–60 seconds

---

## Git Log (latest first)
```
1c638ed docs: add borrower sharing implementation plan
1a1734c docs: add borrower sharing feature design spec
b41a908 feat: add borrowers & lending tracker feature
20955e0 docs: add current-progress.md with full session summary
7c4815c fix: replace confirm() alerts with inline UI, block future transaction dates
d5da172 fix: default to light mode and validate transaction amount against available credit
90a6e38 feat: add CORS support and dynamic API URL for split Vercel/Render deployment
4c72500 feat: add card sharing, fix auth flow, fix email, fix signup
```
