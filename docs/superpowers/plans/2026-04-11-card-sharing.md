# Card Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow owners to invite viewers by email to read-only access of selected cards and transactions, with invite/accept/revoke flow and email notification.

**Architecture:** Supabase `shares` table tracks invites with status (`unclaimed → pending → active`). A Supabase RPC auto-claims shares on sign-in by matching email. RLS on `cards` and `transactions` is extended so active-share viewers can SELECT. All viewer-facing UI lives in a separate `/shared` route. Read-only mode on TrackerPage is controlled via `?readOnly=true` URL param.

**Tech Stack:** React 18, Vite, Supabase (PostgreSQL + RLS + RPC), @tanstack/react-query v5, React Router v6, Zustand, Tailwind CSS (dark mode), Express + Nodemailer (existing `/api/notify` endpoint)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| Supabase SQL (manual) | Create | `shares` table, RPC, modified RLS |
| `src/hooks/useShares.js` | Create | All share-related React Query hooks |
| `src/components/sharing/ShareManagerModal.jsx` | Create | Owner's invite + revoke UI |
| `src/pages/SharedWithMePage.jsx` | Create | Viewer's pending invites + shared cards page |
| `src/App.jsx` | Modify | Claim RPC on auth change + `/shared` route |
| `src/pages/DashboardPage.jsx` | Modify | Share button, filter own-only cards |
| `src/components/cards/CardTile.jsx` | Modify | `readOnly` prop (hide Edit, navigate with flag) |
| `src/components/layout/Navbar.jsx` | Modify | "Shared" nav link + pending-invite badge |
| `src/components/tracker/TransactionTable.jsx` | Modify | `readOnly` prop suppresses Pay/Archive columns |
| `src/pages/TrackerPage.jsx` | Modify | Read `?readOnly` param, banner, pass prop down |

---

## Task 1: Supabase Database Migrations

**Files:**
- Manual SQL run in Supabase dashboard → SQL editor

- [ ] **Step 1: Create the `shares` table**

Open **Supabase → SQL Editor** and run:

```sql
CREATE TABLE shares (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES auth.users NOT NULL,
  owner_email  text NOT NULL,
  viewer_email text NOT NULL,
  viewer_id    uuid REFERENCES auth.users,
  card_ids     uuid[] NOT NULL,
  status       text NOT NULL DEFAULT 'unclaimed'
               CHECK (status IN ('unclaimed', 'pending', 'active', 'declined')),
  created_at   timestamptz DEFAULT now()
);

-- Prevent duplicate active/pending invites (allows re-invite after decline)
CREATE UNIQUE INDEX shares_owner_viewer_unique
  ON shares(owner_id, lower(viewer_email))
  WHERE status NOT IN ('declined');
```

- [ ] **Step 2: Enable RLS and add policies on `shares`**

```sql
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Owner can read, create, delete their shares
CREATE POLICY "owner_manage_shares" ON shares
  FOR ALL USING (auth.uid() = owner_id);

-- Viewer can read shares addressed to them (before and after claim)
CREATE POLICY "viewer_read_shares" ON shares
  FOR SELECT USING (
    auth.uid() = viewer_id
    OR lower(viewer_email) = lower((
      SELECT email FROM auth.users WHERE id = auth.uid()
    ))
  );

-- Viewer can update status on their own claimed shares
CREATE POLICY "viewer_update_status" ON shares
  FOR UPDATE USING (auth.uid() = viewer_id)
  WITH CHECK (auth.uid() = viewer_id);
```

- [ ] **Step 3: Create the `claim_pending_shares` RPC**

```sql
CREATE OR REPLACE FUNCTION claim_pending_shares()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE shares
  SET viewer_id = auth.uid(),
      status    = 'pending'
  WHERE lower(viewer_email) = lower((
          SELECT email FROM auth.users WHERE id = auth.uid()
        ))
    AND viewer_id IS NULL
    AND status = 'unclaimed';
END;
$$;
```

- [ ] **Step 4: Extend RLS on `cards` to allow viewers to SELECT shared cards**

