# Borrowers Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "My Borrowers" section to the dashboard where users can track people they lend money to, manage individual loans, record payments, and view repayment progress.

**Architecture:** Mirrors the CC Tracker structure — BorrowerTile on the dashboard links to a LoanPage, which lists loans and allows recording payments via a modal. Three new Supabase tables (`borrowers`, `loans`, `loan_payments`) with row-level security. Overdue status is computed on the frontend; all financial math uses the existing cents-based `money.js` utilities.

**Tech Stack:** React 18, Vite, Tailwind CSS, React Query (`@tanstack/react-query`), React Hook Form, Zod, Supabase (Postgres + RLS), Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/utils/loans.js` | Loan-specific math: initials, remaining balance, overdue check, next-payment advancement |
| Create | `src/utils/loans.test.js` | Vitest unit tests for `loans.js` |
| Modify | `src/lib/zod-schemas.js` | Add `borrowerSchema`, `loanSchema`, `loanPaymentSchema` |
| Create | `src/hooks/useBorrowers.js` | React Query hooks: `useBorrowers`, `useAddBorrower`, `useUpdateBorrower` |
| Create | `src/hooks/useLoans.js` | React Query hooks: `useLoans`, `useAddLoan`, `useRecordLoanPayment` |
| Create | `src/components/borrowers/BorrowerTile.jsx` | Borrower summary card (initials avatar, totals, progress bar) |
| Create | `src/components/borrowers/BorrowerForm.jsx` | Add / edit borrower modal |
| Create | `src/components/borrowers/LoanForm.jsx` | Add loan modal (amount, date, frequency, notarization) |
| Create | `src/components/borrowers/LoanPaymentModal.jsx` | Record payment + view payment history for one loan |
| Create | `src/components/borrowers/LoanTable.jsx` | List of loans for a borrower with status, remaining, actions |
| Create | `src/pages/LoanPage.jsx` | Borrower detail page — summary header + LoanTable + modals |
| Modify | `src/pages/DashboardPage.jsx` | Add "My Borrowers" section below cards |
| Modify | `src/App.jsx` | Add `/borrower/:borrowerId` route |

---

## Task 1: SQL Migration — Create Tables in Supabase

**Files:** *(run in Supabase Dashboard → SQL Editor)*

- [ ] **Step 1: Open Supabase SQL Editor and run this migration**

```sql
-- 1. borrowers
create table borrowers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  full_name text not null,
  address text not null,
  phone text not null,
  email text not null,
  is_archived boolean default false,
  created_at timestamptz default now()
);
alter table borrowers enable row level security;
create policy "Users manage own borrowers" on borrowers
  for all using (auth.uid() = user_id);

