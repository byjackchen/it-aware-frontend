'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Route as RouteIcon,
  Pencil,
  Trash2,
  AlertTriangle,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type {
  LLMModel,
  LLMModelTestResult,
  LLMRoute,
  LLMRouteCreate,
  TaskKeyInfo,
} from '@/lib/types/systems';
import { createRoute, deleteRoute, testModel, updateRoute } from '@/app/actions/systems';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import { Field, FormActions, Modal, inputClass } from '../_components/Modal';

interface Props {
  routes: LLMRoute[];
  models: LLMModel[];
  taskKeys: TaskKeyInfo[];
}

/** Only active models are routable: a route to an inactive model is skipped at
 * runtime and the task runs on the default model through ohla-router. */
const isUsable = (m: LLMModel) => m.is_active;

const numOrNull = (v: FormDataEntryValue | null): number | null => {
  const s = (v as string)?.trim();
  return s ? Number(s) : null;
};

export function RoutesClient({ routes, models, taskKeys }: Props) {
  const t = useTranslations('Systems');
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission(PERMISSIONS.SYSTEMS.LLM_PROXY_WRITE);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LLMRoute | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelOid, setModelOid] = useState('');
  const [pendingSwitch, setPendingSwitch] = useState<{
    payload: LLMRouteCreate;
    route: LLMRoute;
    fromName: string;
    toName: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LLMModelTestResult | null>(null);
  // The switch is only allowed once the target model has actually answered via the router.
  const testPassed = testResult?.ok === true && testResult.source === 'router';

  const usableModels = models.filter(isUsable);
  const modelByOid = new Map(models.map((m) => [m.oid, m]));
  // Known task_keys not yet routed — picking from these prevents typo'd routes
  // that would silently never match a real call site.
  const routedKeys = new Set(routes.map((r) => r.task_key));
  const availableTaskKeys = taskKeys.filter((tk) => !routedKeys.has(tk.task_key));

  const openCreate = () => {
    setCreating(true);
    setModelOid('');
    setError(null);
  };
  const openEdit = (r: LLMRoute) => {
    setEditing(r);
    setModelOid(r.model_oid);
    setError(null);
  };
  const close = () => {
    setEditing(null);
    setCreating(false);
    setError(null);
    setModelOid('');
    setPendingSwitch(null);
    setTestResult(null);
    setTesting(false);
  };

  const runTest = async (modelOid: string) => {
    setTesting(true);
    setTestResult(null);
    const res = await testModel(modelOid);
    setTesting(false);
    setTestResult(
      'error' in res
        ? {
            ok: false,
            model_name: '',
            source: 'error',
            content: null,
            latency_ms: null,
            http_status: null,
            error: res.error,
          }
        : res.data,
    );
  };

  const currentModel = modelByOid.get(modelOid);
  const selectedUnusable = !!currentModel && !isUsable(currentModel);
  const optionModels = [...usableModels];
  if (currentModel && !isUsable(currentModel)) optionModels.unshift(currentModel);

  const modelLabel = (m: LLMModel) =>
    isUsable(m) ? m.display_name || m.name : `${m.display_name || m.name} ${t('routes.inactiveModel')}`;

  // Only include override fields that carry a value (empty = inherit from model).
  const collectOverrides = (fd: FormData): Partial<LLMRouteCreate> => {
    const o: Partial<LLMRouteCreate> = {};
    const temperature = numOrNull(fd.get('temperature'));
    if (temperature !== null) o.temperature = temperature;
    const top_p = numOrNull(fd.get('top_p'));
    if (top_p !== null) o.top_p = top_p;
    const max_tokens = numOrNull(fd.get('max_tokens'));
    if (max_tokens !== null) o.max_tokens = max_tokens;
    const thinking = fd.get('thinking') as string;
    if (thinking === 'true') o.thinking = true;
    else if (thinking === 'false') o.thinking = false;
    return o;
  };

  const runSave = (payload: LLMRouteCreate, route: LLMRoute | null) => {
    startTransition(async () => {
      const res = route
        ? await updateRoute(route.oid, payload)
        : await createRoute(payload);
      if ('error' in res) setError(res.error);
      else {
        setPendingSwitch(null);
        close();
        router.refresh();
      }
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const overrides = collectOverrides(fd);
    const description = (fd.get('description') as string) || null;
    const payload: LLMRouteCreate = editing
      ? { task_key: editing.task_key, model_oid: modelOid, description, ...overrides }
      : { task_key: fd.get('task_key') as string, model_oid: modelOid, description, ...overrides };

    // Editing a live route's model is a hot prod switch — confirm before applying.
    // (New routes and same-model edits apply directly.)
    if (editing && modelOid !== editing.model_oid) {
      setTestResult(null);
      setTesting(false);
      setPendingSwitch({
        payload,
        route: editing,
        fromName: editing.model_name ?? t('common.none'),
        toName: currentModel ? currentModel.display_name || currentModel.name : modelOid,
      });
      return;
    }
    runSave(payload, editing);
  };

  const onDelete = (route: LLMRoute) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    startTransition(async () => {
      const res = await deleteRoute(route.oid);
      if ('error' in res) setError(res.error);
      else router.refresh();
    });
  };

  const thinkingDefault = (r: LLMRoute | null) =>
    r?.thinking === true ? 'true' : r?.thinking === false ? 'false' : '';

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
          {canWrite && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-blue-400 hover:bg-blue-500/30"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">{t('common.create')}</span>
            </button>
          )}
        </div>

        {/* Page-level error (e.g. a failed delete, which has no modal of its own). */}
        {error && !creating && !editing && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
                {routes.map((r) => {
                  const m = modelByOid.get(r.model_oid);
                  const broken = !m || !isUsable(m);
                  return (
                    <tr key={r.oid} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-sm text-blue-400">{r.task_key}</td>
                      <td className="px-4 py-3 text-white">
                        <span className="inline-flex items-center gap-1.5">
                          {r.model_name ?? t('common.none')}
                          {broken && (
                            <span title={t('routes.inactiveWarn')} className="text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{r.description ?? t('common.none')}</td>
                      <td className="px-4 py-3 text-sm">
                        {r.is_active ? (
                          <span className="text-green-400">{t('common.active')}</span>
                        ) : (
                          <span className="text-gray-500">{t('common.inactive')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canWrite && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-400">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => onDelete(r)} className="text-gray-400 hover:text-red-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(creating || editing) && !pendingSwitch && (
        <Modal title={editing ? t('routes.edit') : t('routes.create')} onClose={close}>
          <form onSubmit={onSubmit}>
            <Field label={t('routes.taskKey')}>
              {editing ? (
                <input
                  name="task_key"
                  defaultValue={editing.task_key}
                  disabled
                  className={`${inputClass} disabled:opacity-60`}
                />
              ) : availableTaskKeys.length === 0 ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                  {t('routes.noTaskKeys')}
                </p>
              ) : (
                <select name="task_key" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    —
                  </option>
                  {availableTaskKeys.map((tk) => (
                    <option key={tk.task_key} value={tk.task_key}>
                      {tk.task_key} — {tk.description}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('routes.model')}>
              {usableModels.length === 0 && !selectedUnusable ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                  {t('routes.noActiveModels')}
                </p>
              ) : (
                <select
                  name="model_oid"
                  required
                  value={modelOid}
                  onChange={(e) => setModelOid(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {optionModels.map((m) => (
                    <option key={m.oid} value={m.oid} disabled={!isUsable(m)}>
                      {modelLabel(m)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {selectedUnusable && (
              <p className="mb-3 flex items-center gap-1.5 text-sm text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t('routes.inactiveWarn')}
              </p>
            )}
            <Field label={t('routes.description')}>
              <input name="description" defaultValue={editing?.description ?? ''} className={inputClass} />
            </Field>

            {/* Optional per-route generation-param overrides (empty = inherit from model). */}
            <p className="mb-2 mt-1 text-xs text-gray-500">{t('routes.overridesHelp')}</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('models.temperature')}>
                <input name="temperature" type="number" step="0.01" defaultValue={editing?.temperature ?? ''} className={inputClass} />
              </Field>
              <Field label={t('models.topP')}>
                <input name="top_p" type="number" step="0.01" defaultValue={editing?.top_p ?? ''} className={inputClass} />
              </Field>
              <Field label={t('models.maxTokens')}>
                <input name="max_tokens" type="number" defaultValue={editing?.max_tokens ?? ''} className={inputClass} />
              </Field>
            </div>
            <Field label={t('models.thinking')}>
              <select name="thinking" defaultValue={thinkingDefault(editing)} className={inputClass}>
                <option value="">{t('routes.inherit')}</option>
                <option value="true">{t('routes.on')}</option>
                <option value="false">{t('routes.off')}</option>
              </select>
            </Field>

            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <FormActions onCancel={close} pending={pending} />
          </form>
        </Modal>
      )}

      {pendingSwitch && (
        <Modal title={t('routes.confirmSwitchTitle')} onClose={() => setPendingSwitch(null)}>
          <div className="space-y-3">
            <div className="font-mono text-sm text-blue-400">{pendingSwitch.route.task_key}</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">{t('routes.confirmFrom')}:</span>
              <span className="text-gray-300 line-through">{pendingSwitch.fromName}</span>
              <span className="text-gray-500">→</span>
              <span className="text-gray-400">{t('routes.confirmTo')}:</span>
              <span className="font-medium text-white">{pendingSwitch.toName}</span>
            </div>
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('routes.confirmSwitchWarn')}</span>
            </p>

            {/* Pre-switch test: probe the new model; the switch is gated on a live v2 reply. */}
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400">{t('routes.testHint')}</span>
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => runTest(pendingSwitch.payload.model_oid)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}
                  {testing ? t('routes.testing') : t('routes.testBtn')}
                </button>
              </div>
              {testResult && !testing && (
                testPassed ? (
                  <p className="flex items-start gap-1.5 text-sm text-green-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t('routes.testOk')}
                      {testResult.latency_ms != null &&
                        ` · ${t('routes.testLatency', { ms: testResult.latency_ms })}`}
                      {testResult.content && ` · ${t('routes.testReply')}: ${testResult.content.slice(0, 40)}`}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-sm text-red-400">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t('routes.testFail')}
                      {testResult.error ? `: ${testResult.error}` : ''}
                    </span>
                  </p>
                )
              )}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingSwitch(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={pending || !testPassed}
                title={!testPassed ? t('routes.testHint') : undefined}
                onClick={() => runSave(pendingSwitch.payload, pendingSwitch.route)}
                className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
              >
                {pending ? t('common.saving') : t('routes.confirmSwitchBtn')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
