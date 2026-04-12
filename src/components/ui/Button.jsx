const variants = {
  primary: 'bg-[#9FE870] hover:bg-[#8ADF5A] text-black',
  ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
  danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30',
}

export default function Button({ children, variant = 'primary', className = '', disabled, ...props }) {
  return (
    <button
      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
