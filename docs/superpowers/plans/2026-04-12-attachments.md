# Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file attachments (images + PDFs, max 10MB, max 10 files) to card transactions and loans, visible to shared viewers in read-only mode.

**Architecture:** Two new DB tables (`transaction_attachments`, `loan_attachments`) backed by a private Supabase Storage bucket (`attachments`). Files served via 60-min signed URLs. A shared `AttachmentModal` handles upload/view/delete. Paperclip icon with count badge added to `TransactionTable` and `LoanTable` rows. Counts fetched in a single batch query per table load.

> **Spec deviation note:** The spec named the loan table `loan_payment_attachments` with FK → `loan_payments`. This plan uses `loan_attachments` with FK → `loans` instead. Reason: `LoanTable` rows are loans (not payments), and notarized documents belong to the loan agreement, not individual payment records.

**Tech Stack:** React 18, Vite, Tailwind CSS, @tanstack/react-query v5, @supabase/supabase-js v2, Supabase Storage

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| SQL (manual) | Supabase SQL Editor | Tables, RLS, storage bucket + policies |
| Create | `src/hooks/useAttachments.js` | All attachment queries + mutations |
| Create | `src/components/ui/AttachmentModal.jsx` | Upload/view/delete modal (shared) |
| Modify | `src/components/tracker/TransactionTable.jsx` | Add paperclip icon column + modal |
| Modify | `src/components/borrowers/LoanTable.jsx` | Add paperclip icon column + modal |
| Modify | `src/pages/LoanPage.jsx` | Pass `borrowerId` prop to LoanTable |

---

## Task 1: SQL Migration

**Run entirely in Supabase Dashboard → SQL Editor.**

- [ ] **Step 1: Create tables, RLS, and storage bucket**

```sql
-- transaction_attachments
create table transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  file_path text not null,
  file_name text not null,
  file_size int8 not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);
alter table transaction_attachments enable row level security;

-- Owner: full control
create policy "Owner manages transaction_attachments" on transaction_attachments
  for all using (auth.uid() = user_id);

-- Viewer: read access via active card share
create policy "Viewer reads transaction_attachments" on transaction_attachments
  for select using (
    exists (
      select 1 from transactions t
      join shares s on s.card_ids @> array[t.card_id]::uuid[]
      where t.id = transaction_attachments.transaction_id
        and s.viewer_id = auth.uid()
        and s.status = 'active'
    )
  );

-- loan_attachments
create table loan_attachments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references loans(id) on delete cascade not null,
  borrower_id uuid references borrowers(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  file_path text not null,
  file_name text not null,
  file_size int8 not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);
alter table loan_attachments enable row level security;

-- Owner: full control
create policy "Owner manages loan_attachments" on loan_attachments
  for all using (auth.uid() = user_id);

-- Viewer: read access via active borrower share
create policy "Viewer reads loan_attachments" on loan_attachments
  for select using (
    exists (
      select 1 from borrower_shares bs
      where bs.borrower_id = loan_attachments.borrower_id
        and bs.viewer_id = auth.uid()
        and bs.status = 'active'
    )
  );

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Storage policies
create policy "Authenticated users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "Authenticated users can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy "Authenticated users can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');
```

- [ ] **Step 2: Verify**

In Supabase Table Editor confirm `transaction_attachments` and `loan_attachments` exist with RLS enabled. In Storage confirm `attachments` bucket exists.

---

## Task 2: `useAttachments.js` Hook

**Files:**
- Create: `src/hooks/useAttachments.js`

- [ ] **Step 1: Create the file**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 10

// --- Batch count queries (for badges in table rows) ---

// Returns { [transactionId]: number } for all given transaction IDs
export function useTransactionAttachmentCounts(transactionIds) {
  return useQuery({
    queryKey: ['transaction-attachment-counts', transactionIds],
    enabled: transactionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_attachments')
        .select('transaction_id')
        .in('transaction_id', transactionIds)
      if (error) throw error
      const counts = {}
      for (const row of data) {
        counts[row.transaction_id] = (counts[row.transaction_id] || 0) + 1
      }
      return counts
    },
  })
}

