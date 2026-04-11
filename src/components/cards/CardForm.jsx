import { forwardRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cardSchema } from '../../lib/zod-schemas.js'
import { BANK_PRESETS } from '../../lib/banks.js'
import { useAddCard, useUpdateCard, useDeleteCard } from '../../hooks/useCards.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'

const InputField = forwardRef(function InputField({ label, error, ...props }, ref) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <input
        ref={ref}
        className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        {...props}
      />
      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
    </div>
  )
})

export default function CardForm({ card, onClose, onSuccess }) {
  const isEdit = !!card?.id

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(cardSchema),
    defaultValues: card ?? {
      bank_name: '',
      nickname: '',
      cardholder_name: '',
      expiry_display: '',
      mock_last4: '0000',
      spending_limit: '',
      color_primary: BANK_PRESETS[0].color_primary,
      color_secondary: BANK_PRESETS[0].color_secondary,
    },
  })

  const [confirmDelete, setConfirmDelete] = useState(false)
  const addCard = useAddCard()
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()

  function applyPreset(preset) {
    setValue('bank_name', preset.name)
    setValue('color_primary', preset.color_primary)
    setValue('color_secondary', preset.color_secondary)
  }

  async function onSubmit(data) {
    if (isEdit) {
      await updateCard.mutateAsync({ id: card.id, ...data })
    } else {
      await addCard.mutateAsync(data)
    }
    onSuccess?.()
    onClose()
  }

  async function handleDelete() {
    await deleteCard.mutateAsync(card.id)
    onClose()
  }

  const isPending = addCard.isPending || updateCard.isPending
  const mutationError = addCard.error || updateCard.error

  return (
    <Modal title={isEdit ? 'Edit Card' : 'Add Card'} onClose={onClose}>
      {/* Bank presets */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {BANK_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p)}
            className="px-2 py-1 rounded text-xs font-medium text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: p.color_primary }}
          >
            {p.id === 'custom' ? 'Custom' : p.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {mutationError && (
          <p className="bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 text-xs rounded-lg px-3 py-2">
            {mutationError.message}
          </p>
        )}

        <InputField
          label="Bank Name"
          placeholder="Security Bank"
          error={errors.bank_name?.message}
          {...register('bank_name')}
        />
        <InputField
          label="Card Nickname"
          placeholder="My Main Card"
          error={errors.nickname?.message}
          {...register('nickname')}
        />
        <InputField
          label="Cardholder Name"
          placeholder="JUAN DELA CRUZ"
          error={errors.cardholder_name?.message}
          {...register('cardholder_name')}
        />
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Expiry (MM/YY)"
            placeholder="12/26"
            error={errors.expiry_display?.message}
            {...register('expiry_display')}
          />
          <InputField
            label="Last 4 Digits"
            placeholder="0000"
            maxLength={4}
            error={errors.mock_last4?.message}
            {...register('mock_last4')}
          />
        </div>
        <InputField
          label="Spending Limit (PHP)"
          type="number"
          placeholder="100000"
          error={errors.spending_limit?.message}
          {...register('spending_limit')}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Primary Color</label>
            <input
              type="color"
              {...register('color_primary')}
              className="h-9 w-full rounded cursor-pointer bg-gray-800 border border-gray-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Secondary Color</label>
            <input
              type="color"
              {...register('color_secondary')}
              className="h-9 w-full rounded cursor-pointer bg-gray-800 border border-gray-600"
            />
          </div>
        </div>

        {confirmDelete && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-red-700 dark:text-red-300 text-sm">Delete this card and all its transactions? This cannot be undone.</p>
            <div className="flex gap-2 flex-shrink-0">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)} className="text-xs py-1 px-2">
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete} disabled={deleteCard.isPending} className="text-xs py-1 px-2">
                {deleteCard.isPending ? 'Deleting…' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {isEdit && !confirmDelete && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              className="flex-1"
            >
              Delete
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Card'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
