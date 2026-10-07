'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Section = 'headline' | 'resolution' | 'gaps' | 'journey' | 'timeline' | 'persona' | 'patterns' | 'audit';
type Kind = 'units' | 'requests' | 'journeys' | 'gap_items' | 'users' | 'personas';
type JsonObject = Record<string, unknown>;
type ReportMeta = { round_id: string; report_version: string; active: boolean; window: string[]; counts: Record<string, number> };
type EntityPage = { rows: JsonObject[]; total: number; offset: number; limit: number };

const SECTION_FILTERS: Partial<Record<Section, Array<'channel' | 'region' | 'topic' | 'persona'>>> = {
  resolution: ['topic', 'persona'], journey: ['channel', 'region', 'topic', 'persona'],
  timeline: ['topic', 'persona'], persona: ['channel', 'region', 'topic', 'persona'],
};
const ID_FIELD: Record<Kind, string> = { units: 'unit_id', requests: 'request_id', journeys: 'journey_id',
  gap_items: 'gap_id', users: 'user_id', personas: 'persona_id' };
const LABELS_ZH: Record<string, string> = {
  id: 'ID', user_id: '用户 ID', unit_id: '单元 ID', request_id: '诉求 ID', journey_id: '旅程 ID',
  gap_id: '缺口 ID', persona_id: '画像 ID', summary: '诉求摘要', topic: '主题', subtopic: '子主题',
  reason: '判断原因', region: '地区', channel: '渠道', outcome: '结果', flow: '流向', first: '首次接触',
  last: '最后接触', type: '类型', start: '开始', end: '结束', time: '耗时', times: '耗时',
  assessment: '缺口判断', links: '关联依据', patterns: '规律', rules: '规则', features: '特征',
  attrs: '用户属性', journey_ids: '旅程', request_ids: '诉求', events: '活动数',
  human_actions: '人工操作', close_context: '关闭情况', fact_index: '统计行序号',
  name_zh: '名称', description_zh: '说明', recommendation: '建议', volume: '覆盖量',
};
const JOURNEY_NAMES: Record<string, [string, string]> = {
  BOT_RESOLVED_FIRST: ['Bot resolved first', '机器人首次解决'],
  BOT_ASKED_HUMAN: ['Bot asked for human', '机器人建议人工处理'],
  TICKET_NO_BOT: ['Ticket without bot', '未经过机器人直接建单'],
  BOT_DELIVERED_LEFT: ['Bot delivered, user left', '机器人给出方案后离开'],
  ESCALATED_SAME_SEGMENT: ['Escalated in same contact', '同次接触转人工'],
  RECONTACT: ['Recontacted', '再次联系'],
  MULTI_TICKET: ['Multiple tickets', '多次建单'],
};

