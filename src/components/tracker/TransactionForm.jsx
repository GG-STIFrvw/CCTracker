import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { transactionSchema } from '../../lib/zod-schemas.js'
import { useAddTransaction } from '../../hooks/useTransactions.js'
import { getRemainingBalance } from '../../utils/money.js'
import Button from '../ui/Button.jsx'

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      {children}
      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
    </div>
  )
}

const inputCls =
  'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full transition-colors'

const today = new Date().toISOString().split('T')[0]

export default function TransactionForm({ cardId, card, transactions = [], onSuccess }) {
  const outstanding = transactions.reduce(
    (acc, t) => acc + getRemainingBalance(t.amount, t.amount_paid),
    0
  )
  const availableCredit = (card?.spending_limit ?? Infinity) - outstanding

  const schema = transactionSchema.extend({
    amount: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .positive('Amount must be greater than 0')
      .max(availableCredit, `Exceeds available credit (₱${availableCredit.toLocaleString('en-PH', { minimumFractionDigits: 2 })})`),
    transaction_date: z.string()
      .min(1, 'Date is required')
      .refine((d) => d <= today, 'Transaction date cannot be in the future'),
  })

  const addTransaction = useAddTransaction()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_due_date: '',
      notes: '',
    },
  })

  async function onSubmit(data) {
    await addTransaction.mutateAsync({ cardId, transactionData: data })
    reset({
      transaction_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_due_date: '',
      notes: '',
    })
    onSuccess?.()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
    >
      <h3 className="text-gray-900 dark:text-white font-semibold mb-4 text-sm">Add Transaction</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Date" error={errors.transaction_date?.message}>
          <input type="date" max={today} className={inputCls} {...register('transaction_date')} />
        </Field>
        <Field label="Amount (PHP)" error={errors.amount?.message}>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className={inputCls}
            {...register('amount')}
          />
        </Field>
        <Field label="Payment Due Date" error={errors.payment_due_date?.message}>
          <input type="date" className={inputCls} {...register('payment_due_date')} />
        </Field>
        <Field label="Notes (optional)" error={errors.notes?.message}>
          <input
            type="text"
            placeholder="Groceries, utilities…"
            className={inputCls}
            {...register('notes')}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between mt-4">
        {addTransaction.isError && (
          <p className="text-red-500 dark:text-red-400 text-xs">{addTransaction.error?.message}</p>
        )}
        <div className="ml-auto">
          <Button type="submit" disabled={addTransaction.isPending}>
            {addTransaction.isPending ? 'Adding…' : '+ Add Transaction'}
          </Button>
        </div>
      </div>
    </form>
  )
}
