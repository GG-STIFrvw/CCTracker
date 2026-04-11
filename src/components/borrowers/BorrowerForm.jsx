import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { borrowerSchema } from '../../lib/zod-schemas.js'
import { useAddBorrower, useUpdateBorrower } from '../../hooks/useBorrowers.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

export default function BorrowerForm({ borrower = null, onClose, onSuccess }) {
  const isEditing = !!borrower
  const addBorrower = useAddBorrower()
  const updateBorrower = useUpdateBorrower()
  const mutation = isEditing ? updateBorrower : addBorrower

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(borrowerSchema),
    defaultValues: borrower ?? { full_name: '', address: '', phone: '', email: '' },
  })

  useEffect(() => {
    if (borrower) reset(borrower)
  }, [borrower, reset])

  async function onSubmit(values) {
    try {
      if (isEditing) {
        await mutation.mutateAsync({ id: borrower.id, ...values })
      } else {
        await mutation.mutateAsync(values)
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal title={isEditing ? 'Edit Borrower' : 'Add Borrower'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {[
          { name: 'full_name', label: 'Full Name', placeholder: 'Juan dela Cruz' },
          { name: 'address', label: 'Address', placeholder: 'Block 1 Lot 2, Barangay...' },
          { name: 'phone', label: 'Phone Number', placeholder: '09XX XXX XXXX' },
          { name: 'email', label: 'Email', placeholder: 'juan@example.com' },
        ].map(({ name, label, placeholder }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {label}
            </label>
            <input
              {...register(name)}
              placeholder={placeholder}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors[name] && (
              <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>
            )}
          </div>
        ))}

        {mutation.error && (
          <p className="text-red-500 text-sm">{mutation.error.message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending} className="flex-1">
            {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Borrower'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
