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
  const [regCourse, setRegCourse] = useState('')
  const [regCustomCourse, setRegCustomCourse] = useState('')
  const [regAcademicYear, setRegAcademicYear] = useState('')
  const [regSection, setRegSection] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [duplicateAccountEmail, setDuplicateAccountEmail] = useState(null)

  // Reset all form inputs and feedback messages
  const resetFormState = () => {
    setError(null)
    setSuccess(null)
    setDuplicateAccountEmail(null)
    setSignInEmail('')
    setSignInPassword('')
    setRegFullName('')
    setRegCourse('')
    setRegCustomCourse('')
    setRegAcademicYear('')
    setRegSection('')
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
    setDuplicateAccountEmail(null)
  }

  // Switch to sign-in tab with prefilled email
  const handleNavigateToSignIn = (emailToPrefill) => {
    if (loading) return
    setActiveTab('signin')
    setError(null)
    setSuccess(null)
    setDuplicateAccountEmail(null)
    if (emailToPrefill) {
      setSignInEmail(emailToPrefill)
    }
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
    setDuplicateAccountEmail(null)

    if (!regFullName.trim()) {
      setError('Please enter your full name.')
      return
    }

    if (!regCourse) {
      setError('Please select your course.')
      return
    }

    if (regCourse === 'Other' && !regCustomCourse.trim()) {
      setError('Please specify your course name.')
      return
    }

    if (!regAcademicYear) {
      setError('Please select your academic year (1st, 2nd, or 3rd).')
      return
    }

    if (!regSection.trim()) {
      setError('Please enter your class section.')
      return
    }

    if (!regEmail.trim()) {
      setError('Please enter your college email.')
      return
    }

    if (!regPassword) {
      setError('Please enter a password.')
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

    const effectiveCourse = regCourse === 'Other' ? regCustomCourse.trim() : regCourse
    const normalizedEmail = regEmail.trim()

    try {
      setLoading(true)
      const data = await signUpStudent(regFullName, normalizedEmail, regPassword, {
        course: effectiveCourse,
        academic_year: regAcademicYear,
        section: regSection.trim().toUpperCase(),
      })

      // Supabase Duplicate Account Detection (Email Confirmations ON):
      // When email confirmations are enabled, Supabase does not throw an error on duplicate signup
      // to avoid enumeration attacks. Instead, data.user is returned with identities = [].
      const isDuplicateUser = data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
      if (isDuplicateUser) {
        setDuplicateAccountEmail(normalizedEmail)
        setError('This account is already registered. Please sign in using your existing account.')
        return
      }

      // Reset registration inputs
      setRegFullName('')
      setRegCourse('')
      setRegCustomCourse('')
      setRegAcademicYear('')
      setRegSection('')
      setRegEmail('')
      setRegPassword('')
      setRegConfirmPassword('')
      setDuplicateAccountEmail(null)

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
      // Supabase Duplicate Account Detection (Email Confirmations OFF or API error):
      const errMsg = err?.message?.toLowerCase() || ''
      const isDuplicateError =
        err?.code === 'user_already_exists' ||
        errMsg.includes('already registered') ||
        errMsg.includes('already exists') ||
        errMsg.includes('user already exists')

      if (isDuplicateError) {
        setDuplicateAccountEmail(normalizedEmail)
        setError('This account is already registered. Please sign in using your existing account.')
      } else {
        setError(err.message || 'Failed to register account. Please try again.')
      }
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
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none">⚠️</span>
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {duplicateAccountEmail && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => handleNavigateToSignIn(duplicateAccountEmail)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
                    >
                      Sign In with {duplicateAccountEmail} →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700">
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

            {/* Course Dropdown */}
            <div>
              <label htmlFor="reg-course" className="mb-1 block text-sm font-medium text-slate-700">
                Course
              </label>
              <select
                id="reg-course"
                value={regCourse}
                onChange={(e) => setRegCourse(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm bg-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="" disabled>Select Course</option>
                <option value="MCA">MCA</option>
                <option value="BCA">BCA</option>
                <option value="BBA">BBA</option>
                <option value="MBA">MBA</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Custom Course (conditional when Other is selected) */}
            {regCourse === 'Other' && (
              <div>
                <label htmlFor="reg-custom-course" className="mb-1 block text-sm font-medium text-slate-700">
                  Specify Course Name
                </label>
                <input
                  id="reg-custom-course"
                  type="text"
                  value={regCustomCourse}
                  onChange={(e) => setRegCustomCourse(e.target.value)}
                  placeholder="e.g. B.Tech CS, B.Com, M.Sc"
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            )}

            {/* Academic Year and Section */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-year" className="mb-1 block text-sm font-medium text-slate-700">
                  Academic Year
                </label>
                <select
                  id="reg-year"
                  value={regAcademicYear}
                  onChange={(e) => setRegAcademicYear(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm bg-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="" disabled>Select Year</option>
                  <option value="1st">1st</option>
                  <option value="2nd">2nd</option>
                  <option value="3rd">3rd</option>
                </select>
              </div>

              <div>
                <label htmlFor="reg-section" className="mb-1 block text-sm font-medium text-slate-700">
                  Section
                </label>
                <input
                  id="reg-section"
                  type="text"
                  value={regSection}
                  onChange={(e) => setRegSection(e.target.value)}
                  placeholder="e.g. A, B, 1"
                  maxLength={10}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
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
