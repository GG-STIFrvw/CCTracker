# CC Tracker — Project Summary

**Built:** April 10, 2026
**Status:** MVP Complete — Ready for local testing and deployment

---

## What This App Is

A secure, minimal credit card spending tracker. Users manage multiple credit cards, log transactions, record payments (partial or full), and monitor spending against a set limit — without storing any sensitive card data (no card numbers, no CVV, no billing info).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 (dark-first) |
| Routing | React Router DOM 6 |
| Server State | @tanstack/react-query v5 |
| Client State | Zustand 4 |
| Forms + Validation | React Hook Form 7 + Zod 3 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Backend | Express 4 (thin server — email only) |
| Email | Nodemailer + Gmail SMTP |
| Testing | Vitest (18 unit tests on financial math) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## Running Locally

```bash
cd CCTracker
npm run dev
```

- Frontend → http://localhost:5173
- Backend → http://localhost:3001

> Note: Port changed to 3001 to avoid conflict with DTR app on port 3000.

### Environment Variables (.env)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
PORT=3001
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
```

---

## Project Structure

```
CCTracker/
├── index.html
├── package.json
├── vite.config.js          # Vite + proxy to Express on :3001
├── tailwind.config.js      # Dark mode, Inter/JetBrains fonts, fade-in animation
├── postcss.config.js
├── vitest.config.js
├── .env.example
├── server/
│   └── index.js            # Express: /api/notify (email) + /health
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx              # Router + QueryClientProvider + auth guard
    ├── lib/
    │   ├── supabase.js      # Supabase client singleton
    │   ├── zod-schemas.js   # All form validation schemas
    │   └── banks.js         # Bank preset colors (SBC, EastWest, BPI, Custom)
    ├── utils/
    │   ├── money.js         # Cents-based financial math (no float errors)
    │   └── money.test.js    # 18 Vitest unit tests
    ├── store/
    │   └── useAppStore.js   # Zustand: user session + dark mode toggle
    ├── hooks/
    │   ├── useCards.js      # React Query: useCards, useAddCard, useUpdateCard, useDeleteCard
    │   └── useTransactions.js # React Query: useTransactions, useAddTransaction,
    │                          #   useArchiveTransaction, useRecordPayment, usePaymentHistory
    ├── pages/
    │   ├── AuthPage.jsx     # Login / Register / Forgot Password / Google OAuth
    │   ├── DashboardPage.jsx
    │   └── TrackerPage.jsx
    └── components/
        ├── layout/
        │   └── Navbar.jsx
        ├── cards/
        │   ├── CardTile.jsx     # Visual card with gradient + spending bar
        │   ├── SpendingBar.jsx  # Progress bar (green → amber → red thresholds)
        │   └── CardForm.jsx     # Add/Edit card modal
        ├── tracker/
        │   ├── TrackerSummary.jsx   # Sticky header: Total Charged / Paid / Outstanding
        │   ├── TransactionTable.jsx
        │   ├── TransactionForm.jsx
        │   └── PaymentModal.jsx     # Partial/full payments + payment history log
        └── ui/
            ├── Modal.jsx    # Reusable modal (Escape key + backdrop click to close)
            ├── Button.jsx   # Variants: primary, ghost, danger
            ├── Badge.jsx    # Unpaid (red) / Partial (yellow) / Paid (green)
            └── Toast.jsx    # useToast hook + ToastContainer