// Returns { [loanId]: number } for all given loan IDs
export function useLoanAttachmentCounts(loanIds) {
  return useQuery({
    queryKey: ['loan-attachment-counts', loanIds],
    enabled: loanIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_attachments')
        .select('loan_id')
        .in('loan_id', loanIds)
      if (error) throw error
      const counts = {}
      for (const row of data) {
        counts[row.loan_id] = (counts[row.loan_id] || 0) + 1
      }
      return counts
    },
  })
}

// --- Single-entity queries (for modal content) ---

// Returns attachment rows with signedUrl for a single transaction
export function useTransactionAttachments(transactionId) {
  return useQuery({
    queryKey: ['transaction-attachments', transactionId],
    enabled: !!transactionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_attachments')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return Promise.all(
        data.map(async (att) => {
          const { data: urlData } = await supabase.storage
            .from('attachments')
            .createSignedUrl(att.file_path, 3600)
          return { ...att, signedUrl: urlData?.signedUrl || null }
        })
      )
    },
  })
}

// Returns attachment rows with signedUrl for a single loan
export function useLoanAttachments(loanId) {
  return useQuery({
    queryKey: ['loan-attachments', loanId],
    enabled: !!loanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_attachments')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return Promise.all(
        data.map(async (att) => {
          const { data: urlData } = await supabase.storage
            .from('attachments')
            .createSignedUrl(att.file_path, 3600)
          return { ...att, signedUrl: urlData?.signedUrl || null }
        })
      )
    },
  })
}

// --- Mutations ---

