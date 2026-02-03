'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

// --- Types ---

export interface UserGroup {
  oid: string
  name: string
  scope_type: string
}

export interface UserAccount {
  oid: string
  username: string
  is_active: boolean
  is_system: boolean
  created_at?: string
}

export interface UserWorker {
  oid: string
  worker_id: string
  full_name: string
  email: string
  org_oid: string | null
  location_oid: string | null
  manager_oid: string | null
  is_active: boolean
}

export interface UserPermissions {
  unconstrained: string[]
  self_scoped: string[]
  role_based: string[]
}

// Backend nested format: { account, worker, permissions, groups }
export interface User {
  account: UserAccount
  worker?: UserWorker
  permissions: UserPermissions
  groups?: UserGroup[]
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
  ACCESS: 'it_aware_access',
  AUTH_MODE: 'it_aware_auth_mode',
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

    if (!cookieValue) {
      return null
    }

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
    } catch (parseError) {
      console.error('[UserContext:getInitialUserData] Failed to parse user data:', parseError)
      deleteCookie(COOKIES.USER_DATA)
      return null
    }
  }, [])

  const fetchUser = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') {
      return
    }

    // Respect explicit logout
    const authMode = getCookie(COOKIES.AUTH_MODE)
    if (authMode === 'logged_out') {
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

          // If this is an SSO user (auth_mode=sso), redirect to login with error
          // This handles the case where Taihu authentication succeeded but user doesn't exist in backend
          if (authMode === 'sso') {
            // Clear auth mode cookie to prevent redirect loop
            deleteCookie(COOKIES.AUTH_MODE)
            const errorMessage = encodeURIComponent('User not found. Please contact your administrator to request access.')
            window.location.href = `/login?error=${errorMessage}`
          }
          return
        }
        // For other errors (500, etc.), redirect to login
        const errorMessage = encodeURIComponent(`Authentication failed (Error ${response.status}). Please try again.`)
        window.location.href = `/login?error=${errorMessage}`
        return
      }

      const userData = await response.json()
      setUser(userData)
    } catch (err) {
      console.error('[UserContext:fetchUser] Exception during fetch:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch user')
      setUser(null)
      // Redirect to login on fetch exception
      const errorMessage = encodeURIComponent('Failed to authenticate. Please try again.')
      window.location.href = `/login?error=${errorMessage}`
    } finally {
      setIsLoading(false)
    }
  }, [getInitialUserData])

  const clearUser = useCallback(() => {
    setUser(null)
    setError(null)
  }, [])

  // --- Permission Helpers ---

  /**
   * Check if a user permission matches a required permission.
   * Supports wildcards (*) at any segment level.
   * IMPORTANT: Both permissions must have the same number of segments.
   * Examples:
   * - User has "*:*:*" -> matches "ui:navigation:auth"
   * - User has "ui:*:*" -> matches "ui:navigation:auth"
   * - User has "ui:navigation:*" -> matches "ui:navigation:auth"
   * - User has "ui:*" -> does NOT match "ui:navigation:auth" (different segment count)
   */
  const permissionMatches = useCallback(
    (userPermission: string, requiredPermission: string): boolean => {
      // Exact match
      if (userPermission === requiredPermission) return true;

      const userSegments = userPermission.split(':');
      const requiredSegments = requiredPermission.split(':');

      // Must have same number of segments
      if (userSegments.length !== requiredSegments.length) return false;

      // Check each segment - * matches any value at that position
      return userSegments.every((userSeg, index) => {
        if (userSeg === '*') return true;
        return userSeg === requiredSegments[index];
      });
    },
    []
  );

  // Get all permissions from nested structure (combine unconstrained, self_scoped, and role_based)
  const getUserPermissions = useCallback((): string[] => {
    const permissions: string[] = [];

    // Add unconstrained permissions
    if (Array.isArray(user?.permissions?.unconstrained)) {
      permissions.push(...user.permissions.unconstrained);
    }

    // Add self_scoped permissions
    if (Array.isArray(user?.permissions?.self_scoped)) {
      permissions.push(...user.permissions.self_scoped);
    }

    // Add role_based permissions
    if (Array.isArray(user?.permissions?.role_based)) {
      permissions.push(...user.permissions.role_based);
    }

    // Return unique permissions
    return [...new Set(permissions)];
  }, [user]);

  const hasPermission = useCallback(
    (permission: string) => {
      const perms = getUserPermissions();
      return perms.some(p => permissionMatches(p, permission));
    },
    [getUserPermissions, permissionMatches]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]) => {
      const userPerms = getUserPermissions();
      return permissions.some(required =>
        userPerms.some(userPerm => permissionMatches(userPerm, required))
      );
    },
    [getUserPermissions, permissionMatches]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]) => {
      const userPerms = getUserPermissions();
      return permissions.every(required =>
        userPerms.some(userPerm => permissionMatches(userPerm, required))
      );
    },
    [getUserPermissions, permissionMatches]
  );

  const hasGroup = useCallback(
    (groupName: string) => user?.groups?.some(g => g.name === groupName) ?? false,
    [user]
  )

  // Fetch user on mount
  useEffect(() => {
    if (isMounted) {
      fetchUser()
    }
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

  // Combine unconstrained, self_scoped, and role_based permissions
  const allPermissions = [
    ...(user?.permissions?.unconstrained ?? []),
    ...(user?.permissions?.self_scoped ?? []),
    ...(user?.permissions?.role_based ?? []),
  ]

  return {
    permissions: [...new Set(allPermissions)], // Deduplicated
    groups: user?.groups ?? [],
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
  }
}
