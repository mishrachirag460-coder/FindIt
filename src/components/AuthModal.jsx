/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthModal({ isOpen, onClose, defaultTab = 'signin' }) {
  const { signIn, signUpStudent } = useAuth()

  const [activeTab, setActiveTab] = useState(defaultTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Registration Form State
  const [regFullName, setRegFullName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  // Reset all form inputs and feedback messages
  const resetFormState = () => {
    setError(null)
    setSuccess(null)
    setSignInEmail('')
    setSignInPassword('')
    setRegFullName('')
    setRegEmail('')
    setRegPassword('')
    setRegConfirmPassword('')
  }

  // Sync activeTab with defaultTab and clear stale state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
      resetFormState()
    }
  }, [isOpen, defaultTab])

  if (!isOpen) return null

  // Safe close: prevent closing while an auth request is in progress
  const handleClose = () => {
    if (loading) return
    resetFormState()
    if (onClose) onClose()
  }

  // Tab switching: prevented while loading; clears messages
  const handleTabSwitch = (newTab) => {
    if (loading) return
    setActiveTab(newTab)
    setError(null)
    setSuccess(null)
  }

  // Handle Sign In submission
  const handleSignInSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!signInEmail.trim() || !signInPassword) {
      setError('Please fill in both email and password.')
      return
    }

    try {
      setLoading(true)
      await signIn(signInEmail, signInPassword)
      setSuccess('Signed in successfully!')
      setTimeout(() => {
        handleClose()
      }, 700)
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Student Registration submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!regFullName.trim() || !regEmail.trim() || !regPassword || !regConfirmPassword) {
      setError('Please fill in all registration fields.')
      return
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please re-enter.')
      return
    }

    try {
      setLoading(true)
      const data = await signUpStudent(regFullName, regEmail, regPassword)

      // Reset registration inputs
      setRegFullName('')
      setRegEmail('')
      setRegPassword('')
      setRegConfirmPassword('')

      // Handle both signup outcomes:
      // a. If signup returns an active session, student is already logged in
      if (data?.session) {
        setSuccess('Registration successful! You are now logged in with your FindIt ID.')
        setTimeout(() => {
          handleClose()
        }, 1200)
      } else {
        // b. If no session returned, email confirmation is required
        setSuccess('Registration successful! Please check your email to verify your account before signing in.')
        setTimeout(() => {
          setActiveTab('signin')
        }, 3500)
      }
    } catch (err) {
      setError(err.message || 'Failed to register account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {activeTab === 'signin' ? 'Welcome Back' : 'Student Registration'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            aria-label="Close modal"
            className="text-2xl font-semibold text-slate-400 hover:text-red-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
          >
            ×
          </button>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          {activeTab === 'signin'
            ? 'Sign in to access your FindIt dashboard and item recovery.'
            : 'Create your student account to receive your unique FindIt ID.'}
        </p>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => handleTabSwitch('signin')}
            disabled={loading}
            className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors focus:outline-none ${
              loading ? 'cursor-not-allowed' : ''
            } ${
              activeTab === 'signin'
                ? 'border-b-2 border-blue-700 text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('register')}
            disabled={loading}
            className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors focus:outline-none ${
              loading ? 'cursor-not-allowed' : ''
            } ${
              activeTab === 'register'
                ? 'border-b-2 border-blue-700 text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Student Sign Up
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Sign In Form */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignInSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="signin-email" className="mb-1 block text-sm font-medium text-slate-700">
                College Email
              </label>
              <input
                id="signin-email"
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="student@campus.edu"
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="signin-password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Student Registration Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="reg-name" className="mb-1 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-slate-700">
                College Email
              </label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="student@campus.edu"
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="mb-1 block text-sm font-medium text-slate-700">
                Password (min. 6 characters)
              </label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="reg-confirm-password" className="mb-1 block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                id="reg-confirm-password"
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              ℹ️ Public registration creates a verified <strong>STUDENT</strong> profile with an automated <strong>FindIt ID</strong>.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Complete Student Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