export function useUploadAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, entityType, entityId, borrowerId }) => {
      if (!ALLOWED_TYPES.includes(file.type))
        throw new Error('Allowed types: JPG, PNG, WEBP, PDF')
      if (file.size > MAX_SIZE)
        throw new Error('File must be under 10 MB')

      const { data: { user } } = await supabase.auth.getUser()
      const timestamp = Date.now()
      const safeName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const folder = entityType === 'transaction' ? 'transactions' : 'loans'
      const filePath = `${folder}/${entityId}/${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file)
      if (uploadError) throw uploadError

      const table = entityType === 'transaction' ? 'transaction_attachments' : 'loan_attachments'
      const idField = entityType === 'transaction' ? 'transaction_id' : 'loan_id'
      const row = {
        [idField]: entityId,
        user_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        ...(entityType === 'loan' && borrowerId ? { borrower_id: borrowerId } : {}),
      }

      const { error: dbError } = await supabase.from(table).insert(row)
      if (dbError) {
        // Rollback storage upload
        await supabase.storage.from('attachments').remove([filePath])
        throw dbError
      }

      return { entityType, entityId }
    },
    onSuccess: ({ entityType, entityId }) => {
      if (entityType === 'transaction') {
        qc.invalidateQueries({ queryKey: ['transaction-attachments', entityId] })
        qc.invalidateQueries({ queryKey: ['transaction-attachment-counts'] })
      } else {
        qc.invalidateQueries({ queryKey: ['loan-attachments', entityId] })
        qc.invalidateQueries({ queryKey: ['loan-attachment-counts'] })
      }
    },
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ attachment, entityType, entityId }) => {
      const table = entityType === 'transaction' ? 'transaction_attachments' : 'loan_attachments'
      // Delete from DB first (RLS blocks non-owners)
      const { error: dbError } = await supabase.from(table).delete().eq('id', attachment.id)
      if (dbError) throw dbError
      // Remove from storage (best-effort)
      await supabase.storage.from('attachments').remove([attachment.file_path])
      return { entityType, entityId }
    },
    onSuccess: ({ entityType, entityId }) => {
      if (entityType === 'transaction') {
        qc.invalidateQueries({ queryKey: ['transaction-attachments', entityId] })
        qc.invalidateQueries({ queryKey: ['transaction-attachment-counts'] })
      } else {
        qc.invalidateQueries({ queryKey: ['loan-attachments', entityId] })
        qc.invalidateQueries({ queryKey: ['loan-attachment-counts'] })
      }
    },
  })
}

export { MAX_FILES }
```

- [ ] **Step 2: Verify no build errors**

```bash
npm run build
```

Expected: `✓ built in` with no errors (file not used yet).

---

## Task 3: `AttachmentModal` Component

**Files:**
- Create: `src/components/ui/AttachmentModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import {
  useTransactionAttachments,
  useLoanAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  MAX_FILES,
} from '../../hooks/useAttachments.js'

export default function AttachmentModal({ entityType, entityId, borrowerId, readOnly, onClose }) {
  const fileInputRef = useRef(null)
  const [uploadError, setUploadError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const txQuery = useTransactionAttachments(entityType === 'transaction' ? entityId : null)
  const loanQuery = useLoanAttachments(entityType === 'loan' ? entityId : null)
  const query = entityType === 'transaction' ? txQuery : loanQuery
  const attachments = query.data ?? []

  const upload = useUploadAttachment()
  const deleteAtt = useDeleteAttachment()

  async function handleFileChange(e) {
    setUploadError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (attachments.length >= MAX_FILES) {
      setUploadError('Maximum 10 files reached')
      e.target.value = ''
      return
    }
    try {
      await upload.mutateAsync({ file, entityType, entityId, borrowerId })
    } catch (err) {
      setUploadError(err.message)
    }
    e.target.value = ''
  }

  return (
    <Modal title={`Attachments (${attachments.length})`} onClose={onClose}>
      {/* Upload — owner only */}
      {!readOnly && (
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending || attachments.length >= MAX_FILES}
            className="w-full justify-center"
          >
            {upload.isPending ? 'Uploading…' : '+ Upload File'}
          </Button>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 text-center">
            JPG, PNG, WEBP, PDF · max 10 MB · max 10 files
          </p>
          {uploadError && (
            <p className="text-red-500 text-xs mt-1 text-center">{uploadError}</p>
          )}
        </div>
      )}

      {/* List */}
      {query.isLoading ? (
        <p className="text-gray-400 text-sm text-center py-6">Loading…</p>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          {readOnly ? 'No attachments.' : 'No files yet. Upload one above.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-2"
            >
              {/* Preview / icon */}
              {att.mime_type.startsWith('image/') ? (
                <a
                  href={att.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={att.signedUrl}
                    alt={att.file_name}
                    className="w-16 h-16 object-cover rounded"
                  />
                </a>
              ) : (
                <a
                  href={att.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-3xl"
                >
                  📄
                </a>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">{att.file_name}</p>
                <p className="text-xs text-gray-400 mb-1">
                  {(att.file_size / 1024).toFixed(0)} KB
                </p>
                <a
                  href={att.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  {att.mime_type === 'application/pdf' ? 'Download PDF' : 'View full size'}
                </a>
              </div>

              {/* Delete — owner only */}
              {!readOnly && (
                <div className="shrink-0">
                  {confirmDeleteId === att.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => {
                          deleteAtt.mutate({ attachment: att, entityType, entityId })
                          setConfirmDeleteId(null)
                        }}
                        className="text-red-500 hover:text-red-400 font-medium"
                        disabled={deleteAtt.isPending}
                      >
                        Yes
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">/</span>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(att.id)}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
```

- [ ] **Step 2: Verify no build errors**

```bash
npm run build
```

Expected: `✓ built in` with no errors.

---

## Task 4: `TransactionTable` — Paperclip Column

**Files:**
- Modify: `src/components/tracker/TransactionTable.jsx`

- [ ] **Step 1: Read the current file**

Read `src/components/tracker/TransactionTable.jsx` to confirm current content before editing.

- [ ] **Step 2: Replace the entire file**

```jsx
import { useState } from 'react'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import { useArchiveTransaction } from '../../hooks/useTransactions.js'
import { useTransactionAttachmentCounts } from '../../hooks/useAttachments.js'
import AttachmentModal from '../ui/AttachmentModal.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function TransactionTable({ transactions, cardId, onPay, readOnly = false }) {
  const archive = useArchiveTransaction()
  const [confirmArchiveId, setConfirmArchiveId] = useState(null)
  const [attachingTxId, setAttachingTxId] = useState(null)

  const txIds = transactions.map((t) => t.id)
  const { data: attCounts = {} } = useTransactionAttachmentCounts(txIds)

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        No transactions yet. Add your first one above.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Due Date</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Paid</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Remaining</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left">Notes</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Files</th>
              {!readOnly && (
                <th className="px-4 py-3 text-center whitespace-nowrap">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {transactions.map((t) => {
              const count = attCounts[t.id] || 0
              return (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-200">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPeso(t.amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {formatDate(t.payment_due_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">
                    {formatPeso(t.amount_paid)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                    {formatPeso(getRemainingBalance(t.amount, t.amount_paid))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge status={t.payment_status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                    {t.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setAttachingTxId(t.id)}
                      className="relative inline-flex items-center gap-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors text-xs"
                      title="Attachments"
                    >
                      📎
                      {count > 0 && (
                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-medium px-1.5 py-0.5 rounded-full leading-none">
                          {count}
                        </span>
                      )}
                    </button>
                  </td>
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
                        {confirmArchiveId === t.id ? (
                          <span className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Archive?</span>
                            <button
                              onClick={() => { archive.mutate({ id: t.id, cardId }); setConfirmArchiveId(null) }}
                              className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                              disabled={archive.isPending}
                            >
                              Yes
                            </button>
                            <span className="text-gray-300 dark:text-gray-600">/</span>
                            <button
                              onClick={() => setConfirmArchiveId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmArchiveId(t.id)}
                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs transition-colors"
                            title="Archive transaction"
                            disabled={archive.isPending}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {attachingTxId && (
        <AttachmentModal
          entityType="transaction"
          entityId={attachingTxId}
          readOnly={readOnly}
          onClose={() => setAttachingTxId(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Verify no build errors**

```bash
npm run build
```

Expected: `✓ built in` with no errors.

---

## Task 5: `LoanTable` — Paperclip Column + `LoanPage` prop

**Files:**
- Modify: `src/components/borrowers/LoanTable.jsx`
- Modify: `src/pages/LoanPage.jsx`

- [ ] **Step 1: Read both files**

Read `src/components/borrowers/LoanTable.jsx` and `src/pages/LoanPage.jsx` to confirm current content.

- [ ] **Step 2: Replace `LoanTable.jsx` entirely**

```jsx
import { useState } from 'react'
import { getLoanTotalPaid, getLoanRemaining, isLoanOverdue } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'
import { useLoanAttachmentCounts } from '../../hooks/useAttachments.js'
import AttachmentModal from '../ui/AttachmentModal.jsx'

const STATUS_STYLES = {
  active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  defaulted: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

export default function LoanTable({ loans, onPay, readOnly = false, borrowerId }) {
  const [attachingLoanId, setAttachingLoanId] = useState(null)

  const loanIds = loans.map((l) => l.id)
  const { data: attCounts = {} } = useLoanAttachmentCounts(loanIds)

  if (loans.length === 0) {
    return (
      <p className="text-gray-400 text-center py-10 text-sm">
        No loans yet. Click "+ Add Loan" to get started.
      </p>
    )
  }

  return (
    <>
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
              <th className="px-4 py-3 text-center">Files</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loans.map((loan) => {
              const totalPaid = getLoanTotalPaid(loan.loan_payments)
              const remaining = getLoanRemaining(loan.amount, totalPaid)
              const overdue = isLoanOverdue(loan, totalPaid)
              const statusKey = overdue ? 'overdue' : loan.status
              const statusLabel = overdue
                ? 'Overdue'
                : loan.status.charAt(0).toUpperCase() + loan.status.slice(1)
              const pct = loan.amount > 0 ? Math.min((totalPaid / loan.amount) * 100, 100) : 0
              const count = attCounts[loan.id] || 0

              return (
                <tr
                  key={loan.id}
                  className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {loan.description || '—'}
                      </p>
                      {loan.notarized && (
                        <p className="text-gray-400 text-xs mt-0.5">Notarized</p>
                      )}
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
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[statusKey]}`}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setAttachingLoanId(loan.id)}
                      className="inline-flex items-center gap-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors text-xs"
                      title="Attachments"
                    >
                      📎
                      {count > 0 && (
                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-medium px-1.5 py-0.5 rounded-full leading-none">
                          {count}
                        </span>
                      )}
                    </button>
                  </td>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {attachingLoanId && (
        <AttachmentModal
          entityType="loan"
          entityId={attachingLoanId}
          borrowerId={borrowerId}
          readOnly={readOnly}
          onClose={() => setAttachingLoanId(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Pass `borrowerId` to `LoanTable` in `LoanPage.jsx`**

In `src/pages/LoanPage.jsx`, find this line:

```jsx
          <LoanTable loans={loans} onPay={setPayingLoan} readOnly={readOnly} />
```

Replace with:

```jsx
          <LoanTable loans={loans} onPay={setPayingLoan} readOnly={readOnly} borrowerId={borrowerId} />
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: `✓ built in` with no errors.

- [ ] **Step 5: End-to-end test on localhost**

```bash
npm run dev
```

Open http://localhost:5173 and test:

**Card transaction attachments (owner):**
1. Open any card → TrackerPage
2. Each transaction row has a 📎 icon in the Files column
3. Click 📎 → AttachmentModal opens titled "Attachments (0)"
4. Click "+ Upload File" → pick a JPG screenshot → uploads successfully
5. Modal shows thumbnail + file name + "View full size" link
6. Badge updates to 📎 1 on that row
7. Click "Delete" → confirm Yes → file removed, badge disappears

**Card transaction attachments (viewer):**
8. Log in as viewer (Account B) → open a shared card
9. Each transaction row shows 📎 with correct count
10. Click 📎 → modal opens, no Upload or Delete buttons visible
11. Images and PDFs display correctly with view/download links

**Loan attachments (owner):**
12. Open any borrower → LoanPage
13. Each loan row has a 📎 icon in the Files column
14. Click 📎 → upload a PDF (notarized doc) → shows 📄 icon + "Download PDF" link
15. Badge updates to 📎 1

**Loan attachments (viewer):**
16. Log in as viewer → open a shared borrower
17. Loan rows show 📎 with correct counts
18. Click 📎 → modal opens read-only, files visible

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Attachments on card transactions | Tasks 1, 2, 3, 4 |
| Attachments on loans (for notarized docs) | Tasks 1, 2, 3, 5 |
| Allowed types: JPG, PNG, WEBP, PDF | Task 2 (useUploadAttachment validation) |
| Max 10 MB per file | Task 2 (useUploadAttachment validation) |
| Max 10 files per entry | Task 2 (MAX_FILES constant), Task 3 (AttachmentModal) |
| Private storage with signed URLs (60 min) | Tasks 1 (bucket), 2 (createSignedUrl 3600) |
| Paperclip icon + count badge on each row | Tasks 4, 5 |
| Image thumbnails in modal | Task 3 |
| PDF download link in modal | Task 3 |
| Upload + delete for owners | Tasks 2, 3 |
| Read-only modal for viewers | Tasks 3, 4, 5 (readOnly prop) |
| Viewer RLS via existing shares | Task 1 (SQL policies) |
| Viewer RLS via existing borrower_shares | Task 1 (SQL policies) |
| Storage rollback on DB insert failure | Task 2 (useUploadAttachment) |
