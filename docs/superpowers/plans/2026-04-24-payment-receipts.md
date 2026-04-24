# Payment Receipt Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional receipt file upload to PaymentModal and LoanPaymentModal, with a 📎 badge on history rows for payments that have receipts attached.

**Architecture:** Two new Supabase tables (`payment_attachments`, `loan_payment_attachments`) mirror the existing `transaction_attachments`/`loan_attachments` pattern. `useAttachments.js` is extended with four new query hooks and updated upload/delete logic. Files are staged in component state and uploaded after the payment record is created (decoupled — payment never blocked by upload).

**Tech Stack:** React, Supabase (PostgreSQL + Storage), @tanstack/react-query, Tailwind CSS, react-hook-form

---

### Task 1: Create DB tables in Supabase

**Files:**
- No file to commit — SQL runs directly in Supabase SQL editor

- [ ] **Step 1: Open the Supabase dashboard SQL editor**

Navigate to your project → SQL Editor → New query.

- [ ] **Step 2: Run the migration SQL**

```sql
create table payment_attachments (
  id               uuid         primary key default gen_random_uuid(),
  payment_id       uuid         not null references payments(id) on delete cascade,
  user_id          uuid         not null references auth.users(id) on delete cascade,
  file_path        text         not null,
  file_name        text         not null,
  file_size        integer      not null,
  mime_type        text         not null,
  created_at       timestamptz  default now()
);
alter table payment_attachments enable row level security;
create policy "Users manage own payment attachments"
  on payment_attachments for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table loan_payment_attachments (
  id                  uuid         primary key default gen_random_uuid(),
  loan_payment_id     uuid         not null references loan_payments(id) on delete cascade,
  user_id             uuid         not null references auth.users(id) on delete cascade,
  file_path           text         not null,
  file_name           text         not null,
  file_size           integer      not null,
  mime_type           text         not null,
  created_at          timestamptz  default now()
);
alter table loan_payment_attachments enable row level security;
create policy "Users manage own loan payment attachments"
  on loan_payment_attachments for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 3: Verify tables exist**

In the Supabase Table Editor, confirm both `payment_attachments` and `loan_payment_attachments` appear with the correct columns and RLS enabled.

- [ ] **Step 4: Commit a note**

```bash
git commit --allow-empty -m "db: add payment_attachments and loan_payment_attachments tables"
```

---

### Task 2: Extend useAttachments.js with payment entity types

**Files:**
- Modify: `src/hooks/useAttachments.js`

- [ ] **Step 1: Export ALLOWED_TYPES and MAX_SIZE (currently private)**

At the top of the file, change:
```js
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 10
```
To:
```js
export const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 10
```

- [ ] **Step 2: Add usePaymentAttachmentCounts and useLoanPaymentAttachmentCounts**

After the existing `useLoanAttachmentCounts` function (line ~48), add:

```js
// Returns { [paymentId]: number } for all given payment IDs
export function usePaymentAttachmentCounts(paymentIds) {
  return useQuery({
    queryKey: ['payment-attachment-counts', paymentIds],
    enabled: Array.isArray(paymentIds) && paymentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_attachments')
        .select('payment_id')
        .in('payment_id', paymentIds)
      if (error) throw error
      const counts = {}
      for (const row of data) {
        counts[row.payment_id] = (counts[row.payment_id] || 0) + 1
      }
      return counts
    },
  })
}

