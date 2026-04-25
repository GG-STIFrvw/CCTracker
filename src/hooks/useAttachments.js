import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

export const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 10

// --- Batch count queries (for badges in table rows) ---

// Returns { [transactionId]: number } for all given transaction IDs
export function useTransactionAttachmentCounts(transactionIds) {
  return useQuery({
    queryKey: ['transaction-attachment-counts', transactionIds],
    enabled: Array.isArray(transactionIds) && transactionIds.length > 0,
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
    enabled: Array.isArray(loanIds) && loanIds.length > 0,
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

// Returns all attachments across multiple loan IDs (for the borrower files section)
export function useAllLoanAttachments(loanIds) {
  return useQuery({
    queryKey: ['all-loan-attachments', loanIds],
    enabled: Array.isArray(loanIds) && loanIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_attachments')
        .select('*')
        .in('loan_id', loanIds)
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

// --- Mutations ---

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
        loan: [['loan-attachments', entityId], ['loan-attachment-counts'], ['all-loan-attachments']],
        payment: [['payment-attachments', entityId], ['payment-attachment-counts']],
        loan_payment: [['loan-payment-attachments', entityId], ['loan-payment-attachment-counts']],
      }
      for (const key of keyMap[entityType] ?? []) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}

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
        loan: [['loan-attachments', entityId], ['loan-attachment-counts'], ['all-loan-attachments']],
        payment: [['payment-attachments', entityId], ['payment-attachment-counts']],
        loan_payment: [['loan-payment-attachments', entityId], ['loan-payment-attachment-counts']],
      }
      for (const key of keyMap[entityType] ?? []) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}

export { MAX_FILES }
