'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Lock, Pencil, Trash2 } from 'lucide-react';
import type { LLMKey, LLMModel } from '@/lib/types/systems';
import { createKey, deleteKey, updateKey } from '@/app/actions/systems';
import { Field, FormActions, Modal, inputClass } from '../_components/Modal';

interface Props {
  keys: LLMKey[];
  models: LLMModel[];
}

export function KeysClient({ keys, models }: Props) {
  const t = useTranslations('Systems');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LLMKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelName = (oid: string) => models.find((m) => m.oid === oid)?.display_name
    || models.find((m) => m.oid === oid)?.name
    || t('common.none');

  const close = () => {
    setEditing(null);
    setCreating(false);
    setError(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const secret = (fd.get('secret') as string)?.trim();
    const qpm = Number(fd.get('qpm'));
    startTransition(async () => {
      const res = editing
        ? await updateKey(editing.oid, {
            label: fd.get('label') as string,
            qpm,
            ...(secret ? { secret } : {}),
          })
        : await createKey({
            model_oid: fd.get('model_oid') as string,
            label: fd.get('label') as string,
            secret,
            qpm,
          });
      if ('error' in res) setError(res.error);
      else {
        close();
        router.refresh();
      }
    });
  };

  const onDelete = (k: LLMKey) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    startTransition(async () => {
      await deleteKey(k.oid);
      router.refresh();
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl glass-card">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-blue-400" />
            <h1 className="text-xl font-semibold text-white">{t('keys.title')}</h1>
          </div>
          <button
            onClick={() => setCreating(true)}
            disabled={models.length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">{t('common.create')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {keys.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-gray-500">
              <Lock className="mb-4 h-12 w-12 opacity-50" />
              <p>{t('keys.empty')}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-inherit">
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="px-4 py-3 font-medium">{t('keys.label')}</th>
                  <th className="px-4 py-3 font-medium">{t('keys.model')}</th>
                  <th className="px-4 py-3 font-medium">{t('keys.secretMasked')}</th>
                  <th className="px-4 py-3 font-medium">{t('keys.qpm')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {keys.map((k) => (
                  <tr key={k.oid} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{k.label}</td>
                    <td className="px-4 py-3 text-white">{modelName(k.model_oid)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-400">{k.secret_masked}</td>
                    <td className="px-4 py-3 text-white">{k.qpm}</td>
                    <td className="px-4 py-3 text-sm">
                      {k.is_active ? (
                        <span className="text-green-400">{t('common.active')}</span>
                      ) : (
                        <span className="text-gray-500">{t('common.inactive')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(k)} className="text-gray-400 hover:text-blue-400">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDelete(k)} className="text-gray-400 hover:text-red-400">
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
        <Modal title={editing ? t('keys.edit') : t('keys.create')} onClose={close}>
          <form onSubmit={onSubmit}>
            {!editing && (
              <Field label={t('keys.model')}>
                <select name="model_oid" required defaultValue="" className={inputClass}>
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
            )}
            <Field label={t('keys.label')}>
              <input
                name="label"
                required
                defaultValue={editing?.label ?? ''}
                placeholder={t('keys.labelPlaceholder')}
                className={inputClass}
              />
            </Field>
            <Field label={t('keys.secret')} help={editing ? t('keys.secretKeep') : undefined}>
              <input
                name="secret"
                type="password"
                required={!editing}
                placeholder={t('keys.secretPlaceholder')}
                className={inputClass}
              />
            </Field>
            <Field label={t('keys.qpm')} help={t('keys.qpmHelp')}>
              <input name="qpm" type="number" min={1} required defaultValue={editing?.qpm ?? 60} className={inputClass} />
            </Field>
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <FormActions onCancel={close} pending={pending} />
          </form>
        </Modal>
      )}
    </div>
  );
}
