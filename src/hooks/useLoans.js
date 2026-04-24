import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { getLoanTotalPaid, getLoanRemaining, advanceNextPaymentDate } from '../utils/loans.js'
import { addMoney } from '../utils/money.js'

export function useLoans(borrowerId) {
  return useQuery({
    queryKey: ['loans', borrowerId],
    enabled: !!borrowerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*, loan_payments(id, amount, notes, paid_at)')
        .eq('borrower_id', borrowerId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ borrowerId, loanData }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('loans')
        .insert({ ...loanData, borrower_id: borrowerId, user_id: user.id, status: 'active' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { borrowerId }) =>
      qc.invalidateQueries({ queryKey: ['loans', borrowerId] }),
  })
}

export function useRecordLoanPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loan, paymentAmount, notes }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

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

      // 2. Compute new remaining balance
      const previousPaid = getLoanTotalPaid(loan.loan_payments)
      const newTotalPaid = addMoney(previousPaid, paymentAmount)
      const newRemaining = getLoanRemaining(loan.amount, newTotalPaid)

      // 3. Update loan status and next_payment_date
      const updates = {}
      if (newRemaining <= 0) {
        updates.status = 'completed'
        updates.next_payment_date = null
      } else {
        updates.next_payment_date = advanceNextPaymentDate(loan)
      }

      const { error: loanErr } = await supabase
        .from('loans')
        .update(updates)
        .eq('id', loan.id)
      if (loanErr) throw loanErr

      return { borrowerId: loan.borrower_id, loanPaymentId: payData.id }
    },
    onSuccess: (_data, { loan }) =>
      qc.invalidateQueries({ queryKey: ['loans', loan.borrower_id] }),
  })
}
