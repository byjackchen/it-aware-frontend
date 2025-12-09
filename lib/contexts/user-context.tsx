'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

// --- Types ---

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
  fetchUser: () => Promise<void>
  clearUser: () => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  hasRole: (roleCode: string) => boolean
}

// --- Constants ---

const COOKIES = {
  USER_DATA: 'it_aware_user_data',
  LOGGED_OUT: 'it_aware_logged_out',
} as const

// --- Cookie Helpers ---

function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? match[2] : null
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Max-Age=0`
}

function hasCookie(name: string): boolean {
  return document.cookie.includes(`${name}=`)
}

// --- Context ---

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Try to get user data from middleware cookie (set during login redirect)
  const getInitialUserData = useCallback((): User | null => {
    const cookieValue = getCookie(COOKIES.USER_DATA)
    if (!cookieValue) return null

    try {
      // Try Base64 decoding first (new format), fallback to URL decoding (old format)
      let jsonString: string
      try {
        jsonString = Buffer.from(cookieValue, 'base64').toString('utf-8')
      } catch {
        // Fallback to old URL decoding format
        jsonString = decodeURIComponent(cookieValue)
      }
      
      const userData = JSON.parse(jsonString) as User
      deleteCookie(COOKIES.USER_DATA) // One-time use
      return userData
    } catch {
      deleteCookie(COOKIES.USER_DATA)
      return null
    }
  }, [])

  const fetchUser = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return

    // Respect explicit logout
    if (hasCookie(COOKIES.LOGGED_OUT)) {
      setIsLoading(false)
      setUser(null)
      return
    }

    // Check for pre-fetched user data from middleware
    const initialData = getInitialUserData()
    if (initialData) {
      setUser(initialData)
      setIsLoading(false)
      return
    }

    // Fetch from API
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          setUser(null)
          return
        }
        throw new Error(`Failed to fetch user: ${response.status}`)
      }

      setUser(await response.json())
    } catch (err) {
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

  // --- Permission Helpers ---

  const hasPermission = useCallback(
    (permission: string) => user?.permissions?.includes(permission) ?? false,
    [user]
  )

  const hasAnyPermission = useCallback(
    (permissions: string[]) => permissions.some(p => user?.permissions?.includes(p)),
    [user]
  )

  const hasAllPermissions = useCallback(
    (permissions: string[]) => permissions.every(p => user?.permissions?.includes(p)),
    [user]
  )

  const hasRole = useCallback(
    (roleCode: string) => user?.roles?.some(r => r.role_code === roleCode) ?? false,
    [user]
  )

  // Fetch user on mount
  useEffect(() => {
    if (isMounted) fetchUser()
  }, [isMounted, fetchUser])

  const value = useMemo<UserContextType>(
    () => ({
      user,
      isLoading,
      error,
      fetchUser,
      clearUser,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,
    }),
    [user, isLoading, error, fetchUser, clearUser, hasPermission, hasAnyPermission, hasAllPermissions, hasRole]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

// --- Hooks ---

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

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