Run this to add a viewer SELECT policy. The existing `user_id = auth.uid()` INSERT/UPDATE/DELETE policies are untouched.

```sql
CREATE POLICY "viewer_select_shared_cards" ON cards
  FOR SELECT USING (
    user_id = auth.uid()
    OR id = ANY(
      SELECT unnest(card_ids) FROM shares
      WHERE viewer_id = auth.uid() AND status = 'active'
    )
  );
```

> **Note:** If your existing cards SELECT policy is a single policy covering all operations, split it first:
> `DROP POLICY "<existing_policy_name>" ON cards;`
> Then recreate owner-only policies for INSERT/UPDATE/DELETE, and use the viewer SELECT policy above for SELECT.

- [ ] **Step 5: Extend RLS on `transactions` to allow viewers to SELECT shared transactions**

```sql
CREATE POLICY "viewer_select_shared_transactions" ON transactions
  FOR SELECT USING (
    user_id = auth.uid()
    OR card_id = ANY(
      SELECT unnest(card_ids) FROM shares
      WHERE viewer_id = auth.uid() AND status = 'active'
    )
  );
```

> Same note as Step 4 — split existing all-operations policies if needed.

- [ ] **Step 6: Verify in Supabase table editor**

Open **Supabase → Table Editor → shares**. Confirm the table exists with columns: `id, owner_id, owner_email, viewer_email, viewer_id, card_ids, status, created_at`.

- [ ] **Step 7: Commit checkpoint**

```bash
git add docs/superpowers/plans/2026-04-11-card-sharing.md
git commit -m "chore: add card sharing plan and db migrations doc"
```

---

## Task 2: Share Hooks (`src/hooks/useShares.js`)

**Files:**
- Create: `src/hooks/useShares.js`

- [ ] **Step 1: Create the file with all share hooks**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import useAppStore from '../store/useAppStore.js'

// Owner's outgoing shares (all statuses)
export function useMyShares() {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['my-shares'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

// Viewer: active shares (cards visible)
export function useSharedWithMe() {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['shared-with-me'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('viewer_id', user.id)
        .eq('status', 'active')
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

// Viewer: pending invites (awaiting acceptance)
export function usePendingInvites() {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['pending-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('viewer_id', user.id)
        .eq('status', 'pending')
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

// Owner: create a share + send email notification via /api/notify
export function useCreateShare() {
  const qc = useQueryClient()
  const user = useAppStore((s) => s.user)
  return useMutation({
    mutationFn: async ({ viewerEmail, cardIds }) => {
      const { data, error } = await supabase
        .from('shares')
        .insert({
          owner_id: user.id,
          owner_email: user.email,
          viewer_email: viewerEmail,
          card_ids: cardIds,
          status: 'unclaimed',
        })
        .select()
        .single()
      if (error) throw error

      // Non-blocking email notification — failure does not fail the share
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: viewerEmail,
          subject: `${user.email} shared their credit cards with you on CC Tracker`,
          html: `
            <p><strong>${user.email}</strong> has shared <strong>${cardIds.length} credit card${cardIds.length !== 1 ? 's' : ''}</strong> with you on CC Tracker.</p>
            <p>To view them, <a href="${window.location.origin}/auth">sign in or create a free account</a>.</p>
            <p>You can sign up with your email or continue with Google.</p>
            <p>Once signed in, the invite will appear in your <strong>"Shared with me"</strong> tab.</p>
          `,
        }),
      }).catch(() => {}) // swallow — email is best-effort

      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-shares'] }),
  })
}

// Owner: revoke a share (hard delete)
export function useRevokeShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shareId) => {
      const { error } = await supabase.from('shares').delete().eq('id', shareId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-shares'] }),
  })
}

// Viewer: accept a pending invite
export function useAcceptShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shareId) => {
      const { error } = await supabase
        .from('shares')
        .update({ status: 'active' })
        .eq('id', shareId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-invites'] })
      qc.invalidateQueries({ queryKey: ['shared-with-me'] })
      qc.invalidateQueries({ queryKey: ['cards'] })
    },
  })
}

