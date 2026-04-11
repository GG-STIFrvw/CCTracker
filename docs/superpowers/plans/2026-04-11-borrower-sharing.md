# Borrower Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Share button to the LoanPage that lets the owner share a specific borrower's loan data (read-only) with another user by email, with a dedicated "Shared Borrowers" page for recipients.

**Architecture:** New `borrower_shares` table (separate from the existing `shares` table for cards) with denormalized borrower name/phone/email for viewer access without cross-table RLS complexity. Viewer RLS policies added to `loans` and `loan_payments`. Mirrors the card sharing flow end-to-end.

**Tech Stack:** React 18, Vite, Tailwind CSS, React Query, Supabase (Postgres + RLS + RPC), React Router v6

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| SQL (manual) | Supabase SQL Editor | Create `borrower_shares` table, RLS, viewer RLS on loans/loan_payments, RPC |
| Create | `src/hooks/useBorrowerShares.js` | All 8 hooks for borrower share lifecycle |
| Create | `src/components/borrowers/BorrowerShareModal.jsx` | Owner: manage shares for one borrower, invite by email |
| Modify | `src/components/borrowers/BorrowerTile.jsx` | Add `readOnly` prop — changes nav URL, hides Edit button |
| Modify | `src/components/borrowers/LoanTable.jsx` | Add `readOnly` prop — hides Pay button |
| Modify | `src/pages/LoanPage.jsx` | Add Share button, read-only mode (banner, hide controls, viewer borrower data) |
| Create | `src/pages/SharedBorrowersPage.jsx` | Viewer: pending invites + shared borrower tiles |
| Modify | `src/components/layout/Navbar.jsx` | Add "Shared Borrowers" link + pending badge |
| Modify | `src/App.jsx` | Add `/shared-borrowers` route, call claim_pending_borrower_shares RPC on login |

---

## Task 1: SQL Migration

**Run in Supabase Dashboard → SQL Editor.**

- [ ] **Step 1: Run this SQL**

```sql
-- borrower_shares table
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
alter table borrower_shares enable row level security;

-- Owner: full control over their outgoing shares
create policy "Owner manages borrower shares" on borrower_shares
  for all using (auth.uid() = owner_id);

-- Viewer: can read shares where they are the recipient (by email or by id)
create policy "Viewer reads borrower shares" on borrower_shares
  for select using (
    viewer_id = auth.uid()
    or viewer_email = (select email from auth.users where id = auth.uid())
  );

-- Viewer: can update status (accept/decline)
create policy "Viewer updates borrower shares" on borrower_shares
  for update using (viewer_id = auth.uid());

-- Viewer RLS: allow reading loans for shared borrowers
create policy "Viewer reads shared loans" on loans
  for select using (
    exists (
      select 1 from borrower_shares
      where borrower_id = loans.borrower_id
        and viewer_id = auth.uid()
        and status = 'active'
    )
  );

-- Viewer RLS: allow reading loan_payments for shared borrowers
create policy "Viewer reads shared loan_payments" on loan_payments
  for select using (
    exists (
      select 1 from loans l
      join borrower_shares bs on bs.borrower_id = l.borrower_id
      where l.id = loan_payments.loan_id
        and bs.viewer_id = auth.uid()
        and bs.status = 'active'
    )
  );

-- RPC: claim pending borrower shares on login (mirrors claim_pending_shares)
create or replace function claim_pending_borrower_shares()
returns void language plpgsql security definer as $$
declare
  _user_email text;
  _user_id uuid;
begin
  select id, email into _user_id, _user_email
  from auth.users where id = auth.uid();

  update borrower_shares
  set viewer_id = _user_id, status = 'pending'
  where viewer_email = _user_email
    and status = 'unclaimed';
end;
$$;
```

- [ ] **Step 2: Verify in Supabase Table Editor**

Confirm `borrower_shares` table exists with all columns. Confirm RLS is enabled on it.

---

## Task 2: `useBorrowerShares` Hook

**Files:**
- Create: `src/hooks/useBorrowerShares.js`

- [ ] **Step 1: Create the file**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import useAppStore from '../store/useAppStore.js'

