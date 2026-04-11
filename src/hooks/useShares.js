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
// No viewer_id filter — RLS (viewer_read_shares policy) handles the restriction
export function useSharedWithMe() {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['shared-with-me'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('status', 'active')
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

// Viewer: pending invites — includes both 'unclaimed' (viewer_id still null)
// and 'pending' (viewer_id set by RPC). RLS filters to this viewer's invites.
export function usePendingInvites() {
  const user = useAppStore((s) => s.user)
  return useQuery({
    queryKey: ['pending-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .in('status', ['unclaimed', 'pending'])
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
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/notify`, {
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
      const { data: { user } } = await supabase.auth.getUser()
      // Also set viewer_id in case claim_pending_shares RPC hadn't run yet
      const { error } = await supabase
        .from('shares')
        .update({ status: 'active', viewer_id: user.id })
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
