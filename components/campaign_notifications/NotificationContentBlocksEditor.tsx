'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { NotificationContentBlock } from '@/lib/types/objects';
import { createEmptyBlock, cloneContentBlocks } from './utils';

interface NotificationContentBlocksEditorProps {
    blocks: NotificationContentBlock[];
    onChange: (next: NotificationContentBlock[]) => void;
    disabled?: boolean;
}

export function NotificationContentBlocksEditor({
    blocks,
    onChange,
    disabled = false,
}: NotificationContentBlocksEditorProps) {
    const t = useTranslations('Campaign');

    const handleBlockTypeChange = (index: number, nextType: NotificationContentBlock['type']) => {
        const next = cloneContentBlocks(blocks);
        next[index] = createEmptyBlock(nextType);
        onChange(next);
    };

    const handleTextChange = (index: number, text: string) => {
        const next = cloneContentBlocks(blocks);
        const target = next[index];
        if (!target) return;
        next[index] = {
            ...target,
            text,
        };
        onChange(next);
    };

    const handleUrlChange = (index: number, url: string) => {
        const next = cloneContentBlocks(blocks);
        const target = next[index];
        if (!target || target.type !== 'link') return;
        next[index] = {
            ...target,
            url,
        };
        onChange(next);
    };

    const handleAddBlock = () => {
        onChange([...blocks, createEmptyBlock('text')]);
    };

    const handleDeleteBlock = (index: number) => {
        const next = blocks.filter((_, idx) => idx !== index);
        onChange(next.length > 0 ? next : [createEmptyBlock('text')]);
    };

    return (
        <div className="space-y-3">
            {blocks.map((block, index) => (
                <div key={`${block.type}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <select
                            value={block.type}
                            onChange={(event) => handleBlockTypeChange(index, event.target.value as NotificationContentBlock['type'])}
                            disabled={disabled}
                            className="px-2 py-1 rounded-md bg-slate-900/80 border border-white/10 text-sm text-white"
                        >
                            <option value="text">{t('contentBlockTypes.text')}</option>
                            <option value="title">{t('contentBlockTypes.title')}</option>
                            <option value="link">{t('contentBlockTypes.link')}</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => handleDeleteBlock(index)}
                            disabled={disabled}
                            className="ml-auto p-1.5 rounded-md text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <textarea
                        value={block.text}
                        onChange={(event) => handleTextChange(index, event.target.value)}
                        disabled={disabled}
                        placeholder={t('content.blockText')}
                        rows={4}
                        className="w-full px-3 py-2 rounded-md bg-slate-900/80 border border-white/10 text-sm text-white resize-y"
                    />

                    {block.type === 'link' && (
                        <input
                            type="url"
                            value={block.url}
                            onChange={(event) => handleUrlChange(index, event.target.value)}
                            disabled={disabled}
                            placeholder={t('content.blockUrl')}
                            className="w-full px-3 py-2 rounded-md bg-slate-900/80 border border-white/10 text-sm text-white"
                        />
                    )}
                </div>
            ))}

            <button
                type="button"
                onClick={handleAddBlock}
                disabled={disabled}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
            >
                <Plus className="w-4 h-4" />
                <span>{t('content.addBlock')}</span>
            </button>
        </div>
    );
}
