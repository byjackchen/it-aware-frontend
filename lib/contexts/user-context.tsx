'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

// --- Types ---

export interface UserGroup {
  oid: string
  name: string
  scope_type: string
}

export interface User {
  oid: string
  username: string
  email: string
  full_name: string
  is_active: boolean
  is_system_user: boolean
  created_at: string
  groups: UserGroup[]
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
  hasGroup: (groupName: string) => boolean
}

// --- Constants ---

const COOKIES = {
  USER_DATA: 'it_aware_user_data',
  LOGGED_OUT: 'it_aware_logged_out',
  ACCESS: 'it_aware_access',
  SSO_USER: 'it_aware_sso_user',
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

// Debug helper to log all cookies
function logAllCookies(context: string): void {
  if (typeof window === 'undefined') return
  console.log(`[UserContext:${context}] All cookies:`, document.cookie)
  console.log(`[UserContext:${context}] Cookie breakdown:`)
  console.log(`  - it_aware_access: ${hasCookie(COOKIES.ACCESS) ? 'EXISTS' : 'MISSING'}`)
  console.log(`  - it_aware_user_data: ${hasCookie(COOKIES.USER_DATA) ? 'EXISTS' : 'MISSING'}`)
  console.log(`  - it_aware_logged_out: ${hasCookie(COOKIES.LOGGED_OUT) ? 'EXISTS' : 'MISSING'}`)
  console.log(`  - it_aware_sso_user: ${hasCookie(COOKIES.SSO_USER) ? 'EXISTS' : 'MISSING'}`)
}

// --- Context ---

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    console.log('[UserContext] Component mounted, setting isMounted=true')
    logAllCookies('mount')
    setIsMounted(true)
  }, [])

  // Try to get user data from middleware cookie (set during login redirect)
  const getInitialUserData = useCallback((): User | null => {
    console.log('[UserContext:getInitialUserData] Checking for pre-fetched user data cookie')
    const cookieValue = getCookie(COOKIES.USER_DATA)
    
    if (!cookieValue) {
      console.log('[UserContext:getInitialUserData] No user data cookie found')
      return null
    }

    console.log(`[UserContext:getInitialUserData] Found user data cookie, length=${cookieValue.length}`)

    try {
      // Try Base64 decoding first (new format), fallback to URL decoding (old format)
      let jsonString: string
      try {
        jsonString = Buffer.from(cookieValue, 'base64').toString('utf-8')
        console.log('[UserContext:getInitialUserData] Successfully decoded Base64')
      } catch (base64Error) {
        console.log('[UserContext:getInitialUserData] Base64 decode failed, trying URL decode:', base64Error)
        // Fallback to old URL decoding format
        jsonString = decodeURIComponent(cookieValue)
      }
      
      const userData = JSON.parse(jsonString) as User
      console.log(`[UserContext:getInitialUserData] Parsed user data: username=${userData.username}`)
      deleteCookie(COOKIES.USER_DATA) // One-time use
      console.log('[UserContext:getInitialUserData] Deleted user data cookie (one-time use)')
      return userData
    } catch (parseError) {
      console.error('[UserContext:getInitialUserData] Failed to parse user data:', parseError)
      deleteCookie(COOKIES.USER_DATA)
      return null
    }
  }, [])

  const fetchUser = useCallback(async (): Promise<void> => {
    console.log('[UserContext:fetchUser] Starting fetchUser')
    logAllCookies('fetchUser-start')

    if (typeof window === 'undefined') {
      console.log('[UserContext:fetchUser] SSR detected, skipping')
      return
    }

    // Respect explicit logout
    if (hasCookie(COOKIES.LOGGED_OUT)) {
      console.log('[UserContext:fetchUser] LOGGED_OUT cookie found, clearing user')
      setIsLoading(false)
      setUser(null)
      return
    }

    // Check for pre-fetched user data from middleware
    console.log('[UserContext:fetchUser] Checking for initial user data from middleware')
    const initialData = getInitialUserData()
    if (initialData) {
      console.log(`[UserContext:fetchUser] Using initial data from cookie: username=${initialData.username}`)
      setUser(initialData)
      setIsLoading(false)
      return
    }

    console.log('[UserContext:fetchUser] No initial data, fetching from /api/auth/me')
    // Fetch from API
    setIsLoading(true)
    setError(null)

    try {
      const startTime = Date.now()
      console.log('[UserContext:fetchUser] Making API request to /api/auth/me')
      
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      })

      const duration = Date.now() - startTime
      console.log(`[UserContext:fetchUser] API response: status=${response.status}, duration=${duration}ms`)
      console.log(`[UserContext:fetchUser] Response headers:`, Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        console.log(`[UserContext:fetchUser] API returned non-OK status: ${response.status}`)
        if (response.status === 401) {
          console.log('[UserContext:fetchUser] 401 Unauthorized - setting user to null')
          setUser(null)
          
          // If this is an SSO user (has sso_user cookie), redirect to login with error
          // This handles the case where Taihu authentication succeeded but user doesn't exist in backend
          if (hasCookie(COOKIES.SSO_USER)) {
            console.log('[UserContext:fetchUser] SSO user detected with 401 - redirecting to login with error')
            // Clear SSO cookie to prevent redirect loop
            deleteCookie(COOKIES.SSO_USER)
            const errorMessage = encodeURIComponent('User not found. Please contact your administrator to request access.')
            window.location.href = `/login?error=${errorMessage}`
          }
          return
        }
        const errorText = await response.text()
        console.error(`[UserContext:fetchUser] API error response: ${errorText}`)
        throw new Error(`Failed to fetch user: ${response.status}`)
      }

      const userData = await response.json()
      console.log(`[UserContext:fetchUser] API returned user data: username=${userData.username}, keys=${Object.keys(userData).join(',')}`)
      setUser(userData)
    } catch (err) {
      console.error('[UserContext:fetchUser] Exception during fetch:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch user')
      setUser(null)
    } finally {
      setIsLoading(false)
      console.log('[UserContext:fetchUser] Completed, isLoading=false')
      logAllCookies('fetchUser-end')
    }
  }, [getInitialUserData])

  const clearUser = useCallback(() => {
    console.log('[UserContext:clearUser] Clearing user state')
    setUser(null)
    setError(null)
  }, [])

  // --- Permission Helpers ---

  const hasPermission = useCallback(
    (permission: string) => Array.isArray(user?.permissions) && user.permissions.includes(permission),
    [user]
  )

  const hasAnyPermission = useCallback(
    (permissions: string[]) => Array.isArray(user?.permissions) && permissions.some(p => user.permissions.includes(p)),
    [user]
  )

  const hasAllPermissions = useCallback(
    (permissions: string[]) => Array.isArray(user?.permissions) && permissions.every(p => user.permissions.includes(p)),
    [user]
  )

  const hasGroup = useCallback(
    (groupName: string) => user?.groups?.some(g => g.name === groupName) ?? false,
    [user]
  )

  // Fetch user on mount
  useEffect(() => {
    if (isMounted) {
      console.log('[UserContext] isMounted is true, calling fetchUser')
      fetchUser()
    }
  }, [isMounted, fetchUser])

  // Log user state changes
  useEffect(() => {
    console.log(`[UserContext] User state changed: user=${user ? user.username : 'null'}, isLoading=${isLoading}, error=${error}`)
  }, [user, isLoading, error])

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
      hasGroup,
    }),
    [user, isLoading, error, fetchUser, clearUser, hasPermission, hasAnyPermission, hasAllPermissions, hasGroup]
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
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasGroup, user } = useUser()
  return {
    permissions: user?.permissions ?? [],
    groups: user?.groups ?? [],
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
  }
}
