'use client';

/**
 * Searchable dropdown for selecting a parent hierarchy node.
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface HierarchyItem {
    oid: string;
    name: string;
}

interface HierarchySelectProps {
    items: HierarchyItem[];
    value: string | null;
    onChange: (oid: string | null) => void;
    placeholder?: string;
    excludeOid?: string;
}

export function HierarchySelect({
    items,
    value,
    onChange,
    placeholder,
    excludeOid,
}: HierarchySelectProps) {
    const { theme } = useTheme();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter items by search and exclude self
    const filteredItems = items.filter((item) => {
        if (excludeOid && item.oid === excludeOid) return false;
        if (!search) return true;
        return item.name.toLowerCase().includes(search.toLowerCase());
    });

    // Get selected item name
    const selectedItem = items.find((item) => item.oid === value);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (oid: string | null) => {
        onChange(oid);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Selected value / trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left
                    ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}
                `}
            >
                <span className={!selectedItem ? (isLight ? 'text-slate-400' : 'text-gray-500') : ''}>
                    {selectedItem ? selectedItem.name : (placeholder || t('common.noParent'))}
                </span>
                <ChevronDown className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className={`
                    absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden
                    ${isLight ? 'bg-white border-slate-200' : 'bg-gray-800 border-white/10'}
                `}>
                    {/* Search input */}
                    <div className={`p-2 border-b ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                        <div className="relative">
                            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('common.searchParent')}
                                className={`
                                    w-full pl-8 pr-3 py-1.5 rounded-md text-sm
                                    ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}
                                `}
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto">
                        {/* No parent option */}
                        <button
                            type="button"
                            onClick={() => handleSelect(null)}
                            className={`
                                w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                                ${value === null
                                    ? (isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-400')
                                    : (isLight ? 'hover:bg-slate-50 text-slate-600' : 'hover:bg-white/5 text-gray-300')
                                }
                            `}
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>{t('common.noParent')}</span>
                        </button>

                        {/* Filtered items */}
                        {filteredItems.map((item) => (
                            <button
                                key={item.oid}
                                type="button"
                                onClick={() => handleSelect(item.oid)}
                                className={`
                                    w-full px-3 py-2 text-sm text-left
                                    ${value === item.oid
                                        ? (isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-400')
                                        : (isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-white/5 text-gray-200')
                                    }
                                `}
                            >
                                {item.name}
                            </button>
                        ))}

                        {/* No results */}
                        {filteredItems.length === 0 && search && (
                            <div className={`px-3 py-2 text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                No matching items
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
