# Attachments Feature Design

## Overview

Allow owners to attach screenshots and documents (images + PDFs) to individual card transactions and loan payments. Shared viewers can see attachments in read-only mode. Designed around a paperclip icon per row that opens a unified modal.

---

## Scope

- Card transactions (`transactions` table) — screenshots of bank statements, receipts
- Loan payments (`loan_payments` table) — PDFs and images of notarized documents, receipts

---

## File Rules

- Allowed types: JPG, JPEG, PNG, WEBP, PDF
- Max size: 10MB per file
- Max files: 10 per transaction or loan payment
- Validation happens client-side before upload

---

## Storage

- Supabase Storage bucket: `attachments` (private)
- Card transaction path: `transactions/{transaction_id}/{filename}`
- Loan payment path: `loan-payments/{loan_payment_id}/{filename}`
- Files served via signed URLs with 60-minute expiry — never publicly exposed
- Filename on upload: `{timestamp}-{original_filename}` to avoid collisions

---

## Database

### `transaction_attachments`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| transaction_id | uuid | FK → transactions(id) on delete cascade |
| user_id | uuid | FK → auth.users(id) |
| file_path | text | Storage path |
| file_name | text | Original display name |
| file_size | int8 | Bytes |
| mime_type | text | e.g. image/jpeg, application/pdf |
| created_at | timestamptz | default now() |

### `loan_payment_attachments`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| loan_payment_id | uuid | FK → loan_payments(id) on delete cascade |
| borrower_id | uuid | Denormalized for RLS — FK → borrowers(id) |
| user_id | uuid | FK → auth.users(id) |
| file_path | text | Storage path |
| file_name | text | Original display name |
| file_size | int8 | Bytes |
| mime_type | text | e.g. image/jpeg, application/pdf |
| created_at | timestamptz | default now() |

---

## RLS Policies

### `transaction_attachments`
- Owner full control: `auth.uid() = user_id`
- Viewer read: `exists (select 1 from shares where card_id = (select card_id from transactions where id = transaction_id) and viewer_id = auth.uid() and status = 'active')`

### `loan_payment_attachments`
- Owner full control: `auth.uid() = user_id`
- Viewer read: `exists (select 1 from borrower_shares where borrower_id = loan_payment_attachments.borrower_id and viewer_id = auth.uid() and status = 'active')`

### Storage Bucket Policy (`attachments`)
- Upload: authenticated users only, path must start with `transactions/` or `loan-payments/`
- Read: authenticated users (signed URLs handle access control at the app layer)
- Delete: owner only (matched via `user_id` in DB before deleting from storage)

---

## Components

### `useAttachments.js` (`src/hooks/useAttachments.js`)

Exports:
- `useTransactionAttachments(transactionId)` — fetch attachments + signed URLs
- `useLoanPaymentAttachments(loanPaymentId)` — fetch attachments + signed URLs
- `useUploadAttachment()` — mutation: validate → storage upload → DB insert
- `useDeleteAttachment()` — mutation: DB delete → storage remove

### `AttachmentModal.jsx` (`src/components/ui/AttachmentModal.jsx`)

Props:
- `entityType` — `'transaction'` or `'loan_payment'`
- `entityId` — transaction ID or loan_payment ID
- `borrowerId` — only required when `entityType = 'loan_payment'` (for RLS)
- `readOnly` — boolean, hides upload/delete when true
- `onClose` — function

Behavior:
- Fetches attachments via the appropriate hook
- Images: rendered as thumbnails (click to open full size in new tab via signed URL)
- PDFs: shown as filename with a download link (signed URL)
- Upload button: opens native file picker, validates type + size, uploads
- Delete button (owner only): confirm inline before deleting
- Shows empty state when no attachments yet
- Shows file count in modal title: `Attachments (3)`

### `TransactionTable.jsx` (modified)

- New column header: `📎` (after Notes)
- Each row: paperclip icon with count badge if count > 0, plain icon if 0
- Clicking icon opens `AttachmentModal` with `entityType='transaction'`
- Visible to both owner and viewer (readOnly passed through)

### `LoanTable.jsx` (modified)

- Paperclip icon added in the Actions column (before Pay button)
- Each row: same badge behavior as TransactionTable
- Clicking opens `AttachmentModal` with `entityType='loan_payment'` and `borrowerId`
- Visible to both owner and viewer

---

## Data Flow

### Upload
1. User clicks paperclip → modal opens
2. User clicks Upload → native file picker opens
3. Client validates: type in allowlist, size ≤ 10MB, count < 10
4. Upload to Supabase Storage at correct path
5. Insert row into `transaction_attachments` or `loan_payment_attachments`
6. Refetch attachment list → badge count updates

### View
1. Modal opens → fetch attachment rows from DB
2. For each row, generate signed URL (60 min expiry) via `supabase.storage.from('attachments').createSignedUrl(path, 3600)`
3. Images rendered as `<img>` thumbnails linking to signed URL
4. PDFs rendered as filename + `<a href={signedUrl} target="_blank">Download</a>`

### Delete (owner only)
1. Click delete → inline confirm (Yes / No)
2. On confirm: delete row from DB → delete from storage
3. Refetch list → badge updates

---

## Reuse from Existing Code

- `Modal.jsx` — AttachmentModal wraps this
- `Button.jsx` — upload and delete controls
- `readOnly` pattern — already established in TransactionTable and LoanTable

---

## Out of Scope

- Video files
- Multiple file upload in one pick (one at a time)
- Renaming files after upload
- Attachment support on borrower-level (only loan payment level)