function object(value: unknown): JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return value === null || value === undefined ? '—' : String(value); }
function pct(value: unknown): string { return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'; }
function displayKey(key: string, zh: boolean): string { return zh ? LABELS_ZH[key] ?? key.replaceAll('_', ' ') : key.replaceAll('_', ' '); }

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api/ohla-journey/${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function Card({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    {note && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</div>}
  </div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>{children}
  </section>;
}

function CountTable({ title, rows, keyField, valueField, zh }: {
  title: string; rows: JsonObject[]; keyField: string; valueField: string; zh: boolean;
}) {
  return <Panel title={title}><div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead><tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700"><th className="py-2">{zh ? '类型' : 'Type'}</th><th className="py-2 text-right">{zh ? '数量' : 'Count'}</th></tr></thead>
    <tbody>{rows.map((row, i) => { const code = text(row[keyField]); const names = JOURNEY_NAMES[code];
      return <tr key={`${code}-${i}`} className="border-b border-slate-100 dark:border-slate-800">
        <td className="py-2" title={code}>{names ? names[zh ? 1 : 0] : code}</td>
        <td className="py-2 text-right font-semibold tabular-nums">{Number(row[valueField] ?? 0).toLocaleString()}</td>
      </tr>; })}</tbody></table></div></Panel>;
}

function headlineNote(value: string, zh: boolean): string {
  if (!zh) return value;
  return value.replaceAll('confirmed', '已证实').replaceAll('incl.', '其中含')
    .replaceAll('self-resolved', '自行解决').replaceAll('came back', '再次联系')
    .replaceAll('several tickets', '多张工单').replaceAll('other', '其他')
    .replace(/(\d+) of (\d+)/, '$1 / $2');
}

function Tree({ value, zh, level = 0 }: { value: unknown; zh: boolean; level?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  if (typeof value !== 'object') return <span className="break-words">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-slate-400">—</span>;
    const shown = expanded ? value : value.slice(0, level === 0 ? 50 : 12);
    return <div className="space-y-1">{shown.map((item, i) => <div key={i} className="border-l border-slate-200 pl-3 dark:border-slate-700">
      <span className="mr-2 text-xs text-slate-400">{i + 1}.</span><Tree value={item} zh={zh} level={level + 1} />
    </div>)}{shown.length < value.length && <button className="text-sm text-indigo-600" onClick={() => setExpanded(true)}>
      {zh ? `显示其余 ${value.length - shown.length} 项` : `Show ${value.length - shown.length} more`}</button>}</div>;
  }
  return <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(110px,180px)_minmax(0,1fr)]">{
    Object.entries(value).map(([key, item]) => <div key={key} className="contents">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{displayKey(key, zh)}</dt>
      <dd className="min-w-0 text-sm text-slate-800 dark:text-slate-200"><Tree value={item} zh={zh} level={level + 1} /></dd>
    </div>)}</dl>;
}

function EntityBrowser({ kind, round, zh, title, relation, filters }: {
  kind: Kind; round: string; zh: boolean; title: string; relation?: { key: string; value: string }; filters?: Record<string, string>;
}) {
  const t = useTranslations('OhlaJourney');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<EntityPage | null>(null);
  const [selected, setSelected] = useState<JsonObject | null>(null);
  const [pending, setPending] = useState(true);
  const relationKey = relation?.key;
  const relationValue = relation?.value;
  const filterKey = JSON.stringify(filters ?? {});
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ limit: '25', offset: String(page * 25) });
    if (relationKey && relationValue) query.set(relationKey, relationValue);
    for (const [key, value] of Object.entries(JSON.parse(filterKey) as Record<string, string>)) if (value) query.set(key, value);
    fetchJson<EntityPage>(`reports/${encodeURIComponent(round)}/entities/${kind}?${query}`).then((result) => {
      if (active) setData(result);
    }).catch(() => { if (active) setData(null); }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [round, kind, page, relationKey, relationValue, filterKey]);
  const rows = data?.rows ?? [];
  const idField = ID_FIELD[kind];
  const open = async (row: JsonObject) => {
    const id = String(row[idField]);
    try { setSelected(await fetchJson<JsonObject>(`reports/${encodeURIComponent(round)}/entities/${kind}/${encodeURIComponent(id)}`)); }
    catch { setSelected(row); }
  };
  return <Panel title={`${title}${data ? ` · ${data.total.toLocaleString()}` : ''}`}>
    {pending && <p className="text-sm text-slate-500">{t('loading')}</p>}
    {!pending && !rows.length && <p className="text-sm text-slate-500">{t('none')}</p>}
    {!!rows.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500 dark:border-slate-700">
      <th className="py-2 pr-4">ID</th><th className="py-2 pr-4">{zh ? '内容' : 'Summary'}</th><th className="py-2">{t('details')}</th>
    </tr></thead><tbody>{rows.map((row) => <tr key={String(row[idField])} className="border-b border-slate-100 dark:border-slate-800">
      <td className="max-w-52 truncate py-2 pr-4 font-mono text-xs" title={String(row[idField])}>{text(row[idField])}</td>
      <td className="max-w-xl truncate py-2 pr-4" title={text(row.summary ?? row.name_zh ?? row.title_zh ?? row.topic ?? row.flow ?? row.type)}>
        {text(row.summary ?? (zh ? row.name_zh : row.name_en) ?? row.title_zh ?? row.topic ?? row.flow ?? row.type)}</td>
      <td className="py-2"><button className="text-indigo-600 hover:underline" onClick={() => open(row)}>{t('details')}</button></td>
    </tr>)}</tbody></table></div>}
    {data && data.total > 25 && <div className="mt-4 flex items-center gap-3 text-sm">
      <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">{t('previous')}</button>
      <span>{page + 1} / {Math.ceil(data.total / 25)}</span>
      <button disabled={(page + 1) * 25 >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">{t('next')}</button>
    </div>}
    {selected && <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{t('details')} · {text(selected[idField])}</h3>
        <button onClick={() => setSelected(null)} aria-label="Close details" className="rounded px-2 py-1 text-sm hover:bg-slate-200 dark:hover:bg-slate-800">×</button></div>
      <Tree value={selected} zh={zh} />
    </div>}
  </Panel>;
}

