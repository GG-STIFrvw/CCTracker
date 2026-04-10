# CC Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, minimal credit card spending tracker where users manage multiple cards, log transactions, record payments, and monitor spending against limits — all without storing sensitive card data.

**Architecture:** SPA (React + Vite) with React Router for navigation, Supabase handling PostgreSQL + Auth (anon key safe to expose via VITE_ env vars due to RLS), a thin Express server only for email notifications, React Query for all server state, Zustand for lightweight client state (session, UI toggles).

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, React Router DOM 6, @tanstack/react-query v5, Zustand 4, React Hook Form 7, Zod 3, @supabase/supabase-js v2, Express 4, Nodemailer, Vitest, concurrently

---

## File Map

```
CCTracker/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vitest.config.js
├── .env.example
├── .gitignore
├── server/
│   └── index.js                   # Express: /api/notify + /health
├── src/
│   ├── main.jsx                   # ReactDOM.createRoot entry
│   ├── index.css                  # Tailwind directives + CSS vars
│   ├── App.jsx                    # QueryClientProvider + Router + auth guard
│   ├── lib/
│   │   ├── supabase.js            # Supabase client singleton
│   │   ├── zod-schemas.js         # All Zod schemas
│   │   └── banks.js               # Bank preset colors
│   ├── utils/
│   │   ├── money.js               # Cents-based financial math + formatting
│   │   └── money.test.js          # Vitest unit tests
│   ├── store/
│   │   └── useAppStore.js         # Zustand: session user + dark mode
│   ├── hooks/
│   │   ├── useCards.js            # React Query: cards CRUD
│   │   └── useTransactions.js     # React Query: transactions + payments
│   ├── pages/
│   │   ├── AuthPage.jsx           # Login / Register / Forgot Password
│   │   ├── DashboardPage.jsx      # Card grid + add card CTA
│   │   └── TrackerPage.jsx        # Single card tracker view
│   └── components/
│       ├── layout/
│       │   └── Navbar.jsx         # Logo, theme toggle, sign out
│       ├── cards/
│       │   ├── CardTile.jsx       # Visual card component with bank theme
│       │   ├── SpendingBar.jsx    # Progress bar with threshold colors
│       │   └── CardForm.jsx       # Add/Edit card modal form
│       ├── tracker/
│       │   ├── TrackerSummary.jsx # Sticky header: totals
│       │   ├── TransactionTable.jsx
│       │   ├── TransactionForm.jsx
│       │   └── PaymentModal.jsx
│       └── ui/
│           ├── Modal.jsx
│           ├── Button.jsx
│           ├── Toast.jsx
│           └── Badge.jsx
```

---

## Supabase Database Schema

> Run this entire block in Supabase Dashboard → SQL Editor before Task 3.

```sql
-- CARDS: no sensitive data stored
create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  bank_name text not null,
  nickname text not null,
  cardholder_name text not null,
  expiry_display text not null,        -- display only, e.g. "12/26"
  mock_last4 text not null default '0000',
  spending_limit numeric(12,2) not null default 0,
  color_primary text not null default '#1a3a52',
  color_secondary text not null default '#2d6a8f',
  created_at timestamptz not null default now()
);

-- TRANSACTIONS
create table transactions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  transaction_date date not null,
  amount numeric(12,2) not null,
  payment_due_date date,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),
  amount_paid numeric(12,2) not null default 0,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PAYMENTS: history log per transaction
create table payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(12,2) not null,
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Auto-update updated_at on transactions
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_updated_at
  before update on transactions
  for each row execute function update_updated_at();

-- ROW LEVEL SECURITY
alter table cards enable row level security;
alter table transactions enable row level security;
alter table payments enable row level security;

create policy "Users own cards" on cards
  for all using (auth.uid() = user_id);

create policy "Users own transactions" on transactions
  for all using (auth.uid() = user_id);

create policy "Users own payments" on payments
  for all using (auth.uid() = user_id);
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `CCTracker/package.json`
- Create: `CCTracker/vite.config.js`
- Create: `CCTracker/tailwind.config.js`
- Create: `CCTracker/postcss.config.js`
- Create: `CCTracker/vitest.config.js`
- Create: `CCTracker/index.html`
- Create: `CCTracker/.env.example`
- Create: `CCTracker/.gitignore`
- Create: `CCTracker/src/index.css`
- Create: `CCTracker/src/main.jsx`
- Create: `CCTracker/src/App.jsx`

- [ ] **Step 1: Init git and create src directory**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git init
mkdir -p src/lib src/utils src/store src/hooks src/pages src/components/layout src/components/cards src/components/tracker src/components/ui server docs/superpowers/plans
```

- [ ] **Step 2: Create package.json**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/package.json << 'EOF'
{
  "name": "cc-tracker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "vite",
    "dev:server": "node --watch server/index.js",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "@tanstack/react-query": "^5.17.0",
    "express": "^4.18.0",
    "nodemailer": "^6.9.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.49.0",
    "react-router-dom": "^6.21.0",
    "zustand": "^4.4.0",
    "zod": "^3.22.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@hookform/resolvers": "^3.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^8.2.0",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.2.0"
  }
}
EOF
```

- [ ] **Step 3: Install dependencies**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm install
```

Expected: package-lock.json created, node_modules populated, no errors.

- [ ] **Step 4: Create vite.config.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
EOF
```

- [ ] **Step 5: Create tailwind.config.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
EOF
```

- [ ] **Step 6: Create postcss.config.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
```

- [ ] **Step 7: Create vitest.config.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/vitest.config.js << 'EOF'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
EOF
```

- [ ] **Step 8: Create index.html**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CC Tracker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
EOF
```

- [ ] **Step 9: Create src/index.css**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply font-sans;
  }
}
EOF
```

- [ ] **Step 10: Create placeholder src/main.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
EOF
```

- [ ] **Step 11: Create placeholder src/App.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/App.jsx << 'EOF'
export default function App() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold text-white">CC Tracker</h1>
    </div>
  )
}
EOF
```

