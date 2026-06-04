import { getTranslations } from 'next-intl/server';

export const ENV_BANNER_HEIGHT_PX = 20;

interface EnvBannerProps {
    env: string;
}

interface EnvBannerStyle {
    labelKey: 'local' | 'dev' | 'test' | 'unknown';
    className: string;
}

const ENV_STYLES: Record<string, EnvBannerStyle> = {
    local: { labelKey: 'local', className: 'bg-orange-500 text-white' },
    dev: { labelKey: 'dev', className: 'bg-amber-400 text-slate-900' },
    test: { labelKey: 'test', className: 'bg-green-500 text-white' },
};

const UNKNOWN_STYLE: EnvBannerStyle = {
    labelKey: 'unknown',
    className: 'bg-rose-600 text-white',
};

/**
 * Slim (20px) full-width color-coded strip pinned above the TopBar on every
 * page when the deployment environment is not prod:
 * local = orange, dev = yellow, test = green, anything else = red (unknown).
 * Layout chrome (TopBar / Sidebar / MainContent) offsets itself via the
 * --env-banner-h CSS variable set on <body> in the root layout.
 */
export async function EnvBanner({ env }: EnvBannerProps) {
    const t = await getTranslations('EnvBanner');
    const style = ENV_STYLES[env] ?? UNKNOWN_STYLE;

    return (
        <div
            role="status"
            className={`fixed top-0 inset-x-0 z-[60] h-[20px] flex items-center justify-center text-xs leading-[20px] font-bold tracking-wider ${style.className}`}
        >
            {t(style.labelKey)}
        </div>
    );
}
