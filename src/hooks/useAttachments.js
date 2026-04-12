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