- [ ] **Step 12: Create .env.example**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/.env.example << 'EOF'
# Supabase (get from Supabase dashboard → Settings → API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Express server port
PORT=3000

# Email (Gmail App Password)
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
EOF
```

- [ ] **Step 13: Create .gitignore**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/.gitignore << 'EOF'
node_modules/
dist/
.env
.env.local
*.local
EOF
```

- [ ] **Step 14: Copy .env.example to .env and fill in your Supabase credentials**

```bash
cp /c/Users/PCWIN10PRO-05/Desktop/CCTracker/.env.example /c/Users/PCWIN10PRO-05/Desktop/CCTracker/.env
```

Then edit `.env` with your actual Supabase URL and anon key (from Supabase dashboard → Settings → API).

- [ ] **Step 15: Run Vite to verify scaffold works**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm run dev:client
```

Expected: Vite starts on `http://localhost:5173`, browser shows "CC Tracker" heading on dark background. Stop with Ctrl+C.

- [ ] **Step 16: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "chore: scaffold Vite + React + Tailwind project"
```

---

## Task 2: Supabase Schema

**Action:** Run the SQL schema block from the top of this document in Supabase.

- [ ] **Step 1: Open Supabase SQL Editor**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Paste and run the full schema SQL**

Paste the entire SQL block from the "Supabase Database Schema" section above. Click Run.

Expected: No errors. All 3 tables created.

- [ ] **Step 3: Verify tables exist**

In Supabase → Table Editor, confirm `cards`, `transactions`, and `payments` tables are visible.

- [ ] **Step 4: Verify RLS is enabled**

In Supabase → Authentication → Policies, confirm each table shows active policies for `auth.uid() = user_id`.

> No code commit for this task — it's infrastructure.

---

## Task 3: Core Utilities

**Files:**
- Create: `src/utils/money.test.js`
- Create: `src/utils/money.js`
- Create: `src/lib/supabase.js`
- Create: `src/lib/zod-schemas.js`
- Create: `src/lib/banks.js`

- [ ] **Step 1: Write failing tests for money.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/utils/money.test.js << 'EOF'
import { describe, it, expect } from 'vitest'
import {
  toCents,
  fromCents,
  addMoney,
  subtractMoney,
  formatPeso,
  getPaymentStatus,
  getRemainingBalance,
} from './money.js'

describe('toCents', () => {
  it('converts whole numbers', () => expect(toCents(100)).toBe(10000))
  it('converts decimals correctly', () => expect(toCents(9.99)).toBe(999))
  it('handles float imprecision (0.1 + 0.2)', () => expect(toCents(0.1 + 0.2)).toBe(30))
})

describe('fromCents', () => {
  it('converts cents back to peso', () => expect(fromCents(999)).toBe(9.99))
  it('converts zero', () => expect(fromCents(0)).toBe(0))
})

describe('addMoney', () => {
  it('adds correctly without float error', () => expect(addMoney(0.1, 0.2)).toBeCloseTo(0.3))
  it('adds large amounts', () => expect(addMoney(1000.50, 500.25)).toBe(1500.75))
})

describe('subtractMoney', () => {
  it('subtracts correctly', () => expect(subtractMoney(100, 30.50)).toBe(69.50))
  it('handles zero remainder', () => expect(subtractMoney(50, 50)).toBe(0))
})

describe('getPaymentStatus', () => {
  it('returns unpaid when nothing paid', () => expect(getPaymentStatus(1000, 0)).toBe('unpaid'))
  it('returns paid when fully paid', () => expect(getPaymentStatus(1000, 1000)).toBe('paid'))
  it('returns partial when partially paid', () => expect(getPaymentStatus(1000, 500)).toBe('partial'))
  it('returns paid when overpaid', () => expect(getPaymentStatus(1000, 1200)).toBe('paid'))
})

describe('getRemainingBalance', () => {
  it('returns correct remaining', () => expect(getRemainingBalance(1000, 300)).toBe(700))
  it('never returns negative', () => expect(getRemainingBalance(100, 200)).toBe(0))
  it('returns 0 when fully paid', () => expect(getRemainingBalance(500, 500)).toBe(0))
})

describe('formatPeso', () => {
  it('formats with PHP symbol', () => expect(formatPeso(1000)).toContain('1,000'))
  it('formats decimals', () => expect(formatPeso(9.99)).toContain('9.99'))
})
EOF
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm test
```

Expected: FAIL — "Cannot find module './money.js'"

- [ ] **Step 3: Write money.js to pass all tests**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/utils/money.js << 'EOF'
// All financial math uses integer cents to avoid IEEE 754 float errors

export function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

export function fromCents(cents) {
  return cents / 100
}

export function addMoney(a, b) {
  return fromCents(toCents(a) + toCents(b))
}

export function subtractMoney(a, b) {
  return fromCents(toCents(a) - toCents(b))
}

export function formatPeso(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)
}

export function getPaymentStatus(amount, amountPaid) {
  const amountCents = toCents(amount)
  const paidCents = toCents(amountPaid)
  if (paidCents === 0) return 'unpaid'
  if (paidCents >= amountCents) return 'paid'
  return 'partial'
}

export function getRemainingBalance(amount, amountPaid) {
  return Math.max(0, subtractMoney(amount, amountPaid))
}
EOF
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm test
```

Expected: All tests PASS. No failures.

- [ ] **Step 5: Create src/lib/supabase.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/lib/supabase.js << 'EOF'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
EOF
```

- [ ] **Step 6: Create src/lib/zod-schemas.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/lib/zod-schemas.js << 'EOF'
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const cardSchema = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  nickname: z.string().min(1, 'Card nickname is required'),
  cardholder_name: z.string().min(1, 'Cardholder name is required'),
  expiry_display: z.string().regex(/^\d{2}\/\d{2}$/, 'Format must be MM/YY'),
  mock_last4: z.string().length(4, 'Must be exactly 4 digits').regex(/^\d{4}$/, 'Digits only'),
  spending_limit: z.coerce.number({ invalid_type_error: 'Must be a number' }).positive('Must be greater than 0'),
  color_primary: z.string().min(1),
  color_secondary: z.string().min(1),
})

