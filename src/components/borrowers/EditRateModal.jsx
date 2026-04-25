import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanInterestRateSchema } from '../../lib/zod-schemas.js'
import { useAddLoanInterestRate } from '../../hooks/useLoans.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

const today = new Date().toISOString().slice(0, 10)

const INPUT_CLS =
  'w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent'

const TYPE_LABELS = {
  simple: 'Simple',
  diminishing: 'Diminishing Balance',
}

export default function EditRateModal({ loan, onClose, onSuccess }) {
  const addRate = useAddLoanInterestRate()
  const rates = [...(loan._rates ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from)
  )
  const currentRate = rates[0]

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanInterestRateSchema),
    defaultValues: {
      interest_rate: currentRate?.interest_rate ?? '',
      interest_type: currentRate?.interest_type ?? 'simple',
      late_fee_rate: currentRate?.late_fee_rate ?? 1,
      penalty_rate: currentRate?.penalty_rate ?? 5,
      effective_from: today,
    },
  })

  async function onSubmit(values) {
    try {
      await addRate.mutateAsync({ loan, rateData: values })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  const lastLedgerDate = (loan._ledger ?? []).map((e) => e.period_date).sort().at(-1)

  return (
    <Modal title="Edit Interest Rate" onClose={onClose}>
      {/* Rate history */}
      {rates.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Rate History</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-sm">
            {rates.map((r, i) => (
              <div key={r.id} className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-900">
                <span className={`font-mono text-xs ${i === 0 ? 'text-[#9FE870]' : 'text-gray-400'}`}>
                  {r.effective_from}{i === 0 ? ' ← current' : ''}
                </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {r.interest_rate}%/mo · {TYPE_LABELS[r.interest_type]}
                </span>
                <span className="text-gray-400 text-xs">
                  Late {r.late_fee_rate}% · Penalty {r.penalty_rate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastLedgerDate && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
          Effective date must be on or after <strong>{lastLedgerDate}</strong> (last computed period).
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              New Rate (%/month)
            </label>
            <input {...register('interest_rate')} type="number" step="0.01" className={INPUT_CLS} />
            {errors.interest_rate && <p className="text-red-500 text-xs mt-1">{errors.interest_rate.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Interest Type
            </label>
            <select {...register('interest_type')} className={INPUT_CLS}>
              <option value="simple">Simple</option>
              <option value="diminishing">Diminishing Balance</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Late Fee Rate (%)
            </label>
            <input {...register('late_fee_rate')} type="number" step="0.01" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Penalty Rate (%/month)
            </label>
            <input {...register('penalty_rate')} type="number" step="0.01" className={INPUT_CLS} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Effective From
          </label>
          <input
            {...register('effective_from')}
            type="date"
            min={lastLedgerDate ?? undefined}
            className={INPUT_CLS}
          />
          {errors.effective_from && <p className="text-red-500 text-xs mt-1">{errors.effective_from.message}</p>}
          <p className="text-gray-400 text-xs mt-1">
            All charges from this date onward use the new rate. Past entries are unchanged.
          </p>
        </div>

        {addRate.error && <p className="text-red-500 text-sm">{addRate.error.message}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={addRate.isPending} className="flex-1">
            {addRate.isPending ? 'Saving…' : 'Save New Rate'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
