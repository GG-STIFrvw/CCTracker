import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('archived', false)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expenseData) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...expenseData, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useEditExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, expenseData }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useArchiveExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('expenses')
        .update({ archived: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