// Owner: all non-declined shares for a specific borrower
export function useMyBorrowerShares(borrowerId) {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['my-borrower-shares', borrowerId],
    enabled: !!user && !!borrowerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrower_shares')
        .select('*')
        .eq('owner_id', user.id)
        .eq('borrower_id', borrowerId)
        .neq('status', 'declined')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// Owner: create a share + send email notification (non-blocking)
export function useCreateBorrowerShare() {
  const qc = useQueryClient()
  const user = useAppStore((s) => s.user)
  return useMutation({
    mutationFn: async ({ viewerEmail, borrower }) => {
      const { data, error } = await supabase
        .from('borrower_shares')
        .insert({
          owner_id: user.id,
          owner_email: user.email,
          viewer_email: viewerEmail,
          borrower_id: borrower.id,
          borrower_name: borrower.full_name,
          borrower_phone: borrower.phone,
          borrower_email: borrower.email,
          status: 'unclaimed',
        })
        .select()
        .single()
      if (error) throw error

      // Non-blocking email notification
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: viewerEmail,
          subject: `${user.email} shared borrower loan data with you on CC Tracker`,
          html: `
            <p><strong>${user.email}</strong> has shared loan data for <strong>${borrower.full_name}</strong> with you on CC Tracker.</p>
            <p><a href="${window.location.origin}/auth">Sign in or create a free account</a> to view it.</p>
            <p>Once signed in, the invite will appear under <strong>"Shared Borrowers"</strong>.</p>
          `,
        }),
      }).catch(() => {})

      return data
    },
    onSuccess: (_data, { borrower }) =>
      qc.invalidateQueries({ queryKey: ['my-borrower-shares', borrower.id] }),
  })
}

// Owner: revoke a share (hard delete)
export function useRevokeBorrowerShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shareId, borrowerId }) => {
      const { error } = await supabase
        .from('borrower_shares')
        .delete()
        .eq('id', shareId)
      if (error) throw error
      return { borrowerId }
    },
    onSuccess: (_data, { borrowerId }) =>
      qc.invalidateQueries({ queryKey: ['my-borrower-shares', borrowerId] }),
  })
}

// Viewer: all active shares where viewer_id = current user
export function useSharedBorrowersWithMe() {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['shared-borrowers-with-me'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrower_shares')
        .select('*')
        .eq('viewer_id', user.id)
        .eq('status', 'active')
      if (error) throw error
      return data
    },
  })
}

// Viewer: pending/unclaimed invites (for badge + accept/decline page)
export function usePendingBorrowerInvites() {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['pending-borrower-invites'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrower_shares')
        .select('*')
        .in('status', ['unclaimed', 'pending'])
      if (error) throw error
      return data
    },
  })
}

// Viewer: accept a pending invite
export function useAcceptBorrowerShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shareId) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('borrower_shares')
        .update({ status: 'active', viewer_id: user.id })
        .eq('id', shareId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-borrower-invites'] })
      qc.invalidateQueries({ queryKey: ['shared-borrowers-with-me'] })
    },
  })
}

// Viewer: decline a pending invite
export function useDeclineBorrowerShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shareId) => {
      const { error } = await supabase
        .from('borrower_shares')
        .update({ status: 'declined' })
        .eq('id', shareId)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['pending-borrower-invites'] }),
  })
}

// Viewer: get borrower info for a specific shared borrower (for read-only LoanPage)
export function useSharedBorrowerInfo(borrowerId, { enabled = true } = {}) {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['shared-borrower-info', borrowerId],
    enabled: enabled && !!borrowerId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrower_shares')
        .select('borrower_id, borrower_name, borrower_phone, borrower_email')
        .eq('borrower_id', borrowerId)
        .eq('viewer_id', user.id)
        .eq('status', 'active')
        .single()
      if (error) throw error
      return data
    },
  })
}
```

- [ ] **Step 2: Verify no build errors**

```bash
npm run dev
```

Expected: "ready in" with no console errors (file not used yet — that's fine)

---

## Task 3: `BorrowerShareModal` Component

**Files:**
- Create: `src/components/borrowers/BorrowerShareModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import {
  useMyBorrowerShares,
  useCreateBorrowerShare,
  useRevokeBorrowerShare,
} from '../../hooks/useBorrowerShares.js'
import useAppStore from '../../store/useAppStore.js'