export const transactionSchema = z.object({
  transaction_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number({ invalid_type_error: 'Must be a number' }).positive('Amount must be greater than 0'),
  payment_due_date: z.string().optional(),
  notes: z.string().optional(),
})

export const paymentSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Must be a number' }).positive('Amount must be greater than 0'),
  notes: z.string().optional(),
})
EOF
```

- [ ] **Step 7: Create src/lib/banks.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/lib/banks.js << 'EOF'
export const BANK_PRESETS = [
  {
    id: 'sbc',
    name: 'Security Bank (SBC)',
    color_primary: '#99c044',
    color_secondary: '#00a1d3',
  },
  {
    id: 'eastwest',
    name: 'EastWest Bank',
    color_primary: '#6d288e',
    color_secondary: '#d5e04d',
  },
  {
    id: 'bpi',
    name: 'BPI',
    color_primary: '#b11116',
    color_secondary: '#dcb91c',
  },
  {
    id: 'custom',
    name: 'Custom',
    color_primary: '#1a3a52',
    color_secondary: '#2d6a8f',
  },
]

export function getBankPreset(colorPrimary) {
  return BANK_PRESETS.find((b) => b.color_primary === colorPrimary) ?? BANK_PRESETS[3]
}
EOF
```

- [ ] **Step 8: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add core utilities, supabase client, zod schemas, bank presets"
```

---

## Task 4: Express Backend

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Create server/index.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/server/index.js << 'EOF'
import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
}

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }))

// Email notification endpoint
app.post('/api/notify', async (req, res) => {
  const { to, subject, html } = req.body
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
  }

  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  if (!user || !pass) {
    // Silently succeed so the app still works without email configured
    return res.json({ ok: true, skipped: true, reason: 'Email not configured' })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
    })
    await transporter.sendMail({ from: `"CC Tracker" <${user}>`, to, subject, html })
    res.json({ ok: true })
  } catch (e) {
    console.error('[email]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// SPA fallback in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  )
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`))
EOF
```

- [ ] **Step 2: Verify server starts**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm run dev:server
```

Expected: "Server → http://localhost:3000" in terminal. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add server/
git commit -m "feat: add express server with email notification endpoint"
```

---

## Task 5: App Shell (Routing + Auth Guard)

**Files:**
- Modify: `src/App.jsx`
- Create: `src/store/useAppStore.js`
- Create: `src/pages/AuthPage.jsx` (placeholder)
- Create: `src/pages/DashboardPage.jsx` (placeholder)
- Create: `src/pages/TrackerPage.jsx` (placeholder)

- [ ] **Step 1: Create Zustand store**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/store/useAppStore.js << 'EOF'
import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  isDark: true,
  setUser: (user) => set({ user }),
  toggleDark: () =>
    set((s) => {
      const next = !s.isDark
      document.documentElement.classList.toggle('dark', next)
      return { isDark: next }
    }),
}))

export default useAppStore
EOF
```

- [ ] **Step 2: Create page placeholders**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/AuthPage.jsx << 'EOF'
export default function AuthPage() {
  return <div className="p-8 text-white">Auth Page (TODO)</div>
}
EOF

cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/DashboardPage.jsx << 'EOF'
export default function DashboardPage() {
  return <div className="p-8 text-white">Dashboard (TODO)</div>
}
EOF

cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/TrackerPage.jsx << 'EOF'
export default function TrackerPage() {
  return <div className="p-8 text-white">Tracker (TODO)</div>
}
EOF
```

- [ ] **Step 3: Rewrite App.jsx with routing + auth guard + QueryClient**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/App.jsx << 'EOF'
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase.js'
import useAppStore from './store/useAppStore.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TrackerPage from './pages/TrackerPage.jsx'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30 } },
})

function ProtectedRoute({ children }) {
  const user = useAppStore((s) => s.user)
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const setUser = useAppStore((s) => s.setUser)

  useEffect(() => {
    // Load existing session on mount
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))

    // Keep user state in sync with Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      queryClient.clear() // clear cached data on auth change
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/tracker/:cardId" element={
            <ProtectedRoute><TrackerPage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
EOF
```

- [ ] **Step 4: Run dev to verify routing works**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm run dev:client
```

Expected: App loads, redirects to `/auth` (shows placeholder), no console errors.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add app shell with React Router, auth guard, QueryClient, Zustand store"
```

---

## Task 6: UI Primitives

**Files:**
- Create: `src/components/ui/Modal.jsx`
- Create: `src/components/ui/Button.jsx`
- Create: `src/components/ui/Badge.jsx`
- Create: `src/components/ui/Toast.jsx`

- [ ] **Step 1: Create Modal.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/ui/Modal.jsx << 'EOF'
import { useEffect } from 'react'

export default function Modal({ title, onClose, children }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
EOF
```

- [ ] **Step 2: Create Button.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/ui/Button.jsx << 'EOF'
const variants = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  ghost: 'bg-transparent hover:bg-gray-700 text-gray-300 border border-gray-600',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
}

export default function Button({ children, variant = 'primary', className = '', disabled, ...props }) {
  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
EOF
```

- [ ] **Step 3: Create Badge.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/ui/Badge.jsx << 'EOF'
const statusStyles = {
  unpaid: 'bg-red-900/50 text-red-300 border border-red-700',
  partial: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  paid: 'bg-green-900/50 text-green-300 border border-green-700',
}

const statusLabels = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
}

export default function Badge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] ?? statusStyles.unpaid}`}>
      {statusLabels[status] ?? status}
    </span>
  )
}
EOF
```

- [ ] **Step 4: Create Toast.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/ui/Toast.jsx << 'EOF'
import { useState, useCallback } from 'react'

// Hook to use in any component
export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return { toasts, toast }
}

const typeStyles = {
  success: 'bg-green-800 border-green-600 text-green-100',
  error: 'bg-red-800 border-red-600 text-red-100',
  info: 'bg-blue-800 border-blue-600 text-blue-100',
}

