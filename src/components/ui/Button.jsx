const variants = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  ghost: 'bg-transparent hover:bg-gray-700 text-gray-300 border border-gray-600',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
}

export default function Button({ children, variant = 'primary', className = '', disabled, ...props }) {
  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
