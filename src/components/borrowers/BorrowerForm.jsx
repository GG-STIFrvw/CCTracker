import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { borrowerSchema } from '../../lib/zod-schemas.js'
import { useAddBorrower, useUpdateBorrower, useArchiveBorrower } from '../../hooks/useBorrowers.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { TrashIcon } from '../ui/icons.jsx'

export default function BorrowerForm({ borrower = null, onClose, onSuccess }) {
  const isEditing = !!borrower
  const addBorrower = useAddBorrower()
  const updateBorrower = useUpdateBorrower()
  const archiveBorrower = useArchiveBorrower()
  const mutation = isEditing ? updateBorrower : addBorrower
  const [confirmDelete, setConfirmDelete] = useState(false)

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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              {label}
            </label>
            <input
              {...register(name)}
              placeholder={placeholder}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent"
            />
            {errors[name] && (
              <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>
            )}
          </div>
        ))}

        {mutation.error && (
          <p className="text-red-500 text-sm">{mutation.error.message}</p>
        )}

        <div className="flex gap-2 pt-2 items-center">
          {isEditing && (
            confirmDelete ? (
              <div className="flex items-center gap-2 mr-auto">
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Delete borrower?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await archiveBorrower.mutateAsync(borrower.id)
                    onClose()
                  }}
                  className="text-xs text-red-500 hover:text-red-600 font-semibold transition-colors"
                  disabled={archiveBorrower.isPending}
                >
                  Yes
                </button>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mr-auto"
                title="Delete borrower"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            )
          )}
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