export function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg border text-sm font-medium shadow-lg animate-fade-in ${typeStyles[t.type] ?? typeStyles.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
EOF
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add UI primitives (Modal, Button, Badge, Toast)"
```

---

## Task 7: Auth Page

**Files:**
- Modify: `src/pages/AuthPage.jsx`

- [ ] **Step 1: Rewrite AuthPage.jsx with login, register, forgot password**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/AuthPage.jsx << 'EOF'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase.js'
import { loginSchema, registerSchema } from '../lib/zod-schemas.js'
import Button from '../components/ui/Button.jsx'

function InputField({ label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">{label}</label>
      <input
        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        {...props}
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

function LoginForm({ onSwitch }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data) {
    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    setLoading(false)
    if (error) { setServerError(error.message); return }
    navigate('/')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && <p className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">{serverError}</p>}
      <InputField label="Email" type="email" placeholder="you@email.com" error={errors.email?.message} {...register('email')} />
      <InputField label="Password" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
      <Button type="submit" disabled={loading} className="w-full justify-center">
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>
      <button type="button" onClick={onSwitch} className="text-blue-400 text-sm text-center hover:underline">
        No account? Register
      </button>
    </form>
  )
}

function RegisterForm({ onSwitch }) {
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data) {
    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.signUp({ email: data.email, password: data.password })
    setLoading(false)
    if (error) { setServerError(error.message); return }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <p className="text-green-400 font-medium">Check your email to confirm your account.</p>
        <button type="button" onClick={onSwitch} className="text-blue-400 text-sm mt-4 hover:underline">Back to Sign In</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && <p className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">{serverError}</p>}
      <InputField label="Email" type="email" placeholder="you@email.com" error={errors.email?.message} {...register('email')} />
      <InputField label="Password" type="password" placeholder="Min. 8 characters" error={errors.password?.message} {...register('password')} />
      <InputField label="Confirm Password" type="password" placeholder="••••••••" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <Button type="submit" disabled={loading} className="w-full justify-center">
        {loading ? 'Creating account…' : 'Create Account'}
      </Button>
      <button type="button" onClick={onSwitch} className="text-blue-400 text-sm text-center hover:underline">
        Already registered? Sign In
      </button>
    </form>
  )
}

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center py-6">
        <p className="text-green-400 font-medium">Password reset email sent. Check your inbox.</p>
        <button type="button" onClick={onBack} className="text-blue-400 text-sm mt-4 hover:underline">Back to Sign In</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">{error}</p>}
      <InputField label="Email" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" disabled={loading} className="w-full justify-center">
        {loading ? 'Sending…' : 'Send Reset Link'}
      </Button>
      <button type="button" onClick={onBack} className="text-blue-400 text-sm text-center hover:underline">
        Back to Sign In
      </button>
    </form>
  )
}

export default function AuthPage() {
  const [tab, setTab] = useState('login') // 'login' | 'register' | 'forgot'

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-600 rounded-xl px-4 py-2 mb-4">
            <span className="font-bold text-white text-lg">CC</span>
            <span className="text-blue-200 text-sm">Tracker</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {tab === 'login' ? 'Sign In' : tab === 'register' ? 'Create Account' : 'Reset Password'}
          </h1>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
          {tab === 'login' && (
            <>
              <LoginForm onSwitch={() => setTab('register')} />
              <button type="button" onClick={() => setTab('forgot')} className="text-gray-500 text-xs mt-3 text-center w-full hover:text-gray-300">
                Forgot password?
              </button>
            </>
          )}
          {tab === 'register' && <RegisterForm onSwitch={() => setTab('login')} />}
          {tab === 'forgot' && <ForgotPasswordForm onBack={() => setTab('login')} />}
        </div>
      </div>
    </div>
  )
}
EOF
```

- [ ] **Step 2: Run dev and test auth page visually**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm run dev:client
```

Open `http://localhost:5173/auth`. Verify:
- Login form shows with email + password fields
- "No account? Register" switches to register form
- "Forgot password?" shows the reset form
- Forms show validation errors when submitted empty

Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add auth page with login, register, forgot password"
```

---

## Task 8: Navbar + Layout

**Files:**
- Create: `src/components/layout/Navbar.jsx`

- [ ] **Step 1: Create Navbar.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/layout/Navbar.jsx << 'EOF'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import useAppStore from '../../store/useAppStore.js'
import Button from '../ui/Button.jsx'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, isDark, toggleDark } = useAppStore()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <nav className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur border-b border-gray-700 px-4 py-3 flex items-center gap-4">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 mr-auto">
        <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-lg text-sm">CC</span>
        <span className="text-white font-semibold hidden sm:inline">Tracker</span>
      </button>

      {user && (
        <span className="text-gray-400 text-sm hidden md:block truncate max-w-[200px]">
          {user.email}
        </span>
      )}

      <button
        onClick={toggleDark}
        className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
        title="Toggle theme"
        aria-label="Toggle dark mode"
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <Button variant="ghost" onClick={signOut} className="text-sm">
        Sign Out
      </Button>
    </nav>
  )
}
EOF
```

- [ ] **Step 2: Add Navbar to DashboardPage and TrackerPage placeholders**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/DashboardPage.jsx << 'EOF'
import Navbar from '../components/layout/Navbar.jsx'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <p className="text-white">Dashboard (TODO)</p>
      </main>
    </div>
  )
}
EOF

cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/TrackerPage.jsx << 'EOF'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar.jsx'

export default function TrackerPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <button onClick={() => navigate('/')} className="text-blue-400 hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </button>
        <p className="text-white">Tracker for card: {cardId} (TODO)</p>
      </main>
    </div>
  )
}
EOF
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add navbar with theme toggle and sign out"
```

---

## Task 9: React Query Hooks

**Files:**
- Create: `src/hooks/useCards.js`
- Create: `src/hooks/useTransactions.js`

- [ ] **Step 1: Create useCards.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/hooks/useCards.js << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

export function useCards() {
  return useQuery({
    queryKey: ['cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardData) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('cards')
        .insert({ ...cardData, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('cards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}
EOF
```

