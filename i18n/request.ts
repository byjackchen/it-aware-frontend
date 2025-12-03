import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
    // Read locale from cookie
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get('IT_AWARE_LOCALE');
    let locale = localeCookie?.value;

    // Ensure that a valid locale is used
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default
    };
});
