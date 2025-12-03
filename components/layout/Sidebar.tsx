import Link from 'next/link';
import { Shield, UserCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function Sidebar() {
    const t = useTranslations('Sidebar');

    return (
        <aside className="w-64 border-r border-gray-200 bg-white fixed top-16 bottom-0 left-0 overflow-y-auto z-40">
            <nav className="p-4 space-y-2">
                <Link
                    href="/security"
                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                    <Shield className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                    <span className="font-medium">{t('security')}</span>
                </Link>

                <Link
                    href="/persona"
                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                    <UserCircle className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                    <span className="font-medium">{t('persona')}</span>
                </Link>
            </nav>
        </aside>
    );
}