- [ ] **Step 2: Create useTransactions.js**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/hooks/useTransactions.js << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { addMoney, getPaymentStatus, getRemainingBalance } from '../utils/money.js'

export function useTransactions(cardId) {
  return useQuery({
    queryKey: ['transactions', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('card_id', cardId)
        .eq('is_archived', false)
        .order('transaction_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, transactionData }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...transactionData, card_id: cardId, user_id: user.id, amount_paid: 0, payment_status: 'unpaid' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { cardId }) =>
      qc.invalidateQueries({ queryKey: ['transactions', cardId] }),
  })
}

export function useArchiveTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cardId }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ is_archived: true })
        .eq('id', id)
      if (error) throw error
      return { cardId }
    },
    onSuccess: (_data, { cardId }) =>
      qc.invalidateQueries({ queryKey: ['transactions', cardId] }),
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ transaction, paymentAmount, notes }) => {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Insert payment history record
      const { error: payErr } = await supabase.from('payments').insert({
        transaction_id: transaction.id,
        user_id: user.id,
        amount: paymentAmount,
        notes,
      })
      if (payErr) throw payErr

      // 2. Update transaction totals
      const newAmountPaid = addMoney(transaction.amount_paid, paymentAmount)
      const newStatus = getPaymentStatus(transaction.amount, newAmountPaid)
      const { error: txErr } = await supabase
        .from('transactions')
        .update({ amount_paid: newAmountPaid, payment_status: newStatus })
        .eq('id', transaction.id)
      if (txErr) throw txErr

      return { cardId: transaction.card_id }
    },
    onSuccess: (_data, { transaction }) =>
      qc.invalidateQueries({ queryKey: ['transactions', transaction.card_id] }),
  })
}

