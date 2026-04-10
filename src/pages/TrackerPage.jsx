import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar.jsx'

export default function TrackerPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:underline text-sm mb-4 block"
        >
          ← Back to Dashboard
        </button>
        <p className="text-white">Tracker for card: {cardId} (TODO)</p>
      </main>
    </div>
  )
}
