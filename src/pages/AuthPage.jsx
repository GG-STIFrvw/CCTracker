import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase.js'
import { loginSchema, registerSchema } from '../lib/zod-schemas.js'
import Button from '../components/ui/Button.jsx'

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

function InputField({ label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">{label}</label>
      <input
        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        {...props}
      />
      {error && <p className="text-red-400 text-xs mt-0.5">{error}</p>}
    </div>
  )
}

function LoginForm({ onSwitch, onForgot }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) })

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
      <InputField
        label="Password"
        type="password"
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
        <button type="button" onClick={onSwitch} className="text-blue-400 hover:underline">
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
  } = useForm({ resolver: zodResolver(registerSchema) })

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
          className="text-blue-400 text-sm mt-4 hover:underline block mx-auto"
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
      <InputField
        label="Password"
        type="password"
        placeholder="Min. 8 characters"
        error={errors.password?.message}
        {...register('password')}
      />
      <InputField
        label="Confirm Password"
        type="password"
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
        className="text-blue-400 text-sm text-center hover:underline"
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
          className="text-blue-400 text-sm mt-4 hover:underline block mx-auto"
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
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
  const [tab, setTab] = useState('login') // 'login' | 'register' | 'forgot'

  const titles = { login: 'Sign In', register: 'Create Account', forgot: 'Reset Password' }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-600 rounded-xl px-4 py-2 mb-4">
            <span className="font-bold text-white text-lg tracking-tight">CC</span>
            <span className="text-blue-200 text-sm">Tracker</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{titles[tab]}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tab === 'login' && 'Track your credit card spending'}
            {tab === 'register' && 'Get started for free'}
            {tab === 'forgot' && 'We\'ll send you a reset link'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
          {tab === 'login' && (
            <LoginForm
              onSwitch={() => setTab('register')}
              onForgot={() => setTab('forgot')}
            />
          )}
          {tab === 'register' && <RegisterForm onSwitch={() => setTab('login')} />}
          {tab === 'forgot' && <ForgotPasswordForm onBack={() => setTab('login')} />}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Your data is stored securely. No card numbers ever saved.
        </p>
      </div>
    </div>
  )
}