export default function BorrowerShareModal({ borrower, onClose }) {
  const user = useAppStore((s) => s.user)
  const { data: shares = [] } = useMyBorrowerShares(borrower.id)
  const createShare = useCreateBorrowerShare()
  const revokeShare = useRevokeBorrowerShare()

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleSend() {
    setEmailError('')
    setSuccessMsg('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter a valid email address')
      return
    }
    if (trimmed === user.email.toLowerCase()) {
      setEmailError('You cannot invite yourself')
      return
    }
    const alreadyShared = shares.some(
      (s) => s.viewer_email.toLowerCase() === trimmed && s.status !== 'declined'
    )
    if (alreadyShared) {
      setEmailError('An active invite already exists for this email')
      return
    }
    try {
      await createShare.mutateAsync({ viewerEmail: trimmed, borrower })
      setEmail('')
      setSuccessMsg(`Invite sent to ${trimmed}`)
    } catch (err) {
      setEmailError(err.message)
    }
  }

  return (
    <Modal title={`Share — ${borrower.full_name}`} onClose={onClose}>
      {/* Active shares */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Active Shares
        </p>
        {shares.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No active shares yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {shares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {share.viewer_email}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      share.status === 'active'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}
                  >
                    {share.status}
                  </p>
                </div>
                <button
                  onClick={() =>
                    revokeShare.mutate({ shareId: share.id, borrowerId: borrower.id })
                  }
                  disabled={revokeShare.isPending}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite form */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Invite Someone
        </p>
        <div>
          <input
            type="email"
            placeholder="viewer@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError('')
              setSuccessMsg('')
            }}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {emailError && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{emailError}</p>
          )}
          {successMsg && (
            <p className="text-green-600 dark:text-green-400 text-xs mt-1">{successMsg}</p>
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={createShare.isPending}
          className="w-full justify-center"
        >
          {createShare.isPending ? 'Sending…' : 'Send Invite'}
        </Button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify no build errors**

```bash
npm run dev
```

Expected: "ready in" with no errors

---

## Task 4: BorrowerTile + LoanTable `readOnly` Support

**Files:**
- Modify: `src/components/borrowers/BorrowerTile.jsx`
- Modify: `src/components/borrowers/LoanTable.jsx`

- [ ] **Step 1: Read both files**

Read `src/components/borrowers/BorrowerTile.jsx` and `src/components/borrowers/LoanTable.jsx` to understand current content before editing.

- [ ] **Step 2: Add `readOnly` prop to `BorrowerTile`**

Change the component signature from:
```jsx
export default function BorrowerTile({ borrower, onEdit }) {
```
to:
```jsx
export default function BorrowerTile({ borrower, onEdit, readOnly = false }) {
```

Change the navigation onClick from:
```jsx
onClick={() => navigate(`/borrower/${borrower.id}`)}
```
to:
```jsx
onClick={() => navigate(`/borrower/${borrower.id}${readOnly ? '?readOnly=true' : ''}`)}
```

Change the Edit button block from:
```jsx
<button
  onClick={(e) => {
    e.stopPropagation()
    onEdit(borrower)
  }}
  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
>
  Edit
</button>
```
to:
```jsx
{!readOnly && (
  <button
    onClick={(e) => {
      e.stopPropagation()
      onEdit(borrower)
    }}
    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
  >
    Edit
  </button>
)}
```

- [ ] **Step 3: Add `readOnly` prop to `LoanTable`**

Change the component signature from:
```jsx
export default function LoanTable({ loans, onPay }) {
```
to:
```jsx
export default function LoanTable({ loans, onPay, readOnly = false }) {
```

Change the Pay button cell from:
```jsx
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
```
to:
```jsx
<td className="px-4 py-3">
  {!readOnly && loan.status !== 'completed' && loan.status !== 'defaulted' && (
    <button
      onClick={() => onPay(loan)}
      className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium"
    >
      Pay
    </button>
  )}
</td>
```

- [ ] **Step 4: Verify no build errors**

```bash
npm run dev
```

Expected: "ready in" with no errors

---

## Task 5: LoanPage Modifications

**Files:**
- Modify: `src/pages/LoanPage.jsx`

- [ ] **Step 1: Read the current file**

Read `src/pages/LoanPage.jsx` to understand the current full content before editing.

- [ ] **Step 2: Replace the entire file with the updated version**

```jsx
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useBorrowers } from '../hooks/useBorrowers.js'
import { useLoans } from '../hooks/useLoans.js'
import { useSharedBorrowerInfo } from '../hooks/useBorrowerShares.js'
import { getLoanInitials, getLoanTotalPaid, getLoanRemaining } from '../utils/loans.js'
import { formatPeso, addMoney } from '../utils/money.js'
import Navbar from '../components/layout/Navbar.jsx'
import LoanTable from '../components/borrowers/LoanTable.jsx'
import LoanForm from '../components/borrowers/LoanForm.jsx'
import LoanPaymentModal from '../components/borrowers/LoanPaymentModal.jsx'
import BorrowerShareModal from '../components/borrowers/BorrowerShareModal.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'

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
  const [searchParams] = useSearchParams()
  const readOnly = searchParams.get('readOnly') === 'true'

  const { data: borrowers = [] } = useBorrowers()
  const { data: loans = [], isLoading } = useLoans(borrowerId)
  const { data: sharedInfo } = useSharedBorrowerInfo(borrowerId, { enabled: readOnly })
  const { toasts, toast } = useToast()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [payingLoan, setPayingLoan] = useState(null)
  const [showShare, setShowShare] = useState(false)

  // Owner mode: find borrower from owned list
  // Read-only mode: construct borrower object from denormalized share data
  let borrower = null
  if (readOnly) {
    if (sharedInfo) {
      borrower = {
        id: sharedInfo.borrower_id,
        full_name: sharedInfo.borrower_name,
        phone: sharedInfo.borrower_phone,
        email: sharedInfo.borrower_email,
        address: null,
      }
    }
  } else {
    borrower = borrowers.find((b) => b.id === borrowerId)
  }

  // Not-found guard (owner mode only — viewer uses sharedInfo path)
  if (!readOnly && borrowers.length > 0 && !borrower) {
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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {borrower.full_name}
              </h1>
              {!readOnly && (
                <button
                  onClick={() => setShowShare(true)}
                  className="text-xs text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded-lg transition-colors"
                >
                  Share
                </button>
              )}
            </div>
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
          onClick={() => navigate(readOnly ? '/shared-borrowers' : '/')}
          className="text-blue-400 hover:underline text-sm mb-6 block"
        >
          ← Back to {readOnly ? 'Shared Borrowers' : 'Dashboard'}
        </button>

        {/* Read-only banner */}
        {readOnly && (
          <div className="mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-700 dark:text-blue-300 text-sm">
            Viewing shared borrower — read only
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Loans ({loans.length})
          </h2>
          {!readOnly && (
            <Button onClick={() => setShowAddLoan(true)}>+ Add Loan</Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading loans…</p>
        ) : (
          <LoanTable loans={loans} onPay={setPayingLoan} readOnly={readOnly} />
        )}
      </main>

      {showShare && (
        <BorrowerShareModal
          borrower={borrower}
          onClose={() => setShowShare(false)}
        />
      )}

      {!readOnly && showAddLoan && (
        <LoanForm
          borrowerId={borrowerId}
          onClose={() => setShowAddLoan(false)}
          onSuccess={() => toast('Loan added!', 'success')}
        />
      )}

      {!readOnly && payingLoan && (
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

- [ ] **Step 3: Verify no build errors**

```bash
npm run dev
```

Expected: "ready in" with no errors

---

## Task 6: `SharedBorrowersPage`

**Files:**
- Create: `src/pages/SharedBorrowersPage.jsx`

- [ ] **Step 1: Create the file**

```jsx
import Navbar from '../components/layout/Navbar.jsx'
import BorrowerTile from '../components/borrowers/BorrowerTile.jsx'
import {
  useSharedBorrowersWithMe,
  usePendingBorrowerInvites,
  useAcceptBorrowerShare,
  useDeclineBorrowerShare,
} from '../hooks/useBorrowerShares.js'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function SharedBorrowersPage() {
  const { data: activeShares = [] } = useSharedBorrowersWithMe()
  const { data: pendingInvites = [] } = usePendingBorrowerInvites()
  const acceptShare = useAcceptBorrowerShare()
  const declineShare = useDeclineBorrowerShare()
  const { toasts, toast } = useToast()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Shared Borrowers
        </h1>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Pending invites ({pendingInvites.length})
            </h2>
            <div className="flex flex-col gap-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-gray-900 dark:text-white text-sm font-medium">
                      {invite.owner_email}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                      Wants to share <strong>{invite.borrower_name}</strong>'s loan data with you
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => declineShare.mutate(invite.id)}
                      disabled={declineShare.isPending}
                      className="text-xs text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg"
                    >
                      Decline
                    </button>
                    <button
                      onClick={async () => {
                        await acceptShare.mutateAsync(invite.id)
                        toast('Invite accepted!', 'success')
                      }}
                      disabled={acceptShare.isPending}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared borrowers grid */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Borrowers shared with me
          </h2>
          {activeShares.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
              <div className="text-4xl mb-3">🤝</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No borrowers shared with you yet.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                When someone shares a borrower with you, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeShares.map((share) => {
                const pseudoBorrower = {
                  id: share.borrower_id,
                  full_name: share.borrower_name,
                  phone: share.borrower_phone,
                  email: share.borrower_email,
                }
                return (
                  <BorrowerTile
                    key={share.id}
                    borrower={pseudoBorrower}
                    readOnly
                    onEdit={() => {}}
                  />
                )
              })}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
```

- [ ] **Step 2: Verify no build errors**

```bash
npm run dev
```

Expected: "ready in" with no errors

---

## Task 7: Navbar + App.jsx + Route

**Files:**
- Modify: `src/components/layout/Navbar.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Read both files**

Read `src/components/layout/Navbar.jsx` and `src/App.jsx` to understand current content.

- [ ] **Step 2: Update Navbar**

Add this import after the existing imports:
```js
import { usePendingBorrowerInvites } from '../../hooks/useBorrowerShares.js'
```

Inside the component, add after the existing `usePendingInvites` line:
```js
const { data: pendingBorrowerInvites = [] } = usePendingBorrowerInvites()
```

Add this button after the existing "Shared" button (the one that navigates to `/shared`):
```jsx
{user && (
  <button
    onClick={() => navigate('/shared-borrowers')}
    className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
      location.pathname === '/shared-borrowers'
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    Borrowers
    {pendingBorrowerInvites.length > 0 && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
        {pendingBorrowerInvites.length}
      </span>
    )}
  </button>
)}
```

- [ ] **Step 3: Update App.jsx**

Add this import with the other page imports:
```js
import SharedBorrowersPage from './pages/SharedBorrowersPage.jsx'
```

Add this route inside `<Routes>` after the `/shared` route:
```jsx
<Route
  path="/shared-borrowers"
  element={
    <ProtectedRoute>
      <SharedBorrowersPage />
    </ProtectedRoute>
  }
/>
```

In the `onAuthStateChange` handler, find the block that calls `claim_pending_shares` and add the borrower shares RPC call right after it:

```js
// Find this existing block:
supabase.rpc('claim_pending_shares')
  .then(() => queryClient.invalidateQueries({ queryKey: ['pending-invites'] }))
  .catch(() => {})

// Add this immediately after:
supabase.rpc('claim_pending_borrower_shares')
  .then(() => queryClient.invalidateQueries({ queryKey: ['pending-borrower-invites'] }))
  .catch(() => {})
```

- [ ] **Step 4: Verify no build errors**

```bash
npm run dev
```

Expected: "ready in" with no errors

- [ ] **Step 5: End-to-end test on localhost**

Open http://localhost:5173 and walk through the full golden path:

**As owner (Account A):**
1. Dashboard → "My Borrowers" — click a borrower tile
2. LoanPage opens — confirm "Share" button appears next to borrower name
3. Click "Share" → BorrowerShareModal opens with title "Share — [Name]"
4. "Active Shares" shows empty state
5. Enter a valid email (Account B's email) → click "Send Invite"
6. Success message appears, share listed in "Active Shares" as "unclaimed"

**As viewer (Account B, different browser or incognito):**
7. Log in to CC Tracker
8. Navbar shows "Borrowers" link with a red badge (pending invite count)
9. Click "Borrowers" → SharedBorrowersPage shows pending invite from Account A
10. Click "Accept" → invite disappears from pending, borrower tile appears in grid
11. Badge disappears from Navbar
12. Click the borrower tile → LoanPage opens with "Viewing shared borrower — read only" banner
13. Loans are visible, "Pay" button is absent, "+ Add Loan" button is absent, "Share" button is absent
14. Back button says "← Back to Shared Borrowers"

**As owner (Account A) — revoke:**
15. Open BorrowerShareModal → share now shows "active" status
16. Click "Revoke" → share disappears from list
17. Account B's SharedBorrowersPage no longer shows this borrower

---

## Spec Coverage Check

| Requirement | Covered by |
|-------------|------------|
| Share button on LoanPage | Task 5 (LoanPage) |
| Share one specific borrower only | Task 3 (BorrowerShareModal — borrowerId scoped) |
| Invite by email | Task 3 (BorrowerShareModal) |
| Email notification (non-blocking) | Task 2 (useCreateBorrowerShare) |
| Active/pending shares list with revoke | Task 3 (BorrowerShareModal) |
| Viewer read-only mode (no Pay, no Add Loan, no Share button) | Task 4 (LoanTable readOnly), Task 5 (LoanPage) |
| Read-only banner | Task 5 (LoanPage) |
| Separate "Shared Borrowers" page | Task 6 (SharedBorrowersPage) |
| Pending invites with Accept/Decline | Task 6 (SharedBorrowersPage) |
| Shared borrower tiles (read-only) | Task 6 + Task 4 (BorrowerTile readOnly) |
| Navbar "Shared Borrowers" link | Task 7 (Navbar) |
| Pending badge on Navbar | Task 7 (Navbar) |
| claim_pending_borrower_shares on login | Task 7 (App.jsx) |
| Viewer reads loans/loan_payments via RLS | Task 1 (SQL) |
| Borrower data available to viewer (denormalized) | Task 1 (SQL columns) + Task 2 (hooks) + Task 5 (LoanPage) |