export function usePaymentHistory(transactionId) {
  return useQuery({
    queryKey: ['payments', transactionId],
    enabled: !!transactionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
EOF
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add React Query hooks for cards and transactions"
```

---

## Task 10: Card Components

**Files:**
- Create: `src/components/cards/SpendingBar.jsx`
- Create: `src/components/cards/CardTile.jsx`
- Create: `src/components/cards/CardForm.jsx`

- [ ] **Step 1: Create SpendingBar.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/cards/SpendingBar.jsx << 'EOF'
import { formatPeso } from '../../utils/money.js'

// Returns color based on % of limit used
function barColor(pct) {
  if (pct >= 90) return '#ef4444'   // red
  if (pct >= 75) return '#f59e0b'   // amber
  return '#22c55e'                   // green
}

export default function SpendingBar({ spent, limit, colorPrimary }) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const color = pct >= 75 ? barColor(pct) : colorPrimary

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
        <span>{formatPeso(spent)}</span>
        <span>{formatPeso(limit)}</span>
      </div>
      <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {pct.toFixed(0)}% used
      </div>
    </div>
  )
}
EOF
```

- [ ] **Step 2: Create CardTile.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/cards/CardTile.jsx << 'EOF'
import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../../hooks/useTransactions.js'
import { getRemainingBalance } from '../../utils/money.js'
import SpendingBar from './SpendingBar.jsx'

function sumSpent(transactions = []) {
  return transactions.reduce((acc, t) => acc + getRemainingBalance(t.amount, t.amount_paid), 0)
}

export default function CardTile({ card, onEdit }) {
  const navigate = useNavigate()
  const { data: transactions = [] } = useTransactions(card.id)
  const spent = sumSpent(transactions)

  const gradient = `linear-gradient(135deg, ${card.color_primary}, ${card.color_secondary})`

  return (
    <div
      className="relative rounded-2xl p-5 cursor-pointer shadow-xl hover:scale-[1.02] transition-transform select-none"
      style={{ background: gradient, minHeight: 180 }}
      onClick={() => navigate(`/tracker/${card.id}`)}
    >
      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(card) }}
        className="absolute top-3 right-3 bg-black/20 hover:bg-black/40 text-white text-xs px-2 py-1 rounded-lg transition-colors"
      >
        Edit
      </button>

      {/* Bank name + nickname */}
      <div className="mb-6">
        <p className="text-white/70 text-xs uppercase tracking-widest">{card.bank_name}</p>
        <p className="text-white font-semibold text-lg mt-0.5">{card.nickname}</p>
      </div>

      {/* Mock card number */}
      <p className="text-white/60 font-mono text-sm tracking-widest mb-4">
        •••• •••• •••• {card.mock_last4}
      </p>

      {/* Spending bar */}
      <SpendingBar spent={spent} limit={card.spending_limit} colorPrimary={card.color_primary} />

      {/* Footer: cardholder + expiry */}
      <div className="flex justify-between items-end mt-3">
        <p className="text-white/70 text-xs uppercase tracking-wide">{card.cardholder_name}</p>
        <p className="text-white/60 text-xs font-mono">{card.expiry_display}</p>
      </div>
    </div>
  )
}
EOF
```

- [ ] **Step 3: Create CardForm.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/cards/CardForm.jsx << 'EOF'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cardSchema } from '../../lib/zod-schemas.js'
import { BANK_PRESETS } from '../../lib/banks.js'
import { useAddCard, useUpdateCard, useDeleteCard } from '../../hooks/useCards.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

function InputField({ label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400">{label}</label>
      <input
        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        {...props}
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export default function CardForm({ card, onClose, onSuccess }) {
  const isEdit = !!card?.id

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(cardSchema),
    defaultValues: card ?? {
      bank_name: '',
      nickname: '',
      cardholder_name: '',
      expiry_display: '',
      mock_last4: '0000',
      spending_limit: '',
      color_primary: BANK_PRESETS[0].color_primary,
      color_secondary: BANK_PRESETS[0].color_secondary,
    },
  })

  const addCard = useAddCard()
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()

  function applyPreset(preset) {
    setValue('bank_name', preset.name)
    setValue('color_primary', preset.color_primary)
    setValue('color_secondary', preset.color_secondary)
  }

  async function onSubmit(data) {
    if (isEdit) {
      await updateCard.mutateAsync({ id: card.id, ...data })
    } else {
      await addCard.mutateAsync(data)
    }
    onSuccess?.()
    onClose()
  }

  async function handleDelete() {
    if (!confirm('Delete this card and all its transactions? This cannot be undone.')) return
    await deleteCard.mutateAsync(card.id)
    onClose()
  }

  const isPending = addCard.isPending || updateCard.isPending

  return (
    <Modal title={isEdit ? 'Edit Card' : 'Add Card'} onClose={onClose}>
      {/* Bank presets */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {BANK_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p)}
            className="px-2 py-1 rounded text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: p.color_primary }}
          >
            {p.id === 'custom' ? 'Custom' : p.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <InputField label="Bank Name" placeholder="Security Bank" error={errors.bank_name?.message} {...register('bank_name')} />
        <InputField label="Card Nickname" placeholder="My Main Card" error={errors.nickname?.message} {...register('nickname')} />
        <InputField label="Cardholder Name" placeholder="JUAN DELA CRUZ" error={errors.cardholder_name?.message} {...register('cardholder_name')} />
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Expiry (MM/YY)" placeholder="12/26" error={errors.expiry_display?.message} {...register('expiry_display')} />
          <InputField label="Last 4 Digits" placeholder="0000" maxLength={4} error={errors.mock_last4?.message} {...register('mock_last4')} />
        </div>
        <InputField label="Spending Limit (PHP)" type="number" placeholder="100000" error={errors.spending_limit?.message} {...register('spending_limit')} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Primary Color</label>
            <input type="color" {...register('color_primary')} className="h-9 w-full rounded cursor-pointer bg-gray-800 border border-gray-600" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Secondary Color</label>
            <input type="color" {...register('color_secondary')} className="h-9 w-full rounded cursor-pointer bg-gray-800 border border-gray-600" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {isEdit && (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={deleteCard.isPending} className="flex-1">
              Delete Card
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Saving…' : isEdit ? 'Save' : 'Add Card'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
EOF
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add CardTile, SpendingBar, CardForm components"
```

---

## Task 11: Dashboard Page

**Files:**
- Modify: `src/pages/DashboardPage.jsx`

- [ ] **Step 1: Rewrite DashboardPage.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/DashboardPage.jsx << 'EOF'
import { useState } from 'react'
import Navbar from '../components/layout/Navbar.jsx'
import CardTile from '../components/cards/CardTile.jsx'
import CardForm from '../components/cards/CardForm.jsx'
import { useCards } from '../hooks/useCards.js'
import Button from '../components/ui/Button.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function DashboardPage() {
  const { data: cards = [], isLoading, error } = useCards()
  const [showAdd, setShowAdd] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const { toasts, toast } = useToast()

  function handleEdit(card) {
    setEditingCard(card)
  }

  function handleCardSuccess(action) {
    toast(action === 'add' ? 'Card added!' : 'Card updated!', 'success')
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Cards</h1>
            <p className="text-gray-400 text-sm mt-0.5">{cards.length} card{cards.length !== 1 ? 's' : ''} tracked</p>
          </div>
          <Button onClick={() => setShowAdd(true)}>+ Add Card</Button>
        </div>

        {isLoading && (
          <div className="text-gray-400 text-center py-20">Loading cards…</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300">
            Failed to load cards: {error.message}
          </div>
        )}

        {!isLoading && cards.length === 0 && (
          <div className="text-center py-24 border border-dashed border-gray-700 rounded-2xl">
            <p className="text-gray-400 text-lg">No cards yet</p>
            <p className="text-gray-500 text-sm mt-2 mb-6">Add your first credit card to start tracking</p>
            <Button onClick={() => setShowAdd(true)}>+ Add Your First Card</Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <CardTile key={card.id} card={card} onEdit={handleEdit} />
          ))}
        </div>
      </main>

      {showAdd && (
        <CardForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => handleCardSuccess('add')}
        />
      )}

      {editingCard && (
        <CardForm
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSuccess={() => handleCardSuccess('edit')}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
EOF
```

- [ ] **Step 2: Run dev and smoke test the dashboard**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm run dev:client
```

Sign in at `/auth`, verify:
- Dashboard loads with "No cards yet" empty state
- "+ Add Card" opens the CardForm modal
- Bank preset buttons fill in the bank name and colors
- Submitting form creates a card (verify in Supabase Table Editor)
- Card tile appears in the grid

Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: build dashboard page with card grid, add/edit card modals"
```

---

## Task 12: Tracker Page — Summary + Transaction Table

**Files:**
- Create: `src/components/tracker/TrackerSummary.jsx`
- Create: `src/components/tracker/TransactionTable.jsx`
- Modify: `src/pages/TrackerPage.jsx`

- [ ] **Step 1: Create TrackerSummary.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/tracker/TrackerSummary.jsx << 'EOF'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'

function calcTotals(transactions = []) {
  return transactions.reduce(
    (acc, t) => ({
      totalSpent: acc.totalSpent + Number(t.amount),
      totalPaid: acc.totalPaid + Number(t.amount_paid),
      totalRemaining: acc.totalRemaining + getRemainingBalance(t.amount, t.amount_paid),
    }),
    { totalSpent: 0, totalPaid: 0, totalRemaining: 0 }
  )
}

function StatBox({ label, value, color }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{formatPeso(value)}</p>
    </div>
  )
}

export default function TrackerSummary({ card, transactions }) {
  const { totalSpent, totalPaid, totalRemaining } = calcTotals(transactions)

  return (
    <div className="sticky top-[57px] z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: card.color_primary }}
          />
          <h2 className="text-white font-semibold">{card.nickname}</h2>
          <span className="text-gray-500 text-sm">· {card.bank_name}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatBox label="Total Charged" value={totalSpent} color="text-white" />
          <StatBox label="Total Paid" value={totalPaid} color="text-green-400" />
          <StatBox label="Outstanding" value={totalRemaining} color="text-red-400" />
        </div>
      </div>
    </div>
  )
}
EOF
```

- [ ] **Step 2: Create TransactionTable.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/tracker/TransactionTable.jsx << 'EOF'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import { useArchiveTransaction } from '../../hooks/useTransactions.js'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function TransactionTable({ transactions, cardId, onPay }) {
  const archive = useArchiveTransaction()

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-700 rounded-xl">
        No transactions yet. Add your first one above.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-left">Due Date</th>
            <th className="px-4 py-3 text-right">Paid</th>
            <th className="px-4 py-3 text-right">Remaining</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-left">Notes</th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {transactions.map((t) => (
            <tr key={t.id} className="hover:bg-gray-800/50 transition-colors text-gray-200">
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.transaction_date)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatPeso(t.amount)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-400">{formatDate(t.payment_due_date)}</td>
              <td className="px-4 py-3 text-right font-mono text-green-400">{formatPeso(t.amount_paid)}</td>
              <td className="px-4 py-3 text-right font-mono text-red-400">
                {formatPeso(getRemainingBalance(t.amount, t.amount_paid))}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge status={t.payment_status} />
              </td>
              <td className="px-4 py-3 text-gray-400 max-w-[150px] truncate">{t.notes || '—'}</td>
              <td className="px-4 py-3 text-center">
                <div className="flex gap-2 justify-center">
                  {t.payment_status !== 'paid' && (
                    <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => onPay(t)}>
                      Pay
                    </Button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Archive this transaction?')) {
                        archive.mutate({ id: t.id, cardId })
                      }
                    }}
                    className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                    title="Archive"
                  >
                    Archive
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
EOF
```

- [ ] **Step 3: Rewrite TrackerPage.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/pages/TrackerPage.jsx << 'EOF'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCards } from '../hooks/useCards.js'
import { useTransactions } from '../hooks/useTransactions.js'
import Navbar from '../components/layout/Navbar.jsx'
import TrackerSummary from '../components/tracker/TrackerSummary.jsx'
import TransactionTable from '../components/tracker/TransactionTable.jsx'
import TransactionForm from '../components/tracker/TransactionForm.jsx'
import PaymentModal from '../components/tracker/PaymentModal.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function TrackerPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const { data: cards = [] } = useCards()
  const { data: transactions = [], isLoading } = useTransactions(cardId)
  const [payingTransaction, setPayingTransaction] = useState(null)
  const { toasts, toast } = useToast()

  const card = cards.find((c) => c.id === cardId)

  if (!card && cards.length > 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Card not found. <button onClick={() => navigate('/')} className="text-blue-400 underline">Go back</button></p>
      </div>
    )
  }

  if (!card) return null // loading

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <TrackerSummary card={card} transactions={transactions} />

      <main className="max-w-6xl mx-auto p-6">
        <button onClick={() => navigate('/')} className="text-blue-400 hover:underline text-sm mb-6 block">
          ← Back to Dashboard
        </button>

        <TransactionForm
          cardId={cardId}
          onSuccess={() => toast('Transaction added!', 'success')}
        />

        <div className="mt-6">
          {isLoading ? (
            <p className="text-gray-400 text-center py-10">Loading transactions…</p>
          ) : (
            <TransactionTable
              transactions={transactions}
              cardId={cardId}
              onPay={setPayingTransaction}
            />
          )}
        </div>
      </main>

      {payingTransaction && (
        <PaymentModal
          transaction={payingTransaction}
          onClose={() => setPayingTransaction(null)}
          onSuccess={() => {
            setPayingTransaction(null)
            toast('Payment recorded!', 'success')
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
EOF
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: build tracker page with summary header and transaction table"
```

