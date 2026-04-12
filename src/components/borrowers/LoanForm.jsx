import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loanSchema } from '../../lib/zod-schemas.js'
import { useAddLoan } from '../../hooks/useLoans.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

const today = new Date().toISOString().slice(0, 10)

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
    },
  })

  const frequency = watch('payment_frequency')
  const notarized = watch('notarized')

  async function onSubmit(values) {
    try {
      const loanData = {
        ...values,
        payment_day: frequency === 'monthly' ? values.payment_day : null,
        next_payment_date: values.next_payment_date || null,
        lawyer_name: values.notarized ? values.lawyer_name : null,
        ptr_number: values.notarized ? values.ptr_number : null,
        date_notarized: values.notarized ? values.date_notarized : null,
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
          <input
            {...register('amount')}
            type="number"
            step="0.01"
            placeholder="5000.00"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        {/* Loan Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Loan Date
          </label>
          <input
            {...register('loan_date')}
            type="date"
            max={today}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
          />
          {errors.loan_date && <p className="text-red-500 text-xs mt-1">{errors.loan_date.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Description (optional)
          </label>
          <input
            {...register('description')}
            placeholder="e.g. Cash loan, iPhone 15"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
          />
        </div>

        {/* Payment Frequency */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Payment Frequency
          </label>
          <select
            {...register('payment_frequency')}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
          >
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
            <select
              {...register('payment_day')}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
            >
              <option value="">Select day</option>
              <option value={15}>15th</option>
              <option value={30}>30th</option>
            </select>
            {errors.payment_day && <p className="text-red-500 text-xs mt-1">{errors.payment_day.message}</p>}
          </div>
        )}

        {/* Next Payment Date (weekly or monthly) */}
        {frequency !== 'one-time' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              First Payment Date
            </label>
            <input
              {...register('next_payment_date')}
              type="date"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
            />
          </div>
        )}

        {/* Notarized toggle */}
        <div className="flex items-center gap-2">
          <input
            {...register('notarized')}
            type="checkbox"
            id="notarized"
            className="h-4 w-4 rounded border-gray-300 accent-[#9FE870]"
          />
          <label htmlFor="notarized" className="text-sm text-gray-700 dark:text-gray-200">
            This loan is notarized
          </label>
        </div>

        {/* Notarization fields */}
        {notarized && (
          <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            {[
              { name: 'lawyer_name', label: 'Lawyer Name', placeholder: 'Atty. Juan dela Cruz' },
              { name: 'ptr_number', label: 'PTR Number', placeholder: 'PTR-12345' },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  {label}
                </label>
                <input
                  {...register(name)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
                />
                {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>}
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Date Notarized
              </label>
              <input
                {...register('date_notarized')}
                type="date"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
              />
            </div>
          </div>
        )}

        {addLoan.error && (
          <p className="text-red-500 text-sm">{addLoan.error.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={addLoan.isPending} className="flex-1">
            {addLoan.isPending ? 'Saving…' : 'Add Loan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