export default function JourneyDashboard({ section }: { section: Section }) {
  const t = useTranslations('OhlaJourney');
  const zh = useLocale().startsWith('zh');
  const [versions, setVersions] = useState<ReportMeta[]>([]);
  const [round, setRound] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [response, setResponse] = useState<{ key: string; data: JsonObject } | null>(null);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [personaId, setPersonaId] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('ohla-journey-round');
    const savedFilters = sessionStorage.getItem('ohla-journey-filters');
    if (savedFilters) { try { Promise.resolve().then(() => setFilters(JSON.parse(savedFilters) as Record<string, string>)); } catch { /* ignore stale preference */ } }
    fetchJson<ReportMeta[]>('reports').then((items) => {
      setVersions(items);
      setRound(items.find((item) => item.round_id === saved)?.round_id ?? items.find((item) => item.active)?.round_id ?? items[0]?.round_id ?? '');
    }).catch(() => setError(true)).finally(() => setLoaded(true));
  }, []);
  const activeFilters = Object.fromEntries((SECTION_FILTERS[section] ?? []).map((name) => [name, filters[name] ?? '']));
  const filterKey = JSON.stringify(activeFilters);
  const responseKey = `${round}|${section}|${filterKey}`;
  const payload = response?.key === responseKey ? response.data : null;
  useEffect(() => {
    if (!round) return;
    sessionStorage.setItem('ohla-journey-round', round);
    sessionStorage.setItem('ohla-journey-filters', JSON.stringify(filters));
    let active = true;
    const query = new URLSearchParams(Object.entries(JSON.parse(filterKey) as Record<string, string>).filter(([, v]) => v));
    fetchJson<JsonObject>(`reports/${encodeURIComponent(round)}/sections/${section}?${query}`).then((result) => {
      if (active) { setResponse({ key: responseKey, data: result }); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [round, section, filterKey, responseKey, filters]);

  const meta = versions.find((item) => item.round_id === round);
  const options = object(payload?.filter_options);
  const updateFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const cards = (items: Array<[string, string | number, string?]>) => <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {items.map(([label, value, note]) => <Card key={label} label={label} value={value} note={note} />)}</div>;
  const treePanel = (title: string, value: unknown) => value === undefined || value === null ? null :
    <Panel title={title}><Tree value={value} zh={zh} /></Panel>;

  const renderSection = () => {
    if (!payload) return null;
    if (section === 'headline') {
      const lineage = object(object(payload.scope).lineage);
      const headline = list(payload.headline);
      return <>
        {cards(headline.map((item) => { const row = list(item); const names = text(row[0]).split(' / ');
          return [names[zh ? 1 : 0] ?? names[0], text(row[1]), row[2] ? headlineNote(text(row[2]), zh) : undefined]; }))}
        {cards((['units', 'requests', 'journeys', 'users'] as const).map((key) => [t(key), Number(lineage[key] ?? 0).toLocaleString()]))}
        {treePanel(t('source'), payload.scope)}{treePanel(zh ? '已稳定与待观察' : 'Settled and pending', payload.settled)}
        {treePanel(zh ? '比率分母' : 'Rate denominators', payload.rate_denominators)}
        {treePanel(t('auditNote'), payload.limits)}
      </>;
    }
    if (section === 'resolution') {
      const rates = object(payload.rates);
      return <>
        {cards((['ai', 'human', 'end_to_end'] as const).map((key) => {
          const value = object(rates[key]); return [key === 'end_to_end' ? t('endToEnd') : t(key), pct(value.upper),
            `${t('confirmed')}: ${pct(value.lower)} · ${text(value.denominator)} ${t('journeys')}`];
        }))}
        {treePanel(t('timing'), payload.timing)}{treePanel(zh ? '诉求结果' : 'Request outcomes', payload.request_outcomes)}
        {treePanel(zh ? '已发布解决率明细' : 'Published resolution detail', payload.published_rates)}
        {treePanel(zh ? '已发布耗时明细' : 'Published timing detail', payload.published_time_stats)}
        <EntityBrowser key={`requests-${round}-${filterKey}`} kind="requests" round={round} zh={zh} title={t('requests')} filters={activeFilters} />
      </>;
    }
    if (section === 'gaps') return <>{treePanel(zh ? '缺口概况' : 'Gap summary', payload.summary)}
      {treePanel(zh ? '全部缺口统计' : 'All gap statistics', payload.items)}
      <EntityBrowser kind="gap_items" round={round} zh={zh} title={t('gapItems')} /></>;
    if (section === 'journey') return <>{treePanel(t('flow'), payload.flow)}
      <CountTable title={zh ? '旅程类型' : 'Journey types'} rows={list(payload.types).map(object)} keyField="journey_type" valueField="n" zh={zh} />
      {treePanel(zh ? '旅程漏斗' : 'Journey funnels', payload.funnels)}
      <EntityBrowser key={`journeys-${round}-${filterKey}`} kind="journeys" round={round} zh={zh} title={t('journeys')} filters={activeFilters} />
      <EntityBrowser key={`units-${round}-${filterKey}`} kind="units" round={round} zh={zh} title={t('units')} filters={activeFilters} /></>;
    if (section === 'timeline') {
      const daily = list(payload.daily).map(object);
      const max = Math.max(1, ...daily.map((row) => Number(row.journeys ?? 0)));
      return <><Panel title={t('daily')}><div className="max-h-80 space-y-1 overflow-auto">{daily.map((row) =>
        <div key={text(row.day)} className="flex items-center gap-3 text-xs"><span className="w-12 text-slate-500">{text(row.day)}</span>
          <div className="h-3 min-w-1 rounded bg-indigo-500" style={{ width: `${Math.max(1, Number(row.journeys ?? 0) / max * 90)}%` }} />
          <span>{text(row.journeys)}</span></div>)}</div></Panel>
        {treePanel(zh ? '异常波峰' : 'Bursts', object(payload.timeline).bursts)}{treePanel(t('timing'), payload.timing)}</>;
    }
    if (section === 'persona') {
      const personaData = object(payload.personas);
      const personas = list(personaData.personas).map(object);
      return <>{!personas.length && treePanel(zh ? '画像暂不可用' : 'Personas unavailable', payload.unavailable)}
        <div className="grid gap-3 lg:grid-cols-2">{personas.map((persona) => <button key={text(persona.persona_id)}
          onClick={() => setPersonaId(text(persona.persona_id))}
          className={`rounded-xl border bg-white p-4 text-left shadow-sm dark:bg-slate-900 ${personaId === persona.persona_id ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className="font-semibold">{text(zh ? persona.name_zh : persona.name_en)}</div>
          <div className="mt-1 text-sm text-slate-500">{text(zh ? persona.description_zh : persona.description_en)}</div>
          <div className="mt-2 text-xs">{t('users')}: {text(persona.users)} · {t('journeys')}: {text(persona.journeys)}</div>
        </button>)}</div>
        {treePanel(zh ? '画像模型' : 'Persona model', personaData.model)}
        {treePanel(zh ? '画像验证' : 'Persona validation', payload.validation)}
        <EntityBrowser key={`users-${round}-${filterKey}-${personaId}`} kind="users" round={round} zh={zh} title={t('users')} filters={activeFilters}
          relation={personaId ? { key: 'persona_id', value: personaId } : undefined} />
        <EntityBrowser kind="personas" round={round} zh={zh} title={t('personas')} />
      </>;
    }
    if (section === 'patterns') return <>{treePanel(t('patterns'), payload.patterns)}</>;
    return <>{treePanel(t('auditNote'), payload.quality)}{treePanel(zh ? '门槛' : 'Thresholds', payload.thresholds)}
      {treePanel(zh ? '一致性' : 'Agreement', payload.agreement)}{treePanel(zh ? '工作量' : 'Workload', payload.workload)}
      {treePanel(zh ? '解释边界' : 'Interpretation limits', payload.limits)}
      {treePanel(zh ? '目录' : 'Catalog', payload.catalog)}
      {treePanel(zh ? '渠道归并' : 'Channel grouping', payload.channel_groups)}
      {treePanel(zh ? '比率计数' : 'Rate counts', payload.rate_counts)}
      {treePanel(zh ? '小样本阈值' : 'Small sample threshold', payload.small_sample_min)}
      {treePanel(zh ? '报告注释' : 'Report note', payload.note)}
      {treePanel(zh ? '地区筛选口径' : 'Region filter rule', payload.slice_region_priority)}</>;
  };

  return <main className="min-h-full space-y-5 bg-slate-50 p-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="flex flex-wrap items-end justify-between gap-3"><div>
      <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600">OHLA JOURNEY</div>
      <h1 className="mt-1 text-xl font-semibold">{t(section)}</h1>
      {meta && <p className="mt-1 text-xs text-slate-500">{meta.window[0]} – {meta.window[1]} · {meta.round_id}</p>}
    </div>{versions.length > 0 && <label className="text-xs text-slate-500">{t('version')}
      <select value={round} onChange={(event) => { setRound(event.target.value); setPersonaId(''); }}
        className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        {versions.map((item) => <option key={item.round_id} value={item.round_id}>{item.round_id}</option>)}
      </select></label>}</div>
    {!loaded && <p>{t('loading')}</p>}
    {loaded && !versions.length && <Panel title={t('title')}><p>{error ? t('error') : t('unavailable')}</p></Panel>}
    {loaded && !!versions.length && !!SECTION_FILTERS[section] && <Panel title={t('filters')}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(SECTION_FILTERS[section] ?? []).map((name) =>
        <label key={name} className="text-xs font-medium text-slate-600 dark:text-slate-300">{name === 'persona' ? t('personaFilter') : t(name)}
          <select value={filters[name] ?? ''} onChange={(event) => updateFilter(name, event.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="">{t('all')}</option>{list(options[name]).map((value) => <option key={text(value)} value={text(value)}>{text(value)}</option>)}
          </select></label>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500"><span>{t('channelHelp')}</span><span>{t('regionHelp')}</span>
        <button className="text-indigo-600 hover:underline" onClick={() => setFilters({})}>{t('clear')}</button></div>
    </Panel>}
    {round && !payload && !error && <p>{t('loading')}</p>}
    {error && versions.length > 0 && <Panel title={t('title')}><p>{t('error')}</p></Panel>}
    {payload && <>{section !== 'headline' && cards([[t('requests'), Number(object(payload.selection).requests ?? 0).toLocaleString()],
                           [t('journeys'), Number(object(payload.selection).journeys ?? 0).toLocaleString()]])}{renderSection()}</>}
  </main>;
}
