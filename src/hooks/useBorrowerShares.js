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
