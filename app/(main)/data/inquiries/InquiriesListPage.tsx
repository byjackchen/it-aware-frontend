'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, RefreshCw, Search } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Inquiry } from '@/lib/types/objects';

interface InquiriesListPageProps {
    inquiries: Inquiry[];
}

export function InquiriesListPage({ inquiries }: InquiriesListPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredInquiries = inquiries.filter((inquiry) => {
        const topic = inquiry.topic || 'Untitled Inquiry';
        return searchQuery === '' || topic.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Inquiries</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {inquiries.length} Total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search inquiries..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                        />
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {filteredInquiries.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No inquiries found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredInquiries.map((inquiry) => (
                                <button
                                    key={inquiry.oid}
                                    onClick={() => router.push(`/data/inquiries/${inquiry.oid}`)}
                                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{inquiry.topic || 'Untitled Inquiry'}</div>
                                        <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                            {inquiry.state}
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}>
                                        {inquiry.state}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
