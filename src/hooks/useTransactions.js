import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { addMoney, getPaymentStatus, getRemainingBalance } from '../utils/money.js'

export function makeTransactionQuery(cardId) {
  return {
    queryKey: ['transactions', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('card_id', cardId)
        .eq('is_archived', false)
        .is('cycle_id', null)
        .order('transaction_date', { ascending: false })
      if (error) throw error
      return data
    },
  }
}

export function useTransactions(cardId) {
  return useQuery(makeTransactionQuery(cardId))
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

export function useArchivedTransactions(cardId) {
  return useQuery({
    queryKey: ['transactions_archived', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('card_id', cardId)
        .eq('is_archived', true)
        .order('transaction_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useRestoreTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cardId }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ is_archived: false })
        .eq('id', id)
      if (error) throw error
      return { cardId }
    },
    onSuccess: (_data, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['transactions', cardId] })
      qc.invalidateQueries({ queryKey: ['transactions_archived', cardId] })
    },
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

export function useEditTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cardId, data, currentAmountPaid }) => {
      const newStatus = getPaymentStatus(data.amount, currentAmountPaid)
      const { error } = await supabase
        .from('transactions')
        .update({
          transaction_date: data.transaction_date,
          amount: data.amount,
          payment_due_date: data.payment_due_date || null,
          notes: data.notes || '',
          payment_status: newStatus,
        })
        .eq('id', id)
      if (error) throw error
      return { cardId }
    },
    onSuccess: (_data, { cardId }) =>
      qc.invalidateQueries({ queryKey: ['transactions', cardId] }),
  })
}

export function usePayBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, transactions }) => {
      if (!transactions?.length) throw new Error('No transactions selected')
      const {
        data: { user },
      } = await supabase.auth.getUser()

      await Promise.all(
        transactions.map(async (t) => {
          const remaining = getRemainingBalance(t.amount, t.amount_paid)
          if (remaining <= 0) return

          const newAmountPaid = addMoney(t.amount_paid, remaining)

          const { error: payErr } = await supabase.from('payments').insert({
            transaction_id: t.id,
            user_id: user.id,
            amount: remaining,
            notes: 'Bulk payment',
          })
          if (payErr) throw payErr

          const { error: txErr } = await supabase
            .from('transactions')
            .update({ amount_paid: newAmountPaid, payment_status: 'paid' })
            .eq('id', t.id)
          if (txErr) throw txErr
        })
      )

      return { cardId }
    },
    onSuccess: (_data, { cardId }) =>
      qc.invalidateQueries({ queryKey: ['transactions', cardId] }),
  })
}

export function useBillingCycles(cardId) {
  return useQuery({
    queryKey: ['billing_cycles', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_cycles')
        .select('*, transactions(id, amount, amount_paid, payment_status)')
        .eq('card_id', cardId)
        .order('closed_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCloseCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, label, start_date, end_date }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: cycle, error: cycleErr } = await supabase
        .from('billing_cycles')
        .insert({ card_id: cardId, user_id: user.id, label, start_date, end_date })
        .select()
        .single()
      if (cycleErr) throw cycleErr

      const { error: txErr } = await supabase
        .from('transactions')
        .update({ cycle_id: cycle.id })
        .eq('card_id', cardId)
        .eq('payment_status', 'paid')
        .is('cycle_id', null)
      if (txErr) throw txErr

      return { cardId, cycleId: cycle.id }
    },
    onSuccess: (_data, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['transactions', cardId] })
      qc.invalidateQueries({ queryKey: ['billing_cycles', cardId] })
    },
  })
}

export function useCycleTransactions(cycleId) {
  return useQuery({
    queryKey: ['cycle_transactions', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('transaction_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
