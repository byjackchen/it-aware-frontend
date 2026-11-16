'use client'

import { UserProvider } from '@/lib/contexts/user-context'
import { ErrorProvider } from '@/lib/contexts/error-context'
import { TimezoneProvider } from '@/lib/contexts/timezone-context'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorProvider>
      <TimezoneProvider>
        <UserProvider>
          {children}
        </UserProvider>
      </TimezoneProvider>
    </ErrorProvider>
  )
}
