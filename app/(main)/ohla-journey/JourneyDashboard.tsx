'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DataDisclosure, FlowSummary, Funnel, JourneySankey, Lineage, Metric, MetricGrid, OutcomeLegend, RankedBars, ReportPanel, StackedBar, TimeSeries } from './ReportVisuals';
import styles from './JourneyDashboard.module.css';

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
function windowDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api/ohla-journey/${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function Card({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <Metric label={label} value={value} note={note} />;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <ReportPanel title={title}>{children}</ReportPanel>;
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
  const cards = (items: Array<[string, string | number, string?]>) => <MetricGrid columns={items.length === 6 ? 3 : 4}>
    {items.map(([label, value, note]) => <Card key={label} label={label} value={value} note={note} />)}</MetricGrid>;
  const treePanel = (title: string, value: unknown) => value === undefined || value === null ? null :
    <DataDisclosure title={`${title} · ${zh ? '完整数据' : 'Full data'}`}><Tree value={value} zh={zh} /></DataDisclosure>;

  const renderSection = () => {
    if (!payload) return null;
    if (section === 'headline') {
      const lineage = object(object(payload.scope).lineage);
      const headline = list(payload.headline);
      return <>
        <p className={styles.lede}>{zh ? '从原始活动段到用户画像，每一步都能追溯；点击侧栏查看各环节的结果与明细。' : 'Trace the analysis from activity segments to personas, then open each section for results and details.'}</p>
        <Lineage scope={object(payload.scope)} zh={zh} personaCount={Number(meta?.counts?.personas ?? 0)} />
        {cards(headline.map((item) => { const row = list(item); const names = text(row[0]).split(' / ');
          return [names[zh ? 1 : 0] ?? names[0], text(row[1]), row[2] ? headlineNote(text(row[2]), zh) : undefined]; }))}
        <p className={styles.note}>{zh ? `共分析 ${Number(lineage.journeys ?? 0).toLocaleString()} 条旅程；结果仍可能变化的旅程 ${Number(object(payload.settled).pending ?? 0).toLocaleString()} 条。` : `${Number(lineage.journeys ?? 0).toLocaleString()} journeys analysed; ${Number(object(payload.settled).pending ?? 0).toLocaleString()} outcomes remain pending.`}</p>
        {treePanel(t('source'), payload.scope)}{treePanel(zh ? '已稳定与待观察' : 'Settled and pending', payload.settled)}
        {treePanel(zh ? '比率分母' : 'Rate denominators', payload.rate_denominators)}
        {treePanel(t('auditNote'), payload.limits)}
      </>;
    }
    if (section === 'resolution') {
      const rates = object(payload.rates);
      const timing = list(payload.timing).map(object);
      const outcomes = object(payload.request_outcomes);
      return <>
        <p className={styles.lede}>{zh ? '同一分母下比较 AI、人工与端到端解决情况。深色为已证实，浅色为已交付但尚未证实；灰色代表无法判断。' : 'Compare AI, human and end-to-end resolution using the same denominator. Dark means confirmed; light means delivered but unconfirmed.'}</p>
        <MetricGrid>{(['ai', 'human', 'end_to_end'] as const).map((key) => { const value = object(rates[key]);
          return <Metric key={key} label={key === 'end_to_end' ? t('endToEnd') : t(key)} value={pct(value.upper)}
            note={`${t('confirmed')}: ${pct(value.lower)} · ${text(value.denominator)} ${t('journeys')}`}
            tone={key === 'human' ? 'green' : 'blue'} />; })}</MetricGrid>
        <ReportPanel title={zh ? '解决结果构成' : 'Resolution composition'}><OutcomeLegend zh={zh} />
          <div className={styles.rateRows}>{(['ai', 'human', 'end_to_end'] as const).map((key) => { const value = object(rates[key]);
            const prefix = key === 'human' ? 'human' : 'ai';
            return <div className={styles.rateRow} key={key}><strong>{key === 'end_to_end' ? t('endToEnd') : t(key)}</strong>
              <StackedBar parts={[
                { key: 'confirmed', value: Number(value.confirmed ?? 0), color: prefix === 'human' ? '#177245' : '#1c5cab', label: zh ? '已证实' : 'Confirmed' },
                { key: 'delivered', value: Number(value.delivered ?? 0), color: prefix === 'human' ? '#8fd1a8' : '#86b6ef', label: zh ? '未证实' : 'Unconfirmed' },
                { key: 'unknown', value: Number(value.unknown ?? 0), color: '#d6dae0', label: zh ? '无法判断' : 'Unknown' },
                { key: 'unresolved', value: Number(value.unresolved ?? 0), color: '#b64a3c', label: zh ? '未解决' : 'Unresolved' },
              ]} /><span>{pct(value.upper)}</span></div>; })}</div></ReportPanel>
        <ReportPanel title={t('timing')} description={zh ? '日历时间；中位数与分位数只在有记录的样本上计算。' : 'Calendar time; percentiles use recorded observations.'}>
          <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>{zh ? '耗时指标' : 'Metric'}</th><th>{zh ? '样本' : 'N'}</th><th>{zh ? '中位数' : 'Median'}</th><th>P75</th><th>P90</th></tr></thead>
            <tbody>{timing.map((row) => <tr key={text(row.metric)}><td>{text(row.metric)}</td><td>{text(row.n)}</td><td>{text(row.median_sec)}s</td><td>{text(row.p75_sec)}s</td><td>{text(row.p90_sec)}s</td></tr>)}</tbody></table></div>
        </ReportPanel>
        <ReportPanel title={zh ? '诉求结果' : 'Request outcomes'}><RankedBars rows={Object.entries(outcomes).map(([label, value]) => ({ label, value: Number(value) }))} zh={zh} /></ReportPanel>
        {treePanel(zh ? '已发布解决率明细' : 'Published resolution detail', payload.published_rates)}
        {treePanel(zh ? '已发布耗时明细' : 'Published timing detail', payload.published_time_stats)}
        <EntityBrowser key={`requests-${round}-${filterKey}`} kind="requests" round={round} zh={zh} title={t('requests')} filters={activeFilters} />
      </>;
    }
    if (section === 'gaps') {
      const summary = object(payload.summary);
      const items = list(payload.items).map(object);
      return <><p className={styles.lede}>{zh ? '知识缺口与自动化缺口按预计影响排序。点击下方缺口明细可查看判断依据和建议。' : 'Knowledge and automation gaps ranked by estimated impact. Open an item below for evidence and recommendations.'}</p>
        <MetricGrid><Metric label={t('gapItems')} value={items.length} tone="amber" />
          <Metric label={zh ? '知识缺口候选' : 'Knowledge candidates'} value={Number(summary.family_knowledge ?? 0).toLocaleString()} />
          <Metric label={zh ? '自动化缺口候选' : 'Automation candidates'} value={Number(summary.family_action ?? 0).toLocaleString()} /></MetricGrid>
        <ReportPanel title={zh ? '优先处理的缺口' : 'Priority gaps'} description={zh ? '条形长度表示覆盖旅程数；完整建议见下方明细。' : 'Bars show journeys covered; open the detail below for recommendations.'}>
          <RankedBars rows={items.map((row) => ({ label: text((zh ? row.title_zh : row.title_en) ?? row.key), value: Number(object(row.volume).journeys ?? 0), note: text(row.gap_family) }))} zh={zh} color="#6c5ad6" />
        </ReportPanel>
        {treePanel(zh ? '缺口计算口径' : 'Gap calculations', payload.summary)}
        <EntityBrowser kind="gap_items" round={round} zh={zh} title={t('gapItems')} />
      </>;
    }
    if (section === 'journey') return <><p className={styles.lede}>{zh ? '从入口到路径再到结果，色彩对应解决结果。每条旅程只计入一条路径。' : 'From entry through path to outcome. Colours indicate resolution; each journey has one path.'}</p>
      {payload.flow ? <ReportPanel title={t('flow')}><JourneySankey flow={payload.flow} zh={zh} />
        <DataDisclosure title={zh ? '按路径查看流量' : 'Flow by path'}><FlowSummary flow={payload.flow} zh={zh} /></DataDisclosure></ReportPanel> : null}
      <CountTable title={zh ? '旅程类型' : 'Journey types'} rows={list(payload.types).map(object)} keyField="journey_type" valueField="n" zh={zh} />
      {list(payload.funnels).map((item) => { const funnel = object(item); return <ReportPanel key={text(funnel.funnel_id)} title={`${zh ? '旅程漏斗' : 'Journey funnel'} · ${text(funnel.funnel_id)}`}>
        <Funnel stages={list(funnel.stages)} zh={zh} /></ReportPanel>; })}
      <EntityBrowser key={`journeys-${round}-${filterKey}`} kind="journeys" round={round} zh={zh} title={t('journeys')} filters={activeFilters} />
      <EntityBrowser key={`units-${round}-${filterKey}`} kind="units" round={round} zh={zh} title={t('units')} filters={activeFilters} /></>;
    if (section === 'timeline') {
      const daily = list(payload.daily).map(object);
      const bursts = list(object(payload.timeline).bursts).map(object);
      return <><p className={styles.lede}>{zh ? '观察旅程数量随时间变化；异常波峰显示高于基线的主题。' : 'See how journey volume changes over time and which topics exceed the baseline.'}</p>
        <ReportPanel title={t('daily')}><TimeSeries rows={daily.map((row) => ({ day: Number(row.day), journeys: Number(row.journeys) }))} zh={zh} /></ReportPanel>
        {bursts.length > 0 && <ReportPanel title={zh ? '异常波峰' : 'Bursts'}><RankedBars rows={bursts.map((row) => ({ label: `${text(row.topic)} · ${zh ? '第' : 'day '}${text(row.day)}${zh ? '天' : ''}`, value: Number(row.n) }))} zh={zh} color="#df9f39" /></ReportPanel>}
        {treePanel(t('timing'), payload.timing)}</>;
    }
    if (section === 'persona') {
      const personaData = object(payload.personas);
      const personas = list(personaData.personas).map(object);
      return <>{!personas.length && treePanel(zh ? '画像暂不可用' : 'Personas unavailable', payload.unavailable)}
        <p className={styles.lede}>{zh ? '每张画像是一组有共同求助习惯的用户。点击画像，下面的用户明细会自动筛选。' : 'Each persona groups users with similar support habits. Select one to filter the users below.'}</p>
        <div className={styles.personaGrid}>{personas.map((persona) => <button key={text(persona.persona_id)}
          onClick={() => setPersonaId(text(persona.persona_id))}
          className={`${styles.personaCard} ${personaId === persona.persona_id ? styles.selected : ''}`}>
          <span className={styles.personaId}>{text(persona.persona_id)}</span><div className={styles.personaName}>{text(zh ? persona.name_zh : persona.name_en)}</div>
          <div className={styles.personaDescription}>{text(zh ? persona.description_zh : persona.description_en)}</div>
          <div className={styles.personaCount}><span>{t('users')} <strong>{text(persona.users)}</strong></span><span>{t('journeys')} <strong>{text(persona.journeys)}</strong></span></div>
        </button>)}</div>
        {treePanel(zh ? '画像模型' : 'Persona model', personaData.model)}
        {treePanel(zh ? '画像验证' : 'Persona validation', payload.validation)}
        <EntityBrowser key={`users-${round}-${filterKey}-${personaId}`} kind="users" round={round} zh={zh} title={t('users')} filters={activeFilters}
          relation={personaId ? { key: 'persona_id', value: personaId } : undefined} />
        <EntityBrowser kind="personas" round={round} zh={zh} title={t('personas')} />
      </>;
    }
    if (section === 'patterns') {
      const patterns = object(payload.patterns);
      const candidates = object(patterns.candidates);
      const rules = list(patterns.rules).map(object);
      return <><p className={styles.lede}>{zh ? '查看重复需求、回访风险和已验证的规律；规则的验证结果与适用范围可在明细中检查。' : 'Explore repeated needs, return risk and verified patterns. Review evidence and scope in the full details.'}</p>
        <MetricGrid><Metric label={zh ? '触达建议' : 'Suggested pushes'} value={Number(candidates.pushes ?? 0).toLocaleString()} tone="blue" />
          <Metric label={t('users')} value={Number(candidates.users ?? 0).toLocaleString()} /><Metric label={zh ? '规则' : 'Rules'} value={rules.length} /></MetricGrid>
        <ReportPanel title={zh ? '建议来源' : 'Suggestion sources'}><RankedBars rows={Object.entries(object(candidates.by_generator)).map(([label, value]) => ({ label, value: Number(value) }))} zh={zh} /></ReportPanel>
        <ReportPanel title={zh ? '已发现的规律' : 'Discovered patterns'}><div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>{zh ? '条件' : 'Condition'}</th><th>{zh ? '生成方式' : 'Generator'}</th><th>{zh ? '验证结果' : 'Verdict'}</th><th>{zh ? '验证用户' : 'Confirmed users'}</th><th>{zh ? '回访率' : 'Return rate'}</th></tr></thead>
          <tbody>{rules.map((rule, i) => <tr key={`${text(rule.condition)}-${i}`}><td>{text(rule.condition)}</td><td>{text(rule.generator)}</td><td>{text(rule.verdict)}</td><td>{text(object(rule.confirm).users)}</td><td>{pct(object(rule.confirm).rate)}</td></tr>)}</tbody></table></div></ReportPanel>
        {treePanel(t('patterns'), payload.patterns)}</>;
    }
    return <><p className={styles.lede}>{zh ? '这里记录报告的校验结果、样本边界和解释限制，便于核对每个结论是否可靠。' : 'Review validation, coverage and interpretation limits behind each conclusion.'}</p>
      <MetricGrid><Metric label={zh ? '审核类别' : 'Audit groups'} value={Object.keys(object(payload.quality)).length} />
        <Metric label={zh ? '小样本阈值' : 'Small sample threshold'} value={Number(payload.small_sample_min ?? 0)} />
        <Metric label={zh ? '渠道映射' : 'Channel mappings'} value={Object.keys(object(payload.channel_groups)).length} /></MetricGrid>
      <ReportPanel title={zh ? '解释边界' : 'Interpretation limits'}><ol className={styles.limits}>{list(payload.limits).map((item, i) => <li key={i}>{text(item)}</li>)}</ol></ReportPanel>
      {treePanel(t('auditNote'), payload.quality)}{treePanel(zh ? '门槛' : 'Thresholds', payload.thresholds)}
      {treePanel(zh ? '一致性' : 'Agreement', payload.agreement)}{treePanel(zh ? '工作量' : 'Workload', payload.workload)}
      {treePanel(zh ? '解释边界' : 'Interpretation limits', payload.limits)}
      {treePanel(zh ? '目录' : 'Catalog', payload.catalog)}
      {treePanel(zh ? '渠道归并' : 'Channel grouping', payload.channel_groups)}
      {treePanel(zh ? '比率计数' : 'Rate counts', payload.rate_counts)}
      {treePanel(zh ? '小样本阈值' : 'Small sample threshold', payload.small_sample_min)}
      {treePanel(zh ? '报告注释' : 'Report note', payload.note)}
      {treePanel(zh ? '地区筛选口径' : 'Region filter rule', payload.slice_region_priority)}</>;
  };

  return <main className={styles.dashboard}>
    <div className={styles.header}><div>
      <div className={styles.eyebrow}>OHLA JOURNEY / {meta?.round_id ?? 'REPORT'}</div>
      <h1>{t(section)}</h1>
      {meta && <p>{windowDate(meta.window[0])} – {windowDate(meta.window[1])} · UTC+08:00</p>}
    </div>{versions.length > 0 && <label className={styles.version}>{t('version')}
      <select value={round} onChange={(event) => { setRound(event.target.value); setPersonaId(''); }}
        className={styles.select}>
        {versions.map((item) => <option key={item.round_id} value={item.round_id}>{item.round_id}</option>)}
      </select></label>}</div>
    {!loaded && <p>{t('loading')}</p>}
    {loaded && !versions.length && <Panel title={t('title')}><p>{error ? t('error') : t('unavailable')}</p></Panel>}
    {loaded && !!versions.length && !!SECTION_FILTERS[section] && <div className={styles.filterBar}>
      <strong>{t('filters')}</strong>{(SECTION_FILTERS[section] ?? []).map((name) =>
        <label key={name}>{name === 'persona' ? t('personaFilter') : t(name)}
          <select value={filters[name] ?? ''} onChange={(event) => updateFilter(name, event.target.value)}
            className={styles.select}>
            <option value="">{t('all')}</option>{list(options[name]).map((value) => <option key={text(value)} value={text(value)}>{text(value)}</option>)}
          </select></label>)}
      <button onClick={() => setFilters({})}>{t('clear')}</button>
      <small>{(SECTION_FILTERS[section] ?? []).includes('channel') ? t('channelHelp') : ''} {(SECTION_FILTERS[section] ?? []).includes('region') ? t('regionHelp') : ''}</small>
    </div>}
    {round && !payload && !error && <p>{t('loading')}</p>}
    {error && versions.length > 0 && <Panel title={t('title')}><p>{t('error')}</p></Panel>}
    {payload && <>{section !== 'headline' && <div className={styles.selection}>{t('requests')} <strong>{Number(object(payload.selection).requests ?? 0).toLocaleString()}</strong>
      <span>·</span>{t('journeys')} <strong>{Number(object(payload.selection).journeys ?? 0).toLocaleString()}</strong></div>}{renderSection()}</>}
  </main>;
}
