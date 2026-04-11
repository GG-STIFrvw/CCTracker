# Card Sharing Feature — Design Spec
**Date:** 2026-04-11  
**Status:** Approved

---

## Overview

Allow a CC Tracker account owner to invite other users (by email) to view selected credit cards and their full transaction history. Shared access is read-only. The owner can revoke access at any time. Viewers see shared cards in a dedicated "Shared with me" page, separate from their own cards.

---

## Database

### New table: `shares`

```sql
CREATE TABLE shares (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES auth.users NOT NULL,
  viewer_email text NOT NULL,
  viewer_id    uuid REFERENCES auth.users,
  card_ids     uuid[] NOT NULL,
  status       text NOT NULL DEFAULT 'unclaimed'
               CHECK (status IN ('unclaimed', 'pending', 'active', 'declined')),
  created_at   timestamptz DEFAULT now()
);

-- Prevent duplicate active/pending invites to the same email from the same owner
-- (allows re-invite after decline)
CREATE UNIQUE INDEX shares_owner_viewer_unique
  ON shares(owner_id, lower(viewer_email))
  WHERE status NOT IN ('declined');

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Owner can read, create, delete their own shares
CREATE POLICY "owner_manage_shares" ON shares
  FOR ALL USING (auth.uid() = owner_id);

-- Viewer can read shares addressed to them (by email or by user_id)
CREATE POLICY "viewer_read_shares" ON shares
  FOR SELECT USING (
    auth.uid() = viewer_id
    OR lower(viewer_email) = lower((
      SELECT email FROM auth.users WHERE id = auth.uid()
    ))
  );

-- Viewer can update status (accept/decline) on their own shares
CREATE POLICY "viewer_update_status" ON shares
  FOR UPDATE USING (auth.uid() = viewer_id)
  WITH CHECK (auth.uid() = viewer_id);
```

### Supabase RPC: `claim_pending_shares()`

Called automatically on every sign-in. Matches unclaimed shares by email and sets `viewer_id`.

```sql
CREATE OR REPLACE FUNCTION claim_pending_shares()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE shares
  SET viewer_id = auth.uid(),
      status = 'pending'
  WHERE lower(viewer_email) = lower((
          SELECT email FROM auth.users WHERE id = auth.uid()
        ))
    AND viewer_id IS NULL
    AND status = 'unclaimed';
END;
$$;
```

### Modified RLS on `cards`

Add a SELECT path for viewers. INSERT/UPDATE/DELETE remain owner-only.

```sql
-- Drop and recreate SELECT policy (name may vary per project)
CREATE POLICY "shared_card_select" ON cards
  FOR SELECT USING (
    user_id = auth.uid()
    OR id = ANY(
      SELECT unnest(card_ids) FROM shares
      WHERE viewer_id = auth.uid() AND status = 'active'
    )
  );
```

### Modified RLS on `transactions`

```sql
CREATE POLICY "shared_transaction_select" ON transactions
  FOR SELECT USING (
    user_id = auth.uid()
    OR card_id = ANY(
      SELECT unnest(card_ids) FROM shares
      WHERE viewer_id = auth.uid() AND status = 'active'
    )
  );
```

---

## Email Notification

Sent via the existing Express + Nodemailer backend (`POST /api/notify`).  
A new endpoint `POST /api/share-invite` is added.

**Request payload:**
```json
{
  "ownerEmail": "owner@example.com",
  "viewerEmail": "viewer@example.com",
  "cardCount": 2
}
```

**Subject:** `[Owner name] shared their credit cards with you on CC Tracker`

**Body:**
```
[Owner email] has shared [N] credit card(s) with you on CC Tracker.

To view them, sign in or create a free account at:
http://localhost:5173/auth

You can sign up with your email or continue with Google.
Once signed in, the invite will appear in your "Shared with me" tab.
```

---

## Frontend

### New route
`/shared` → `SharedWithMePage` (protected, authenticated users only)

