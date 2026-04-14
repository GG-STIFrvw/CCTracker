import { formatPeso } from '../../utils/money.js'
import { CATEGORIES } from '../../utils/expenses.js'
import {
  UtilitiesIcon, FoodIcon, TransportIcon, RentIcon,
  HealthcareIcon, ShoppingIcon, EntertainmentIcon,
  SubscriptionsIcon, EducationIcon, PersonalCareIcon,
  InsuranceIcon, OthersIcon,
} from '../ui/icons.jsx'

const ICONS = {
  utilities: UtilitiesIcon,
  food: FoodIcon,
  transportation: TransportIcon,
  rent: RentIcon,
  healthcare: HealthcareIcon,
  shopping: ShoppingIcon,
  entertainment: EntertainmentIcon,
  subscriptions: SubscriptionsIcon,
  education: EducationIcon,
  personal_care: PersonalCareIcon,
  insurance: InsuranceIcon,
  others: OthersIcon,
}

export default function CategoryTiles({ totals, activeCategory, onSelect }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-6">
      {CATEGORIES.map((cat) => {
        const Icon = ICONS[cat.value]
        const amount = totals[cat.value] ?? 0
        const isActive = activeCategory === cat.value
        const hasAmount = amount > 0

        return (
          <button
            key={cat.value}
            onClick={() => onSelect(isActive ? null : cat.value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all text-center ${
              isActive
                ? 'border-2 shadow-sm'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } ${hasAmount ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-900/50 opacity-60'}`}
            style={isActive ? { borderColor: cat.color } : {}}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: cat.color + '22', color: cat.color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-200 leading-tight">
              {cat.label}
            </p>
            <p
              className="text-xs font-mono font-semibold"
              style={{ color: hasAmount ? cat.color : '#9CA3AF' }}
            >
              {formatPeso(amount)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
