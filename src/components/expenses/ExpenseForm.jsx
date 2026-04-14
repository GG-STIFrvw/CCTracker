import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema } from '../../lib/zod-schemas.js'
import { useAddExpense, useEditExpense } from '../../hooks/useExpenses.js'
import { CATEGORIES, PAYMENT_METHODS } from '../../utils/expenses.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

const today = new Date().toISOString().slice(0, 10)

const inputClass =
  'w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent'

const labelClass =
  'block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5'

export default function ExpenseForm({ expense = null, onClose, onSuccess }) {
  const isEdit = !!expense
  const addExpense = useAddExpense()
  const editExpense = useEditExpense()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expense_date: expense?.expense_date ?? today,
      category: expense?.category ?? '',
      description: expense?.description ?? '',
      amount: expense?.amount ?? '',
      payment_method: expense?.payment_method ?? '',
      notes: expense?.notes ?? '',
    },
  })

  async function onSubmit(values) {
    try {
      if (isEdit) {
        await editExpense.mutateAsync({ id: expense.id, expenseData: values })
      } else {
        await addExpense.mutateAsync(values)
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  const isPending = addExpense.isPending || editExpense.isPending
  const mutationError = addExpense.error || editExpense.error

  return (
    <Modal title={isEdit ? 'Edit Expense' : 'Add Expense'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Date */}
        <div>
          <label className={labelClass}>Date</label>
          <input
            {...register('expense_date')}
            type="date"
            max={today}
            className={inputClass}
          />
          {errors.expense_date && (
            <p className="text-red-500 text-xs mt-1">{errors.expense_date.message}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className={labelClass}>Category</label>
          <select {...register('category')} className={inputClass}>
            <option value="">Select category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {errors.category && (
            <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <input
            {...register('description')}
            type="text"
            placeholder="e.g. Meralco bill, Groceries, Rent"
            className={inputClass}
          />
          {errors.description && (
            <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className={labelClass}>Amount (PHP)</label>
          <input
            {...register('amount')}
            type="number"
            step="0.01"
            placeholder="0.00"
            className={inputClass}
          />
          {errors.amount && (
            <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label className={labelClass}>Payment Method</label>
          <select {...register('payment_method')} className={inputClass}>
            <option value="">Select method</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {errors.payment_method && (
            <p className="text-red-500 text-xs mt-1">{errors.payment_method.message}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            {...register('notes')}
            rows={2}
            placeholder="Any additional details…"
            className={inputClass}
          />
        </div>

        {mutationError && (
          <p className="text-red-500 text-sm">{mutationError.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
