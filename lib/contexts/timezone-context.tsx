'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { detectLocalTimezone, DEFAULT_TIMEZONE, resolveTimezone } from '@/lib/utils/datetime';
import { readUserDataCookie, updateUserPreferences } from '@/lib/utils/user-data-cookie';

interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(DEFAULT_TIMEZONE);

  useEffect(() => {
    const cookieData = readUserDataCookie();
    const preferredTimezone = cookieData?.preferences?.timezone;
    if (preferredTimezone) {
      setTimezoneState(resolveTimezone(preferredTimezone));
      return;
    }

    const localTimezone = detectLocalTimezone();
    setTimezoneState(resolveTimezone(localTimezone));
  }, []);

  const setTimezone = useCallback((nextTimezone: string) => {
    const resolved = resolveTimezone(nextTimezone);
    setTimezoneState(resolved);
    updateUserPreferences({ timezone: resolved });
  }, []);

  const value = useMemo<TimezoneContextType>(() => ({ timezone, setTimezone }), [timezone, setTimezone]);

  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
