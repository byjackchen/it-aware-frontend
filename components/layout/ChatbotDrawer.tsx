'use client';

import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

export function ChatbotDrawer() {
    const [isOpen, setIsOpen] = useState(false);
    const t = useTranslations('Chatbot');

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
            >
                <MessageSquare className="w-7 h-7" />
            </button>

            <div
                className={clsx(
                    "fixed top-0 right-0 bottom-0 w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-blue-600 text-white">
                        <h3 className="font-semibold text-lg">{t('title')}</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-blue-700 rounded"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                        <div className="text-center text-gray-500 mt-10">
                            <p>{t('placeholder')}</p>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-200">
                        <input
                            type="text"
                            placeholder={t('inputPlaceholder')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
