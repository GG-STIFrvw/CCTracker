import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

export function useBorrowers() {
  return useQuery({
    queryKey: ['borrowers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrowers')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddBorrower() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (borrowerData) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('borrowers')
        .insert({ ...borrowerData, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}

export function useUpdateBorrower() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('borrowers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}

export function useArchiveBorrower() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('borrowers')
        .update({ is_archived: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['borrowers'] }),
  })
}
