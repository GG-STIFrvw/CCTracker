import { useState, forwardRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase.js'
import { loginSchema, registerSchema } from '../lib/zod-schemas.js'
import Button from '../components/ui/Button.jsx'
import { OwlIcon } from '../components/ui/icons.jsx'
import useAppStore from '../store/useAppStore.js'

async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

function GoogleButton() {
  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium text-sm px-4 py-2 rounded-lg transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google
    </button>
  )
}

const InputField = forwardRef(function InputField({ label, error, ...props }, ref) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-600 dark:text-gray-400">{label}</label>
      <input
        ref={ref}
        className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent transition-colors"
        {...props}
      />
      {error && <p className="text-red-500 dark:text-red-400 text-xs mt-0.5">{error}</p>}
    </div>
  )
})

const PasswordField = forwardRef(function PasswordField({ label, error, ...props }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-600 dark:text-gray-400">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent transition-colors"
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          tabIndex={-1}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="text-red-500 dark:text-red-400 text-xs mt-0.5">{error}</p>}
    </div>
  )
})

function LoginForm({ onSwitch, onForgot }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  async function onSubmit(data) {
    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    setLoading(false)
    if (error) { setServerError(error.message); return }
    navigate('/')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <p className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}
      <InputField
        label="Email"
        type="email"
        placeholder="you@email.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        label="Password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" disabled={loading} className="w-full justify-center">
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>

      <div className="relative flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-gray-500 text-xs">or</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      <GoogleButton />

      <div className="flex justify-between text-sm">
        <button type="button" onClick={onForgot} className="text-gray-500 hover:text-gray-300 transition-colors">
          Forgot password?
        </button>
        <button type="button" onClick={onSwitch} className="text-[#2D6A4F] dark:text-[#9FE870] hover:underline">
          Create account
        </button>
      </div>
    </form>
  )
}

function RegisterForm({ onSwitch }) {
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(data) {
    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    setLoading(false)
    if (error) { setServerError(error.message); return }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">📧</div>
        <p className="text-white font-medium">Check your email</p>
        <p className="text-gray-400 text-sm mt-1">
          A confirmation link has been sent to your inbox.
        </p>
        <button
          type="button"
          onClick={onSwitch}
          className="text-[#2D6A4F] dark:text-[#9FE870] text-sm mt-4 hover:underline block mx-auto"
        >
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <p className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}
      <InputField
        label="Email"
        type="email"
        placeholder="you@email.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        label="Password"
        placeholder="Min. 8 characters"
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField
        label="Confirm Password"
        placeholder="••••••••"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" disabled={loading} className="w-full justify-center">
        {loading ? 'Creating account…' : 'Create Account'}
      </Button>
      <button
        type="button"
        onClick={onSwitch}
        className="text-[#2D6A4F] dark:text-[#9FE870] text-sm text-center hover:underline"
      >
        Already registered? Sign In
      </button>
    </form>
  )
}

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) { setError('Email is required'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">✉️</div>
        <p className="text-white font-medium">Reset link sent</p>
        <p className="text-gray-400 text-sm mt-1">Check your inbox for the password reset link.</p>
        <button
          type="button"
          onClick={onBack}
          className="text-[#2D6A4F] dark:text-[#9FE870] text-sm mt-4 hover:underline block mx-auto"
        >
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400">Email</label>
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:border-transparent w-full"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full justify-center">
        {loading ? 'Sending…' : 'Send Reset Link'}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="text-gray-500 text-sm text-center hover:text-gray-300 transition-colors"
      >
        Back to Sign In
      </button>
    </form>
  )
}

export default function AuthPage() {
  const user = useAppStore((s) => s.user)
  const [tab, setTab] = useState('login') // 'login' | 'register' | 'forgot'

  if (user) return <Navigate to="/" replace />

  const titles = { login: 'Sign In', register: 'Create Account', forgot: 'Reset Password' }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card — logo, brand, title, and form all inside */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-8 pt-8 pb-6 shadow-xl">
          {/* Logo + brand */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <OwlIcon className="w-16 h-16" />
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              CC <span className="text-[#9FE870]">Tracker</span>
            </p>
          </div>

          {/* Title + subtitle */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{titles[tab]}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {tab === 'login' && 'Control Your Cards. Track Every Debt.'}
              {tab === 'register' && 'Get started for free'}
              {tab === 'forgot' && "We'll send you a reset link"}
            </p>
          </div>

          {tab === 'login' && (
            <LoginForm
              onSwitch={() => setTab('register')}
              onForgot={() => setTab('forgot')}
            />
          )}
          {tab === 'register' && <RegisterForm onSwitch={() => setTab('login')} />}
          {tab === 'forgot' && <ForgotPasswordForm onBack={() => setTab('login')} />}
        </div>

        <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-6">
          Your data is stored securely. No card numbers ever saved.
        </p>
      </div>
    </div>
  )
}