// Returns { [loanPaymentId]: number } for all given loan payment IDs
export function useLoanPaymentAttachmentCounts(loanPaymentIds) {
  return useQuery({
    queryKey: ['loan-payment-attachment-counts', loanPaymentIds],
    enabled: Array.isArray(loanPaymentIds) && loanPaymentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_payment_attachments')
        .select('loan_payment_id')
        .in('loan_payment_id', loanPaymentIds)
      if (error) throw error
      const counts = {}
      for (const row of data) {
        counts[row.loan_payment_id] = (counts[row.loan_payment_id] || 0) + 1
      }
      return counts
    },
  })
}
```

- [ ] **Step 3: Add usePaymentAttachments and useLoanPaymentAttachments**

After the existing `useLoanAttachments` function (line ~98), add:

```js
// Returns attachment rows with signedUrl for a single payment record
export function usePaymentAttachments(paymentId) {
  return useQuery({
    queryKey: ['payment-attachments', paymentId],
    enabled: !!paymentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_attachments')
        .select('*')
        .eq('payment_id', paymentId)
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

// Returns attachment rows with signedUrl for a single loan_payment record
export function useLoanPaymentAttachments(loanPaymentId) {
  return useQuery({
    queryKey: ['loan-payment-attachments', loanPaymentId],
    enabled: !!loanPaymentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_payment_attachments')
        .select('*')
        .eq('loan_payment_id', loanPaymentId)
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
```

- [ ] **Step 4: Update useUploadAttachment to handle payment and loan_payment**

Replace the entire `useUploadAttachment` function with:

```js
export function useUploadAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, entityType, entityId, borrowerId }) => {
      if (!ALLOWED_TYPES.includes(file.type))
        throw new Error('Allowed types: JPG, PNG, WEBP, PDF')
      if (file.size > MAX_SIZE)
        throw new Error('File must be under 10 MB')

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      const timestamp = Date.now()
      const safeName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      const folderMap = {
        transaction: 'transactions',
        loan: 'loans',
        payment: 'payments',
        loan_payment: 'loan_payments',
      }
      const tableMap = {
        transaction: 'transaction_attachments',
        loan: 'loan_attachments',
        payment: 'payment_attachments',
        loan_payment: 'loan_payment_attachments',
      }
      const idFieldMap = {
        transaction: 'transaction_id',
        loan: 'loan_id',
        payment: 'payment_id',
        loan_payment: 'loan_payment_id',
      }

      const folder = folderMap[entityType]
      const table = tableMap[entityType]
      const idField = idFieldMap[entityType]
      const filePath = `${folder}/${entityId}/${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file)
      if (uploadError) throw uploadError

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
        await supabase.storage.from('attachments').remove([filePath])
        throw dbError
      }

      return { entityType, entityId }
    },
    onSuccess: ({ entityType, entityId }) => {
      const keyMap = {
        transaction: [['transaction-attachments', entityId], ['transaction-attachment-counts']],
        loan: [['loan-attachments', entityId], ['loan-attachment-counts']],
        payment: [['payment-attachments', entityId], ['payment-attachment-counts']],
        loan_payment: [['loan-payment-attachments', entityId], ['loan-payment-attachment-counts']],
      }
      for (const key of keyMap[entityType] ?? []) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}
```

- [ ] **Step 5: Update useDeleteAttachment to handle payment and loan_payment**

Replace the entire `useDeleteAttachment` function with:

```js
export function useDeleteAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ attachment, entityType, entityId }) => {
      const tableMap = {
        transaction: 'transaction_attachments',
        loan: 'loan_attachments',
        payment: 'payment_attachments',
        loan_payment: 'loan_payment_attachments',
      }
      const table = tableMap[entityType]
      const { error: dbError } = await supabase.from(table).delete().eq('id', attachment.id)
      if (dbError) throw dbError
      await supabase.storage.from('attachments').remove([attachment.file_path])
      return { entityType, entityId }
    },
    onSuccess: ({ entityType, entityId }) => {
      const keyMap = {
        transaction: [['transaction-attachments', entityId], ['transaction-attachment-counts']],
        loan: [['loan-attachments', entityId], ['loan-attachment-counts']],
        payment: [['payment-attachments', entityId], ['payment-attachment-counts']],
        loan_payment: [['loan-payment-attachments', entityId], ['loan-payment-attachment-counts']],
      }
      for (const key of keyMap[entityType] ?? []) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAttachments.js
git commit -m "feat: extend useAttachments with payment and loan_payment entity types"
```

---

### Task 3: Update AttachmentModal to accept payment/loan_payment

**Files:**
- Modify: `src/components/ui/AttachmentModal.jsx`

- [ ] **Step 1: Add new import for payment attachment hooks**

Replace the existing import block:
```js
import {
  useTransactionAttachments,
  useLoanAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  MAX_FILES,
} from '../../hooks/useAttachments.js'
```
With:
```js
import {
  useTransactionAttachments,
  useLoanAttachments,
  usePaymentAttachments,
  useLoanPaymentAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  MAX_FILES,
} from '../../hooks/useAttachments.js'
```

- [ ] **Step 2: Update entity type guard and query selection**

Replace these lines in the component body:
```js
if (process.env.NODE_ENV !== 'production' && entityType !== 'transaction' && entityType !== 'loan') {
  console.error(`AttachmentModal: unknown entityType "${entityType}"`)
}

const txQuery = useTransactionAttachments(entityType === 'transaction' ? entityId : null)
const loanQuery = useLoanAttachments(entityType === 'loan' ? entityId : null)
const query = entityType === 'transaction' ? txQuery : loanQuery
```
With:
```js
if (process.env.NODE_ENV !== 'production' &&
    !['transaction', 'loan', 'payment', 'loan_payment'].includes(entityType)) {
  console.error(`AttachmentModal: unknown entityType "${entityType}"`)
}

const txQuery = useTransactionAttachments(entityType === 'transaction' ? entityId : null)
const loanQuery = useLoanAttachments(entityType === 'loan' ? entityId : null)
const paymentQuery = usePaymentAttachments(entityType === 'payment' ? entityId : null)
const loanPaymentQuery = useLoanPaymentAttachments(entityType === 'loan_payment' ? entityId : null)
const queryMap = { transaction: txQuery, loan: loanQuery, payment: paymentQuery, loan_payment: loanPaymentQuery }
const query = queryMap[entityType] ?? txQuery
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/AttachmentModal.jsx
git commit -m "feat: extend AttachmentModal to support payment and loan_payment entity types"
```

---

### Task 4: Update useRecordPayment to return the new payment ID

**Files:**
- Modify: `src/hooks/useTransactions.js` (lines ~115–121)

- [ ] **Step 1: Change the payments insert to return the new row**

In `useRecordPayment`, replace:
```js
// 1. Insert payment history record
const { error: payErr } = await supabase.from('payments').insert({
  transaction_id: transaction.id,
  user_id: user.id,
  amount: paymentAmount,
  notes,
})
if (payErr) throw payErr
```
With:
```js
// 1. Insert payment history record
const { data: payData, error: payErr } = await supabase
  .from('payments')
  .insert({
    transaction_id: transaction.id,
    user_id: user.id,
    amount: paymentAmount,
    notes,
  })
  .select()
  .single()
if (payErr) throw payErr
```

- [ ] **Step 2: Return paymentId alongside cardId**

Replace the return statement:
```js
return { cardId: transaction.card_id }
```
With:
```js
return { cardId: transaction.card_id, paymentId: payData.id }
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTransactions.js
git commit -m "feat: return paymentId from useRecordPayment for receipt upload"
```

---

### Task 5: Update useRecordLoanPayment to return the new loan payment ID

**Files:**
- Modify: `src/hooks/useLoans.js` (lines ~52–58)

- [ ] **Step 1: Change the loan_payments insert to return the new row**

In `useRecordLoanPayment`, replace:
```js
// 1. Insert payment record
const { error: payErr } = await supabase.from('loan_payments').insert({
  loan_id: loan.id,
  user_id: user.id,
  amount: paymentAmount,
  notes,
})
if (payErr) throw payErr
```
With:
```js
// 1. Insert payment record
const { data: payData, error: payErr } = await supabase
  .from('loan_payments')
  .insert({
    loan_id: loan.id,
    user_id: user.id,
    amount: paymentAmount,
    notes,
  })
  .select()
  .single()
if (payErr) throw payErr
```

- [ ] **Step 2: Return loanPaymentId alongside borrowerId**

Replace the return statement:
```js
return { borrowerId: loan.borrower_id }
```
With:
```js
return { borrowerId: loan.borrower_id, loanPaymentId: payData.id }
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLoans.js
git commit -m "feat: return loanPaymentId from useRecordLoanPayment for receipt upload"
```

---

### Task 6: Add receipt upload to PaymentModal

**Files:**
- Modify: `src/components/tracker/PaymentModal.jsx`

- [ ] **Step 1: Add new imports**

Replace the existing import block at the top:
```js
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paymentSchema } from '../../lib/zod-schemas.js'
import { useRecordPayment, usePaymentHistory } from '../../hooks/useTransactions.js'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
```
With:
```js
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paymentSchema } from '../../lib/zod-schemas.js'
import { useRecordPayment, usePaymentHistory } from '../../hooks/useTransactions.js'
import {
  useUploadAttachment,
  usePaymentAttachmentCounts,
  ALLOWED_TYPES,
  MAX_SIZE,
  MAX_FILES,
} from '../../hooks/useAttachments.js'
import { formatPeso, getRemainingBalance } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import AttachmentModal from '../ui/AttachmentModal.jsx'
```

- [ ] **Step 2: Add new state and hooks inside the component**

After the existing hook calls at the top of the component body:
```js
const remaining = getRemainingBalance(transaction.amount, transaction.amount_paid)
const recordPayment = useRecordPayment()
const { data: history = [] } = usePaymentHistory(transaction.id)
```
Add:
```js
const fileInputRef = useRef(null)
const [stagedFiles, setStagedFiles] = useState([])
const [fileError, setFileError] = useState('')
const [uploadWarning, setUploadWarning] = useState('')
const [attachmentModalPaymentId, setAttachmentModalPaymentId] = useState(null)
const uploadAttachment = useUploadAttachment()
const paymentIds = history.map((p) => p.id)
const { data: attachmentCounts } = usePaymentAttachmentCounts(paymentIds)
```

- [ ] **Step 3: Add file selection handler**

After the `useForm` block, add two functions:
```js
function handleFileSelect(e) {
  setFileError('')
  const files = Array.from(e.target.files || [])
  const slots = MAX_FILES - stagedFiles.length
  if (files.length > slots) {
    setFileError(`Maximum ${MAX_FILES} files allowed.`)
    e.target.value = ''
    return
  }
  const invalid = files.filter((f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_SIZE)
  if (invalid.length > 0) {
    setFileError('Only JPG, PNG, WEBP, PDF under 10 MB allowed.')
    e.target.value = ''
    return
  }
  setStagedFiles((prev) => [...prev, ...files])
  e.target.value = ''
}

function removeStagedFile(index) {
  setStagedFiles((prev) => prev.filter((_, i) => i !== index))
}
```

- [ ] **Step 4: Update onSubmit to upload staged files after payment**

Replace the existing `onSubmit` function:
```js
async function onSubmit(data) {
  if (Number(data.amount) > remaining + 0.001) {
    alert(`Payment cannot exceed remaining balance of ${formatPeso(remaining)}`)
    return
  }
  await recordPayment.mutateAsync({
    transaction,
    paymentAmount: Number(data.amount),
    notes: data.notes || '',
  })
  onSuccess?.()
}
```
With:
```js
async function onSubmit(data) {
  if (Number(data.amount) > remaining + 0.001) {
    alert(`Payment cannot exceed remaining balance of ${formatPeso(remaining)}`)
    return
  }
  const result = await recordPayment.mutateAsync({
    transaction,
    paymentAmount: Number(data.amount),
    notes: data.notes || '',
  })

  if (stagedFiles.length > 0) {
    const failed = []
    for (const file of stagedFiles) {
      try {
        await uploadAttachment.mutateAsync({
          file,
          entityType: 'payment',
          entityId: result.paymentId,
        })
      } catch {
        failed.push(file.name)
      }
    }
    if (failed.length > 0) {
      setUploadWarning(`Payment saved. Receipt upload failed for: ${failed.join(', ')}. You can retry from payment history.`)
      return
    }
  }

  onSuccess?.()
}
```

- [ ] **Step 5: Add the receipt upload zone to the form JSX**

In the form, after the notes `<div>` block and before the buttons `<div>`, add:
```jsx
{/* Receipt upload */}
<div className="flex flex-col gap-1">
  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
    Receipts (optional)
  </label>
  <div
    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 text-center cursor-pointer hover:border-[#9FE870] dark:hover:border-[#9FE870] transition-colors"
    onClick={() => fileInputRef.current?.click()}
  >
    <span className="text-gray-500 dark:text-gray-400 text-sm">📎 Attach receipt</span>
    <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
      JPG, PNG, PDF · max 10 MB · up to 10 files
    </p>
  </div>
  <input
    ref={fileInputRef}
    type="file"
    multiple
    accept=".jpg,.jpeg,.png,.webp,.pdf"
    className="hidden"
    onChange={handleFileSelect}
  />
  {fileError && (
    <p className="text-red-500 dark:text-red-400 text-xs">{fileError}</p>
  )}
  {stagedFiles.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-1">
      {stagedFiles.map((f, i) => (
        <span
          key={i}
          className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5 border border-gray-200 dark:border-gray-700"
        >
          {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
          <button
            type="button"
            onClick={() => removeStagedFile(i)}
            className="text-gray-400 hover:text-red-500 ml-0.5 leading-none"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Show uploadWarning and update submit button label**

Replace the existing buttons `<div>`:
```jsx
<div className="flex gap-2 pt-1">
  <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
    Cancel
  </Button>
  <Button type="submit" disabled={recordPayment.isPending} className="flex-1">
    {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
  </Button>
</div>
```
With:
```jsx
{uploadWarning && (
  <p className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 text-xs rounded-lg px-3 py-2">
    {uploadWarning}
  </p>
)}
<div className="flex gap-2 pt-1">
  <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
    {uploadWarning ? 'Close' : 'Cancel'}
  </Button>
  {!uploadWarning && (
    <Button
      type="submit"
      disabled={recordPayment.isPending || uploadAttachment.isPending}
      className="flex-1"
    >
      {uploadAttachment.isPending
        ? 'Uploading receipts…'
        : recordPayment.isPending
        ? 'Recording…'
        : 'Record Payment'}
    </Button>
  )}
</div>
```

- [ ] **Step 7: Add 📎 badge to payment history rows**

Replace the existing history rows render inside the history `<div className="flex flex-col gap-2 ...">`:
```jsx
{history.map((p) => (
  <div key={p.id} className="flex justify-between items-start text-sm gap-2">
    <div>
      <span className="text-gray-700 dark:text-gray-300">{formatDateTime(p.paid_at)}</span>
      {p.notes && (
        <p className="text-gray-500 dark:text-gray-500 text-xs">{p.notes}</p>
      )}
    </div>
    <span className="text-green-600 dark:text-green-400 font-mono flex-shrink-0">
      {formatPeso(p.amount)}
    </span>
  </div>
))}
```
With:
```jsx
{history.map((p) => (
  <div key={p.id} className="flex justify-between items-start text-sm gap-2">
    <div>
      <span className="text-gray-700 dark:text-gray-300">{formatDateTime(p.paid_at)}</span>
      {p.notes && (
        <p className="text-gray-500 dark:text-gray-500 text-xs">{p.notes}</p>
      )}
    </div>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="text-green-600 dark:text-green-400 font-mono">
        {formatPeso(p.amount)}
      </span>
      {(attachmentCounts?.[p.id] ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => setAttachmentModalPaymentId(p.id)}
          className="text-gray-400 hover:text-[#9FE870] transition-colors text-base leading-none"
          title="View receipts"
        >
          📎
        </button>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 8: Render AttachmentModal when a history row's 📎 is clicked**

Just before the closing `</Modal>` tag at the bottom of the component, add:
```jsx
{attachmentModalPaymentId && (
  <AttachmentModal
    entityType="payment"
    entityId={attachmentModalPaymentId}
    onClose={() => setAttachmentModalPaymentId(null)}
  />
)}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/tracker/PaymentModal.jsx
git commit -m "feat: add receipt upload and history badges to PaymentModal"
```

---

### Task 7: Add receipt upload to LoanPaymentModal

**Files:**
- Modify: `src/components/borrowers/LoanPaymentModal.jsx`

- [ ] **Step 1: Add new imports**

Replace the existing import block:
```js
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanPaymentSchema } from '../../lib/zod-schemas.js'
import { useRecordLoanPayment } from '../../hooks/useLoans.js'
import { getLoanTotalPaid, getLoanRemaining } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
```
With:
```js
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanPaymentSchema } from '../../lib/zod-schemas.js'
import { useRecordLoanPayment } from '../../hooks/useLoans.js'
import {
  useUploadAttachment,
  useLoanPaymentAttachmentCounts,
  ALLOWED_TYPES,
  MAX_SIZE,
  MAX_FILES,
} from '../../hooks/useAttachments.js'
import { getLoanTotalPaid, getLoanRemaining } from '../../utils/loans.js'
import { formatPeso } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import AttachmentModal from '../ui/AttachmentModal.jsx'
```

- [ ] **Step 2: Add new state and hooks inside the component**

After the existing hook calls:
```js
const recordPayment = useRecordLoanPayment()
const totalPaid = getLoanTotalPaid(loan.loan_payments)
const remaining = getLoanRemaining(loan.amount, totalPaid)
```
Add:
```js
const fileInputRef = useRef(null)
const [stagedFiles, setStagedFiles] = useState([])
const [fileError, setFileError] = useState('')
const [uploadWarning, setUploadWarning] = useState('')
const [attachmentModalPaymentId, setAttachmentModalPaymentId] = useState(null)
const uploadAttachment = useUploadAttachment()
const loanPaymentIds = loan.loan_payments.map((p) => p.id)
const { data: attachmentCounts } = useLoanPaymentAttachmentCounts(loanPaymentIds)
```

- [ ] **Step 3: Add file selection handler**

After the `useForm` block, add:
```js
function handleFileSelect(e) {
  setFileError('')
  const files = Array.from(e.target.files || [])
  const slots = MAX_FILES - stagedFiles.length
  if (files.length > slots) {
    setFileError(`Maximum ${MAX_FILES} files allowed.`)
    e.target.value = ''
    return
  }
  const invalid = files.filter((f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_SIZE)
  if (invalid.length > 0) {
    setFileError('Only JPG, PNG, WEBP, PDF under 10 MB allowed.')
    e.target.value = ''
    return
  }
  setStagedFiles((prev) => [...prev, ...files])
  e.target.value = ''
}

function removeStagedFile(index) {
  setStagedFiles((prev) => prev.filter((_, i) => i !== index))
}
```

- [ ] **Step 4: Update onSubmit to upload staged files after payment**

Replace the existing `onSubmit` function:
```js
async function onSubmit(values) {
  if (Number(values.amount) > remaining) return
  try {
    await recordPayment.mutateAsync({
      loan,
      paymentAmount: Number(values.amount),
      notes: values.notes || null,
    })
    onSuccess?.()
    onClose()
  } catch (err) {
    console.error(err)
  }
}
```
With:
```js
async function onSubmit(values) {
  if (Number(values.amount) > remaining) return
  let result
  try {
    result = await recordPayment.mutateAsync({
      loan,
      paymentAmount: Number(values.amount),
      notes: values.notes || null,
    })
  } catch (err) {
    console.error(err)
    return
  }

  if (stagedFiles.length > 0) {
    const failed = []
    for (const file of stagedFiles) {
      try {
        await uploadAttachment.mutateAsync({
          file,
          entityType: 'loan_payment',
          entityId: result.loanPaymentId,
        })
      } catch {
        failed.push(file.name)
      }
    }
    if (failed.length > 0) {
      setUploadWarning(`Payment saved. Receipt upload failed for: ${failed.join(', ')}. You can retry from payment history.`)
      return
    }
  }

  onSuccess?.()
  onClose()
}
```

- [ ] **Step 5: Add the receipt upload zone to the form JSX**

In the form (`<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">`), after the notes `<div>` and before the error message / buttons, add:
```jsx
{/* Receipt upload */}
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Receipts (optional)
  </label>
  <div
    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 transition-colors"
    onClick={() => fileInputRef.current?.click()}
  >
    <span className="text-gray-500 dark:text-gray-400 text-sm">📎 Attach receipt</span>
    <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
      JPG, PNG, PDF · max 10 MB · up to 10 files
    </p>
  </div>
  <input
    ref={fileInputRef}
    type="file"
    multiple
    accept=".jpg,.jpeg,.png,.webp,.pdf"
    className="hidden"
    onChange={handleFileSelect}
  />
  {fileError && (
    <p className="text-red-500 text-xs mt-1">{fileError}</p>
  )}
  {stagedFiles.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-2">
      {stagedFiles.map((f, i) => (
        <span
          key={i}
          className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-full px-2 py-0.5 border border-gray-200 dark:border-gray-700"
        >
          {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
          <button
            type="button"
            onClick={() => removeStagedFile(i)}
            className="text-gray-400 hover:text-red-500 ml-0.5 leading-none"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Show uploadWarning and update buttons**

Replace the existing error + buttons block:
```jsx
{recordPayment.error && (
  <p className="text-red-500 text-sm">{recordPayment.error.message}</p>
)}

<div className="flex gap-2 pt-2">
  <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
    Cancel
  </Button>
  <Button
    type="submit"
    disabled={recordPayment.isPending || remaining <= 0}
    className="flex-1"
  >
    {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
  </Button>
</div>
```
With:
```jsx
{recordPayment.error && (
  <p className="text-red-500 text-sm">{recordPayment.error.message}</p>
)}

{uploadWarning && (
  <p className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 text-xs rounded-lg px-3 py-2">
    {uploadWarning}
  </p>
)}

<div className="flex gap-2 pt-2">
  <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
    {uploadWarning ? 'Close' : 'Cancel'}
  </Button>
  {!uploadWarning && (
    <Button
      type="submit"
      disabled={recordPayment.isPending || uploadAttachment.isPending || remaining <= 0}
      className="flex-1"
    >
      {uploadAttachment.isPending
        ? 'Uploading receipts…'
        : recordPayment.isPending
        ? 'Recording…'
        : 'Record Payment'}
    </Button>
  )}
</div>
```

- [ ] **Step 7: Add 📎 badge to loan payment history rows**

In the existing history render (the `.sort(...).map(...)` block), replace:
```jsx
<div
  key={p.id}
  className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-900"
>
  <div>
    <p className="text-sm text-gray-900 dark:text-white font-medium">
      {formatPeso(p.amount)}
    </p>
    {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
  </div>
  <p className="text-xs text-gray-400">
    {new Date(p.paid_at).toLocaleDateString('en-PH')}
  </p>
</div>
```
With:
```jsx
<div
  key={p.id}
  className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-900"
>
  <div>
    <p className="text-sm text-gray-900 dark:text-white font-medium">
      {formatPeso(p.amount)}
    </p>
    {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
  </div>
  <div className="flex items-center gap-1.5">
    <p className="text-xs text-gray-400">
      {new Date(p.paid_at).toLocaleDateString('en-PH')}
    </p>
    {(attachmentCounts?.[p.id] ?? 0) > 0 && (
      <button
        type="button"
        onClick={() => setAttachmentModalPaymentId(p.id)}
        className="text-gray-400 hover:text-blue-500 transition-colors text-base leading-none"
        title="View receipts"
      >
        📎
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 8: Render AttachmentModal when a history row's 📎 is clicked**

Just before the closing `</Modal>` tag, add:
```jsx
{attachmentModalPaymentId && (
  <AttachmentModal
    entityType="loan_payment"
    entityId={attachmentModalPaymentId}
    onClose={() => setAttachmentModalPaymentId(null)}
  />
)}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/borrowers/LoanPaymentModal.jsx
git commit -m "feat: add receipt upload and history badges to LoanPaymentModal"
```

---

### Task 8: Manual testing on localhost

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test credit card receipt upload**

1. Open the app → go to the Tracker page → open any transaction with a remaining balance
2. Click "Pay" → the PaymentModal opens
3. Verify the "Receipts (optional)" dashed zone appears between Notes and the buttons
4. Click the zone → file picker opens → select a JPG or PDF
5. Verify the file appears as a removable chip below the zone
6. Click the × on the chip → it is removed
7. Re-select the file → submit the payment
8. Verify the button briefly shows "Uploading receipts…" then the modal closes
9. Re-open the modal → in Payment History, the new entry shows a 📎 button
10. Click 📎 → AttachmentModal opens showing the uploaded file
11. Verify you can download/view the file and delete it

- [ ] **Step 3: Test validation errors**

1. Try selecting a .txt file → verify "Only JPG, PNG, WEBP, PDF under 10 MB allowed." error
2. Try selecting a file > 10 MB → same error
3. Select 10 files → try adding one more → verify "Maximum 10 files allowed." error

- [ ] **Step 4: Test payment without a receipt**

1. Record a payment with no files staged
2. Verify the modal closes normally with no upload warnings
3. In history, the new entry shows no 📎 badge

- [ ] **Step 5: Test loan receipt upload**

1. Go to the Borrowers page → open any active loan → click "Pay"
2. Repeat steps 3–10 from Step 2 using the LoanPaymentModal
3. Verify the 📎 badge appears on the loan payment history row
4. Click 📎 → AttachmentModal opens with `entityType="loan_payment"`

- [ ] **Step 6: Verify no regressions**

1. Confirm the existing transaction-level 📎 badge still works in TransactionTable
2. Confirm the existing loan-level 📎 badge still works in LoanTable
3. Confirm bulk pay flow is unaffected
