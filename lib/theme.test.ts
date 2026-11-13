import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '@/lib/contexts/theme-context';
import { themeFrom } from '@/lib/theme';

describe('the theme a person sees', () => {
    it('is light for anyone who has not chosen', () => {
        expect(themeFrom(undefined)).toBe('light');
        expect(themeFrom('')).toBe('light');
        expect(themeFrom('sepia')).toBe('light');
    });

    it('is the one they chose', () => {
        expect(themeFrom('dark')).toBe('dark');
        expect(themeFrom('light')).toBe('light');
    });
});

describe('the theme provider', () => {
    const Shown = () => useTheme().theme;
    const rendered = (initialTheme: 'dark' | 'light') =>
        renderToString(createElement(ThemeProvider, { initialTheme }, createElement(Shown)));

    it('starts from the theme the server read, so the first paint is already right', () => {
        expect(rendered('light')).toBe('light');
        expect(rendered('dark')).toBe('dark');
    });

    it('refuses to be read outside the provider', () => {
        expect(() => renderToString(createElement(Shown))).toThrow('useTheme must be used within a ThemeProvider');
    });
});
