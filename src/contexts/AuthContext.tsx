import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase, User } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  isSubscriptionExpired: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Fetch user profile from public.user table
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)

        // If RLS is blocking, create a basic user object from auth data
        if (error.code === 'PGRST301' || error.message?.includes('row-level security')) {
          console.warn('RLS blocking user fetch - returning basic user object')
          const { data: { user: authUser } } = await supabase.auth.getUser()
          if (authUser) {
            return {
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.user_metadata?.full_name || '',
              is_active: true,
              status: 'Trial',
              subscription_status: 'inactive',
              max_devices: 0,
              created_at: authUser.created_at,
              updated_at: new Date().toISOString(),
            } as User
          }
        }
        return null
      }

      return data as User
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  // Check if user is active
  const checkUserActive = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user')
        .select('is_active')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('Error checking user active status:', error)
        // If any error (including RLS), assume user is active to prevent lockout
        // This is safer than blocking legitimate users
        return true
      }

      // If no data returned, assume active
      if (!data) {
        console.warn('No user data returned - assuming active')
        return true
      }

      return data.is_active === true
    } catch (error) {
      console.error('Error checking user active status:', error)
      return true // Allow access on error to prevent lockout
    }
  }

  // Refresh user profile
  const refreshUser = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (currentSession?.user) {
      const profile = await fetchUserProfile(currentSession.user.id)
      setUser(profile)
    } else {
      setUser(null)
    }
  }

  // Sign in
  const signIn = async (email: string, password: string) => {
    let loginEmail = email

    // If input is not an email, look up email from user table
    if (!email.includes('@')) {
      const { data, error: lookupError } = await supabase.functions.invoke('get-email-from-user', {
        body: { identifier: email },
      })

      if (lookupError || !data?.email) {
        return { error: 'Invalid email or password' }
      }

      loginEmail = data.email
    }

    // Sign in with Supabase Auth
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    // Check if user is active
    if (authData?.user) {
      const isActive = await checkUserActive(authData.user.id)

      if (!isActive) {
        await supabase.auth.signOut()
        return { error: 'Your account has been deactivated' }
      }
    }

    return { error: null }
  }

  // Sign up
  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        return { error: error.message }
      }

      // Save password to public.user table for admin reference
      // Wait a moment for the trigger to create the user record first
      if (data?.user) {
        setTimeout(async () => {
          await supabase
            .from('user')
            .update({ password: password })
            .eq('id', data.user!.id)
        }, 1000)
      }

      return { error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { error: 'Network error. Please try again.' }
    }
  }

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    navigate('/')
  }

  // Check if subscription is expired
  const isSubscriptionExpired = (): boolean => {
    if (!user) return false

    // Admin users never expire
    if (user.role === 'admin') return false

    // If no subscription_end date, not expired (lifetime or trial)
    if (!user.subscription_end) return false

    // Check if today is past the subscription_end date
    const today = new Date()
    const endDate = new Date(user.subscription_end)

    // Set both dates to midnight for accurate date comparison
    today.setHours(0, 0, 0, 0)
    endDate.setHours(0, 0, 0, 0)

    return today >= endDate
  }

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)

        if (newSession?.user) {
          // Defer profile fetching
          setTimeout(async () => {
            const profile = await fetchUserProfile(newSession.user.id)
            if (profile) {
              setUser(profile)
            }
          }, 0)
        } else {
          setUser(null)
        }
      }
    )

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession)
      if (initialSession?.user) {
        const profile = await fetchUserProfile(initialSession.user.id)
        if (profile) {
          setUser(profile)
        }
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
    isSubscriptionExpired,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