-- 2. loans
create table loans (
  id uuid default gen_random_uuid() primary key,
  borrower_id uuid references borrowers(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  amount numeric not null,
  loan_date date not null,
  description text,
  payment_frequency text not null default 'one-time',
  payment_day integer,
  next_payment_date date,
  status text not null default 'active',
  notarized boolean default false,
  lawyer_name text,
  ptr_number text,
  date_notarized date,
  is_archived boolean default false,
  created_at timestamptz default now()
);
alter table loans enable row level security;
create policy "Users manage own loans" on loans
  for all using (auth.uid() = user_id);

-- 3. loan_payments
create table loan_payments (
  id uuid default gen_random_uuid() primary key,
  loan_id uuid references loans(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  amount numeric not null,
  notes text,
  paid_at timestamptz default now()
);
alter table loan_payments enable row level security;
create policy "Users manage own loan_payments" on loan_payments
  for all using (auth.uid() = user_id);
```

- [ ] **Step 2: Verify tables exist**

In Supabase → Table Editor, confirm `borrowers`, `loans`, and `loan_payments` appear with the correct columns and RLS enabled.

---

## Task 2: Loan Utility Functions

**Files:**
- Create: `src/utils/loans.js`
- Create: `src/utils/loans.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/loans.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  getLoanInitials,
  getLoanTotalPaid,
  getLoanRemaining,
  isLoanOverdue,
  advanceNextPaymentDate,
} from './loans.js'

describe('getLoanInitials', () => {
  it('returns two initials for two-word name', () =>
    expect(getLoanInitials('John Smith')).toBe('JS'))
  it('returns one initial for single-word name', () =>
    expect(getLoanInitials('Maria')).toBe('M'))
  it('only uses first two words', () =>
    expect(getLoanInitials('Juan dela Cruz')).toBe('JD'))
  it('handles extra spaces', () =>
    expect(getLoanInitials('  Ana  Torres  ')).toBe('AT'))
})

describe('getLoanTotalPaid', () => {
  it('returns 0 for empty payments', () =>
    expect(getLoanTotalPaid([])).toBe(0))
  it('sums payment amounts correctly', () =>
    expect(getLoanTotalPaid([{ amount: 500 }, { amount: 250.50 }])).toBe(750.50))
  it('handles a single payment', () =>
    expect(getLoanTotalPaid([{ amount: 1000 }])).toBe(1000))
})

describe('getLoanRemaining', () => {
  it('returns loan amount minus total paid', () =>
    expect(getLoanRemaining(1000, 300)).toBe(700))
  it('never returns negative', () =>
    expect(getLoanRemaining(1000, 1500)).toBe(0))
  it('returns 0 when fully paid', () =>
    expect(getLoanRemaining(500, 500)).toBe(0))
})

describe('isLoanOverdue', () => {
  const pastDate = '2020-01-01'
  const futureDate = '2099-12-31'

  it('returns true when next_payment_date is past and remaining > 0', () =>
    expect(isLoanOverdue({ next_payment_date: pastDate, status: 'active' }, 0)).toBe(true))
  it('returns false when next_payment_date is in future', () =>
    expect(isLoanOverdue({ next_payment_date: futureDate, status: 'active' }, 0)).toBe(false))
  it('returns false when loan is completed', () =>
    expect(isLoanOverdue({ next_payment_date: pastDate, status: 'completed' }, 1000)).toBe(false))
  it('returns false when loan is defaulted', () =>
    expect(isLoanOverdue({ next_payment_date: pastDate, status: 'defaulted' }, 0)).toBe(false))
  it('returns false when no next_payment_date', () =>
    expect(isLoanOverdue({ next_payment_date: null, status: 'active' }, 0)).toBe(false))
})

describe('advanceNextPaymentDate', () => {
  it('advances weekly by 7 days', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'weekly', next_payment_date: '2026-04-01', payment_day: null })
    ).toBe('2026-04-08'))

  it('advances monthly to same payment_day next month', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'monthly', next_payment_date: '2026-04-15', payment_day: 15 })
    ).toBe('2026-05-15'))

  it('clamps monthly payment_day=30 for February', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'monthly', next_payment_date: '2026-01-30', payment_day: 30 })
    ).toBe('2026-02-28'))

  it('returns same date for one-time frequency', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'one-time', next_payment_date: '2026-04-15', payment_day: null })
    ).toBe('2026-04-15'))

  it('returns null when next_payment_date is null', () =>
    expect(
      advanceNextPaymentDate({ payment_frequency: 'weekly', next_payment_date: null, payment_day: null })
    ).toBeNull())
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- loans.test
```

Expected: fails with "Cannot find module './loans.js'"

- [ ] **Step 3: Implement `src/utils/loans.js`**

```js
import { addMoney, subtractMoney } from './money.js'

export function getLoanInitials(fullName) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function getLoanTotalPaid(payments = []) {
  return payments.reduce((sum, p) => addMoney(sum, p.amount), 0)
}

export function getLoanRemaining(loanAmount, totalPaid) {
  return Math.max(0, subtractMoney(loanAmount, totalPaid))
}

export function isLoanOverdue(loan, totalPaid) {
  if (loan.status === 'completed' || loan.status === 'defaulted') return false
  if (!loan.next_payment_date) return false
  const remaining = getLoanRemaining(loan.amount, totalPaid)
  if (remaining <= 0) return false
  const today = new Date().toISOString().slice(0, 10)
  return loan.next_payment_date < today
}

export function advanceNextPaymentDate(loan) {
  if (!loan.next_payment_date) return null
  if (loan.payment_frequency === 'one-time') return loan.next_payment_date

  const date = new Date(loan.next_payment_date + 'T00:00:00')

  if (loan.payment_frequency === 'weekly') {
    date.setDate(date.getDate() + 7)
    return date.toISOString().slice(0, 10)
  }

  if (loan.payment_frequency === 'monthly') {
    const targetDay = loan.payment_day || 30
    date.setMonth(date.getMonth() + 1)
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    date.setDate(Math.min(targetDay, lastDayOfMonth))
    return date.toISOString().slice(0, 10)
  }

  return loan.next_payment_date
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- loans.test
```

Expected: all 15 tests pass

---

## Task 3: Zod Schemas

**Files:**
- Modify: `src/lib/zod-schemas.js`

- [ ] **Step 1: Add borrower, loan, and loan payment schemas**

Append to the bottom of `src/lib/zod-schemas.js`:

```js
export const borrowerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email address'),
})

