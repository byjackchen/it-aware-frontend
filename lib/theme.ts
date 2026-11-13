/**
 * The theme a person sees: the one they chose (kept in the `it-aware-theme`
 * cookie by the theme switch), and light for anyone who has not chosen.
 */

export type Theme = 'dark' | 'light';

export const THEME_COOKIE_NAME = 'it-aware-theme';

/** The theme for the cookie's value; `undefined` when the person never chose. */
export function themeFrom(chosen: string | undefined): Theme {
    return chosen === 'dark' ? 'dark' : 'light';
}
