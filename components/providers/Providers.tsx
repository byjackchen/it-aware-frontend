'use client'

import { UserProvider } from '@/lib/contexts/user-context'
import { ThemeProvider } from '@/lib/contexts/theme-context'
import { ErrorProvider } from '@/lib/contexts/error-context'
import { TimezoneProvider } from '@/lib/contexts/timezone-context'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <ErrorProvider>
        <TimezoneProvider>
          <UserProvider>
            {children}
          </UserProvider>
        </TimezoneProvider>
      </ErrorProvider>
    </ThemeProvider>
  )
}