export const loanSchema = z
  .object({
    amount: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .positive('Amount must be greater than 0'),
    loan_date: z.string().min(1, 'Loan date is required'),
    description: z.string().optional(),
    payment_frequency: z.enum(['one-time', 'weekly', 'monthly']),
    payment_day: z.coerce.number().optional().nullable(),
    next_payment_date: z.string().optional().nullable(),
    notarized: z.boolean().default(false),
    lawyer_name: z.string().optional().nullable(),
    ptr_number: z.string().optional().nullable(),
    date_notarized: z.string().optional().nullable(),
  })
  .refine(
    (d) => {
      if (d.payment_frequency === 'monthly') {
        return d.payment_day === 15 || d.payment_day === 30
      }
      return true
    },
    { message: 'Payment day must be 15 or 30 for monthly frequency', path: ['payment_day'] }
  )
  .refine(
    (d) => {
      if (d.notarized) {
        return !!d.lawyer_name && !!d.ptr_number && !!d.date_notarized
      }
      return true
    },
    { message: 'Lawyer name, PTR number, and date notarized are required when notarized', path: ['lawyer_name'] }
  )

export const loanPaymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .positive('Amount must be greater than 0'),
  notes: z.string().optional(),
})
```

- [ ] **Step 2: Verify no import errors**

```bash
npm run dev
```

Expected: dev server starts without errors (check browser console — no import errors)

---

## Task 4: `useBorrowers` Hook

**Files:**
- Create: `src/hooks/useBorrowers.js`

- [ ] **Step 1: Create the hook file**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

export function useBorrowers() {
  return useQuery({
    queryKey: ['borrowers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrowers')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddBorrower() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (borrowerData) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('borrowers')
        .insert({ ...borrowerData, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}

export function useUpdateBorrower() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('borrowers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}
```

- [ ] **Step 2: Verify dev server still loads**

```bash
npm run dev
```

Expected: dev server starts, no console errors

---

## Task 5: `useLoans` Hook

**Files:**
- Create: `src/hooks/useLoans.js`

- [ ] **Step 1: Create the hook file**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { getLoanTotalPaid, getLoanRemaining, advanceNextPaymentDate } from '../utils/loans.js'
import { addMoney } from '../utils/money.js'

export function useLoans(borrowerId) {
  return useQuery({
    queryKey: ['loans', borrowerId],
    enabled: !!borrowerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*, loan_payments(id, amount, notes, paid_at)')
        .eq('borrower_id', borrowerId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ borrowerId, loanData }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('loans')
        .insert({ ...loanData, borrower_id: borrowerId, user_id: user.id, status: 'active' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { borrowerId }) =>
      qc.invalidateQueries({ queryKey: ['loans', borrowerId] }),
  })
}

export function useRecordLoanPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loan, paymentAmount, notes }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // 1. Insert payment record
      const { error: payErr } = await supabase.from('loan_payments').insert({
        loan_id: loan.id,
        user_id: user.id,
        amount: paymentAmount,
        notes,
      })
      if (payErr) throw payErr

      // 2. Compute new remaining balance
      const previousPaid = getLoanTotalPaid(loan.loan_payments)
      const newTotalPaid = addMoney(previousPaid, paymentAmount)
      const newRemaining = getLoanRemaining(loan.amount, newTotalPaid)

      // 3. Update loan status and next_payment_date
      const updates = {}
      if (newRemaining <= 0) {
        updates.status = 'completed'
        updates.next_payment_date = null
      } else {
        updates.next_payment_date = advanceNextPaymentDate(loan)
      }

      const { error: loanErr } = await supabase
        .from('loans')
        .update(updates)
        .eq('id', loan.id)
      if (loanErr) throw loanErr

      return { borrowerId: loan.borrower_id }
    },
    onSuccess: (_data, { loan }) =>
      qc.invalidateQueries({ queryKey: ['loans', loan.borrower_id] }),
  })
}
```

- [ ] **Step 2: Verify dev server still loads**

```bash
npm run dev
```

Expected: no console errors

---

## Task 6: `BorrowerTile` Component

**Files:**
- Create: `src/components/borrowers/BorrowerTile.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useNavigate } from 'react-router-dom'
import { useLoans } from '../../hooks/useLoans.js'
import { getLoanInitials, getLoanTotalPaid, getLoanRemaining, isLoanOverdue } from '../../utils/loans.js'
import { formatPeso, addMoney } from '../../utils/money.js'

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
]

