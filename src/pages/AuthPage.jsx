import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase.js'
import { loginSchema, registerSchema } from '../lib/zod-schemas.js'
import Button from '../components/ui/Button.jsx'

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
