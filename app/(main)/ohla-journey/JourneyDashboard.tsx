'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DataDisclosure, FlowSummary, Funnel, JourneySankey, Lineage, Metric, MetricGrid, OutcomeLegend, RankedBars, ReportPanel, StackedBar } from './ReportVisuals';
import DrilldownDrawer, { type Drill } from './DrilldownDrawer';
import PatternsReport from './PatternsReport';
import AuditReport from './AuditReport';
import TimelineReport from './TimelineReport';
import styles from './JourneyDashboard.module.css';

type Section = 'headline' | 'resolution' | 'gaps' | 'journey' | 'timeline' | 'persona' | 'patterns' | 'audit';
type Kind = 'units' | 'requests' | 'journeys' | 'gap_items' | 'users' | 'personas';
type JsonObject = Record<string, unknown>;
type ReportMeta = { round_id: string; report_version: string; active: boolean; window: string[]; counts: Record<string, number> };
type EntityPage = { rows: JsonObject[]; total: number; offset: number; limit: number };

const RESOLUTION_DIMENSIONS = ['topic', 'subtopic', 'resolution_requirement', 'request_type',
  'journey_type', 'entry_channel', 'persona', 'tenure', 'worker_type', 'business_group',
  'country', 'state'] as const;
const SECTION_FILTERS: Partial<Record<Section, readonly string[]>> = {
  resolution: RESOLUTION_DIMENSIONS,
  journey: ['channel', 'region', ...RESOLUTION_DIMENSIONS],
  timeline: RESOLUTION_DIMENSIONS,
  persona: ['channel', 'region', ...RESOLUTION_DIMENSIONS],
};
const DIMENSION_LABELS: Record<string, [string, string]> = {
  topic: ['Topic', '主题'], subtopic: ['Subtopic', '子主题'],
  resolution_requirement: ['Resolution requirement', '解决要求'], request_type: ['Request type', '诉求类型'],
  journey_type: ['Journey path', '旅程路径'], entry_channel: ['Entry', '入口'],
  persona: ['Persona', '用户画像'], tenure: ['Tenure at contact', '接触时工龄'],
  worker_type: ['Worker type', '员工类型'], business_group: ['Business group', '业务组'],
  country: ['Country', '国家'], state: ['Settled or pending', '已稳定或待观察'],
  channel: ['Channel', '渠道'], region: ['Region', '地区'],
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
const OUTCOME_NAMES: Record<string, [string, string]> = {
  ai_confirmed: ['AI confirmed', 'AI 已证实'], ai_unconfirmed: ['AI unconfirmed', 'AI 未证实'],
  human_confirmed: ['Human confirmed', '人工已证实'], human_unconfirmed: ['Human unconfirmed', '人工未证实'],
  elsewhere: ['Resolved elsewhere', '其他方式解决'], unknown: ['Unknown', '无法判断'],
  unresolved: ['Unresolved', '未解决'],
};
function outcomeLabel(key: string, zh: boolean): string { return OUTCOME_NAMES[key]?.[zh ? 1 : 0] ?? key.replaceAll('_', ' '); }

function object(value: unknown): JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return value === null || value === undefined ? '—' : String(value); }
function pct(value: unknown): string { return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'; }
function personaCriterionValue(row: JsonObject, zh: boolean): string {
  if (Array.isArray(row.values)) return row.values.map((value) => typeof value === 'number' ? pct(value) : value === true ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No')).join(' · ');
  const values = object(row.values);
  if (row.id === 'baseline') return ['persistence', 'gain_to_human', 'gain_ai_solved'].map((key) => {
    const label = ({ persistence: zh ? '稳定性' : 'Persistence', gain_to_human: zh ? '预测转人工' : 'Predict human', gain_ai_solved: zh ? '预测 AI 解决' : 'Predict AI' })[key];
    return `${label}: ${list(values[key]).map(pct).join(' / ')}`;
  }).join(' · ');
  if (row.id === 'reformation') return `${zh ? '组数' : 'Groups'} ${list(values.groups).map(text).join(' / ')} · ${zh ? '一致性' : 'Agreement'} ${pct(values.agreement)} · ${zh ? '共同用户' : 'Shared users'} ${text(values.users)}`;
  return '—';
}
function dimensionLabel(key: string, zh: boolean): string { return DIMENSION_LABELS[key]?.[zh ? 1 : 0] ?? key; }
function catalogLabel(catalog: JsonObject, dimension: string, code: string, zh: boolean): string {
  const entries = list(catalog[dimension === 'topic' ? 'topics' : dimension === 'subtopic' ? 'subtopics' : '']).map(object);
  const entry = entries.find((row) => row.code === code);
  return text((zh ? entry?.name_zh : entry?.name_en) ?? code);
}
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

function Card({ label, value, note, onClick }: { label: string; value: string | number; note?: string; onClick?: () => void }) {
  return <Metric label={label} value={value} note={note} onClick={onClick} />;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <ReportPanel title={title}>{children}</ReportPanel>;
}

function CountTable({ title, rows, keyField, valueField, zh, onRow }: {
  title: string; rows: JsonObject[]; keyField: string; valueField: string; zh: boolean; onRow?: (row: JsonObject) => void;
}) {
  return <Panel title={title}><div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead><tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700"><th className="py-2">{zh ? '类型' : 'Type'}</th><th className="py-2 text-right">{zh ? '数量' : 'Count'}</th></tr></thead>
    <tbody>{rows.map((row, i) => { const code = text(row[keyField]); const names = JOURNEY_NAMES[code];
      return <tr key={`${code}-${i}`} className={`border-b border-slate-100 dark:border-slate-800 ${onRow ? styles.clickRow : ''}`}
        onClick={() => onRow?.(row)} onKeyDown={(event) => { if (onRow && (event.key === 'Enter' || event.key === ' ')) onRow(row); }}
        role={onRow ? 'button' : undefined} tabIndex={onRow ? 0 : undefined}>
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

function EntityBrowser({ kind, round, zh, title, relation, filters, onOpen }: {
  kind: Kind; round: string; zh: boolean; title: string; relation?: { key: string; value: string }; filters?: Record<string, string>;
  onOpen: (drill: Drill) => void;
}) {
  const t = useTranslations('OhlaJourney');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<EntityPage | null>(null);
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
  const open = (row: JsonObject) => onOpen({ kind, title: text(row.summary ?? row.title_zh ?? row.name_zh ?? row.topic ?? row[idField]), id: String(row[idField]) });
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
  </Panel>;
}

function duration(seconds: unknown): string {
  if (typeof seconds !== 'number') return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function PersonaFeatureTable({ persona, pattern, model, zh }: { persona: JsonObject; pattern: JsonObject; model: JsonObject; zh: boolean }) {
  const means = object(object(pattern.features).mean);
  const lifts = object(object(pattern.features).lift);
  const definitions = new Map(list(model.features).map(object).map((row) => [text(row.name), row]));
  const keys = list(persona.evidence).map(String).map((item) => item.replace(/^p\d+\//, ''))
    .filter((key) => typeof means[key] === 'number').slice(0, 5);
  const weekly = list(object(pattern.weekly).journeys).map(Number);
  const maximum = Math.max(1, ...weekly);
  const points = weekly.map((value, index) => `${index * 100 / Math.max(1, weekly.length - 1)},${32 - 30 * value / maximum}`).join(' ');
  return <>
    <table className={styles.personaFeatures}><thead><tr><th>{zh ? '特征' : 'Feature'}</th><th>{zh ? '画像' : 'Persona'}</th><th>{zh ? '全体' : 'All users'}</th></tr></thead>
      <tbody>{keys.map((key) => { const own = Number(means[key]); const lift = Number(lifts[key]); const base = lift > 0 ? own / lift : null;
        const definition = definitions.get(key) ?? definitions.get(key.replace(':', '='));
        const share = definition?.kind === 'share' || key.startsWith('topic:');
        const fmt = (value: number | null) => value === null ? '—' : share ? `${Math.round(value * 100)}%` : value.toFixed(1);
        const fallback = key.startsWith('topic:') ? (zh ? `${key.slice(6)} 主题旅程占比` : `Share of journeys on ${key.slice(6)}`) : key;
        return <tr key={key}><td>{text((zh ? definition?.zh : definition?.en) ?? fallback)}</td><td>{fmt(own)}</td><td>{fmt(base)}</td></tr>; })}</tbody></table>
    {weekly.length > 1 && <svg className={styles.personaSparkline} viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label={zh ? '每周旅程趋势' : 'Weekly journey trend'}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>}
  </>;
}

function PersonaValidationTable({ validation, zh }: { validation: JsonObject; zh: boolean }) {
  const previous = object(validation.previous);
  const months = list(previous.months).map(object);
  const criteria = list(previous.criteria).map(object);
  const groups = [...new Set(months.flatMap((month) => Object.keys(object(object(month.personas).by_group))))].sort();
  if (!months.length) return null;
  const criterionZh: Record<string, string> = { persistence: '画像是否稳定', to_human: '能否预测转人工', ai_solved: '能否预测 AI 解决',
    order: '画像顺序是否稳定', baseline: '是否优于之前的画像', reformation: '重新形成是否一致' };
  return <ReportPanel title={zh ? '画像检验' : 'Persona validation'} description={zh ? '按月份展示模型检验与各画像表现；这些是整份报告的结果。' : 'Monthly model checks and persona outcomes for the full report.'}>
    <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>{zh ? '检验' : 'Criterion'}</th>
      {months.map((month) => <th key={text(month.start)}>{windowDate(text(month.start))} → {windowDate(text(month.end))}</th>)}<th>{zh ? '判定' : 'Verdict'}</th></tr></thead><tbody>
      <tr><td>{zh ? '本期计入的用户 / 本期到访用户' : 'Users counted / users in period'}</td>{months.map((month) => <td key={text(month.start)}>{text(object(month.personas).users)} / {text(month.users_in_period)}</td>)}<td>—</td></tr>
      {criteria.map((row) => { const values = list(row.values); return <tr key={text(row.id)}><td title={text(row.threshold)}>{zh ? criterionZh[text(row.id)] ?? text(row.statement) : text(row.statement)}</td>
        {months.map((month, i) => <td key={text(month.start)}>{values.length === months.length ? typeof values[i] === 'number' ? pct(values[i]) : text(values[i]) : i === 0 ? personaCriterionValue(row, zh) : '—'}</td>)}
        <td>{row.verdict === 'pass' ? (zh ? '通过 ✓' : 'Pass ✓') : (zh ? '未通过 ✗' : 'Fail ✗')}</td></tr>; })}
      {groups.map((group) => <tr key={group}><td>{group}</td>{months.map((month) => { const values=object(object(object(month.personas).by_group)[group]);return <td key={text(month.start)}>{values.users === undefined ? '—' : `${text(values.users)} ${zh ? '用户' : 'users'} · ${zh ? '转人工' : 'to human'} ${pct(values.to_human)} · ${zh ? 'AI 解决' : 'AI solved'} ${pct(values.ai_solved)}`}</td>; })}<td>—</td></tr>)}
    </tbody></table></div>
  </ReportPanel>;
}

function ResolutionMatrix({ rows, groupBy, catalog, zh, onOpen }: {
  rows: JsonObject[]; groupBy: string; catalog: JsonObject; zh: boolean;
  onOpen: (title: string, query: Record<string, string>) => void;
}) {
  const [sort, setSort] = useState('n');
  const [expanded, setExpanded] = useState<string[]>([]);
  const ordered = [...rows].sort((a, b) => {
    const value = (row: JsonObject) => sort === 'n' ? Number(row.n ?? 0)
      : sort === 'time' ? Number(object(object(row.times).T5_calendar).median_sec ?? 0)
        : sort === 'other' ? Number(object(row.outcomes).elsewhere ?? 0) / Math.max(1, Number(row.n))
        : sort === 'recontacted' || sort === 'escalated' ? Number(row[sort] ?? 0) / Math.max(1, Number(row.n))
          : (Number(object(row[sort]).c ?? 0) + Number(object(row[sort]).d ?? 0)) / Math.max(1, Number(row.n));
    return value(b) - value(a) || text(a.group).localeCompare(text(b.group));
  });
  const open = (row: JsonObject, detail: Record<string, string> = {}) => onOpen(`${dimensionLabel(groupBy, zh)} · ${catalogLabel(catalog, groupBy, text(row.group), zh)}`, { [groupBy]: text(row.group), ...detail });
  const rate = (row: JsonObject, key: string) => {
    const value = object(row[key]); const n = Number(row.n ?? 0);
    return n ? (Number(value.c ?? 0) + Number(value.d ?? 0)) / n : 0;
  };
  const headers: Array<[string, string]> = [
    ['n', zh ? '旅程' : 'Journeys'], ['end_to_end', zh ? '端到端' : 'End-to-end'],
    ['ai', 'AI'], ['human', zh ? '人工' : 'Human'], ['other', zh ? '其他' : 'Other'],
    ['escalated', zh ? '转人工' : 'Escalation'], ['recontacted', zh ? '再次联系' : 'Recontact'],
    ['time', zh ? '总耗时中位数' : 'Total time median'],
  ];
  return <ReportPanel title={zh ? '解决情况明细' : 'Resolution matrix'} description={zh ? '按选定维度分组。比率分母是该行旅程数；点击数字可查看旅程。' : 'Group by a dimension. Rates use the journeys in each row; click a value to inspect journeys.'}>
    <div className={styles.tableWrap}><table className={`${styles.dataTable} ${styles.matrix}`}>
      <thead><tr><th>{dimensionLabel(groupBy, zh)}</th>{headers.map(([key, label]) => <th key={key}><button className={styles.sortButton} onClick={() => setSort(key)} aria-label={`${zh ? '按' : 'Sort by '}${label}`}>
        {label}{sort === key ? ' ↓' : ''}</button></th>)}</tr></thead>
      {ordered.map((row) => { const group = text(row.group); const n = Number(row.n ?? 0); const time = object(object(row.times).T5_calendar);
        return <tbody key={group} className={styles.matrixGroup}><tr>
          <td><button className={styles.groupButton} onClick={() => setExpanded((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])} aria-expanded={expanded.includes(group)}>
            <span>{expanded.includes(group) ? '▾' : '▸'}</span> {catalogLabel(catalog, groupBy, group, zh)}</button>
            <div className={styles.matrixMini}><StackedBar parts={[
              ['ai_confirmed', '#1c5cab'], ['ai_unconfirmed', '#86b6ef'],
              ['human_confirmed', '#177245'], ['human_unconfirmed', '#8fd1a8'],
              ['elsewhere', '#ad85c4'], ['unknown', '#d6dae0'], ['unresolved', '#b64a3c'],
            ].map(([key, color]) => ({ key, color, label: outcomeLabel(key, zh), value: Number(object(row.outcomes)[key] ?? 0) }))} onPart={(key) => open(row, { outcome: key })} /></div></td>
          <td><button className={styles.cellButton} onClick={() => open(row)}>{n.toLocaleString()}</button></td>
          {(['end_to_end', 'ai', 'human'] as const).map((key) => <td key={key}><button className={styles.cellButton} onClick={() => open(row, { resolution: key, category: 'resolved' })}>
            <strong>{pct(rate(row, key))}</strong><span>{(Number(object(row[key]).c ?? 0) + Number(object(row[key]).d ?? 0)).toLocaleString()} / {n.toLocaleString()}</span></button></td>)}
          <td><button className={styles.cellButton} onClick={() => open(row, { outcome: 'elsewhere' })}><strong>{pct(n ? Number(object(row.outcomes).elsewhere ?? 0) / n : 0)}</strong><span>{Number(object(row.outcomes).elsewhere ?? 0).toLocaleString()} / {n.toLocaleString()}</span></button></td>
          {(['escalated', 'recontacted'] as const).map((key) => <td key={key}><button className={styles.cellButton} onClick={() => open(row, { [key]: '1' })}>
            <strong>{pct(n ? Number(row[key] ?? 0) / n : 0)}</strong><span>{Number(row[key] ?? 0).toLocaleString()} / {n.toLocaleString()}</span></button></td>)}
          <td><button className={styles.cellButton} onClick={() => open(row)}><strong>{duration(time.median_sec)}</strong><span>n={text(time.n)}</span></button></td>
        </tr>{expanded.includes(group) && <tr className={styles.matrixDetail}><td colSpan={9}>
          {groupBy === 'topic' && list(row.children).length > 0 && <div className={styles.childWrap}><strong>{zh ? '子主题' : 'Subtopics'}</strong><table className={styles.childTable}><thead><tr>
            <th>{zh ? '子主题' : 'Subtopic'}</th><th>{zh ? '旅程' : 'Journeys'}</th><th>{zh ? '端到端' : 'End-to-end'}</th><th>AI</th><th>{zh ? '人工' : 'Human'}</th><th>{zh ? '其他' : 'Other'}</th><th>{zh ? '转人工' : 'Escalation'}</th><th>{zh ? '再次联系' : 'Recontact'}</th>
          </tr></thead><tbody>{list(row.children).map(object).map((child) => { const n=Number(child.n ?? 0); const query={topic:group,subtopic:text(child.group)};const childOpen=(detail:Record<string,string>={})=>onOpen(`${catalogLabel(catalog, 'topic', group, zh)} · ${catalogLabel(catalog, 'subtopic', text(child.group), zh)}`,{...query,...detail});return <tr key={text(child.group)}>
            <td><button onClick={() => childOpen()}>{catalogLabel(catalog, 'subtopic', text(child.group), zh)}</button></td><td><button onClick={() => childOpen()}>{n.toLocaleString()}</button></td>
            {(['end_to_end','ai','human'] as const).map((key) => <td key={key}><button onClick={() => childOpen({resolution:key,category:'resolved'})}>{pct(n ? (Number(object(child[key]).c ?? 0)+Number(object(child[key]).d ?? 0))/n : 0)}</button></td>)}
            <td><button onClick={() => childOpen({outcome:'elsewhere'})}>{Number(object(child.outcomes).elsewhere ?? 0).toLocaleString()}</button></td>
            <td><button onClick={() => childOpen({escalated:'1'})}>{Number(child.escalated ?? 0).toLocaleString()}</button></td>
            <td><button onClick={() => childOpen({recontacted:'1'})}>{Number(child.recontacted ?? 0).toLocaleString()}</button></td>
          </tr>; })}</tbody></table></div>}
          <div className={styles.matrixDetailGrid}>
            {Object.entries(object(row.times)).map(([metric, item]) => { const values = object(item); return <div key={metric}><strong>{metric}</strong><span>n={text(values.n)} · {zh ? '中位数' : 'median'} {duration(values.median_sec)} · P75 {duration(values.p75_sec)} · P90 {duration(values.p90_sec)}</span></div>; })}
          </div><div className={styles.outcomeChips}>{Object.entries(object(row.outcomes)).map(([key, value]) => <button key={key} onClick={() => open(row, { outcome: key })}>{outcomeLabel(key, zh)} · {Number(value).toLocaleString()}</button>)}</div>
        </td></tr>}</tbody>; })}</table></div>
    {!rows.length && <p className={styles.note}>{zh ? '当前筛选没有旅程。' : 'No journeys match the current filters.'}</p>}
  </ReportPanel>;
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
  const [groupBy, setGroupBy] = useState('topic');
  const [gapFamily, setGapFamily] = useState('all');
  const [gapTopic, setGapTopic] = useState('all');
  const [showAllGaps, setShowAllGaps] = useState(false);
  const [drill, setDrill] = useState<Drill | null>(null);

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
  const responseKey = `${round}|${section}|${filterKey}|${section === 'resolution' ? groupBy : ''}`;
  const payload = response?.key === responseKey ? response.data : null;
  useEffect(() => {
    if (!round) return;
    sessionStorage.setItem('ohla-journey-round', round);
    sessionStorage.setItem('ohla-journey-filters', JSON.stringify(filters));
    let active = true;
    const query = new URLSearchParams(Object.entries(JSON.parse(filterKey) as Record<string, string>).filter(([, v]) => v));
    if (section === 'resolution') query.set('group_by', groupBy);
    if (section === 'timeline') query.set('timeline_group', 'user');
    fetchJson<JsonObject>(`reports/${encodeURIComponent(round)}/sections/${section}?${query}`).then((result) => {
      if (active) { setResponse({ key: responseKey, data: result }); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [round, section, filterKey, responseKey, groupBy, filters]);

  const meta = versions.find((item) => item.round_id === round);
  const options = object(payload?.filter_options);
  const updateFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const open = (kind: Kind, title: string, query?: Record<string, string>, id?: string) => setDrill({ kind, title, query, id });
  const selectedFilters = Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value));
  const openJourneys = (title: string, detail: Record<string, string> = {}) => open('journeys', title, { ...selectedFilters, ...detail });
  const openRequests = (title: string, detail: Record<string, string> = {}) => open('requests', title, { ...selectedFilters, ...detail });
  const cards = (items: Array<[string, string | number, string?]>, onClick?: (index: number, label: string) => void) => <MetricGrid columns={items.length === 6 ? 3 : 4}>
    {items.map(([label, value, note], index) => <Card key={label} label={label} value={value} note={note} onClick={onClick ? () => onClick(index, label) : undefined} />)}</MetricGrid>;
  const treePanel = (title: string, value: unknown) => value === undefined || value === null ? null :
    <DataDisclosure title={`${title} · ${zh ? '完整数据' : 'Full data'}`}><Tree value={value} zh={zh} /></DataDisclosure>;

  const renderSection = () => {
    if (!payload) return null;
    if (section === 'headline') {
      const lineage = object(object(payload.scope).lineage);
      const headline = list(payload.headline);
      return <>
        <p className={styles.lede}>{zh ? '从原始活动段到用户画像，每一步都能追溯；点击侧栏查看各环节的结果与明细。' : 'Trace the analysis from activity segments to personas, then open each section for results and details.'}</p>
        <Lineage scope={object(payload.scope)} zh={zh} personaCount={Number(meta?.counts?.personas ?? 0)}
          onOpen={(kind) => open(kind, ({ requests: t('requests'), journeys: t('journeys'), users: t('users'), personas: t('personas') })[kind], {})} />
        {cards(headline.map((item) => { const row = list(item); const names = text(row[0]).split(' / ');
          return [names[zh ? 1 : 0] ?? names[0], text(row[1]), row[2] ? headlineNote(text(row[2]), zh) : undefined]; }),
          (index, label) => {
            if (index === 5) open('gap_items', label, {});
            else if (index === 3) openJourneys(label, { escalated: '1' });
            else if (index === 4) openJourneys(label, { recontacted: '1' });
            else openJourneys(label, { resolution: index === 0 ? 'ai' : index === 1 ? 'human' : 'end_to_end', category: 'resolved' });
          })}
        <p className={styles.note}>{zh ? `共分析 ${Number(lineage.journeys ?? 0).toLocaleString()} 条旅程；结果仍可能变化的旅程 ${Number(object(payload.settled).pending ?? 0).toLocaleString()} 条。` : `${Number(lineage.journeys ?? 0).toLocaleString()} journeys analysed; ${Number(object(payload.settled).pending ?? 0).toLocaleString()} outcomes remain pending.`}</p>
        <ReportPanel title={zh ? '术语' : 'Terms'} description={zh ? '这些数字分别在数什么；解决率以旅程为分母。' : 'What each number counts; resolution rates use journeys as their denominator.'}>
          <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>{zh ? '术语' : 'Term'}</th><th>{zh ? '定义' : 'Meaning'}</th><th>{zh ? '本版本' : 'This version'}</th></tr></thead><tbody>{[
            [zh ? '单元' : 'Unit', zh ? '一次机器人活动段或一张工单；一个单元可包含多个诉求。' : 'One bot activity segment or one ticket; a unit may contain several requests.', lineage.units],
            [zh ? '诉求' : 'Request', zh ? '用户在单元中提出的一件具体事情。' : 'One distinct thing the user asked for in a unit.', lineage.requests],
            [zh ? '旅程' : 'Journey', zh ? '同一用户的一项问题，可能跨越多个活动段或工单。' : 'One problem of one user, linked across segments or tickets.', lineage.journeys],
            [zh ? '用户' : 'User', zh ? '旅程背后的一位用户；一人可能有多条旅程。' : 'The person behind one or more journeys.', lineage.users],
            [zh ? '画像' : 'Persona', zh ? '求助习惯相近的一组用户。' : 'A group of users with similar support habits.', meta?.counts?.personas],
            [zh ? 'AI 解决率' : 'AI resolution', zh ? '由 AI 解决的旅程，占全部旅程的比例。' : 'Journeys resolved by the AI, over all journeys.', headline[0] ? list(headline[0])[1] : '—'],
            [zh ? '人工解决率' : 'Human resolution', zh ? '由人工解决的旅程，占全部旅程的比例。' : 'Journeys resolved by a human, over all journeys.', headline[1] ? list(headline[1])[1] : '—'],
            [zh ? '端到端解决率' : 'End-to-end resolution', zh ? '由 AI、人工或用户自行解决的旅程，占全部旅程的比例。' : 'Journeys resolved by AI, human or the user, over all journeys.', headline[2] ? list(headline[2])[1] : '—'],
            [zh ? '自行解决或问题消失' : 'Self-resolved', zh ? '用户自己修复、找到替代方法，或问题自行消失。' : 'The user fixed it, found a workaround, or the problem went away.', '—'],
            [zh ? '转人工率' : 'Escalation', zh ? '进入机器人后又转到人工的旅程，占进入机器人的旅程比例。' : 'Journeys reaching a human after the bot, over bot-entry journeys.', headline[3] ? list(headline[3])[1] : '—'],
            [zh ? '复发率' : 'Recontact', zh ? '用户就同一个问题再次开启机器人会话或工单。' : 'The user returned about the same problem in a new contact.', headline[4] ? list(headline[4])[1] : '—'],
            [zh ? '已证实解决' : 'Confirmed resolution', zh ? '有明确证据证明问题解决。' : 'Evidence confirms that the problem was solved.', '—'],
            [zh ? '无法判断' : 'Cannot tell', zh ? '现有证据不能确定是否解决；与明确未解决不同。' : 'The evidence cannot determine whether it was solved.', '—'],
          ].map(([name, meaning, value]) => <tr key={String(name)}><td><strong>{String(name)}</strong></td><td>{String(meaning)}</td><td>{typeof value === 'number' ? value.toLocaleString() : String(value ?? '—')}</td></tr>)}</tbody></table></div>
        </ReportPanel>
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
        <ResolutionMatrix rows={list(payload.matrix).map(object)} groupBy={groupBy} catalog={object(payload.catalog)} zh={zh} onOpen={openJourneys} />
        <MetricGrid>{(['ai', 'human', 'end_to_end'] as const).map((key) => { const value = object(rates[key]);
          return <Metric key={key} label={key === 'end_to_end' ? t('endToEnd') : t(key)} value={pct(value.upper)}
            note={`${t('confirmed')}: ${pct(value.lower)} · ${text(value.denominator)} ${t('journeys')}`}
            tone={key === 'human' ? 'green' : 'blue'} onClick={() => openJourneys(key === 'end_to_end' ? t('endToEnd') : t(key), { resolution: key, category: 'resolved' })} />; })}</MetricGrid>
        <ReportPanel title={zh ? '解决结果构成' : 'Resolution composition'}><OutcomeLegend zh={zh} />
          <div className={styles.rateRows}>{(['ai', 'human', 'end_to_end'] as const).map((key) => { const value = object(rates[key]);
            const prefix = key === 'human' ? 'human' : 'ai';
            return <div className={styles.rateRow} key={key}><strong>{key === 'end_to_end' ? t('endToEnd') : t(key)}</strong>
              <StackedBar parts={[
                { key: 'confirmed', value: Number(value.confirmed ?? 0), color: prefix === 'human' ? '#177245' : '#1c5cab', label: zh ? '已证实' : 'Confirmed' },
                { key: 'delivered', value: Number(value.delivered ?? 0), color: prefix === 'human' ? '#8fd1a8' : '#86b6ef', label: zh ? '未证实' : 'Unconfirmed' },
                { key: 'unknown', value: Number(value.unknown ?? 0), color: '#d6dae0', label: zh ? '无法判断' : 'Unknown' },
                { key: 'unresolved', value: Number(value.unresolved ?? 0), color: '#b64a3c', label: zh ? '未解决' : 'Unresolved' },
              ]} onPart={(part) => openJourneys(`${key === 'end_to_end' ? t('endToEnd') : t(key)} · ${part}`, { resolution: key, category: ({ confirmed: 'c', delivered: 'd', unknown: 'u', unresolved: 'x' })[part] ?? 'u' })} />
              <span>{pct(value.upper)}</span></div>; })}</div></ReportPanel>
        <ReportPanel title={t('timing')} description={zh ? '日历时间；中位数与分位数只在有记录的样本上计算。' : 'Calendar time; percentiles use recorded observations.'}>
          <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>{zh ? '耗时指标' : 'Metric'}</th><th>{zh ? '样本' : 'N'}</th><th>{zh ? '中位数' : 'Median'}</th><th>P75</th><th>P90</th></tr></thead>
            <tbody>{timing.map((row) => <tr key={text(row.metric)}><td>{text(row.metric)}</td><td>{text(row.n)}</td><td>{text(row.median_sec)}s</td><td>{text(row.p75_sec)}s</td><td>{text(row.p90_sec)}s</td></tr>)}</tbody></table></div>
        </ReportPanel>
        <ReportPanel title={zh ? '诉求结果' : 'Request outcomes'}><RankedBars rows={Object.entries(outcomes).map(([label, value]) => ({ label, value: Number(value) }))} zh={zh}
          onSelect={(row) => openRequests(`${zh ? '诉求结果' : 'Request outcome'} · ${row.label}`, { category: row.label })} /></ReportPanel>
        {treePanel(zh ? '已发布解决率明细' : 'Published resolution detail', payload.published_rates)}
        {treePanel(zh ? '已发布耗时明细' : 'Published timing detail', payload.published_time_stats)}
        <EntityBrowser key={`requests-${round}-${filterKey}`} kind="requests" round={round} zh={zh} title={t('requests')} filters={activeFilters} onOpen={setDrill} />
      </>;
    }
    if (section === 'gaps') {
      const summary = object(payload.summary);
      const items = list(payload.items).map(object);
      const visible = items.filter((item) => (gapFamily === 'all' || item.gap_family === gapFamily)
        && (gapTopic === 'all' || item.topic === gapTopic));
      const topics = [...new Set(items.map((item) => text(item.topic)))].sort();
      const topicCounts = topics.map((topic) => ({ key: topic, label: catalogLabel(object(payload.catalog), 'topic', topic, zh), value: items.filter((item) => item.topic === topic).length }));
      const families: Array<[string, string, number, string]> = [
        ['knowledge', zh ? '知识缺口' : 'Knowledge gap', Number(summary.family_knowledge ?? 0), '#3269ae'],
        ['action', zh ? '执行缺口' : 'Action gap', Number(summary.family_action ?? 0), '#ad7d39'],
        ['both', zh ? '两者皆有' : 'Both', Number(summary.family_both ?? 0), '#8560a8'],
        ['none', zh ? '无缺口' : 'No gap', Number(summary.family_none ?? 0), '#9aa3ae'],
        ['undetermined', zh ? '未定' : 'Undetermined', Number(summary.family_undetermined ?? 0), '#d3d7dc'],
      ];
      return <><p className={styles.lede}>{zh ? '知识缺口与自动化缺口按预计影响排序。点击下方缺口明细可查看判断依据和建议。' : 'Knowledge and automation gaps ranked by estimated impact. Open an item below for evidence and recommendations.'}</p>
        <MetricGrid><Metric label={t('gapItems')} value={items.length} tone="amber" onClick={() => open('gap_items', t('gapItems'), {})} />
          <Metric label={zh ? '可转化旅程' : 'Convertible journeys'} value={`${text(summary.journeys_lower)}–${text(summary.journeys_upper)}`} note={zh ? '上下界；重叠旅程仅计一次' : 'Lower–upper bound; overlaps counted once'} />
          <Metric label={zh ? '可避免工单下界' : 'Tickets deflectable, lower'} value={Number(summary.tickets_deflectable_lower ?? 0).toLocaleString()} /></MetricGrid>
        <ReportPanel title={zh ? '候选问题的判断结果' : 'Judgment of gap candidates'} description={zh ? '按候选诉求统计；与下方 159 个已整理的缺口项不是同一分母。' : 'Counts candidate requests; the 159 consolidated gap items below have a different denominator.'}>
          <div className={styles.gapFamilies}>{families.map(([key,label,value,color]) => <div key={key}><span style={{ background: color }} /><strong>{label}</strong><b>{value.toLocaleString()}</b><small>{pct(Number(summary.candidates) ? value / Number(summary.candidates) : null)}</small></div>)}</div>
        </ReportPanel>
        <ReportPanel title={zh ? '各主题缺口项' : 'Gap items by topic'}><RankedBars rows={topicCounts} zh={zh} color="#6c5ad6" onSelect={(row) => setGapTopic(row.key ?? row.label)} /></ReportPanel>
        <ReportPanel title={zh ? '缺口项排名' : 'Ranked gap items'} description={zh ? '按可转化旅程下界排序；点击条形或表格行查看判断依据和建议。' : 'Ranked by lower bound of convertible journeys. Open a bar or row for evidence and recommendations.'}>
          <div className={styles.inlineControls}><label>{zh ? '缺口类型' : 'Gap family'} <select className={styles.select} value={gapFamily} onChange={(event) => setGapFamily(event.target.value)}>
            <option value="all">{t('all')}</option><option value="knowledge">{zh ? '知识缺口' : 'Knowledge'}</option><option value="action">{zh ? '自动化缺口' : 'Automation'}</option>
          </select></label><label>{zh ? '主题' : 'Topic'} <select className={styles.select} value={gapTopic} onChange={(event) => setGapTopic(event.target.value)}><option value="all">{t('all')}</option>{topics.map((topic) => <option key={topic} value={topic}>{catalogLabel(object(payload.catalog), 'topic', topic, zh)}</option>)}</select></label>
          <span>{visible.length.toLocaleString()} {zh ? '项' : 'items'}</span></div>
          <RankedBars rows={visible.slice(0, 20).map((row) => ({ key: text(row.gap_id), label: text((zh ? row.title_zh : row.title_en) ?? row.key), value: Number(object(object(row.conversion).lower).journeys ?? 0), note: zh ? row.gap_family === 'knowledge' ? '知识' : row.gap_family === 'action' ? '自动化' : text(row.gap_family) : text(row.gap_family) }))}
            zh={zh} color="#6c5ad6" onSelect={(row) => open('gap_items', row.label, undefined, row.key)} />
          <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr>
            <th>{zh ? '排名 / 缺口' : 'Rank / gap'}</th><th>{zh ? '类型' : 'Family'}</th><th>{zh ? '旅程' : 'Journeys'}</th><th>{zh ? '可转化旅程' : 'Convertible'}</th><th>{zh ? '可避免工单' : 'Tickets deflectable'}</th><th>{zh ? '节省等待' : 'Wait avoided'}</th><th>{zh ? '验证状态' : 'Verification'}</th>
          </tr></thead><tbody>{(showAllGaps ? visible : visible.slice(0,20)).map((row) => { const volume = object(row.volume); const conversion = object(row.conversion); const lower=object(conversion.lower);const upper=object(conversion.upper);return <tr key={text(row.gap_id)} className={styles.clickRow} role="button" tabIndex={0}
            onClick={() => open('gap_items', text((zh ? row.title_zh : row.title_en) ?? row.key), undefined, text(row.gap_id))}
            onKeyDown={(event) => { if (event.key === 'Enter') open('gap_items', text((zh ? row.title_zh : row.title_en) ?? row.key), undefined, text(row.gap_id)); }}>
            <td><strong>#{text(row.priority_rank)}</strong> {text((zh ? row.title_zh : row.title_en) ?? row.key)}</td><td>{row.gap_family === 'knowledge' ? (zh ? '知识' : 'Knowledge') : row.gap_family === 'action' ? (zh ? '自动化' : 'Automation') : text(row.gap_family)}</td>
            <td>{Number(volume.journeys ?? 0).toLocaleString()}</td><td>{text(lower.journeys)}–{text(upper.journeys)}</td>
            <td>{text(lower.tickets_deflected)}–{text(upper.tickets_deflected)}</td><td>{duration(lower.time_saved_sec)}–{duration(upper.time_saved_sec)}</td><td>{zh && row.verification_status === 'verified' ? '已验证' : text(row.verification_status)}</td>
          </tr>; })}</tbody></table></div>
          {visible.length > 20 && <button className={styles.moreButton} onClick={() => setShowAllGaps(!showAllGaps)}>{showAllGaps ? (zh ? '收起' : 'Show less') : (zh ? `显示全部 ${visible.length} 项` : `Show all ${visible.length} items`)}</button>}
        </ReportPanel>
        {treePanel(zh ? '缺口计算口径' : 'Gap calculations', payload.summary)}
      </>;
    }
    if (section === 'journey') return <><p className={styles.lede}>{zh ? '从入口到路径再到结果，色彩对应解决结果。每条旅程只计入一条路径。' : 'From entry through path to outcome. Colours indicate resolution; each journey has one path.'}</p>
      {payload.flow ? <ReportPanel title={t('flow')}><JourneySankey flow={payload.flow} zh={zh}
        onSelect={(query, title) => openJourneys(title, query)} />
        <FlowSummary flow={payload.flow} zh={zh} onSelect={(query, title) => openJourneys(title, query)} /></ReportPanel> : null}
      <CountTable title={zh ? '旅程类型' : 'Journey types'} rows={list(payload.types).map(object)} keyField="journey_type" valueField="n" zh={zh}
        onRow={(row) => openJourneys(text(JOURNEY_NAMES[text(row.journey_type)]?.[zh ? 1 : 0] ?? row.journey_type), { path: text(row.journey_type) })} />
      {list(payload.funnels).map((item) => { const funnel = object(item); return <ReportPanel key={text(funnel.funnel_id)} title={`${zh ? '旅程漏斗' : 'Journey funnel'} · ${text(funnel.funnel_id)}`}>
        <Funnel stages={list(funnel.stages)} zh={zh} /></ReportPanel>; })}
      <EntityBrowser key={`journeys-${round}-${filterKey}`} kind="journeys" round={round} zh={zh} title={t('journeys')} filters={activeFilters} onOpen={setDrill} />
      <EntityBrowser key={`units-${round}-${filterKey}`} kind="units" round={round} zh={zh} title={t('units')} filters={activeFilters} onOpen={setDrill} /></>;
    if (section === 'timeline') {
      const bursts = list(object(payload.timeline).bursts).map(object);
      return <><TimelineReport key={round} data={payload} catalog={object(payload.catalog)} zh={zh} windowStart={meta?.window[0] ?? '2026-04-01T00:00:00+08:00'}
        filters={activeFilters} onFilter={updateFilter} onJourneys={openJourneys}
        onUser={(id) => open('users', id, undefined, id)} />
        {bursts.length > 0 && <ReportPanel title={zh ? '异常波峰' : 'Bursts'}><RankedBars rows={bursts.map((row) => ({ key: `${text(row.topic)}|${text(row.day)}`, label: `${catalogLabel(object(payload.catalog), 'topic', text(row.topic), zh)} · ${zh ? '第' : 'day '}${text(row.day)}${zh ? '天' : ''}`, value: Number(row.n) }))}
          zh={zh} color="#df9f39" onSelect={(row) => { const [topic, day] = text(row.key).split('|'); openJourneys(row.label, { topic, day }); }} /></ReportPanel>}
        {treePanel(t('timing'), payload.timing)}</>;
    }
    if (section === 'persona') {
      const personaData = object(payload.personas);
      const personas = list(personaData.personas).map(object);
      const selectedPersona = filters.persona ?? '';
      const pattern = object(object(personaData.patterns)[selectedPersona]);
      const patternMatchesFilter = Object.keys(selectedFilters).every((name) => name === 'persona');
      const model = object(personaData.model);
      const habitRows = list(model.habit_table).map(object).sort((a, b) => Number(b.agreement ?? 0) - Number(a.agreement ?? 0));
      return <>{!personas.length && treePanel(zh ? '画像暂不可用' : 'Personas unavailable', payload.unavailable)}
        <p className={styles.lede}>{zh ? '每张画像是一组有共同求助习惯的用户。点击画像，下面的用户明细会自动筛选。' : 'Each persona groups users with similar support habits. Select one to filter the users below.'}</p>
        <div className={styles.personaGrid}>{personas.map((persona) => <button key={text(persona.persona_id)}
          onClick={() => updateFilter('persona', text(persona.persona_id))}
          className={`${styles.personaCard} ${selectedPersona === persona.persona_id ? styles.selected : ''}`}>
          <span className={styles.personaId}>{text(persona.persona_id)}</span><div className={styles.personaName}>{text(zh ? persona.name_zh : persona.name_en)}</div>
          <div className={styles.personaDescription}>{text(zh ? persona.description_zh : persona.description_en)}</div>
          <div className={styles.personaCount}><span>{Object.keys(selectedFilters).length ? (zh ? '全版本用户' : 'All-report users') : t('users')} <strong>{text(persona.users)}</strong></span><span>{selectedPersona && selectedPersona !== persona.persona_id ? (zh ? '全版本旅程' : 'All-report journeys') : t('journeys')} <strong>{text(selectedPersona && selectedPersona !== persona.persona_id ? persona.journeys_full ?? persona.journeys : persona.journeys)}</strong></span></div>
          <PersonaFeatureTable persona={persona} pattern={object(object(personaData.patterns)[text(persona.persona_id)])} model={model} zh={zh} />
        </button>)}</div>
        {selectedPersona && <div className={styles.personaDetails}>
          {Object.keys(selectedFilters).length > 1 && <p className={styles.personaScope}>{zh ? '下方画像规律来自整份报告；上方旅程数量和用户列表使用当前筛选。' : 'The patterns below describe the full report; journey counts and the user list use the current filters.'}</p>}
          <ReportPanel title={zh ? '解决结果' : 'Resolution outcomes'}><RankedBars rows={Object.entries(object(object(pattern.outcomes).nodes)).map(([label, value]) => ({ label: outcomeLabel(label, zh), value: Number(value), key: label }))} zh={zh}
            onSelect={patternMatchesFilter ? (row) => openJourneys(`${selectedPersona} · ${row.label}`, { persona: selectedPersona, outcome: row.key ?? row.label }) : undefined} /></ReportPanel>
          <ReportPanel title={zh ? '常见主题' : 'Top topics'}><RankedBars rows={list(object(pattern.topics).topics).map(object).slice(0, 12).map((row) => ({ label: catalogLabel(object(payload.catalog), 'topic', text(row.topic), zh), value: Number(row.journeys), key: text(row.topic) }))} zh={zh}
            onSelect={patternMatchesFilter ? (row) => openJourneys(`${selectedPersona} · ${row.label}`, { persona: selectedPersona, topic: row.key ?? row.label }) : undefined} /></ReportPanel>
          <DataDisclosure title={zh ? '画像特征与用户属性 · 完整数据' : 'Features and attributes · full data'}><Tree value={{ features: pattern.features, attributes: pattern.attributes, rules: personas.find((item) => item.persona_id === selectedPersona)?.rules }} zh={zh} /></DataDisclosure>
          <ReportPanel title={zh ? '每周活跃' : 'Weekly activity'}><div className={styles.weekBars}>{list(object(pattern.weekly).journeys).map((value, i) => <div key={i} title={`${zh ? '第' : 'Week '}${i + 1}${zh ? '周' : ''}: ${text(value)}`} style={{ height: `${Math.max(3, Number(value) / Math.max(1, ...list(object(pattern.weekly).journeys).map(Number)) * 100)}%` }} />)}</div></ReportPanel>
        </div>}
        {habitRows.length > 0 && <ReportPanel title={zh ? '哪些特征是习惯' : 'Which features are habits'} description={zh ? `比较同一用户奇数次与偶数次旅程中特征出现的比例；一致性达到 ${pct(object(model.habit_params).min_habit)} 算习惯。` : `Compare feature shares in each user's odd and even journeys. Agreement of at least ${pct(object(model.habit_params).min_habit)} counts as a habit.`}>
          <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>{zh ? '特征' : 'Feature'}</th><th>{zh ? '类别' : 'Kind'}</th><th>{zh ? '旅程占比' : 'Journey share'}</th><th>{zh ? '一致性' : 'Agreement'}</th><th>{zh ? '使用情况' : 'Use'}</th></tr></thead><tbody>{habitRows.map((row) => <tr key={text(row.feature)}>
            <td>{text(row.feature)}</td><td>{row.role === 'how' ? (zh ? '求助方式' : 'How') : (zh ? '诉求内容' : 'What')}</td><td>{pct(row.share_of_journeys)}</td><td>{pct(row.agreement)}</td>
            <td>{row.kept ? (zh ? '用于画像模型' : 'Used in persona model') : row.copy_of ? `${zh ? '重复于' : 'Copy of'} ${text(row.copy_of)}` : (zh ? '未用于画像模型' : 'Not used in persona model')}</td>
          </tr>)}</tbody></table></div>
        </ReportPanel>}
        <PersonaValidationTable validation={object(payload.validation)} zh={zh} />
        {treePanel(zh ? '画像模型' : 'Persona model', personaData.model)}
        {treePanel(zh ? '画像验证' : 'Persona validation', payload.validation)}
        <EntityBrowser key={`users-${round}-${filterKey}-${selectedPersona}`} kind="users" round={round} zh={zh} title={t('users')} filters={activeFilters}
          relation={selectedPersona ? { key: 'persona_id', value: selectedPersona } : undefined} onOpen={setDrill} />
        <EntityBrowser kind="personas" round={round} zh={zh} title={t('personas')} onOpen={setDrill} />
      </>;
    }
    if (section === 'patterns') {
      const patterns = object(payload.patterns);
      return <><PatternsReport data={patterns} zh={zh} />{treePanel(t('patterns'), payload.patterns)}</>;
    }
    return <><AuditReport data={payload} zh={zh} personaCount={Number(meta?.counts?.personas ?? 0)} gapCount={Number(meta?.counts?.gap_items ?? 0)} />
      {treePanel(zh ? '完整范围数据' : 'Full scope data', payload.scope)}
      {treePanel(zh ? '完整画像验证' : 'Full persona validation', payload.persona_validation)}
      {treePanel(t('auditNote'), payload.quality)}{treePanel(zh ? '门槛' : 'Thresholds', payload.thresholds)}
      {treePanel(zh ? '一致性' : 'Agreement', payload.agreement)}{treePanel(zh ? '工作量' : 'Workload', payload.workload)}
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
      <select value={round} onChange={(event) => { setRound(event.target.value); setFilters({}); }}
        className={styles.select}>
        {versions.map((item) => <option key={item.round_id} value={item.round_id}>{item.round_id}</option>)}
      </select></label>}</div>
    {!loaded && <p>{t('loading')}</p>}
    {loaded && !versions.length && <Panel title={t('title')}><p>{error ? t('error') : t('unavailable')}</p></Panel>}
    {loaded && !!versions.length && !!SECTION_FILTERS[section] && <div className={styles.filterBar}>
      <strong>{t('filters')}</strong>
      {section === 'resolution' && <label>{zh ? '按维度分组' : 'Group rows by'}
        <select className={styles.select} value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
          {RESOLUTION_DIMENSIONS.filter((name) => options[name]).map((name) => <option key={name} value={name}>{dimensionLabel(name, zh)}</option>)}
        </select></label>}
      {(SECTION_FILTERS[section] ?? []).filter((name) => ['topic', 'persona', 'channel', 'region'].includes(name)).map((name) =>
        <label key={name}>{dimensionLabel(name, zh)}
          <select value={filters[name] ?? ''} onChange={(event) => updateFilter(name, event.target.value)} className={styles.select}>
            <option value="">{t('all')}</option>{list(options[name]).map((value) => <option key={text(value)} value={text(value)}>{catalogLabel(object(payload?.catalog), name, text(value), zh)}</option>)}
          </select></label>)}
      <details className={styles.moreFilters}><summary>{zh ? '更多筛选' : 'More filters'}{Object.entries(activeFilters).filter(([key, value]) => value && !['topic', 'persona', 'channel', 'region'].includes(key)).length ? ' ●' : ''}</summary>
        <div className={styles.moreFilterGrid}>{(SECTION_FILTERS[section] ?? []).filter((name) => !['topic', 'persona', 'channel', 'region'].includes(name) && options[name]).map((name) =>
          <label key={name}>{dimensionLabel(name, zh)}<select value={filters[name] ?? ''} onChange={(event) => updateFilter(name, event.target.value)} className={styles.select}>
            <option value="">{t('all')}</option>{list(options[name]).map((value) => <option key={text(value)} value={text(value)}>{catalogLabel(object(payload?.catalog), name, text(value), zh)}</option>)}
          </select></label>)}</div></details>
      <button onClick={() => setFilters({})}>{t('clear')}</button>
      <small>{(SECTION_FILTERS[section] ?? []).includes('channel') ? t('channelHelp') : ''} {(SECTION_FILTERS[section] ?? []).includes('region') ? t('regionHelp') : ''}</small>
    </div>}
    {round && !payload && !error && <p>{t('loading')}</p>}
    {error && versions.length > 0 && <Panel title={t('title')}><p>{t('error')}</p></Panel>}
    {payload && <>{section !== 'headline' && <div className={styles.selection}>
      <button onClick={() => openRequests(t('requests'))}>{t('requests')} <strong>{Number(object(payload.selection).requests ?? 0).toLocaleString()}</strong></button>
      <span>·</span><button onClick={() => openJourneys(t('journeys'))}>{t('journeys')} <strong>{Number(object(payload.selection).journeys ?? 0).toLocaleString()}</strong></button>
      </div>}{renderSection()}</>}
    {drill && round && <DrilldownDrawer key={`${round}-${drill.kind}-${drill.id ?? ''}-${JSON.stringify(drill.query ?? {})}`} round={round} initial={drill} zh={zh} onClose={() => setDrill(null)} />}
  </main>;
}