function pickColor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function BorrowerTile({ borrower, onEdit }) {
  const navigate = useNavigate()
  const { data: loans = [] } = useLoans(borrower.id)

  const totalLoaned = loans.reduce((sum, l) => addMoney(sum, l.amount), 0)
  const totalPaid = loans.reduce((sum, l) => addMoney(sum, getLoanTotalPaid(l.loan_payments)), 0)
  const outstanding = loans.reduce(
    (sum, l) => addMoney(sum, getLoanRemaining(l.amount, getLoanTotalPaid(l.loan_payments))),
    0
  )

  const hasOverdue = loans.some((l) =>
    isLoanOverdue(l, getLoanTotalPaid(l.loan_payments))
  )

  const pct = totalLoaned > 0 ? Math.min((totalPaid / totalLoaned) * 100, 100) : 0

  const initials = getLoanInitials(borrower.full_name)
  const avatarColor = pickColor(borrower.full_name)

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/borrower/${borrower.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`${avatarColor} w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {borrower.full_name}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{borrower.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasOverdue && (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
              Overdue
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(borrower)
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <p className="text-gray-400 text-xs">Loaned</p>
          <p className="text-gray-900 dark:text-white text-sm font-medium">{formatPeso(totalLoaned)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Paid</p>
          <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{formatPeso(totalPaid)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Outstanding</p>
          <p className="text-red-500 dark:text-red-400 text-sm font-medium">{formatPeso(outstanding)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-gray-400 text-xs mt-1 text-right">{Math.round(pct)}% repaid</p>
    </div>
  )
}
```

- [ ] **Step 2: Verify dev server loads without error**

```bash
npm run dev
```

Expected: no console errors (component not rendered yet — that's fine)

---

## Task 7: `BorrowerForm` Modal

**Files:**
- Create: `src/components/borrowers/BorrowerForm.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { borrowerSchema } from '../../lib/zod-schemas.js'
import { useAddBorrower, useUpdateBorrower } from '../../hooks/useBorrowers.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

export default function BorrowerForm({ borrower = null, onClose, onSuccess }) {
  const isEditing = !!borrower
  const addBorrower = useAddBorrower()
  const updateBorrower = useUpdateBorrower()
  const mutation = isEditing ? updateBorrower : addBorrower

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(borrowerSchema),
    defaultValues: borrower ?? { full_name: '', address: '', phone: '', email: '' },
  })

  useEffect(() => {
    if (borrower) reset(borrower)
  }, [borrower, reset])

  async function onSubmit(values) {
    try {
      if (isEditing) {
        await mutation.mutateAsync({ id: borrower.id, ...values })
      } else {
        await mutation.mutateAsync(values)
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
        {isEditing ? 'Edit Borrower' : 'Add Borrower'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {[
          { name: 'full_name', label: 'Full Name', placeholder: 'Juan dela Cruz' },
          { name: 'address', label: 'Address', placeholder: 'Block 1 Lot 2, Barangay...' },
          { name: 'phone', label: 'Phone Number', placeholder: '09XX XXX XXXX' },
          { name: 'email', label: 'Email', placeholder: 'juan@example.com' },
        ].map(({ name, label, placeholder }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {label}
            </label>
            <input
              {...register(name)}
              placeholder={placeholder}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors[name] && (
              <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>
            )}
          </div>
        ))}

        {mutation.error && (
          <p className="text-red-500 text-sm">{mutation.error.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending} className="flex-1">
            {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Borrower'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify dev server loads without error**

```bash
npm run dev
```

Expected: no console errors

---

## Task 8: Wire Borrowers into Dashboard + Add Route

**Files:**
- Modify: `src/pages/DashboardPage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Update `DashboardPage.jsx`**

Add these imports at the top of `src/pages/DashboardPage.jsx` (after existing imports):

```js
import BorrowerTile from '../components/borrowers/BorrowerTile.jsx'
import BorrowerForm from '../components/borrowers/BorrowerForm.jsx'
import { useBorrowers } from '../hooks/useBorrowers.js'
```

Add state for borrowers inside the component (after existing useState lines):

```js
const { data: borrowers = [], isLoading: loadingBorrowers } = useBorrowers()
const [showAddBorrower, setShowAddBorrower] = useState(false)
const [editingBorrower, setEditingBorrower] = useState(null)
```

Add borrowers section inside `<main>`, after the cards grid (before `</main>`):

```jsx
{/* Borrowers section */}
<div className="mt-10">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Borrowers</h2>
      <p className="text-gray-500 dark:text-gray-500 text-sm mt-0.5">
        {borrowers.length} borrower{borrowers.length !== 1 ? 's' : ''} tracked
      </p>
    </div>
    <Button onClick={() => setShowAddBorrower(true)}>+ Add Borrower</Button>
  </div>

  {loadingBorrowers && (
    <div className="text-gray-500 text-center py-10">Loading borrowers…</div>
  )}

  {!loadingBorrowers && borrowers.length === 0 && (
    <div className="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
      <div className="text-4xl mb-3">🤝</div>
      <p className="text-gray-700 dark:text-gray-300 font-medium">No borrowers yet</p>
      <p className="text-gray-500 text-sm mt-1 mb-5">
        Track money you lend to friends or family
      </p>
      <Button onClick={() => setShowAddBorrower(true)}>+ Add Your First Borrower</Button>
    </div>
  )}

  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {borrowers.map((b) => (
      <BorrowerTile key={b.id} borrower={b} onEdit={(b) => setEditingBorrower(b)} />
    ))}
  </div>
</div>
```

Add modals before `<ToastContainer>`:

```jsx
{showAddBorrower && (
  <BorrowerForm
    onClose={() => setShowAddBorrower(false)}
    onSuccess={() => toast('Borrower added!', 'success')}
  />
)}
{editingBorrower && (
  <BorrowerForm
    borrower={editingBorrower}
    onClose={() => setEditingBorrower(null)}
    onSuccess={() => toast('Borrower updated!', 'success')}
  />
)}
```

- [ ] **Step 2: Add route in `src/App.jsx`**

Add this import with the existing page imports:

```js
import LoanPage from './pages/LoanPage.jsx'
```

Add this route inside `<Routes>` (after the `/tracker/:cardId` route):

```jsx
<Route
  path="/borrower/:borrowerId"
  element={
    <ProtectedRoute>
      <LoanPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Test on localhost**

```bash
npm run dev
```

Open http://localhost:5173 — the dashboard should now show a "My Borrowers" section with an empty state and "+ Add Borrower" button. Click the button to confirm the BorrowerForm modal opens. Add a test borrower and confirm the tile appears.

*(The tile click will 404 until LoanPage is built in Task 10 — that's expected.)*

---

## Task 9: `LoanPage` Skeleton

**Files:**
- Create: `src/pages/LoanPage.jsx`

- [ ] **Step 1: Create the skeleton**

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { useBorrowers } from '../hooks/useBorrowers.js'
import { useLoans } from '../hooks/useLoans.js'
import Navbar from '../components/layout/Navbar.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function LoanPage() {
  const { borrowerId } = useParams()
  const navigate = useNavigate()
  const { data: borrowers = [] } = useBorrowers()
  const { data: loans = [], isLoading } = useLoans(borrowerId)
  const { toasts, toast } = useToast()

  const borrower = borrowers.find((b) => b.id === borrowerId)

  if (borrowers.length > 0 && !borrower) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Borrower not found.</p>
          <button onClick={() => navigate('/')} className="text-blue-400 hover:underline">
            ← Go back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!borrower) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:underline text-sm mb-4 block"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {borrower.full_name}
        </h1>
        <p className="text-gray-500 text-sm mb-6">{borrower.phone} · {borrower.email}</p>

        {isLoading && (
          <p className="text-gray-500 text-center py-10">Loading loans…</p>
        )}
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
```

- [ ] **Step 2: Test navigation**

```bash
npm run dev
```

Click a BorrowerTile on the dashboard. LoanPage should load with the borrower's name and contact info. No loans are shown yet — that's expected.

---

## Task 10: `LoanTable` Component

**Files:**
- Create: `src/components/borrowers/LoanTable.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState } from 'react'
import { getLoanTotalPaid, getLoanRemaining, isLoanOverdue } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'

const STATUS_STYLES = {
  active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  defaulted: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

export default function LoanTable({ loans, onPay }) {
  const [archiveConfirm, setArchiveConfirm] = useState(null)

  if (loans.length === 0) {
    return (
      <p className="text-gray-400 text-center py-10 text-sm">
        No loans yet. Click "+ Add Loan" to get started.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">Description</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Paid</th>
            <th className="px-4 py-3 text-right">Remaining</th>
            <th className="px-4 py-3 text-left">Next Payment</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {loans.map((loan) => {
            const totalPaid = getLoanTotalPaid(loan.loan_payments)
            const remaining = getLoanRemaining(loan.amount, totalPaid)
            const overdue = isLoanOverdue(loan, totalPaid)
            const statusKey = overdue ? 'overdue' : loan.status
            const statusLabel = overdue ? 'Overdue' : loan.status.charAt(0).toUpperCase() + loan.status.slice(1)
            const pct = loan.amount > 0 ? Math.min((totalPaid / loan.amount) * 100, 100) : 0

            return (
              <tr key={loan.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {loan.description || '—'}
                    </p>
                    {loan.notarized && (
                      <p className="text-gray-400 text-xs mt-0.5">Notarized</p>
                    )}
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-700 rounded-full w-32">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {loan.loan_date}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {formatPeso(loan.amount)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {formatPeso(totalPaid)}
                </td>
                <td className="px-4 py-3 text-right text-red-500 dark:text-red-400 whitespace-nowrap">
                  {formatPeso(remaining)}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {loan.next_payment_date || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[statusKey]}`}>
                    {statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {loan.status !== 'completed' && loan.status !== 'defaulted' && (
                    <button
                      onClick={() => onPay(loan)}
                      className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium"
                    >
                      Pay
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify no import errors**

```bash
npm run dev
```

Expected: dev server starts, no console errors (component not yet rendered)

---

## Task 11: `LoanForm` Modal

**Files:**
- Create: `src/components/borrowers/LoanForm.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanSchema } from '../../lib/zod-schemas.js'
import { useAddLoan } from '../../hooks/useLoans.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

const today = new Date().toISOString().slice(0, 10)

export default function LoanForm({ borrowerId, onClose, onSuccess }) {
  const addLoan = useAddLoan()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      amount: '',
      loan_date: today,
      description: '',
      payment_frequency: 'one-time',
      payment_day: null,
      next_payment_date: '',
      notarized: false,
      lawyer_name: '',
      ptr_number: '',
      date_notarized: '',
    },
  })

  const frequency = watch('payment_frequency')
  const notarized = watch('notarized')

  async function onSubmit(values) {
    try {
      const loanData = {
        ...values,
        payment_day: frequency === 'monthly' ? values.payment_day : null,
        next_payment_date: values.next_payment_date || null,
        lawyer_name: values.notarized ? values.lawyer_name : null,
        ptr_number: values.notarized ? values.ptr_number : null,
        date_notarized: values.notarized ? values.date_notarized : null,
      }
      await addLoan.mutateAsync({ borrowerId, loanData })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Add Loan</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Loan Amount (PHP)
          </label>
          <input
            {...register('amount')}
            type="number"
            step="0.01"
            placeholder="5000.00"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        {/* Loan Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Loan Date
          </label>
          <input
            {...register('loan_date')}
            type="date"
            max={today}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.loan_date && <p className="text-red-500 text-xs mt-1">{errors.loan_date.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <input
            {...register('description')}
            placeholder="e.g. Cash loan, iPhone 15"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Payment Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Frequency
          </label>
          <select
            {...register('payment_frequency')}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="one-time">One-time</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Payment Day (monthly only) */}
        {frequency === 'monthly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Day
            </label>
            <select
              {...register('payment_day')}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select day</option>
              <option value={15}>15th</option>
              <option value={30}>30th</option>
            </select>
            {errors.payment_day && <p className="text-red-500 text-xs mt-1">{errors.payment_day.message}</p>}
          </div>
        )}

        {/* Next Payment Date (weekly or monthly) */}
        {frequency !== 'one-time' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Payment Date
            </label>
            <input
              {...register('next_payment_date')}
              type="date"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Notarized toggle */}
        <div className="flex items-center gap-2">
          <input
            {...register('notarized')}
            type="checkbox"
            id="notarized"
            className="h-4 w-4 rounded border-gray-300 text-blue-500"
          />
          <label htmlFor="notarized" className="text-sm text-gray-700 dark:text-gray-300">
            This loan is notarized
          </label>
        </div>

        {/* Notarization fields */}
        {notarized && (
          <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            {[
              { name: 'lawyer_name', label: 'Lawyer Name', placeholder: 'Atty. Juan dela Cruz' },
              { name: 'ptr_number', label: 'PTR Number', placeholder: 'PTR-12345' },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {label}
                </label>
                <input
                  {...register(name)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>}
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Notarized
              </label>
              <input
                {...register('date_notarized')}
                type="date"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {addLoan.error && (
          <p className="text-red-500 text-sm">{addLoan.error.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={addLoan.isPending} className="flex-1">
            {addLoan.isPending ? 'Saving…' : 'Add Loan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify no import errors**

```bash
npm run dev
```

Expected: dev server starts, no console errors

---

## Task 12: `LoanPaymentModal`

**Files:**
- Create: `src/components/borrowers/LoanPaymentModal.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanPaymentSchema } from '../../lib/zod-schemas.js'
import { useRecordLoanPayment } from '../../hooks/useLoans.js'
import { getLoanTotalPaid, getLoanRemaining } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

export default function LoanPaymentModal({ loan, onClose, onSuccess }) {
  const recordPayment = useRecordLoanPayment()
  const totalPaid = getLoanTotalPaid(loan.loan_payments)
  const remaining = getLoanRemaining(loan.amount, totalPaid)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanPaymentSchema),
    defaultValues: { amount: '', notes: '' },
  })

  async function onSubmit(values) {
    if (values.amount > remaining) return
    try {
      await recordPayment.mutateAsync({
        loan,
        paymentAmount: values.amount,
        notes: values.notes || null,
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Record Payment</h2>
      <p className="text-gray-400 text-sm mb-5">
        {loan.description || 'Loan'} · Remaining: {formatPeso(remaining)}
      </p>

      {/* Payment history */}
      {loan.loan_payments.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Payment History</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {[...loan.loan_payments]
              .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
              .map((p) => (
                <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-900">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{formatPeso(p.amount)}</p>
                    {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(p.paid_at).toLocaleDateString('en-PH')}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Amount (PHP)
          </label>
          <input
            {...register('amount')}
            type="number"
            step="0.01"
            max={remaining}
            placeholder={`Max ${formatPeso(remaining)}`}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (optional)
          </label>
          <input
            {...register('notes')}
            placeholder="e.g. Cash, GCash"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {recordPayment.error && (
          <p className="text-red-500 text-sm">{recordPayment.error.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={recordPayment.isPending || remaining <= 0} className="flex-1">
            {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify no import errors**

```bash
npm run dev
```

Expected: dev server starts, no console errors

---

## Task 13: Complete `LoanPage`

**Files:**
- Modify: `src/pages/LoanPage.jsx`

- [ ] **Step 1: Replace the skeleton with the full LoanPage**

Replace the entire contents of `src/pages/LoanPage.jsx`:

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBorrowers } from '../hooks/useBorrowers.js'
import { useLoans } from '../hooks/useLoans.js'
import { getLoanInitials, getLoanTotalPaid, getLoanRemaining } from '../utils/loans.js'
import { formatPeso, addMoney } from '../utils/money.js'
import Navbar from '../components/layout/Navbar.jsx'
import LoanTable from '../components/borrowers/LoanTable.jsx'
import LoanForm from '../components/borrowers/LoanForm.jsx'
import LoanPaymentModal from '../components/borrowers/LoanPaymentModal.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'
import { getLoanInitials as getInitials } from '../utils/loans.js'

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
]
function pickColor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function LoanPage() {
  const { borrowerId } = useParams()
  const navigate = useNavigate()
  const { data: borrowers = [] } = useBorrowers()
  const { data: loans = [], isLoading } = useLoans(borrowerId)
  const { toasts, toast } = useToast()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [payingLoan, setPayingLoan] = useState(null)

  const borrower = borrowers.find((b) => b.id === borrowerId)

  if (borrowers.length > 0 && !borrower) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Borrower not found.</p>
          <button onClick={() => navigate('/')} className="text-blue-400 hover:underline">
            ← Go back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!borrower) return null

  const totalLoaned = loans.reduce((sum, l) => addMoney(sum, l.amount), 0)
  const totalPaid = loans.reduce((sum, l) => addMoney(sum, getLoanTotalPaid(l.loan_payments)), 0)
  const outstanding = loans.reduce(
    (sum, l) => addMoney(sum, getLoanRemaining(l.amount, getLoanTotalPaid(l.loan_payments))),
    0
  )

  const initials = getLoanInitials(borrower.full_name)
  const avatarColor = pickColor(borrower.full_name)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      {/* Summary header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className={`${avatarColor} w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0`}
          >
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{borrower.full_name}</h1>
            <p className="text-gray-400 text-sm">{borrower.phone} · {borrower.email}</p>
            {borrower.address && (
              <p className="text-gray-400 text-xs mt-0.5">{borrower.address}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-6 text-center sm:text-right">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Total Loaned</p>
              <p className="text-gray-900 dark:text-white font-semibold">{formatPeso(totalLoaned)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Total Paid</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatPeso(totalPaid)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Outstanding</p>
              <p className="text-red-500 dark:text-red-400 font-semibold">{formatPeso(outstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:underline text-sm mb-6 block"
        >
          ← Back to Dashboard
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Loans ({loans.length})
          </h2>
          <Button onClick={() => setShowAddLoan(true)}>+ Add Loan</Button>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading loans…</p>
        ) : (
          <LoanTable loans={loans} onPay={setPayingLoan} />
        )}
      </main>

      {showAddLoan && (
        <LoanForm
          borrowerId={borrowerId}
          onClose={() => setShowAddLoan(false)}
          onSuccess={() => toast('Loan added!', 'success')}
        />
      )}

      {payingLoan && (
        <LoanPaymentModal
          loan={payingLoan}
          onClose={() => setPayingLoan(null)}
          onSuccess={() => {
            setPayingLoan(null)
            toast('Payment recorded!', 'success')
          }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
```

- [ ] **Step 2: Full end-to-end test on localhost**

```bash
npm run dev
```

Run through the entire golden path:

1. Dashboard loads → "My Borrowers" section is visible
2. Click "+ Add Borrower" → modal opens, fill in all fields, submit → tile appears
3. BorrowerTile shows initials avatar, summary zeros (no loans yet)
4. Click the tile → navigates to LoanPage with borrower header
5. Click "+ Add Loan" → LoanForm opens; test one-time, weekly, monthly frequencies
6. Add a loan → it appears in LoanTable with correct amount and "Active" status
7. Click "Pay" → LoanPaymentModal opens with correct remaining balance shown
8. Record a partial payment → modal closes, LoanTable updates (remaining decreases, payment history shows in modal next time)
9. Record a full payment → loan status changes to "Completed"
10. Go back to dashboard → BorrowerTile totals update correctly
11. Verify overdue: manually edit a loan's `next_payment_date` in Supabase to a past date → reload → tile shows "Overdue" badge, table shows "Overdue" status

---

## Spec Coverage Check

| Spec Requirement | Covered By |
|---|---|
| Borrower fields (name, address, phone, email) | Task 3 (schema), Task 7 (BorrowerForm) |
| Multiple loans per borrower | Task 5 (useLoans), Task 13 (LoanPage) |
| Borrower summary (total loaned/paid/outstanding) | Task 6 (BorrowerTile), Task 13 (LoanPage header) |
| Loan amount + date | Task 3 (loanSchema), Task 11 (LoanForm) |
| Loan description | Task 3, Task 11 |
| Payment frequency: one-time/weekly/monthly | Task 2 (advanceNextPaymentDate), Task 3, Task 11 |
| Monthly payment day (15 or 30) | Task 2, Task 3, Task 11 |
| Next payment date auto-advances | Task 5 (useRecordLoanPayment) |
| Notarization fields | Task 3, Task 11 |
| Loan status: active/completed/overdue/defaulted | Task 2 (isLoanOverdue), Task 10 (LoanTable) |
| Progress bar per loan | Task 10 (LoanTable) |
| Progress bar per borrower | Task 6 (BorrowerTile) |
| Payment ledger (partial payments, history) | Task 5, Task 12 (LoanPaymentModal) |
| Remaining balance auto-calculated | Task 2 (getLoanRemaining), Task 5, Task 10 |
| Overdue: computed on frontend | Task 2 (isLoanOverdue), Task 6, Task 10 |
| Initials avatar (no image) | Task 6 (BorrowerTile) |
| Dashboard integration ("My Borrowers" section) | Task 8 (DashboardPage) |
| Archive only (no hard deletes) | Tasks 4, 5 use `is_archived = false` filter; SQL uses no cascade delete from RLS |
| No interest calculation (raw loan only) | *(out of scope — not implemented)* |
| No borrower login/sharing | *(out of scope — not implemented)* |
