import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { addMoney, getPaymentStatus } from '../utils/money.js'

export function useTransactions(cardId) {
  return useQuery({
    queryKey: ['transactions', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('card_id', cardId)
        .eq('is_archived', false)
        .order('transaction_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, transactionData }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...transactionData,
          card_id: cardId,
          user_id: user.id,
          amount_paid: 0,
          payment_status: 'unpaid',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { cardId }) =>
      qc.invalidateQueries({ queryKey: ['transactions', cardId] }),
  })
}

export function useArchiveTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cardId }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ is_archived: true })
        .eq('id', id)
      if (error) throw error
      return { cardId }
    },
    onSuccess: (_data, { cardId }) =>
      qc.invalidateQueries({ queryKey: ['transactions', cardId] }),
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ transaction, paymentAmount, notes }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // 1. Insert payment history record
      const { error: payErr } = await supabase.from('payments').insert({
        transaction_id: transaction.id,
        user_id: user.id,
        amount: paymentAmount,
        notes,
      })
      if (payErr) throw payErr

      // 2. Update transaction totals using cents-based math
      const newAmountPaid = addMoney(transaction.amount_paid, paymentAmount)
      const newStatus = getPaymentStatus(transaction.amount, newAmountPaid)
      const { error: txErr } = await supabase
        .from('transactions')
        .update({ amount_paid: newAmountPaid, payment_status: newStatus })
        .eq('id', transaction.id)
      if (txErr) throw txErr

      return { cardId: transaction.card_id }
    },
    onSuccess: (_data, { transaction }) =>
      qc.invalidateQueries({ queryKey: ['transactions', transaction.card_id] }),
  })
}

export function usePaymentHistory(transactionId) {
  return useQuery({
    queryKey: ['payments', transactionId],
    enabled: !!transactionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