---

## Task 13: Transaction Form

**Files:**
- Create: `src/components/tracker/TransactionForm.jsx`

- [ ] **Step 1: Create TransactionForm.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/tracker/TransactionForm.jsx << 'EOF'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { transactionSchema } from '../../lib/zod-schemas.js'
import { useAddTransaction } from '../../hooks/useTransactions.js'
import Button from '../ui/Button.jsx'

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export default function TransactionForm({ cardId, onSuccess }) {
  const addTransaction = useAddTransaction()
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_due_date: '',
      notes: '',
    },
  })

  async function onSubmit(data) {
    await addTransaction.mutateAsync({ cardId, transactionData: data })
    reset({ transaction_date: new Date().toISOString().split('T')[0], amount: '', payment_due_date: '', notes: '' })
    onSuccess?.()
  }

  const inputCls = 'bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full'

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-gray-900 border border-gray-700 rounded-xl p-4"
    >
      <h3 className="text-white font-semibold mb-4">Add Transaction</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Date" error={errors.transaction_date?.message}>
          <input type="date" className={inputCls} {...register('transaction_date')} />
        </Field>
        <Field label="Amount (PHP)" error={errors.amount?.message}>
          <input type="number" step="0.01" placeholder="0.00" className={inputCls} {...register('amount')} />
        </Field>
        <Field label="Payment Due Date" error={errors.payment_due_date?.message}>
          <input type="date" className={inputCls} {...register('payment_due_date')} />
        </Field>
        <Field label="Notes (optional)" error={errors.notes?.message}>
          <input type="text" placeholder="Groceries, utilities…" className={inputCls} {...register('notes')} />
        </Field>
      </div>
      <div className="flex justify-end mt-4">
        <Button type="submit" disabled={addTransaction.isPending}>
          {addTransaction.isPending ? 'Adding…' : '+ Add Transaction'}
        </Button>
      </div>
      {addTransaction.isError && (
        <p className="text-red-400 text-xs mt-2">{addTransaction.error?.message}</p>
      )}
    </form>
  )
}
EOF
```

- [ ] **Step 2: Run dev and test adding transactions**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm run dev:client
```

