import { getTranslations } from 'next-intl/server';

export default async function OpsDashboardPage() {
    const t = await getTranslations('OpsDashboard');

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-2">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
    );
}