```

---

## Database Schema (Supabase / PostgreSQL)

### `cards`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → auth.users |
| bank_name | text | |
| nickname | text | |
| cardholder_name | text | Display only |
| expiry_display | text | Display only e.g. "12/26" |
| mock_last4 | text | Non-sensitive display |
| spending_limit | numeric(12,2) | |
| color_primary | text | Hex color |
| color_secondary | text | Hex color |
| created_at | timestamptz | |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| card_id | uuid | FK → cards |
| user_id | uuid | FK → auth.users |
| transaction_date | date | |
| amount | numeric(12,2) | |
| payment_due_date | date | Optional |
| payment_status | text | unpaid / partial / paid |
| amount_paid | numeric(12,2) | Updated on payment |
| notes | text | Optional |
| is_archived | boolean | Archive instead of delete |
| created_at / updated_at | timestamptz | updated_at via trigger |

### `payments`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| transaction_id | uuid | FK → transactions |
| user_id | uuid | FK → auth.users |
| amount | numeric(12,2) | |
| notes | text | Optional |
| paid_at | timestamptz | |

**RLS:** All tables use `auth.uid() = user_id` — users can only access their own data.

---

## Features Built

### Auth
- Email + password login and registration
- Email confirmation flow (Supabase magic link)
- Forgot password / reset via email
- Google OAuth button (requires Supabase provider setup)
- Auth guard — unauthenticated users redirected to `/auth`
- Session persistence via Supabase `onAuthStateChange`

### Credit Card Management
- Add multiple cards with bank name, nickname, cardholder name, expiry, last 4 digits, spending limit
- Bank color presets: SBC, EastWest Bank, BPI, Custom
- Custom primary + secondary color pickers
- Edit existing cards
- Delete cards (with confirmation)
- Visual card tile with gradient background from bank colors

### Spending Bar
- Shows outstanding balance vs spending limit
- Color thresholds: green (< 75%) → amber (≥ 75%) → red (≥ 90%)
- Smooth CSS transition animation

### Transaction Tracker
- Add transactions: date, amount, due date, notes
- Table view per card with all transaction details
- Archive transactions (preserved in DB, excluded from active view)
- Remaining balance calculated client-side: `amount - amount_paid`

### Payments
- Record partial or full payments against any transaction
- "Pay full remaining" shortcut button
- Payment history log per transaction
- Status auto-updates: unpaid → partial → paid
- Uses cents-based integer math to avoid float precision errors

### Tracker Summary (Sticky Header)
- Total Charged (white)
- Total Paid (green)
- Outstanding balance (red)
- Updates in real-time via React Query cache invalidation

### UI / UX
- Dark mode default with toggle (☀️ / 🌙)
- Toast notifications for all user actions
- Modal: Escape key or backdrop click to close
- Fully responsive — 1 col mobile, 2 col tablet, 3 col desktop
- Fade-in animation on toasts

---

## Financial Accuracy

All monetary calculations use integer cents to avoid IEEE 754 float errors:

```js
// Instead of: 0.1 + 0.2 = 0.30000000000000004
toCents(0.1) + toCents(0.2) = 10 + 20 = 30 cents = 0.30 ✓
```

Functions: `toCents`, `fromCents`, `addMoney`, `subtractMoney`, `getRemainingBalance`, `getPaymentStatus`, `formatPeso`

All covered by 18 Vitest unit tests.

---

## Git History

```
266a8ce feat: add Google OAuth sign-in button to auth page
e07d20f feat: add payment modal with history log and partial/full payment support
3294e02 feat: add transaction form with Zod validation
b9b6776 feat: build tracker page with summary header and transaction table
12cc801 feat: build dashboard page with card grid, add/edit modals, toasts
9534317 feat: add CardTile, SpendingBar, CardForm components
297a5bb feat: add React Query hooks for cards and transactions
273014a feat: add navbar with theme toggle and sign out
0b2eb5c feat: add auth page with login, register, forgot password
1e94888 feat: add UI primitives (Modal, Button, Badge, Toast)
f972862 feat: add app shell with React Router, auth guard, QueryClient, Zustand store
6a625c2 feat: add express server with email notification endpoint
6ad5455 feat: add money utils (tested), supabase client, zod schemas, bank presets
4cae689 chore: scaffold Vite + React + Tailwind project
```

---

## What's NOT Built Yet (Phase 2)

| Feature | Notes |
|---|---|
| Google OAuth activation | Button is coded — needs Supabase provider configured + Google Cloud credentials |
| Share codes / collaborators | Spec section 5 — viewer/editor roles, time-limited codes |
| CSV / Excel export | Spec recommended feature |
| Spending threshold email alerts | Backend `/api/notify` ready — logic not wired to triggers |
| Analytics dashboard | Monthly trends, category breakdown |
| Transaction categories | Food, Bills, Shopping, etc. |
| Multi-currency support | Future consideration |
| Production deployment | Vercel (frontend) + Render/Railway (backend) |

---

## Deployment (When Ready)

**Frontend → Vercel**
1. Push repo to GitHub
2. Import project in Vercel
3. Set environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Deploy

**Backend → Render / Railway**
1. Point to the same repo, root directory `server/`
2. Start command: `node index.js`
3. Set environment variables: `PORT`, `EMAIL_USER`, `EMAIL_PASS`
4. Update Vite proxy URL in `vite.config.js` to point to production backend URL

**Supabase**
- Update **Site URL** and **Redirect URLs** in Auth settings to production domain
- Update Google OAuth redirect URI in Google Cloud Console

---

## Notes

- The DTR app (Daily Time Record) is a separate project at `C:\Users\PCWIN10PRO-05\Desktop\DTR2` running on port 3000. CC Tracker uses port 3001 to avoid conflict.
- Supabase anon key is safe to expose in the frontend — all data access is protected by Row Level Security (RLS).
- Transactions are archived, never deleted — preserves full audit history.
