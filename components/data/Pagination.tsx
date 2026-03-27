'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    pageSizeOptions?: number[];
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

export function Pagination({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    pageSizeOptions = [20, 50, 100],
    onPageChange,
    onPageSizeChange,
}: PaginationProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [inputValue, setInputValue] = useState(String(currentPage));

    useEffect(() => {
        setInputValue(String(currentPage));
    }, [currentPage]);

    if (totalItems === 0) return null;

    const goToPage = () => {
        const parsed = parseInt(inputValue, 10);
        if (isNaN(parsed)) {
            setInputValue(String(currentPage));
            return;
        }
        const clamped = Math.max(1, Math.min(parsed, totalPages));
        setInputValue(String(clamped));
        if (clamped !== currentPage) {
            onPageChange(clamped);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            goToPage();
        }
    };

    const navBtnBase = `p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`;
    const navBtnColor = isLight
        ? 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent'
        : 'text-gray-400 hover:bg-white/10 disabled:hover:bg-transparent';

    const textColor = isLight ? 'text-slate-600' : 'text-gray-400';
    const inputBg = isLight
        ? 'bg-white border-slate-300 text-slate-800 focus:border-slate-500 focus:ring-slate-500/20'
        : 'bg-white/5 border-white/20 text-gray-200 focus:border-white/40 focus:ring-white/10';
    const selectBg = isLight
        ? 'bg-white border-slate-300 text-slate-700 focus:border-slate-500'
        : 'bg-white/5 border-white/20 text-gray-300 focus:border-white/40';

    return (
        <div className={`flex items-center justify-between py-4 text-sm ${textColor}`}>
            {/* Left: total items */}
            <div className="flex-shrink-0">
                <span>{totalItems.toLocaleString()} items</span>
            </div>

            {/* Center: page size selector */}
            <div className="flex items-center gap-2">
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className={`rounded-lg border px-2 py-1 text-sm outline-none transition-colors cursor-pointer ${selectBg}`}
                >
                    {pageSizeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt} / page
                        </option>
                    ))}
                </select>
            </div>

            {/* Right: page navigation */}
            <div className="flex items-center gap-1.5">
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className={`${navBtnBase} ${navBtnColor}`}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="select-none">Page</span>

                <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={goToPage}
                    onKeyDown={handleKeyDown}
                    className={`w-12 rounded-lg border px-2 py-1 text-center text-sm outline-none transition-colors focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${inputBg}`}
                />

                <span className="select-none">/ {totalPages.toLocaleString()}</span>

                <button
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className={`${navBtnBase} ${navBtnColor}`}
                    aria-label="Next page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
