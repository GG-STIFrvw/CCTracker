import { useState, useMemo } from 'react'
import { useLoanLedger, useWaivePenalty } from '../../hooks/useLoans.js'
import { computeOutstanding } from '../../utils/loanInterest.js'
import { formatPeso } from '../../utils/money.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

const ENTRY_LABELS = {
  interest_charge: 'Interest charge',
  late_fee: 'Late fee',
  penalty_interest: 'Penalty interest',
  payment: 'Payment received',
  penalty_waiver: 'Penalty waived',
}

const CHARGE_TYPES = new Set(['interest_charge', 'late_fee', 'penalty_interest'])
const PENALTY_TYPES = new Set(['late_fee', 'penalty_interest'])

export default function LedgerStatementModal({ loan, onClose }) {
  const { data: ledger = [], isLoading } = useLoanLedger(loan.id)
  const waivePenalty = useWaivePenalty()
  const [waivingEntry, setWaivingEntry] = useState(null)
  const [waiveAmount, setWaiveAmount] = useState('')
  const [waiveNotes, setWaiveNotes] = useState('')
  const [waivedEntryIds, setWaivedEntryIds] = useState(new Set())

  // Rate change informational rows from _rates
  const rateRows = useMemo(
    () =>
      (loan._rates ?? []).map((r) => ({
        type: 'rate_change',
        date: r.effective_from,
        label: `Rate changed → ${r.interest_rate}%/mo (${r.interest_type === 'simple' ? 'Simple' : 'Diminishing'}) · Late ${r.late_fee_rate}% · Penalty ${r.penalty_rate}%`,
      })),
    [loan._rates]
  )

  // Merge: synthetic disbursement row + ledger entries + rate change rows, sorted by date
  const allRows = useMemo(() => {
    return [
      { type: 'disbursement', date: loan.loan_date, amount: loan.amount },
      ...ledger
      .filter((e) => !(e.entry_type === 'interest_charge' && Number(e.amount) === 0))
      .map((e) => ({ type: 'ledger', entry: e, date: e.period_date })),
      ...rateRows,
    ].sort((a, b) => a.date.localeCompare(b.date))
  }, [ledger, rateRows, loan])

  // Compute running balance for each row
  const rowsWithBalance = useMemo(() => {
    let balance = 0
    return allRows.map((row) => {
      if (row.type === 'disbursement') {
        balance = row.amount
        return { ...row, balance }
      }
      if (row.type === 'rate_change') return { ...row, balance }
      const e = row.entry
      if (CHARGE_TYPES.has(e.entry_type)) {
        balance = Math.round((balance + Number(e.amount)) * 100) / 100
      } else if (e.entry_type === 'payment') {
        balance = Math.round((balance - Number(e.amount)) * 100) / 100
      } else if (e.entry_type === 'penalty_waiver') {
        balance = Math.round((balance - Number(e.amount)) * 100) / 100
      }
      return { ...row, balance: Math.max(0, balance) }
    })
  }, [allRows])

  const outstanding = useMemo(() => computeOutstanding(loan.amount, ledger), [loan.amount, ledger])

  async function handleWaive() {
    const amt = Number(waiveAmount)
    if (!waivingEntry || amt <= 0) return
    try {
      await waivePenalty.mutateAsync({ loan, amount: amt, notes: waiveNotes || null })
      setWaivedEntryIds((prev) => new Set([...prev, waivingEntry.id]))
      setWaivingEntry(null)
      setWaiveAmount('')
      setWaiveNotes('')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal title={`Statement — ${loan.description || 'Loan'}`} onClose={onClose}>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Principal Left</p>
          <p className="font-mono font-bold text-gray-900 dark:text-white text-sm">{formatPeso(outstanding.principalBalance)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-[#2D6A4F] dark:text-[#9FE870] uppercase tracking-wide mb-1">Interest Due</p>
          <p className="font-mono font-bold text-[#2D6A4F] dark:text-[#9FE870] text-sm">{formatPeso(outstanding.interestBalance)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-red-500 uppercase tracking-wide mb-1">Penalties</p>
          <p className="font-mono font-bold text-red-500 text-sm">{formatPeso(outstanding.penaltyBalance)}</p>
        </div>
      </div>

      {/* Ledger table */}
      {isLoading ? (
        <p className="text-gray-400 text-center py-6 text-sm">Loading statement…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Entry</th>
                <th className="px-3 py-2 text-right">Charge</th>
                <th className="px-3 py-2 text-right">Payment</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rowsWithBalance.map((row, i) => {
                if (row.type === 'disbursement') {
                  return (
                    <tr key="disbursement" className="bg-white dark:bg-gray-900">
                      <td className="px-3 py-2 text-gray-400">{row.date}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">Loan disbursed</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{formatPeso(row.amount)}</td>
                      <td className="px-3 py-2 text-right text-gray-300 dark:text-gray-600">—</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{formatPeso(row.balance)}</td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  )
                }

                if (row.type === 'rate_change') {
                  return (
                    <tr key={`rate-${i}`} className="bg-blue-50/30 dark:bg-blue-900/10">
                      <td className="px-3 py-2 text-gray-400">{row.date}</td>
                      <td className="px-3 py-2 text-blue-500 dark:text-blue-400 italic" colSpan={3}>{row.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">{formatPeso(row.balance)}</td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  )
                }

                const e = row.entry
                const isCharge = CHARGE_TYPES.has(e.entry_type)
                const isPenalty = PENALTY_TYPES.has(e.entry_type)
                const isWaiver = e.entry_type === 'penalty_waiver'
                const isPayment = e.entry_type === 'payment'

                return (
                  <tr key={e.id} className={`bg-white dark:bg-gray-900 ${isPenalty ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                    <td className="px-3 py-2 text-gray-400">{e.period_date}</td>
                    <td className="px-3 py-2">
                      <span className={
                        isPayment ? 'text-blue-500' :
                        isPenalty ? 'text-red-500' :
                        isWaiver ? 'text-emerald-500' :
                        'text-[#2D6A4F] dark:text-[#9FE870]'
                      }>
                        {ENTRY_LABELS[e.entry_type]}
                      </span>
                      {isPayment && (
                        <p className="text-gray-400 text-xs mt-0.5">
                          → penalty {formatPeso(e.penalty_applied)} · interest {formatPeso(e.interest_applied)} · principal {formatPeso(e.principal_applied)}
                        </p>
                      )}
                      {e.notes && <p className="text-gray-400 text-xs">{e.notes}</p>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {isCharge
                        ? <span className={isPenalty ? 'text-red-500' : 'text-[#2D6A4F] dark:text-[#9FE870]'}>{formatPeso(e.amount)}</span>
                        : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {(isPayment || isWaiver)
                        ? <span className="text-blue-500">−{formatPeso(e.amount)}</span>
                        : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{formatPeso(row.balance)}</td>
                    <td className="px-3 py-2">
                      {isPenalty && outstanding.penaltyBalance > 0 && !waivedEntryIds.has(e.id) && (
                        <button
                          onClick={() => { setWaivingEntry(e); setWaiveAmount(String(e.amount)) }}
                          className="text-xs text-amber-500 hover:text-amber-700 transition-colors">
                          Waive
                        </button>
                      )}
                      {isPenalty && waivedEntryIds.has(e.id) && (
                        <span className="text-xs text-emerald-500">Waived</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Waive panel */}
      {waivingEntry && (
        <div className="border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-4 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
            Waive Penalty ({ENTRY_LABELS[waivingEntry.entry_type]})
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="number" step="0.01" value={waiveAmount}
              onChange={(e) => setWaiveAmount(e.target.value)}
              className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Amount to waive"
            />
            <input
              type="text" value={waiveNotes}
              onChange={(e) => setWaiveNotes(e.target.value)}
              className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Reason (optional)"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setWaivingEntry(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            <Button onClick={handleWaive} disabled={waivePenalty.isPending} className="text-xs py-1 px-3">
              {waivePenalty.isPending ? 'Waiving…' : 'Confirm Waiver'}
            </Button>
          </div>
          {waivePenalty.error && <p className="text-red-500 text-xs mt-1">{waivePenalty.error.message}</p>}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
