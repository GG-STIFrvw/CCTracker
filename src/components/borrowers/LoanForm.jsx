import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanSchema } from '../../lib/zod-schemas.js'
import { useAddLoan } from '../../hooks/useLoans.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

const today = new Date().toISOString().slice(0, 10)

const INPUT_CLS =
  'w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent'

export default function LoanForm({ borrowerId, onClose, onSuccess }) {
  const addLoan = useAddLoan()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      amount: '',
      loan_date: today,
      description: '',
      payment_frequency: 'one-time',
      payment_day: null,
      next_payment_date: '',
      notarized: false,
      lawyer_name: '',
      ptr_number: '',
      date_notarized: '',
      interest_bearing: false,
      minimum_payment: '',
      interest_rate: '',
      interest_type: 'simple',
      late_fee_rate: '1',
      penalty_rate: '5',
    },
  })

  const frequency = watch('payment_frequency')
  const notarized = watch('notarized')
  const interestBearing = watch('interest_bearing')

  async function onSubmit(values) {
    try {
      const loanData = {
        ...values,
        payment_day: frequency === 'monthly' ? values.payment_day : null,
        next_payment_date: values.next_payment_date || null,
        lawyer_name: values.notarized ? values.lawyer_name : null,
        ptr_number: values.notarized ? values.ptr_number : null,
        date_notarized: values.notarized ? values.date_notarized : null,
        minimum_payment: values.interest_bearing && values.minimum_payment ? Number(values.minimum_payment) : null,
        interest_rate: values.interest_bearing ? Number(values.interest_rate) : null,
        interest_type: values.interest_bearing ? values.interest_type : null,
        late_fee_rate: values.interest_bearing ? Number(values.late_fee_rate) : null,
        penalty_rate: values.interest_bearing ? Number(values.penalty_rate) : null,
      }
      await addLoan.mutateAsync({ borrowerId, loanData })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal title="Add Loan" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Loan Amount (PHP)
          </label>
          <input {...register('amount')} type="number" step="0.01" placeholder="5000.00" className={INPUT_CLS} />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        {/* Loan Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Loan Date
          </label>
          <input {...register('loan_date')} type="date" max={today} className={INPUT_CLS} />
          {errors.loan_date && <p className="text-red-500 text-xs mt-1">{errors.loan_date.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Description (optional)
          </label>
          <input {...register('description')} placeholder="e.g. Cash loan, iPhone 15" className={INPUT_CLS} />
        </div>

        {/* Payment Frequency */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Payment Frequency
          </label>
          <select {...register('payment_frequency')} className={INPUT_CLS}>
            <option value="one-time">One-time</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Payment Day (monthly only) */}
        {frequency === 'monthly' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Payment Day
            </label>
            <select {...register('payment_day')} className={INPUT_CLS}>
              <option value="">Select day</option>
              <option value={15}>15th</option>
              <option value={30}>30th</option>
            </select>
            {errors.payment_day && <p className="text-red-500 text-xs mt-1">{errors.payment_day.message}</p>}
          </div>
        )}

        {/* First Payment Date */}
        {frequency !== 'one-time' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              First Payment Date
            </label>
            <input {...register('next_payment_date')} type="date" className={INPUT_CLS} />
          </div>
        )}

        {/* Notarized */}
        <div className="flex items-center gap-2">
          <input {...register('notarized')} type="checkbox" id="notarized" className="h-4 w-4 rounded border-gray-300 accent-[#9FE870]" />
          <label htmlFor="notarized" className="text-sm text-gray-700 dark:text-gray-200">
            This loan is notarized
          </label>
        </div>

        {notarized && (
          <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            {[
              { name: 'lawyer_name', label: 'Lawyer Name', placeholder: 'Atty. Juan dela Cruz' },
              { name: 'ptr_number', label: 'PTR Number', placeholder: 'PTR-12345' },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">{label}</label>
                <input {...register(name)} placeholder={placeholder} className={INPUT_CLS} />
                {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>}
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Date Notarized</label>
              <input {...register('date_notarized')} type="date" className={INPUT_CLS} />
            </div>
          </div>
        )}

        {/* Interest toggle */}
        <div className="flex items-center gap-2">
          <input {...register('interest_bearing')} type="checkbox" id="interest_bearing" className="h-4 w-4 rounded border-gray-300 accent-[#9FE870]" />
          <label htmlFor="interest_bearing" className="text-sm text-gray-700 dark:text-gray-200">
            This loan earns interest
          </label>
        </div>

        {/* Interest fields */}
        {interestBearing && (
          <div className="space-y-3 border border-[#9FE870]/30 dark:border-[#9FE870]/20 rounded-lg p-3 bg-[#9FE870]/5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Interest Rate (%/month)
                </label>
                <input {...register('interest_rate')} type="number" step="0.01" placeholder="4.00" className={INPUT_CLS} />
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
                <input {...register('late_fee_rate')} type="number" step="0.01" placeholder="1.00" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Penalty Rate (%/month)
                </label>
                <input {...register('penalty_rate')} type="number" step="0.01" placeholder="5.00" className={INPUT_CLS} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Minimum Monthly Payment (PHP) — optional
              </label>
              <input {...register('minimum_payment')} type="number" step="0.01" placeholder="7000.00 — leave blank if any amount clears the period" className={INPUT_CLS} />
              <p className="text-gray-400 text-xs mt-1">
                If set, partial payments below this amount still trigger late fees.
              </p>
            </div>
          </div>
        )}

        {addLoan.error && <p className="text-red-500 text-sm">{addLoan.error.message}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={addLoan.isPending} className="flex-1">
            {addLoan.isPending ? 'Saving…' : 'Add Loan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
