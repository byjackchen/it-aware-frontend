'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-full transition-all duration-300 ${
        isLight 
          ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-300/50' 
          : 'text-gray-400 hover:text-white hover:bg-white/10'
      }`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
