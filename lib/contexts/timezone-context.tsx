'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { detectLocalTimezone, DEFAULT_TIMEZONE, resolveTimezone } from '@/lib/utils/datetime';
import { readUserDataCookie, updateUserPreferences } from '@/lib/utils/user-data-cookie';

interface TimezoneContextType {
  timezone: string;
  ready: boolean;
  setTimezone: (timezone: string) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(DEFAULT_TIMEZONE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const preferredTimezone = readUserDataCookie()?.preferences?.timezone;
      setTimezoneState(resolveTimezone(preferredTimezone || detectLocalTimezone()));
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  const setTimezone = useCallback((nextTimezone: string) => {
    const resolved = resolveTimezone(nextTimezone);
    setTimezoneState(resolved);
    updateUserPreferences({ timezone: resolved });
  }, []);

  const value = useMemo<TimezoneContextType>(() => ({ timezone, ready, setTimezone }), [timezone, ready, setTimezone]);

  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