Click a card from the dashboard, verify:
- Tracker summary shows all zeroes initially
- Transaction form is visible at top
- Adding a transaction shows it in the table immediately
- Summary totals update to reflect the new transaction
- Badge shows "Unpaid"

Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add transaction form with validation"
```

---

## Task 14: Payment Modal

**Files:**
- Create: `src/components/tracker/PaymentModal.jsx`

- [ ] **Step 1: Create PaymentModal.jsx**

```bash
cat > /c/Users/PCWIN10PRO-05/Desktop/CCTracker/src/components/tracker/PaymentModal.jsx << 'EOF'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paymentSchema } from '../../lib/zod-schemas.js'
import { useRecordPayment, usePaymentHistory } from '../../hooks/useTransactions.js'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

function formatDateTime(dt) {
  return new Date(dt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PaymentModal({ transaction, onClose, onSuccess }) {
  const remaining = getRemainingBalance(transaction.amount, transaction.amount_paid)
  const recordPayment = useRecordPayment()
  const { data: history = [] } = usePaymentHistory(transaction.id)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: '', notes: '' },
  })

  async function onSubmit(data) {
    if (data.amount > remaining) {
      alert(`Payment cannot exceed remaining balance of ${formatPeso(remaining)}`)
      return
    }
    await recordPayment.mutateAsync({
      transaction,
      paymentAmount: data.amount,
      notes: data.notes,
    })
    onSuccess?.()
  }

  const inputCls = 'bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-full focus:outline-none focus:border-blue-500'

  return (
    <Modal title="Record Payment" onClose={onClose}>
      {/* Transaction summary */}
      <div className="bg-gray-800 rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Original Amount</p>
          <p className="text-white font-mono">{formatPeso(transaction.amount)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Already Paid</p>
          <p className="text-green-400 font-mono">{formatPeso(transaction.amount_paid)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 text-xs">Remaining Balance</p>
          <p className="text-red-400 font-mono font-bold">{formatPeso(remaining)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Payment Amount (PHP)</label>
          <input type="number" step="0.01" placeholder="0.00" className={inputCls} {...register('amount')} />
          {errors.amount && <p className="text-red-400 text-xs">{errors.amount.message}</p>}
          <button
            type="button"
            className="text-blue-400 text-xs text-left hover:underline"
            onClick={() => setValue('amount', remaining)}
          >
            Pay full remaining ({formatPeso(remaining)})
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Notes (optional)</label>
          <input type="text" placeholder="Bank transfer, GCash…" className={inputCls} {...register('notes')} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={recordPayment.isPending} className="flex-1">
            {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </div>
      </form>

      {/* Payment history */}
      {history.length > 0 && (
        <div className="mt-4 border-t border-gray-700 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Payment History</p>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
            {history.map((p) => (
              <div key={p.id} className="flex justify-between items-center text-sm">
                <span className="text-gray-300">{formatDateTime(p.paid_at)}</span>
                <span className="text-green-400 font-mono">{formatPeso(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
EOF
```

- [ ] **Step 2: Run dev and test payment flow end to end**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker && npm run dev:client
```

Verify:
- Add a transaction (e.g., ₱5,000)
- Click "Pay" → Payment modal opens showing remaining balance
- Click "Pay full remaining" — fills in amount
- Submit → transaction status updates to "Paid", badge changes to green
- Add another transaction, pay partially → badge shows "Partial"
- Summary totals update after each payment
- Payment history shows all recorded payments

Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add payment modal with history log and full/partial payment support"
```

---

## Task 15: Final Polish — Dark Mode + Responsive Check

**Files:**
- Modify: `src/index.css` (add utility classes)
- Modify: `tailwind.config.js` (add animation)

- [ ] **Step 1: Add animation utility to tailwind.config.js**

Open `CCTracker/tailwind.config.js` and replace with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Verify dark mode toggle works**

Run the app, click the ☀️/🌙 button in the navbar. Confirm the page doesn't visually change (it's already dark-first). The toggle is wired and functional — light mode can be styled in a future pass.

- [ ] **Step 3: Verify mobile layout**

In Chrome DevTools, switch to iPhone viewport (375px). Confirm:
- Navbar fits without overflow
- Dashboard grid shows 1 column
- Tracker table scrolls horizontally
- Transaction form stacks vertically
- All modals are scrollable on small screens

- [ ] **Step 4: Final commit**

```bash
cd /c/Users/PCWIN10PRO-05/Desktop/CCTracker
git add -A
git commit -m "feat: add animation utilities, verify mobile responsiveness"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Multiple credit cards management | Tasks 10, 11 |
| Bank color themes (SBC, EastWest, BPI) | Task 3 (banks.js), Task 10 (CardForm presets) |
| Card visual component | Task 10 (CardTile) |
| Spending bar with thresholds | Task 10 (SpendingBar) |
| Transaction tracker table | Task 12 (TransactionTable) |
| Partial + full payments | Task 14 (PaymentModal) |
| Payment history log | Task 14 (usePaymentHistory + modal) |
| Archive transactions (not delete) | Task 12 (archive mutation) |
| Auth: email/password + forgot password | Task 7 (AuthPage) |
| Supabase RLS security | Task 2 (Schema) |
| No sensitive card data stored | Design constraint (no card numbers in schema) |
| Financial precision (no float errors) | Task 3 (money.js cents-based) |
| Real-time totals on payment | Tasks 9, 12, 13 (React Query invalidation) |
| Mobile responsive | Task 15 |

### Gaps (Post-MVP)
- Google OAuth (Supabase supports it, enable in dashboard → not coded here)
- Share codes / collaborator system (spec section 5 — defer to Phase 2)
- CSV export (spec recommended feature — defer)
- Spending threshold email alerts (backend ready at `/api/notify`, logic not wired)
- Analytics dashboard (defer)

### Placeholder Scan
None found. All steps contain actual code and exact commands.

### Type Consistency
- `transaction.card_id` used consistently in `useTransactions.js` and `TransactionTable.jsx`
- `getRemainingBalance(t.amount, t.amount_paid)` called identically in `TrackerSummary`, `TransactionTable`, `PaymentModal`
- `useRecordPayment` mutationFn signature matches call in `PaymentModal` (`{ transaction, paymentAmount, notes }`)
- `BANK_PRESETS` shape `{ id, name, color_primary, color_secondary }` used identically in `banks.js` and `CardForm.jsx`
