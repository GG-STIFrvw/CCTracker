import { toCents, fromCents } from './money.js'
import { advanceNextPaymentDate } from './loans.js'

export function getActiveRate(rateHistory, date) {
  return (
    [...rateHistory]
      .filter(r => r.effective_from <= date)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
  )
}

export function computeInterestCharge(loanAmount, principalBalance, interestRate, interestType) {
  const baseCents = interestType === 'simple' ? toCents(loanAmount) : toCents(principalBalance)
  return fromCents(Math.round(baseCents * Number(interestRate) / 100))
}

export function computeOutstanding(loanAmount, ledgerEntries) {
  let principalPaidCents = 0
  let interestChargedCents = 0
  let interestPaidCents = 0
  let penaltyChargedCents = 0
  let penaltyPaidCents = 0
  let penaltyWaivedCents = 0

  for (const e of ledgerEntries) {
    switch (e.entry_type) {
      case 'interest_charge':
        interestChargedCents += toCents(e.amount)
        break
      case 'late_fee':
      case 'penalty_interest':
        penaltyChargedCents += toCents(e.amount)
        break
      case 'payment':
        principalPaidCents += toCents(e.principal_applied ?? 0)
        interestPaidCents  += toCents(e.interest_applied  ?? 0)
        penaltyPaidCents   += toCents(e.penalty_applied   ?? 0)
        break
      case 'penalty_waiver':
        penaltyWaivedCents += toCents(e.amount)
        break
    }
  }

  const principalBalance = Math.max(0, fromCents(toCents(loanAmount) - principalPaidCents))
  const interestBalance  = Math.max(0, fromCents(interestChargedCents - interestPaidCents))
  const penaltyBalance   = Math.max(0, fromCents(penaltyChargedCents - penaltyPaidCents - penaltyWaivedCents))
  const total            = fromCents(toCents(principalBalance) + toCents(interestBalance) + toCents(penaltyBalance))

  return { principalBalance, interestBalance, penaltyBalance, total }
}

export function allocatePayment(paymentAmount, outstanding) {
  let remainderCents = toCents(paymentAmount)

  const penaltyAppliedCents  = Math.min(remainderCents, toCents(outstanding.penaltyBalance))
  remainderCents -= penaltyAppliedCents

  const interestAppliedCents = Math.min(remainderCents, toCents(outstanding.interestBalance))
  remainderCents -= interestAppliedCents

  const principalAppliedCents = Math.min(remainderCents, toCents(outstanding.principalBalance))

  return {
    penaltyApplied:   fromCents(penaltyAppliedCents),
    interestApplied:  fromCents(interestAppliedCents),
    principalApplied: fromCents(principalAppliedCents),
    remainder:        fromCents(Math.max(0, toCents(paymentAmount) - penaltyAppliedCents - interestAppliedCents - principalAppliedCents)),
  }
}

export function isPeriodSufficientlyPaid(periodDate, ledgerEntries, minimumPayment) {
  const totalPaidCents = ledgerEntries
    .filter(e => e.entry_type === 'payment' && e.period_date === periodDate)
    .reduce((sum, e) => sum + toCents(e.amount), 0)

  if (minimumPayment == null) return totalPaidCents > 0
  return totalPaidCents >= toCents(minimumPayment)
}

export function getNextPeriodDate(loan) {
  if (loan.payment_frequency === 'one-time') {
    return advanceNextPaymentDate({
      payment_frequency: 'monthly',
      next_payment_date: loan.next_payment_date,
      payment_day: Number(loan.next_payment_date.split('-')[2]),
    })
  }
  return advanceNextPaymentDate(loan)
}

export function generateMissingEntries(loan, rateHistory, ledgerEntries, today) {
  if (loan.status === 'completed' || loan.status === 'defaulted') return []
  if (!loan.next_payment_date) return []

  const chargedPeriods = new Set(
    ledgerEntries.filter(e => e.entry_type === 'interest_charge').map(e => e.period_date)
  )

  const result = []
  const workingLedger = [...ledgerEntries]
  let currentDueDate = loan.next_payment_date

  while (currentDueDate <= today) {
    if (!chargedPeriods.has(currentDueDate)) {
      const rate = getActiveRate(rateHistory, currentDueDate)
      if (rate !== null) {
        const outstanding = computeOutstanding(loan.amount, workingLedger)

        const interestAmount = computeInterestCharge(
          loan.amount,
          outstanding.principalBalance,
          rate.interest_rate,
          rate.interest_type
        )

        const interestEntry = {
          loan_id: loan.id,
          entry_type: 'interest_charge',
          amount: interestAmount,
          principal_applied: 0,
          interest_applied: 0,
          penalty_applied: 0,
          period_date: currentDueDate,
          is_manual: false,
          notes: null,
        }
        result.push(interestEntry)
        workingLedger.push(interestEntry)

        const paid = isPeriodSufficientlyPaid(currentDueDate, workingLedger, loan.minimum_payment)
        if (!paid) {
          const outstandingAfter = computeOutstanding(loan.amount, workingLedger)
          const totalCents = toCents(outstandingAfter.total)
          const lateFeeRate = Number(rate.late_fee_rate ?? 0)
          const penaltyRate = Number(rate.penalty_rate ?? 0)

          const lateFeeEntry = {
            loan_id: loan.id,
            entry_type: 'late_fee',
            amount: fromCents(Math.round(totalCents * lateFeeRate / 100)),
            principal_applied: 0,
            interest_applied: 0,
            penalty_applied: 0,
            period_date: currentDueDate,
            is_manual: false,
            notes: null,
          }
          const penaltyEntry = {
            loan_id: loan.id,
            entry_type: 'penalty_interest',
            amount: fromCents(Math.round(totalCents * penaltyRate / 100)),
            principal_applied: 0,
            interest_applied: 0,
            penalty_applied: 0,
            period_date: currentDueDate,
            is_manual: false,
            notes: null,
          }
          result.push(lateFeeEntry, penaltyEntry)
          workingLedger.push(lateFeeEntry, penaltyEntry)
        }
      }
    }

    // Advance to next period
    const next = getNextPeriodDate({
      payment_frequency: loan.payment_frequency,
      next_payment_date: currentDueDate,
      payment_day: loan.payment_day,
    })

    if (!next || next === currentDueDate) break
    currentDueDate = next
  }

  return result
}
