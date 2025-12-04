'use client';

import { MessageSquare, X, Send } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

export function ChatbotDrawer() {
    const [isOpen, setIsOpen] = useState(false);
    const t = useTranslations('Chatbot');

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 btn-glass text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
            >
                <MessageSquare className="w-7 h-7" />
            </button>

            {/* Chat Drawer */}
            <div
                className={clsx(
                    "fixed top-0 right-0 bottom-0 w-96 glass-dark shadow-2xl transform transition-transform duration-300 ease-in-out z-50",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600/80 to-purple-600/80">
                        <h3 className="font-semibold text-lg text-white">{t('title')}</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        <div className="text-center text-gray-400 mt-10">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                <MessageSquare className="w-8 h-8 text-blue-400" />
                            </div>
                            <p>{t('placeholder')}</p>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={t('inputPlaceholder')}
                                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                            />
                            <button className="p-2.5 btn-glass rounded-lg text-white">
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
