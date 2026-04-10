import { useState } from 'react'
import Navbar from '../components/layout/Navbar.jsx'
import CardTile from '../components/cards/CardTile.jsx'
import CardForm from '../components/cards/CardForm.jsx'
import { useCards } from '../hooks/useCards.js'
import Button from '../components/ui/Button.jsx'
import { useToast, ToastContainer } from '../components/ui/Toast.jsx'

export default function DashboardPage() {
  const { data: cards = [], isLoading, error } = useCards()
  const [showAdd, setShowAdd] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const { toasts, toast } = useToast()

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Cards</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {cards.length} card{cards.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)}>+ Add Card</Button>
        </div>

        {isLoading && (
          <div className="text-gray-500 text-center py-20">Loading cards…</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            Failed to load cards: {error.message}
          </div>
        )}

        {!isLoading && !error && cards.length === 0 && (
          <div className="text-center py-24 border border-dashed border-gray-700 rounded-2xl">
            <div className="text-5xl mb-4">💳</div>
            <p className="text-gray-300 text-lg font-medium">No cards yet</p>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Add your first credit card to start tracking spending
            </p>
            <Button onClick={() => setShowAdd(true)}>+ Add Your First Card</Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onEdit={(c) => setEditingCard(c)}
            />
          ))}
        </div>
      </main>

      {showAdd && (
        <CardForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => toast('Card added!', 'success')}
        />
      )}

      {editingCard && (
        <CardForm
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSuccess={() => toast('Card updated!', 'success')}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
