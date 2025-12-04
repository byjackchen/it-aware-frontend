'use client'

import { UserProvider } from '@/lib/contexts/user-context'
import { ThemeProvider } from '@/lib/contexts/theme-context'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <UserProvider>
        {children}
      </UserProvider>
    </ThemeProvider>
  )
}
