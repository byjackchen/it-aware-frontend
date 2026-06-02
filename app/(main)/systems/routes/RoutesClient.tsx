'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Route as RouteIcon, Pencil, Trash2 } from 'lucide-react';
import type { LLMModel, LLMRoute } from '@/lib/types/systems';
import { createRoute, deleteRoute, updateRoute } from '@/app/actions/systems';
import { Field, FormActions, Modal, inputClass } from '../_components/Modal';

interface Props {
  routes: LLMRoute[];
  models: LLMModel[];
}

export function RoutesClient({ routes, models }: Props) {
  const t = useTranslations('Systems');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LLMRoute | null>(null);
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
    const model_oid = fd.get('model_oid') as string;
    startTransition(async () => {
      const res = editing
        ? await updateRoute(editing.oid, { model_oid, description: (fd.get('description') as string) || null })
        : await createRoute({
            task_key: fd.get('task_key') as string,
            model_oid,
            description: (fd.get('description') as string) || null,
          });
      if ('error' in res) setError(res.error);
      else {
        close();
        router.refresh();
      }
    });
  };

  const onDelete = (route: LLMRoute) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    startTransition(async () => {
      await deleteRoute(route.oid);
      router.refresh();
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl glass-card">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <RouteIcon className="h-5 w-5 text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">{t('routes.title')}</h1>
              <p className="text-xs text-gray-500">{t('routes.help')}</p>
            </div>
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
          {routes.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-gray-500">
              <RouteIcon className="mb-4 h-12 w-12 opacity-50" />
              <p>{t('routes.empty')}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-inherit">
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="px-4 py-3 font-medium">{t('routes.taskKey')}</th>
                  <th className="px-4 py-3 font-medium">{t('routes.model')}</th>
                  <th className="px-4 py-3 font-medium">{t('routes.description')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {routes.map((r) => (
                  <tr key={r.oid} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-mono text-sm text-blue-400">{r.task_key}</td>
                    <td className="px-4 py-3 text-white">{r.model_name ?? t('common.none')}</td>
                    <td className="px-4 py-3 text-gray-400">{r.description ?? t('common.none')}</td>
                    <td className="px-4 py-3 text-sm">
                      {r.is_active ? (
                        <span className="text-green-400">{t('common.active')}</span>
                      ) : (
                        <span className="text-gray-500">{t('common.inactive')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(r)} className="text-gray-400 hover:text-blue-400">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDelete(r)} className="text-gray-400 hover:text-red-400">
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
        <Modal title={editing ? t('routes.edit') : t('routes.create')} onClose={close}>
          <form onSubmit={onSubmit}>
            <Field label={t('routes.taskKey')}>
              <input
                name="task_key"
                required
                defaultValue={editing?.task_key ?? ''}
                disabled={!!editing}
                placeholder={t('routes.taskKeyPlaceholder')}
                className={`${inputClass} disabled:opacity-60`}
              />
            </Field>
            <Field label={t('routes.model')}>
              <select name="model_oid" required defaultValue={editing?.model_oid ?? ''} className={inputClass}>
                <option value="" disabled>
                  —
                </option>
                {models.map((m) => (
                  <option key={m.oid} value={m.oid}>
                    {m.display_name || m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('routes.description')}>
              <input name="description" defaultValue={editing?.description ?? ''} className={inputClass} />
            </Field>
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <FormActions onCancel={close} pending={pending} />
          </form>
        </Modal>
      )}
    </div>
  );
}
