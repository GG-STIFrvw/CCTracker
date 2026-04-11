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
- OAuth redirect fixed (was looping back to localhost — fixed by setting Supabase Site URL to Vercel URL)

### Dashboard
- Shows all cards owned by the logged-in user
- Add card modal (with bank presets, color pickers, spending limit)
- Edit card modal
- Delete card with inline confirmation UI (no browser alert)
- Share button → opens ShareManagerModal

### Card Tile
- Displays bank, nickname, cardholder, last 4 digits, expiry
- Spending bar: outstanding balance vs credit limit (color-coded: green → amber → red)
- Clicking tile navigates to Tracker page

### Tracker Page
- Sticky summary header: Total Charged, Total Paid, Outstanding
- Add Transaction form with fields: Date, Amount (PHP), Payment Due Date, Notes
  - Date capped at today — future dates blocked (both `max` attr and Zod validation)
  - Amount validated against available credit (spending_limit minus outstanding) — shows error if exceeded
- Transaction table with columns: Date, Amount, Due Date, Paid, Remaining, Status, Notes, Actions
  - **Pay** button → opens Payment Modal
  - **Archive** button → inline "Archive? Yes / No" confirmation (no browser alert)
- Read-only mode for shared cards (no Add Transaction or Pay/Archive actions)

### Payment Modal
- Record partial or full payments
- Payment history log per transaction
- Auto-updates payment status (unpaid → partial → paid)

### Card Sharing
- Owner can share cards with other users by email
- Shared cards visible to recipient under "Shared with me" tab
- Email notification sent via Render backend when a share is created
- Pending invites badge on Navbar

### Email Notifications
- Express server at `server/index.js` handles `POST /api/notify`
- Uses Nodemailer with Gmail App Password
- Frontend calls `${VITE_API_URL}/api/notify` (dynamic, not hardcoded)
- Email is non-blocking — share still works if email fails

---

## Fixes Applied This Session

| Fix | File(s) |
|---|---|
| Render: wrong start command (`node index.js` → `node server/index.js`) | Render dashboard |
| Added CORS to Express server | `server/index.js` |
| Frontend API calls now use `VITE_API_URL` env var instead of relative `/api/notify` | `src/hooks/useShares.js` |
| Default theme changed to **light mode** (was dark by default for new users) | `src/store/useAppStore.js` |
| Transaction amount validated against available credit limit | `src/components/tracker/TransactionForm.jsx` |
| Future transaction dates blocked (max = today) | `src/components/tracker/TransactionForm.jsx` |
| Archive confirmation replaced with inline Yes/No (no browser alert) | `src/components/tracker/TransactionTable.jsx` |
| Delete card confirmation replaced with inline banner (no browser alert) | `src/components/cards/CardForm.jsx` |

---

## Borrowers Feature — In Progress (NOT YET CODED)

### Status: Brainstorming complete, design approved, spec not yet written, implementation not started

### Decisions Made
- **Scope:** Owner-side only (no borrower login/sharing for now)
- **Interest:** Raw loan amount only, no interest calculation yet
- **Notarization fields:** IN SCOPE (Lawyer Name, PTR Number, Date Notarized)
- **Payment frequency:** Per-loan setting — one-time / weekly / monthly
  - Monthly includes a payment day field (15 or 30)
  - Next payment date auto-updates after each payment recorded
- **Architecture:** Option A — mirrors CC Tracker structure (BorrowerTile on dashboard, click → LoanPage)

### Approved Data Model
Three new Supabase tables: `borrowers`, `loans`, `loan_payments`

**borrowers:** id, user_id, full_name, address, phone, email, is_archived, created_at

**loans:** id, borrower_id, user_id, amount, loan_date, description, payment_frequency, payment_day (nullable, 15 or 30 for monthly), next_payment_date, status (active/completed/overdue/defaulted), notarized, lawyer_name, ptr_number, date_notarized, is_archived, created_at

**loan_payments:** id, loan_id, user_id, amount, notes, paid_at

Overdue status computed on frontend: next_payment_date < today AND remaining balance > 0

### UI Decisions
- **Borrower avatar:** Show initials only (e.g. John Smith → "JS"), no image/avatar. Styled as a colored circle with white initials.

### Next Steps (next session)
1. Write design spec to `docs/superpowers/specs/`
2. Write implementation plan (writing-plans skill)
3. Create Supabase tables (SQL migration)
4. Build: hooks → BorrowerTile → BorrowerForm → LoanPage → LoanForm → PaymentLedger
5. Wire into DashboardPage under cards
6. Test on localhost
7. Commit only after user confirms everything works

### Supabase Note
No URL config changes needed for localhost testing of borrowers feature.
If Google OAuth is needed on localhost: add `http://localhost:5173` to Supabase redirect URLs list (do NOT change Site URL).

---

## Known Issues / Not Yet Done
- Email sending on production not confirmed working (Render free tier sleeps after 15 min inactivity — first request after sleep can time out)
  - Diagnose: open DevTools → Network → trigger a share → check `/api/notify` request status and URL
  - Possible cause: Gmail App Password may be wrong format (must be 16-char app password, not regular password)
- Render free tier spins down after inactivity — first load of backend can take ~30–60 seconds

---

## Git Log (latest first)
```
7c4815c fix: replace confirm() alerts with inline UI, block future transaction dates
d5da172 fix: default to light mode and validate transaction amount against available credit
90a6e38 feat: add CORS support and dynamic API URL for split Vercel/Render deployment
4c72500 feat: add card sharing, fix auth flow, fix email, fix signup
266a8ce feat: add Google OAuth sign-in button to auth page
e07d20f feat: add payment modal with history log and partial/full payment support
3294e02 feat: add transaction form with Zod validation
b9b6776 feat: build tracker page with summary header and transaction table
12cc801 feat: build dashboard page with card grid, add/edit modals, toasts
```