### New hooks (`src/hooks/useShares.js`)
- `useMyShares()` — owner's outgoing shares (SELECT where `owner_id = uid`)
- `useSharedWithMe()` — incoming active shares (SELECT where `viewer_id = uid AND status = active`)
- `usePendingInvites()` — incoming pending invites (SELECT where `viewer_id = uid AND status = pending`)
- `useCreateShare()` — INSERT new share + call `/api/share-invite`
- `useRevokeShare()` — DELETE share by id (owner only)
- `useAcceptShare()` — UPDATE status → 'active'
- `useDeclineShare()` — UPDATE status → 'declined'

### New components

#### `ShareManagerModal` (`src/components/sharing/ShareManagerModal.jsx`)
Owner's control panel. Opens from Dashboard header.

Sections:
1. **Existing shares** — list of `{ viewer_email, card names, Revoke button }`. Empty state if none.
2. **Invite someone** — email input + card checkboxes (one per owned card) + "Send Invite" button.

Validation: email must be valid format; at least one card must be selected; cannot invite yourself.

#### `SharedWithMePage` (`src/pages/SharedWithMePage.jsx`)
Viewer's page. Route: `/shared`.

Sections:
1. **Pending invites** — shown only when count > 0. Each invite shows owner email + card count + Accept / Decline buttons.
2. **Shared cards** — `CardTile` grid for all active shared cards, same as Dashboard but read-only. Empty state if no active shares.

Clicking a card tile navigates to `/tracker/:cardId?readOnly=true`.

### Modified components

#### `Navbar`
- Add "Shared" nav link (visible when logged in)
- Show a small numeric badge on the link when `usePendingInvites().data.length > 0`

#### `DashboardPage`
- Add **Share** button to the header row (next to `+ Add Card`)
- Opens `ShareManagerModal`

#### `TrackerPage`
- Read `readOnly` from URL search params (`useSearchParams`)
- When `readOnly=true`:
  - Hide `TransactionForm`
  - Hide Pay buttons in `TransactionTable`
  - Hide Archive buttons in `TransactionTable`
  - Show a subtle read-only banner: *"Viewing shared card — read only"*

#### `TransactionTable`
- Accept `readOnly` prop; when true, suppress action column entirely

### `App.jsx`
- Add `/shared` route (protected)

### `server/index.js`
- Add `POST /api/share-invite` endpoint (sends invite email via Nodemailer)

---

## Data Flow

### Owner creates a share
1. Opens `ShareManagerModal` → fills email + selects cards → clicks Send
2. `useCreateShare()` runs:
   a. INSERT into `shares` (status = 'unclaimed')
   b. POST to `/api/share-invite` with owner email, viewer email, card count
3. Toast: "Invite sent to viewer@email.com"

### Viewer receives invite (existing account)
1. Viewer signs in → `onAuthStateChange` fires → `supabase.rpc('claim_pending_shares')` called
2. Share status: `unclaimed → pending`, `viewer_id` set
3. Navbar "Shared" badge shows count

### Viewer receives invite (new account)
1. Viewer signs up with matching email (or Google) → same `claim_pending_shares` RPC fires
2. Same flow as above

### Viewer accepts invite
1. Clicks Accept on `SharedWithMePage`
2. `useAcceptShare()` → UPDATE status = 'active'
3. Card appears in "Shared cards" section

### Viewer declines invite
1. Clicks Decline
2. `useDeclineShare()` → UPDATE status = 'declined'
3. Invite disappears

### Owner revokes share
1. Clicks Revoke in `ShareManagerModal`
2. `useRevokeShare()` → DELETE share row
3. Viewer loses access immediately (RLS re-evaluated on next query)

---

## Error Handling

- **Invite to own email:** client-side validation, blocked with inline error
- **Duplicate invite:** Supabase will return a conflict; surface as "You've already invited this person"
- **Email send failure:** treat as non-blocking — share record is still created, toast warns "Invite sent but email notification failed"
- **Viewer declines but owner re-invites:** allowed (creates new share row)

---

## What's NOT in scope
- Viewer can make changes (read-only enforced at DB and UI level)
- Share expiry (no expiry by design)
- Sharing individual transactions (card-level granularity only)
- Notification to owner when viewer accepts/declines
