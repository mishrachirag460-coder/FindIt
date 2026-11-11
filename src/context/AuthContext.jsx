/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const activeUserIdRef = useRef(null)
  const isMountedRef = useRef(true)

  // 1. Auth listener: updates ONLY session and user synchronously without awaiting DB queries.
  // Avoids deadlock/lock-contention in Supabase's auth state machine.
  useEffect(() => {
    isMountedRef.current = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!isMountedRef.current) return

        const currentUser = newSession?.user ?? null
        setSession(newSession)
        setUser(currentUser)
        activeUserIdRef.current = currentUser?.id ?? null

        // If user logged out or session ended, immediately clear profile and end loading
        if (!currentUser) {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      isMountedRef.current = false
      subscription?.unsubscribe()
    }
  }, [])

  // 2. Separate effect to fetch public.profiles based strictly on user?.id.
  // Eliminates duplicate initial queries and prevents auth event deadlocks.
  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('findit_id, full_name, member_type')
          .eq('id', userId)
          .single()

        // Discard response if user changed or component unmounted
        if (activeUserIdRef.current !== userId || !isMountedRef.current) {
          return
        }

        if (error) {
          console.error('Error fetching profile:', error.message)
          setProfile(null)
        } else {
          setProfile(data)
        }
      } catch (err) {
        if (activeUserIdRef.current === userId && isMountedRef.current) {
          console.error('Unexpected error fetching profile:', err)
          setProfile(null)
        }
      } finally {
        if (isMountedRef.current && activeUserIdRef.current === userId) {
          setLoading(false)
        }
      }
    }

    loadProfile()
  }, [user?.id])

  // Sign in existing user with email and password
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) throw error
    return data
  }

  // Register student: passes fullName in options.data; NEVER sends a role
  const signUpStudent = async (fullName, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    })

    if (error) throw error
    return data
  }

  // Sign out current user
  const signOut = async () => {
    activeUserIdRef.current = null
    setUser(null)
    setSession(null)
    setProfile(null)

    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Manual profile refresh helper
  const refreshProfile = async () => {
    const currentId = activeUserIdRef.current
    if (!currentId) return null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('findit_id, full_name, member_type')
        .eq('id', currentId)
        .single()

      if (!error && activeUserIdRef.current === currentId && isMountedRef.current) {
        setProfile(data)
        return data
      }
    } catch (err) {
      console.error('Error refreshing profile:', err)
    }
    return null
  }

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUpStudent,
    signOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
