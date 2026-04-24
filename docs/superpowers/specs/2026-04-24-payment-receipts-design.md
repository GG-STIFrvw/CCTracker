# Payment Receipt Attachments — Design Spec

**Date:** 2026-04-24
**Status:** Approved

## Overview

Allow users to attach receipt files (images or PDFs) when recording a payment on a credit card transaction or a loan. Receipts are optional but encouraged for review. Up to 10 files per payment, each up to 10 MB. After recording, the payment history row shows a 📎 icon if receipts are attached.

## Scope

- Credit card payments (`PaymentModal`) and loan payments (`LoanPaymentModal`)
- Attach during payment entry only (not after the fact)
- View/delete receipts from the payment history list inside each modal
- Bulk pay does not support receipt attachment (no UI for it)

## Data Layer

### New Supabase tables

**`payment_attachments`**
```
id               uuid         PRIMARY KEY DEFAULT gen_random_uuid()
payment_id       uuid         NOT NULL REFERENCES payments(id) ON DELETE CASCADE
user_id          uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
file_path        text         NOT NULL   -- e.g. payments/{paymentId}/1713600000-receipt.jpg
file_name        text         NOT NULL
file_size        integer      NOT NULL   -- bytes
mime_type        text         NOT NULL
created_at       timestamptz  DEFAULT now()
```

**`loan_payment_attachments`**
```
id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid()
loan_payment_id     uuid         NOT NULL REFERENCES loan_payments(id) ON DELETE CASCADE
user_id             uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
file_path           text         NOT NULL   -- e.g. loan_payments/{loanPaymentId}/...
file_name           text         NOT NULL
file_size           integer      NOT NULL
mime_type           text         NOT NULL
created_at          timestamptz  DEFAULT now()
```

### RLS policies (both tables)
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

### Supabase Storage
- Bucket: `attachments` (existing)
- Paths: `payments/{paymentId}/{timestamp}-{sanitizedFilename}` and `loan_payments/{loanPaymentId}/...`

### File constraints (same as existing attachment system)
- Allowed types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `application/pdf`
- Max size: 10 MB per file
- Max files: 10 per payment

## Hooks (`useAttachments.js`)

Extend the existing `entityType` switch to handle two new types: `payment` and `loan_payment`.

**New query hooks:**
- `usePaymentAttachments(paymentId)` — fetches all attachment rows + generates signed URLs (1-hour expiry) for a specific payment
- `usePaymentAttachmentCounts(paymentIds[])` — batch count query, returns `{ [paymentId]: count }` for all visible history rows
- `useLoanPaymentAttachments(loanPaymentId)` — same for loan payments
- `useLoanPaymentAttachmentCounts(loanPaymentIds[])` — same batch count for loan payment history

Upload and delete mutations reuse the existing `useUploadAttachment()` and `useDeleteAttachment()` with the new entity types — no new mutation hooks needed.

## Upload Flow

Files are staged locally in component state before the payment is submitted. The payment ID does not exist until the payment is recorded, so uploads happen after the payment is saved:

1. User fills in amount, notes, and optionally selects files (staged as component state)
2. User hits Pay
3. `useRecordPayment()` (or `useRecordLoanPayment()`) runs → returns new `payment.id`
4. Each staged file uploads sequentially to `payments/{payment.id}/` and inserts into `payment_attachments`
5. If any upload fails, a non-blocking warning is shown — the payment record is already saved and is not rolled back

**The Pay button is never blocked by uploads.** Payment recording and receipt upload are decoupled — payments always succeed independently.

## UI Changes

### `PaymentModal.jsx`

- Add `stagedFiles` state (array, max 10) to the component
- Add receipt upload section **between notes field and Pay button**:
  - Dashed-border drop zone: "📎 Attach receipt" with hint text (JPG, PNG, PDF · max 10 MB · up to 10 files)
  - Selected files render as removable chips showing filename and file size
  - File validation (type + size) runs client-side on selection; invalid files are rejected with an inline error
- On submit: record payment → upload staged files in sequence → show non-blocking upload error if any file fails
- Payment history list: fetch counts with `usePaymentAttachmentCounts` for all displayed payment IDs; rows with `count > 0` show a 📎 button to the right of the amount; clicking opens `AttachmentModal` with `entityType="payment"` and `entityId={payment.id}`

### `LoanPaymentModal.jsx`

Identical changes as `PaymentModal.jsx`, using `loan_payment` entity type and `useLoanPaymentAttachmentCounts`.

### `AttachmentModal.jsx`

No changes needed. The existing component handles image thumbnails, PDF icons, signed URL download links, and per-file deletion. It is reused as-is with the new entity types.

### Bulk Pay

No receipt attachment in bulk pay (`BulkPayConfirmModal`). Bulk payments record individual payment rows with notes: 'Bulk payment' — these can have the 📎 button in history if the user later views those payment rows, but no upload UI is added to the bulk flow.

## Error Handling

| Scenario | Behavior |
|---|---|
| File exceeds 10 MB | Rejected on selection with inline error, not added to staged list |
| Invalid file type | Rejected on selection with inline error |
| More than 10 files selected | 11th+ files rejected with inline message |
| Upload fails after payment saved | Non-blocking warning shown; payment is kept; user can retry by viewing receipts from history |
| Payment recording fails | Staged files are not uploaded; standard payment error shown |

## Out of Scope

- Receipt attachment for bulk payments
- Generating receipts automatically
- Sending receipts by email
