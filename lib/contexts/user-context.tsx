'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

// Types based on the API response
export interface UserRole {
  role_code: string
  name: string
  description: string
}

export interface User {
  username: string
  email: string
  full_name: string
  is_active: boolean
  created_at: string
  roles: UserRole[]
  permissions: string[]
}

interface UserContextType {
  user: User | null
  isLoading: boolean
  error: string | null
  // Actions
  fetchUser: () => Promise<void>
  clearUser: () => void
  // Permission helpers
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  hasRole: (roleCode: string) => boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Track when component is mounted on client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Helper to get and clear the initial user data cookie set by middleware
  const getInitialUserData = useCallback((): User | null => {
    if (typeof window === 'undefined') return null
    
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split('=')
      if (name === 'it_aware_user_data') {
        try {
          const value = valueParts.join('=')
          const userData = JSON.parse(decodeURIComponent(value)) as User
          console.log('[UserContext] Found initial user data from middleware cookie')
          // Clear the cookie after reading (it's only for initial hydration)
          document.cookie = 'it_aware_user_data=; Path=/; Max-Age=0'
          return userData
        } catch (e) {
          console.error('[UserContext] Failed to parse initial user data:', e)
          // Clear invalid cookie
          document.cookie = 'it_aware_user_data=; Path=/; Max-Age=0'
        }
      }
    }
    return null
  }, [])

  const fetchUser = useCallback(async (): Promise<void> => {
    // Only fetch on client side where cookies are available
    if (typeof window === 'undefined') {
      console.log('[UserContext] Skipping fetch on server side')
      return
    }

    // Check if user explicitly logged out (cookie set by logout action)
    const isLoggedOut = document.cookie.includes('it_aware_logged_out=true')
    if (isLoggedOut) {
      console.log('[UserContext] User is logged out, skipping fetch')
      setIsLoading(false)
      setUser(null)
      return
    }

    // First, check for initial user data cookie (set by middleware after login)
    // This solves the timing issue where JWT HttpOnly cookies aren't available yet
    const initialData = getInitialUserData()
    if (initialData) {
      console.log('[UserContext] Using initial user data from middleware:', initialData.username)
      setUser(initialData)
      setIsLoading(false)
      return
    }

    console.log('[UserContext] Fetching user data from /api/auth/me...')
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Include cookies for JWT authentication
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - clear user state
          console.log('[UserContext] User not authenticated (401)')
          setUser(null)
          return
        }
        throw new Error(`Failed to fetch user: ${response.status}`)
      }

      const userData: User = await response.json()
      console.log('[UserContext] User data fetched successfully:', userData.username)
      setUser(userData)
    } catch (err) {
      console.error('[UserContext] Error fetching user:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch user')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [getInitialUserData])

  const clearUser = useCallback(() => {
    setUser(null)
    setError(null)
  }, [])

  // Permission helper functions
  const hasPermission = useCallback((permission: string): boolean => {
    return user?.permissions?.includes(permission) ?? false
  }, [user])

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!user?.permissions) return false
    return permissions.some(p => user.permissions.includes(p))
  }, [user])

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (!user?.permissions) return false
    return permissions.every(p => user.permissions.includes(p))
  }, [user])

  const hasRole = useCallback((roleCode: string): boolean => {
    return user?.roles?.some(role => role.role_code === roleCode) ?? false
  }, [user])

  // Auto-fetch user only after component is mounted on client
  // The middleware now sets a readable cookie with user data, so no delay needed
  useEffect(() => {
    if (isMounted) {
      fetchUser()
    }
  }, [isMounted, fetchUser])

  const value = useMemo<UserContextType>(() => ({
    user,
    isLoading,
    error,
    fetchUser,
    clearUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  }), [user, isLoading, error, fetchUser, clearUser, hasPermission, hasAnyPermission, hasAllPermissions, hasRole])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

// Hook to use the user context
export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

// Convenience hook for just permissions
export function usePermissions() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, user } = useUser()
  return {
    permissions: user?.permissions ?? [],
    roles: user?.roles ?? [],
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  }
}
