# Borrower Sharing Feature — Design Spec

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

Allow a borrower owner to share one specific borrower's loan data (read-only) with another user by email. The recipient accepts the invite and views the borrower's loans in a dedicated "Shared Borrowers" page — separate from the existing "Shared with me" cards page.

---

## Architecture

A new `borrower_shares` Supabase table separate from the existing `shares` table (used for cards). This keeps borrower sharing and card sharing fully independent — no risk of breaking existing functionality. The pattern mirrors the card sharing flow end-to-end.

**New files:**
- `src/hooks/useBorrowerShares.js` — all query/mutation hooks
- `src/components/borrowers/BorrowerShareModal.jsx` — share management modal on LoanPage
- `src/pages/SharedBorrowersPage.jsx` — viewer's shared borrowers page

**Modified files:**
- `src/pages/LoanPage.jsx` — add Share button + read-only mode
- `src/components/layout/Navbar.jsx` — add "Shared Borrowers" link + pending badge
- `src/App.jsx` — add `/shared-borrowers` route

---

## Data Model

### Table: `borrower_shares`

```sql
create table borrower_shares (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null,
  owner_email text not null,
  viewer_email text not null,
  viewer_id uuid references auth.users,
  borrower_id uuid references borrowers(id) on delete cascade not null,
  status text not null default 'unclaimed',
  created_at timestamptz default now()
);
alter table borrower_shares enable row level security;

-- Owner: full control over their own shares
create policy "Owner manages borrower shares" on borrower_shares
  for all using (auth.uid() = owner_id);

-- Viewer: can read and update their own received shares
create policy "Viewer reads borrower shares by email" on borrower_shares
  for select using (
    viewer_id = auth.uid()
    or viewer_email = (select email from auth.users where id = auth.uid())
  );

create policy "Viewer updates borrower shares" on borrower_shares
  for update using (viewer_id = auth.uid());
```

### Status lifecycle

```
unclaimed → (viewer logs in, RPC runs) → pending → (viewer accepts) → active
                                                   → (viewer declines) → declined
```

### RPC: `claim_pending_borrower_shares`

Mirrors the existing `claim_pending_shares` RPC. Called on login to match `viewer_email` to the logged-in user's `viewer_id` and transition `unclaimed → pending`.

```sql
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

---

## Hooks (`src/hooks/useBorrowerShares.js`)

| Hook | Purpose |
|------|---------|
| `useMyBorrowerShares(borrowerId)` | Owner: all shares for a specific borrower (all statuses except declined) |
| `useCreateBorrowerShare()` | Owner: insert share + send email notification (non-blocking) |
| `useRevokeBorrowerShare()` | Owner: hard delete a share row |
| `useSharedBorrowersWithMe()` | Viewer: active shares where viewer_id = current user |
| `usePendingBorrowerInvites()` | Viewer: unclaimed + pending shares (for badge + accept/decline) |
| `useAcceptBorrowerShare()` | Viewer: update status → active, set viewer_id |
| `useDeclineBorrowerShare()` | Viewer: update status → declined |

---

## Components

### `BorrowerShareModal` (`src/components/borrowers/BorrowerShareModal.jsx`)

Opened via Share button on LoanPage. Receives `borrowerId` and `onClose` props.

**Sections:**
1. **Active Shares** — list of non-declined shares for this borrower. Each row shows `viewer_email`, status badge (pending/active), and a Revoke button.
2. **Invite Someone** — email input + Send Invite button. Validates: valid email format, not self, no duplicate active invite. On success shows a success message. Sends email via existing `POST /api/notify` endpoint (non-blocking).

Email body: `"{owner_email} has shared borrower "{borrower_name}"'s loan data with you on CC Tracker. Sign in at {origin}/auth to view it under Shared Borrowers."`

### `SharedBorrowersPage` (`src/pages/SharedBorrowersPage.jsx`)

Route: `/shared-borrowers`

**Sections:**
1. **Pending Invites** — list of pending/unclaimed borrower share invites with Accept/Decline buttons. Disappears when empty.
2. **Shared Borrowers grid** — BorrowerTile-style tiles for each active share, read-only. Clicking navigates to `/borrower/:borrowerId?readOnly=true`.

Uses `useSharedBorrowersWithMe` to get `borrower_id` values, then fetches borrower data for each. Because RLS only allows the owner to query `borrowers` directly, the `borrower_shares` table must join borrower data or a separate public-safe fetch is needed — see Read-Only Access note below.

### LoanPage (`src/pages/LoanPage.jsx`) — modifications

- **Share button** added to the summary header area (next to borrower name), only visible when `!readOnly`
- **Read-only banner** shown when `readOnly=true` (same pattern as TrackerPage)
- **Read-only mode**: hides "+ Add Loan" button and "Pay" buttons in LoanTable
- `readOnly` prop passed down to `LoanTable`

### Navbar — modifications

- New **"Shared Borrowers"** link (mirrors "Shared with me" link)
- Pending badge on the link showing count of pending borrower invites (from `usePendingBorrowerInvites`)

---

## Read-Only Access for Shared Borrowers

**Problem:** The `borrowers` table RLS only allows the owner to read their own rows. A viewer cannot directly query a borrower they've been shared with.

**Solution:** When a viewer opens `/borrower/:borrowerId?readOnly=true`, the LoanPage needs to fetch that borrower's data. Two options:

**Option A (recommended):** Store `borrower_name`, `borrower_phone`, `borrower_email` denormalized on the `borrower_shares` row at creation time. The viewer reads these from their share row — no RLS issue.

**Option B:** Add an RLS policy to `borrowers` allowing a viewer to read if a matching active `borrower_share` exists.

Option A is simpler and avoids complex cross-table RLS. The `borrower_shares` table gets three extra columns: `borrower_name text`, `borrower_phone text`, `borrower_email text` — populated when the share is created.

Similarly, `loans` and `loan_payments` tables need a viewer-read RLS policy:
```sql
-- Allow viewer to read loans if they have an active borrower_share for this borrower
create policy "Viewer reads shared loans" on loans
  for select using (
    exists (
      select 1 from borrower_shares
      where borrower_id = loans.borrower_id
        and viewer_id = auth.uid()
        and status = 'active'
    )
  );

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
```

---

## Email Notification

Uses existing `POST /api/notify` Express endpoint (Render backend). Non-blocking — share is created even if email fails.

```js
fetch(`${import.meta.env.VITE_API_URL}/api/notify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: viewerEmail,
    subject: `${ownerEmail} shared a borrower's loan data with you on CC Tracker`,
    html: `<p><strong>${ownerEmail}</strong> has shared loan data for <strong>${borrowerName}</strong> with you on CC Tracker.</p>
           <p><a href="${origin}/auth">Sign in or create an account</a> to view it under <strong>"Shared Borrowers"</strong>.</p>`,
  }),
}).catch(() => {})
```

---

## Scope Boundaries

**In scope:**
- Owner shares one borrower at a time with one person by email
- Viewer sees shared borrower's loans + payment history (read-only)
- Accept / decline / revoke flow
- Email notification (non-blocking)
- Pending invites badge on Navbar
- Separate "Shared Borrowers" page

**Out of scope:**
- Viewer recording payments (read-only only)
- Sharing multiple borrowers in one invite
- Borrower-level permissions (all loans visible or none)
- Real-time updates for viewers