// Viewer: decline a pending invite
export function useDeclineShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shareId) => {
      const { error } = await supabase
        .from('shares')
        .update({ status: 'declined' })
        .eq('id', shareId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-invites'] }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useShares.js
git commit -m "feat: add useShares hooks (create, revoke, accept, decline)"
```

---

## Task 3: Claim RPC + New Route in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `claim_pending_shares` call and `/shared` route**

Replace the contents of `src/App.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase.js'
import useAppStore from './store/useAppStore.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TrackerPage from './pages/TrackerPage.jsx'
import SharedWithMePage from './pages/SharedWithMePage.jsx'

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
  const [sessionLoaded, setSessionLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setSessionLoaded(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      queryClient.clear()

      // Claim any unclaimed shares addressed to this user's email
      if (session?.user) {
        supabase.rpc('claim_pending_shares').catch(() => {})
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  if (!sessionLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tracker/:cardId"
            element={
              <ProtectedRoute>
                <TrackerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shared"
            element={
              <ProtectedRoute>
                <SharedWithMePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: claim pending shares on sign-in, add /shared route"
```

---

## Task 4: `ShareManagerModal` Component

**Files:**
- Create: `src/components/sharing/ShareManagerModal.jsx`

- [ ] **Step 1: Create the directory and component**

```jsx
import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { useMyShares, useCreateShare, useRevokeShare } from '../../hooks/useShares.js'
import { useCards } from '../../hooks/useCards.js'
import useAppStore from '../../store/useAppStore.js'

export default function ShareManagerModal({ onClose }) {
  const user = useAppStore((s) => s.user)
  const { data: shares = [] } = useMyShares()
  const { data: cards = [] } = useCards()
  const createShare = useCreateShare()
  const revokeShare = useRevokeShare()

  const [email, setEmail] = useState('')
  const [selectedCardIds, setSelectedCardIds] = useState([])
  const [emailError, setEmailError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Only show own cards for sharing (not cards shared with the owner)
  const ownCards = cards.filter((c) => c.user_id === user?.id)

  function toggleCard(cardId) {
    setSelectedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    )
  }

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
    if (selectedCardIds.length === 0) {
      setEmailError('Select at least one card')
      return
    }
    try {
      await createShare.mutateAsync({ viewerEmail: trimmed, cardIds: selectedCardIds })
      setEmail('')
      setSelectedCardIds([])
      setSuccessMsg(`Invite sent to ${trimmed}`)
    } catch (err) {
      if (err.code === '23505') {
        setEmailError('An active invite already exists for this email')
      } else {
        setEmailError(err.message)
      }
    }
  }

  function getCardNames(cardIds) {
    return cardIds
      .map((id) => ownCards.find((c) => c.id === id)?.nickname ?? 'Unknown card')
      .join(', ')
  }

  const activeShares = shares.filter((s) => s.status !== 'declined')

  return (
    <Modal title="Share Cards" onClose={onClose}>
      {/* Existing shares */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Active Shares
        </p>
        {activeShares.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No active shares yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeShares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {share.viewer_email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {getCardNames(share.card_ids)} ·{' '}
                    <span
                      className={
                        share.status === 'active'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      }
                    >
                      {share.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => revokeShare.mutate(share.id)}
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

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Select cards to share:
          </p>
          {ownCards.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              No cards to share yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {ownCards.map((card) => (
                <label
                  key={card.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCardIds.includes(card.id)}
                    onChange={() => toggleCard(card.id)}
                    className="accent-blue-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: card.color_primary }}
                    />
                    {card.nickname}
                    <span className="text-gray-400 dark:text-gray-500 text-xs">
                      · {card.bank_name}
                    </span>
                  </span>
                </label>
              ))}
            </div>
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

- [ ] **Step 2: Commit**

```bash
git add src/components/sharing/ShareManagerModal.jsx
git commit -m "feat: add ShareManagerModal with invite and revoke UI"
```

---

## Task 5: Update `DashboardPage` — Share Button + Own-Cards Filter

**Files:**
- Modify: `src/pages/DashboardPage.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { useState } from 'react'
import Navbar from '../components/layout/Navbar.jsx'
import CardTile from '../components/cards/CardTile.jsx'
import CardForm from '../components/cards/CardForm.jsx'
import ShareManagerModal from '../components/sharing/ShareManagerModal.jsx'
import { useCards } from '../hooks/useCards.js'
import useAppStore from '../store/useAppStore.js'
import Button from '../components/ui/Button.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function DashboardPage() {
  const user = useAppStore((s) => s.user)
  const { data: cards = [], isLoading, error } = useCards()
  const [showAdd, setShowAdd] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const { toasts, toast } = useToast()

  // Only show cards owned by this user on the dashboard
  const ownCards = cards.filter((c) => c.user_id === user?.id)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Cards</h1>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-0.5">
              {ownCards.length} card{ownCards.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowShare(true)}>
              Share
            </Button>
            <Button onClick={() => setShowAdd(true)}>+ Add Card</Button>
          </div>
        </div>

        {isLoading && (
          <div className="text-gray-500 text-center py-20">Loading cards…</div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4 text-red-600 dark:text-red-300 text-sm">
            Failed to load cards: {error.message}
          </div>
        )}

        {!isLoading && !error && ownCards.length === 0 && (
          <div className="text-center py-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
            <div className="text-5xl mb-4">💳</div>
            <p className="text-gray-700 dark:text-gray-300 text-lg font-medium">No cards yet</p>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Add your first credit card to start tracking spending
            </p>
            <Button onClick={() => setShowAdd(true)}>+ Add Your First Card</Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ownCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onEdit={(c) => setEditingCard(c)}
            />
          ))}
        </div>
      </main>

      {showAdd && (
        <CardForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => toast('Card added!', 'success')}
        />
      )}

      {editingCard && (
        <CardForm
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSuccess={() => toast('Card updated!', 'success')}
        />
      )}

      {showShare && <ShareManagerModal onClose={() => setShowShare(false)} />}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/DashboardPage.jsx
git commit -m "feat: add Share button to dashboard, filter own cards only"
```

---

## Task 6: `CardTile` — `readOnly` Prop

**Files:**
- Modify: `src/components/cards/CardTile.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../../hooks/useTransactions.js'
import { getRemainingBalance } from '../../utils/money.js'
import SpendingBar from './SpendingBar.jsx'

function sumOutstanding(transactions = []) {
  return transactions.reduce(
    (acc, t) => acc + getRemainingBalance(t.amount, t.amount_paid),
    0
  )
}

export default function CardTile({ card, onEdit, readOnly = false }) {
  const navigate = useNavigate()
  const { data: transactions = [] } = useTransactions(card.id)
  const spent = sumOutstanding(transactions)

  const gradient = `linear-gradient(135deg, ${card.color_primary}, ${card.color_secondary})`

  function handleClick() {
    const url = `/tracker/${card.id}${readOnly ? '?readOnly=true' : ''}`
    navigate(url)
  }

  return (
    <div
      className="relative rounded-2xl p-5 cursor-pointer shadow-xl hover:scale-[1.02] transition-transform select-none"
      style={{ background: gradient, minHeight: 190 }}
      onClick={handleClick}
    >
      {/* Edit button — hidden in readOnly mode */}
      {!readOnly && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit(card)
          }}
          className="absolute top-3 right-3 bg-black/20 hover:bg-black/40 text-white text-xs px-2 py-1 rounded-lg transition-colors"
        >
          Edit
        </button>
      )}

      {/* Read-only badge */}
      {readOnly && (
        <span className="absolute top-3 right-3 bg-black/20 text-white/70 text-xs px-2 py-1 rounded-lg">
          View only
        </span>
      )}

      {/* Bank + nickname */}
      <div className="mb-5">
        <p className="text-white/60 text-xs uppercase tracking-widest">{card.bank_name}</p>
        <p className="text-white font-semibold text-lg mt-0.5">{card.nickname}</p>
      </div>

      {/* Mock card number */}
      <p className="text-white/50 font-mono text-sm tracking-widest mb-4">
        •••• •••• •••• {card.mock_last4}
      </p>

      {/* Spending bar */}
      <SpendingBar
        spent={spent}
        limit={card.spending_limit}
        colorPrimary={card.color_primary}
      />

      {/* Footer */}
      <div className="flex justify-between items-end mt-3">
        <p className="text-white/60 text-xs uppercase tracking-wide">{card.cardholder_name}</p>
        <p className="text-white/50 text-xs font-mono">{card.expiry_display}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cards/CardTile.jsx
git commit -m "feat: add readOnly prop to CardTile"
```

---

## Task 7: `SharedWithMePage`

**Files:**
- Create: `src/pages/SharedWithMePage.jsx`

- [ ] **Step 1: Create the file**

```jsx
import Navbar from '../components/layout/Navbar.jsx'
import CardTile from '../components/cards/CardTile.jsx'
import {
  useSharedWithMe,
  usePendingInvites,
  useAcceptShare,
  useDeclineShare,
} from '../hooks/useShares.js'
import { useCards } from '../hooks/useCards.js'
import useAppStore from '../store/useAppStore.js'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function SharedWithMePage() {
  const user = useAppStore((s) => s.user)
  const { data: activeShares = [] } = useSharedWithMe()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: allCards = [] } = useCards()
  const acceptShare = useAcceptShare()
  const declineShare = useDeclineShare()
  const { toasts, toast } = useToast()

  // All card IDs from active shares
  const sharedCardIds = activeShares.flatMap((s) => s.card_ids)

  // Filter to cards that belong to someone else (shared to this user)
  const sharedCards = allCards.filter(
    (c) => c.user_id !== user?.id && sharedCardIds.includes(c.id)
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Shared with me
        </h1>

        {/* Pending invites section */}
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
                      Wants to share {invite.card_ids.length} card
                      {invite.card_ids.length !== 1 ? 's' : ''} with you
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

        {/* Shared cards section */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Cards shared with me
          </h2>
          {sharedCards.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
              <div className="text-4xl mb-3">🔗</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No cards shared with you yet.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                When someone shares cards with you, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  readOnly
                  onEdit={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SharedWithMePage.jsx
git commit -m "feat: add SharedWithMePage with pending invites and shared cards"
```

---

## Task 8: Update `Navbar` — Shared Link + Pending Badge

**Files:**
- Modify: `src/components/layout/Navbar.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import useAppStore from '../../store/useAppStore.js'
import Button from '../ui/Button.jsx'
import { usePendingInvites } from '../../hooks/useShares.js'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isDark, toggleDark } = useAppStore()
  const { data: pendingInvites = [] } = usePendingInvites()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 mr-auto"
        aria-label="Go to dashboard"
      >
        <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-lg text-sm tracking-tight">
          CC
        </span>
        <span className="text-gray-900 dark:text-white font-semibold hidden sm:inline">
          Tracker
        </span>
      </button>

      {user && (
        <span className="text-gray-500 dark:text-gray-500 text-sm hidden md:block truncate max-w-[200px]">
          {user.email}
        </span>
      )}

      {/* Shared with me link */}
      {user && (
        <button
          onClick={() => navigate('/shared')}
          className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
            location.pathname === '/shared'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Shared
          {pendingInvites.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {pendingInvites.length}
            </span>
          )}
        </button>
      )}

      <button
        onClick={toggleDark}
        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-base"
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Navbar.jsx
git commit -m "feat: add Shared nav link with pending invite badge"
```

---

## Task 9: `TransactionTable` — `readOnly` Prop

**Files:**
- Modify: `src/components/tracker/TransactionTable.jsx`

- [ ] **Step 1: Add `readOnly` prop — suppress Pay/Archive when true**

Replace `export default function TransactionTable({ transactions, cardId, onPay }) {` and the actions column with:

```jsx
export default function TransactionTable({ transactions, cardId, onPay, readOnly = false }) {
```

Replace the `<thead>` row to conditionally show Actions column:

```jsx
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left whitespace-nowrap">Date</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
            <th className="px-4 py-3 text-left whitespace-nowrap">Due Date</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">Paid</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">Remaining</th>
            <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-left">Notes</th>
            {!readOnly && (
              <th className="px-4 py-3 text-center whitespace-nowrap">Actions</th>
            )}
          </tr>
        </thead>
```

Replace the actions `<td>` in each row:

```jsx
              {!readOnly && (
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-2 justify-center items-center">
                    {t.payment_status !== 'paid' && (
                      <Button
                        variant="ghost"
                        className="text-xs py-1 px-2"
                        onClick={() => onPay(t)}
                      >
                        Pay
                      </Button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Archive this transaction? It will no longer appear in your tracker.')) {
                          archive.mutate({ id: t.id, cardId })
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors"
                      title="Archive transaction"
                      disabled={archive.isPending}
                    >
                      Archive
                    </button>
                  </div>
                </td>
              )}
```

- [ ] **Step 2: Verify the full file looks correct** — open `src/components/tracker/TransactionTable.jsx` and confirm the `readOnly` prop threads through both `<thead>` and `<tbody>`.

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/TransactionTable.jsx
git commit -m "feat: add readOnly prop to TransactionTable"
```

---

## Task 10: `TrackerPage` — Read-Only Mode

**Files:**
- Modify: `src/pages/TrackerPage.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const readOnly = searchParams.get('readOnly') === 'true'

  const { data: cards = [] } = useCards()
  const { data: transactions = [], isLoading } = useTransactions(cardId)
  const [payingTransaction, setPayingTransaction] = useState(null)
  const { toasts, toast } = useToast()

  const card = cards.find((c) => c.id === cardId)

  if (cards.length > 0 && !card) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Card not found.</p>
          <button onClick={() => navigate('/')} className="text-blue-400 hover:underline">
            ← Go back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!card) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <TrackerSummary card={card} transactions={transactions} />

      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate(readOnly ? '/shared' : '/')}
          className="text-blue-400 hover:underline text-sm mb-4 block"
        >
          ← Back to {readOnly ? 'Shared with me' : 'Dashboard'}
        </button>

        {/* Read-only banner */}
        {readOnly && (
          <div className="mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-700 dark:text-blue-300 text-sm">
            Viewing shared card — read only
          </div>
        )}

        {!readOnly && (
          <TransactionForm
            cardId={cardId}
            onSuccess={() => toast('Transaction added!', 'success')}
          />
        )}

        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Loading transactions…</p>
        ) : (
          <TransactionTable
            transactions={transactions}
            cardId={cardId}
            onPay={setPayingTransaction}
            readOnly={readOnly}
          />
        )}
      </main>

      {!readOnly && payingTransaction && (
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/TrackerPage.jsx
git commit -m "feat: add readOnly mode to TrackerPage via ?readOnly=true param"
```

---

## Final Verification Checklist

- [ ] Sign in as **Owner**. Open Dashboard. Click **Share** button → ShareManagerModal opens.
- [ ] Enter a viewer's email, select 1+ cards, click Send Invite. Toast appears. Row appears in Active Shares list.
- [ ] Sign in as **Viewer** (same or different browser). Navbar shows **Shared** badge with count `1`.
- [ ] Click Shared → `SharedWithMePage`. Pending invite shows owner email + card count.
- [ ] Click **Accept**. Toast "Invite accepted!". Card appears in "Cards shared with me" grid with "View only" badge.
- [ ] Click the shared card. Navigates to `/tracker/:id?readOnly=true`. Blue read-only banner visible. No Add Transaction form. No Pay/Archive buttons in table.
- [ ] Back arrow returns to `/shared`.
- [ ] As Owner, open Share modal → click **Revoke**. Row disappears.
- [ ] As Viewer, refresh `/shared`. Shared card is gone.
- [ ] Sign up as a **new account** with the invited email. After sign-in, Shared tab shows pending invite (claim RPC ran).
