import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { getLoanTotalPaid, getLoanRemaining, advanceNextPaymentDate } from '../utils/loans.js'
import { addMoney, toCents, fromCents } from '../utils/money.js'
import {
  computeOutstanding,
  allocatePayment,
  generateMissingEntries,
  getNextPeriodDate,
} from '../utils/loanInterest.js'

export function useLoans(borrowerId) {
  return useQuery({
    queryKey: ['loans', borrowerId],
    enabled: !!borrowerId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)

      const { data: loans, error } = await supabase
        .from('loans')
        .select('*, loan_payments(id, amount, notes, paid_at)')
        .eq('borrower_id', borrowerId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error

      const {
        data: { user },
      } = await supabase.auth.getUser()

      for (const loan of loans) {
        if (!loan.interest_bearing) continue

        const [{ data: ledger, error: ledgerErr }, { data: rates, error: ratesErr }] =
          await Promise.all([
            supabase
              .from('loan_ledger')
              .select('*')
              .eq('loan_id', loan.id)
              .order('period_date', { ascending: true })
              .order('created_at', { ascending: true }),
            supabase
              .from('loan_interest_rates')
              .select('*')
              .eq('loan_id', loan.id)
              .order('effective_from', { ascending: true }),
          ])
        if (ledgerErr) throw ledgerErr
        if (ratesErr) throw ratesErr

        const missing = generateMissingEntries(loan, rates, ledger, today)
        if (missing.length > 0) {
          const { error: insertErr } = await supabase
            .from('loan_ledger')
            .insert(missing.map((e) => ({ ...e, user_id: user.id })))
          if (insertErr) throw insertErr

          const { data: updatedLedger, error: refetchErr } = await supabase
            .from('loan_ledger')
            .select('*')
            .eq('loan_id', loan.id)
            .order('period_date', { ascending: true })
            .order('created_at', { ascending: true })
          if (refetchErr) throw refetchErr

          loan._ledger = updatedLedger
        } else {
          loan._ledger = ledger
        }
        loan._rates = rates
      }

      return loans
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

      const {
        interest_bearing,
        minimum_payment,
        interest_rate,
        interest_type,
        late_fee_rate,
        penalty_rate,
        ...rest
      } = loanData

      const { data, error } = await supabase
        .from('loans')
        .insert({
          ...rest,
          interest_bearing: interest_bearing ?? false,
          minimum_payment: interest_bearing ? (minimum_payment ?? null) : null,
          borrower_id: borrowerId,
          user_id: user.id,
          status: 'active',
        })
        .select()
        .single()
      if (error) throw error

      if (interest_bearing && interest_rate && interest_type) {
        const { error: rateErr } = await supabase.from('loan_interest_rates').insert({
          loan_id: data.id,
          user_id: user.id,
          interest_rate,
          interest_type,
          rate_period: 'monthly',
          late_fee_rate: late_fee_rate ?? 1.0,
          penalty_rate: penalty_rate ?? 5.0,
          effective_from: rest.loan_date,
        })
        if (rateErr) throw rateErr
      }

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

      // ── Non-interest path (unchanged) ──────────────────────────────────────
      if (!loan.interest_bearing) {
        const { data: payData, error: payErr } = await supabase
          .from('loan_payments')
          .insert({ loan_id: loan.id, user_id: user.id, amount: paymentAmount, notes })
          .select()
          .single()
        if (payErr) throw payErr

        const previousPaid = getLoanTotalPaid(loan.loan_payments)
        const newTotalPaid = addMoney(previousPaid, paymentAmount)
        const newRemaining = getLoanRemaining(loan.amount, newTotalPaid)

        const updates = {}
        if (newRemaining <= 0) {
          updates.status = 'completed'
          updates.next_payment_date = null
        } else {
          updates.next_payment_date = advanceNextPaymentDate(loan)
        }
        const { error: loanErr } = await supabase.from('loans').update(updates).eq('id', loan.id)
        if (loanErr) throw loanErr

        return { borrowerId: loan.borrower_id, loanPaymentId: payData.id }
      }

      // ── Interest-bearing path ──────────────────────────────────────────────
      const ledger = loan._ledger ?? []
      const outstanding = computeOutstanding(loan.amount, ledger)
      const allocation = allocatePayment(paymentAmount, outstanding)

      const periodDate = loan.next_payment_date ?? loan.loan_date

      const { data: payData, error: payErr } = await supabase
        .from('loan_ledger')
        .insert({
          loan_id: loan.id,
          user_id: user.id,
          entry_type: 'payment',
          amount: paymentAmount,
          principal_applied: allocation.principalApplied,
          interest_applied: allocation.interestApplied,
          penalty_applied: allocation.penaltyApplied,
          period_date: periodDate,
          is_manual: false,
          notes: notes ?? null,
        })
        .select()
        .single()
      if (payErr) throw payErr

      const newTotalCents = Math.max(0, toCents(outstanding.total) - toCents(paymentAmount))
      const updates = {}
      if (newTotalCents <= 0) {
        updates.status = 'completed'
        updates.next_payment_date = null
      } else {
        const nextDate = getNextPeriodDate(loan)
        if (nextDate && nextDate !== loan.next_payment_date) {
          updates.next_payment_date = nextDate
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: loanErr } = await supabase.from('loans').update(updates).eq('id', loan.id)
        if (loanErr) throw loanErr
      }

      return { borrowerId: loan.borrower_id, loanPaymentId: payData.id }
    },
    onSuccess: (_data, { loan }) =>
      qc.invalidateQueries({ queryKey: ['loans', loan.borrower_id] }),
  })
}

export function useAddLoanInterestRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loan, rateData }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const lastLedgerDate = (loan._ledger ?? [])
        .map((e) => e.period_date)
        .sort()
        .at(-1)

      if (lastLedgerDate && rateData.effective_from < lastLedgerDate) {
        throw new Error(
          `Effective date must be on or after the last computed period (${lastLedgerDate})`
        )
      }

      const { error } = await supabase.from('loan_interest_rates').insert({
        loan_id: loan.id,
        user_id: user.id,
        interest_rate: rateData.interest_rate,
        interest_type: rateData.interest_type,
        rate_period: 'monthly',
        late_fee_rate: rateData.late_fee_rate,
        penalty_rate: rateData.penalty_rate,
        effective_from: rateData.effective_from,
      })
      if (error) throw error
    },
    onSuccess: (_data, { loan }) =>
      qc.invalidateQueries({ queryKey: ['loans', loan.borrower_id] }),
  })
}

export function useLoanLedger(loanId) {
  return useQuery({
    queryKey: ['loan_ledger', loanId],
    enabled: !!loanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_ledger')
        .select('*')
        .eq('loan_id', loanId)
        .order('period_date', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useWaivePenalty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loan, amount, notes }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const lastLedgerDate = (loan._ledger ?? [])
        .map((e) => e.period_date)
        .sort()
        .at(-1) ?? loan.loan_date

      const { error } = await supabase.from('loan_ledger').insert({
        loan_id: loan.id,
        user_id: user.id,
        entry_type: 'penalty_waiver',
        amount,
        principal_applied: 0,
        interest_applied: 0,
        penalty_applied: 0,
        period_date: lastLedgerDate,
        is_manual: true,
        notes: notes ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, { loan }) => {
      qc.invalidateQueries({ queryKey: ['loans', loan.borrower_id] })
      qc.invalidateQueries({ queryKey: ['loan_ledger', loan.id] })
    },
  })
}
