'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Cpu, Pencil, Trash2 } from 'lucide-react';
import type { LLMModel } from '@/lib/types/systems';
import { createModel, deleteModel, updateModel } from '@/app/actions/systems';
import { Field, FormActions, Modal, inputClass } from '../_components/Modal';

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = (v as string)?.trim();
  return s ? Number(s) : null;
}

export function ModelsClient({ models }: { models: LLMModel[] }) {
  const t = useTranslations('Systems');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LLMModel | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setEditing(null);
    setCreating(false);
    setError(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get('name') as string,
      display_name: (fd.get('display_name') as string) || null,
      api_domain: (fd.get('api_domain') as string) || null,
      max_tokens: numOrNull(fd.get('max_tokens')),
      temperature: numOrNull(fd.get('temperature')),
      top_p: numOrNull(fd.get('top_p')),
      thinking: fd.get('thinking') === 'on',
    };
    startTransition(async () => {
      const res = editing ? await updateModel(editing.oid, payload) : await createModel(payload);
      if ('error' in res) setError(res.error);
      else {
        close();
        router.refresh();
      }
    });
  };

  const onDelete = (m: LLMModel) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    startTransition(async () => {
      await deleteModel(m.oid);
      router.refresh();
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl glass-card">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-blue-400" />
            <h1 className="text-xl font-semibold text-white">{t('models.title')}</h1>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-blue-400 hover:bg-blue-500/30"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">{t('common.create')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {models.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-gray-500">
              <Cpu className="mb-4 h-12 w-12 opacity-50" />
              <p>{t('models.empty')}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-inherit">
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="px-4 py-3 font-medium">{t('models.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('models.totalQpm')}</th>
                  <th className="px-4 py-3 font-medium">{t('models.activeKeys')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {models.map((m) => (
                  <tr key={m.oid} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="text-white">{m.display_name || m.name}</div>
                      <div className="font-mono text-xs text-gray-500">{m.name}</div>
                    </td>
                    <td className="px-4 py-3 text-white">{m.total_qpm}</td>
                    <td className="px-4 py-3 text-white">{m.active_key_count}</td>
                    <td className="px-4 py-3 text-sm">
                      {m.is_active ? (
                        <span className="text-green-400">{t('common.active')}</span>
                      ) : (
                        <span className="text-gray-500">{t('common.inactive')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(m)} className="text-gray-400 hover:text-blue-400">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDelete(m)} className="text-gray-400 hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <Modal title={editing ? t('models.edit') : t('models.create')} onClose={close}>
          <form onSubmit={onSubmit}>
            <Field label={t('models.name')}>
              <input
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                placeholder={t('models.namePlaceholder')}
                className={inputClass}
              />
            </Field>
            <Field label={t('models.displayName')}>
              <input name="display_name" defaultValue={editing?.display_name ?? ''} className={inputClass} />
            </Field>
            <Field label={t('models.apiDomain')}>
              <input
                name="api_domain"
                defaultValue={editing?.api_domain ?? ''}
                placeholder={t('models.apiDomainPlaceholder')}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('models.maxTokens')}>
                <input name="max_tokens" type="number" defaultValue={editing?.max_tokens ?? ''} className={inputClass} />
              </Field>
              <Field label={t('models.temperature')}>
                <input name="temperature" type="number" step="0.01" defaultValue={editing?.temperature ?? ''} className={inputClass} />
              </Field>
              <Field label={t('models.topP')}>
                <input name="top_p" type="number" step="0.01" defaultValue={editing?.top_p ?? ''} className={inputClass} />
              </Field>
            </div>
            <label className="mb-3 flex items-center gap-2 text-sm text-gray-300">
              <input name="thinking" type="checkbox" defaultChecked={editing?.thinking ?? false} />
              {t('models.thinking')}
            </label>
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <FormActions onCancel={close} pending={pending} />
          </form>
        </Modal>
      )}
    </div>
  );
}
