'use client';

import React from 'react';
import styles from './ReportVisuals.module.css';

export type RecordValue = Record<string, unknown>;
const asObject = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const asList = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const number = (value: unknown) => Number(value ?? 0);
const formatted = (value: unknown) => number(value).toLocaleString();

export function ReportPanel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className={styles.panel}><div className={styles.panelHead}><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</section>;
}

export function Metric({ label, value, note, tone, onClick }: { label: string; value: string | number; note?: string; tone?: 'blue' | 'green' | 'amber' | 'red'; onClick?: () => void }) {
  const content = <><span className={styles.metricLabel}>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</>;
  const className = `${styles.metric} ${tone ? styles[tone] : ''} ${onClick ? styles.clickable : ''}`;
  return onClick ? <button type="button" className={className} onClick={onClick}>{content}</button> : <div className={className}>{content}</div>;
}

export function MetricGrid({ children, columns = 3 }: { children: React.ReactNode; columns?: 3 | 4 | 6 }) {
  return <div className={styles.metricGrid} style={{ '--cols': columns } as React.CSSProperties}>{children}</div>;
}

export function Lineage({ scope, zh, personaCount, onOpen }: { scope: RecordValue; zh: boolean; personaCount?: number; onOpen?: (kind: 'requests' | 'journeys' | 'users' | 'personas') => void }) {
  const values = asObject(scope.lineage);
  const stages: Array<[string, string, number, 'requests' | 'journeys' | 'users' | 'personas' | null]> = [
    [zh ? '活动段' : 'Activity segments', zh ? '完整机器人活动范围' : 'All bot activity', number(values.segments), null],
    [zh ? '单元' : 'Units', zh ? '有操作活动段 + 工单' : 'Active segments + tickets', number(values.units), null],
    [zh ? '诉求' : 'Requests', zh ? '每个单元可含多个诉求' : 'One unit may contain several requests', number(values.requests), 'requests'],
    [zh ? '旅程' : 'Journeys', zh ? '一个用户的一项问题' : 'One problem of one user', number(values.journeys), 'journeys'],
    [zh ? '用户' : 'Users', zh ? '旅程背后的用户' : 'People behind journeys', number(values.users), 'users'],
    [zh ? '画像' : 'Personas', zh ? '支持方式相近的用户组' : 'Groups with similar support habits', personaCount ?? 0, 'personas'],
  ];
  return <ol className={styles.lineage}>{stages.map(([label, note, value, kind]) => <li key={label}>
    {kind && onOpen ? <button onClick={() => onOpen(kind)}><strong>{formatted(value)}</strong><span>{label}</span></button>
      : <><strong>{formatted(value)}</strong><span>{label}</span></>}
    <small>{note}</small></li>)}</ol>;
}

const outcomeColors: Record<string, string> = {
  ai_confirmed: '#1c5cab', ai_unconfirmed: '#86b6ef', human_confirmed: '#177245',
  human_unconfirmed: '#8fd1a8', elsewhere: '#6b7688', unknown: '#d6dae0', unresolved: '#b64a3c',
};
const outcomeNames: Record<string, [string, string]> = {
  ai_confirmed: ['AI · confirmed', 'AI · 已证实'], ai_unconfirmed: ['AI · unconfirmed', 'AI · 未证实'],
  human_confirmed: ['Human · confirmed', '人工 · 已证实'], human_unconfirmed: ['Human · unconfirmed', '人工 · 未证实'],
  elsewhere: ['Self-resolved', '自行解决'], unknown: ["Can't tell", '无法判断'], unresolved: ['Not resolved', '未解决'],
};

export function OutcomeLegend({ zh }: { zh: boolean }) {
  return <div className={styles.legend}>{Object.entries(outcomeNames).map(([key, names]) => <span key={key}>
    <i style={{ background: outcomeColors[key] }} />{names[zh ? 1 : 0]}</span>)}</div>;
}

export function StackedBar({ parts, onPart }: { parts: Array<{ key: string; value: number; color: string; label?: string }>; onPart?: (key: string) => void }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return <div className={styles.stack} role="img" aria-label={parts.map((part) => `${part.label ?? part.key}: ${formatted(part.value)}`).join(', ')}>
    {parts.filter((part) => part.value > 0).map((part) => onPart ? <button type="button" key={part.key} title={`${part.label ?? part.key}: ${formatted(part.value)}`}
      aria-label={`${part.label ?? part.key}: ${formatted(part.value)}`} onClick={() => onPart(part.key)}
      style={{ width: `${total ? 100 * part.value / total : 0}%`, background: part.color }} /> : <span key={part.key} title={`${part.label ?? part.key}: ${formatted(part.value)}`}
      style={{ width: `${total ? 100 * part.value / total : 0}%`, background: part.color }} />)}</div>;
}

export function RankedBars({ rows, zh, limit = 12, color = '#2f5fc4', onSelect }: {
  rows: Array<{ label: string; value: number; note?: string; key?: string }>; zh: boolean; limit?: number; color?: string;
  onSelect?: (row: { label: string; value: number; note?: string; key?: string }, index: number) => void;
}) {
  const [all, setAll] = React.useState(false);
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((row) => row.value));
  return <><div className={styles.ranks}>{(all ? sorted : sorted.slice(0, limit)).map((row, i) => <div className={`${styles.rank} ${onSelect ? styles.clickable : ''}`} key={`${row.label}-${i}`}
    role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} onClick={() => onSelect?.(row, i)}
    onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) onSelect(row, i); }}>
    <div className={styles.rankLabel} title={row.label}>{row.label}</div><div className={styles.rankTrack}>
      <div style={{ width: `${Math.max(1, row.value / max * 100)}%`, background: color }} /></div>
    <strong>{formatted(row.value)}</strong>{row.note && <small>{row.note}</small>}</div>)}</div>
    {sorted.length > limit && <button className={styles.more} onClick={() => setAll(!all)}>{all ? (zh ? '收起' : 'Show less') : (zh ? `查看全部 ${sorted.length} 项` : `Show all ${sorted.length}`)}</button>}
  </>;
}

export function Funnel({ stages, zh, onSelect }: { stages: unknown[]; zh: boolean; onSelect?: (stage: RecordValue) => void }) {
  const rows = stages.map(asObject);
  const max = Math.max(1, ...rows.map((row) => number(row.n)));
  return <div className={styles.funnel}>{rows.map((row, i) => <div className={`${styles.funnelRow} ${onSelect ? styles.clickable : ''}`} key={String(row.stage_id ?? i)}
    role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} onClick={() => onSelect?.(row)}
    onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) onSelect(row); }}>
    <span className={styles.stage}>{String((zh ? row.label_zh : row.label_en) ?? row.stage_id ?? '')}</span>
    <div className={styles.funnelTrack}><div style={{ width: `${Math.max(1, number(row.n) / max * 100)}%` }} /></div>
    <strong>{formatted(row.n)}</strong><small>{typeof row.pct === 'number' ? `${(row.pct * 100).toFixed(1)}%` : '—'}</small>
  </div>)}</div>;
}

export function TimeSeries({ rows, zh, onSelect }: { rows: Array<{ day: number; journeys: number }>; zh: boolean; onSelect?: (day: number) => void }) {
  const values = [...rows].sort((a, b) => a.day - b.day);
  if (!values.length) return <p>{zh ? '没有时间线数据' : 'No timeline data'}</p>;
  const max = Math.max(1, ...values.map((row) => row.journeys));
  const width = 900; const height = 210; const left = 34; const right = 8; const top = 10; const bottom = 26;
  const x = (index: number) => left + index * (width - left - right) / Math.max(1, values.length - 1);
  const y = (n: number) => top + (1 - n / max) * (height - top - bottom);
  return <div className={styles.timeWrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={zh ? '每日旅程数量趋势' : 'Daily journey trend'}>
    {[0, .5, 1].map((fraction) => <g key={fraction}><line x1={left} x2={width-right} y1={y(max*fraction)} y2={y(max*fraction)} stroke="#e3e6ea" />
      <text x={left-6} y={y(max*fraction)+4} textAnchor="end" fill="#667080" fontSize="11">{Math.round(max*fraction)}</text></g>)}
    <polyline fill="none" stroke="#2f5fc4" strokeWidth="2" strokeLinejoin="round" points={values.map((row,i) => `${x(i)},${y(row.journeys)}`).join(' ')} />
    {values.map((row,i) => <circle key={row.day} cx={x(i)} cy={y(row.journeys)} r={onSelect ? '4' : '2'} fill="#2f5fc4"
      className={onSelect ? styles.chartPoint : ''} tabIndex={onSelect ? 0 : undefined} role={onSelect ? 'button' : undefined}
      aria-label={onSelect ? `${zh ? '第' : 'Day '}${row.day}${zh ? '天' : ''}: ${row.journeys} ${zh ? '条旅程' : 'journeys'}` : undefined}
      onClick={() => onSelect?.(row.day)} onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) onSelect(row.day); }}>
      <title>{zh ? '第' : 'Day '}{row.day}{zh ? '天' : ''}: {row.journeys}</title></circle>)}
    <text x={left} y={height-5} fill="#667080" fontSize="11">{zh ? '第 0 天' : 'Day 0'}</text>
    <text x={width-right} y={height-5} textAnchor="end" fill="#667080" fontSize="11">{zh ? `第 ${values.at(-1)?.day} 天` : `Day ${values.at(-1)?.day}`}</text>
  </svg></div>;
}

export function FlowSummary({ flow, zh }: { flow: unknown; zh: boolean }) {
  const data = asObject(flow);
  const rows = asList(data.flows).map(asObject);
  const byPath = new Map<string, { n: number; outcomes: Map<string, number> }>();
  for (const row of rows) {
    const path = String(row.path ?? 'unknown'); const entry = String(row.entry ?? 'unknown'); const key = `${entry}|${path}`;
    const item = byPath.get(key) ?? { n: 0, outcomes: new Map<string, number>() };
    item.n += number(row.n); item.outcomes.set(String(row.outcome), (item.outcomes.get(String(row.outcome)) ?? 0) + number(row.n)); byPath.set(key, item);
  }
  return <><OutcomeLegend zh={zh} /><div className={styles.flowList}>{[...byPath.entries()].sort((a, b) => b[1].n - a[1].n).map(([key, item]) => {
    const [entry, path] = key.split('|');
    return <div className={styles.flowRow} key={key}><span className={styles.flowEntry}>{entry === 'bot' ? (zh ? '机器人' : 'Bot') : (zh ? '人工' : 'Human')}</span>
      <span className={styles.flowArrow}>→</span><span className={styles.flowPath}>{path.replaceAll('_', ' ').toLowerCase()}</span>
      <span className={styles.flowArrow}>→</span><div className={styles.flowOutcome}><StackedBar parts={[...item.outcomes].map(([outcome, value]) => ({
        key: outcome, value, color: outcomeColors[outcome] ?? '#8892a0', label: outcomeNames[outcome]?.[zh ? 1 : 0] ?? outcome,
      }))} /></div><strong>{formatted(item.n)}</strong></div>;
  })}</div></>;
}

const journeyNames: Record<string, [string, string]> = {
  BOT_RESOLVED_FIRST: ['Bot resolved first', '机器人首次解决'], BOT_ASKED_HUMAN: ['Bot asked for human', '机器人建议人工'],
  TICKET_NO_BOT: ['Ticket without bot', '直接建单'], BOT_DELIVERED_LEFT: ['Bot delivered, user left', '机器人交付后离开'],
  ESCALATED_SAME_SEGMENT: ['Escalated in same contact', '同次接触转人工'], RECONTACT: ['Recontacted', '再次联系'],
  MULTI_TICKET: ['Multiple tickets', '多次建单'],
};

export function JourneySankey({ flow, zh, onSelect }: { flow: unknown; zh: boolean; onSelect?: (query: Record<string, string>, title: string) => void }) {
  const [selected, setSelected] = React.useState('');
  const rows = asList(asObject(flow).flows).map(asObject).filter((row) => number(row.n) > 0);
  const total = rows.reduce((sum, row) => sum + number(row.n), 0);
  if (!total) return null;
  const nodeOrder = {
    entry: ['bot', 'ticket_direct'],
    path: ['BOT_RESOLVED_FIRST', 'BOT_DELIVERED_LEFT', 'BOT_ASKED_HUMAN', 'ESCALATED_SAME_SEGMENT', 'TICKET_NO_BOT', 'RECONTACT', 'MULTI_TICKET'],
    outcome: ['ai_confirmed', 'ai_unconfirmed', 'human_confirmed', 'human_unconfirmed', 'elsewhere', 'unknown', 'unresolved'],
  };
  type Stage = keyof typeof nodeOrder;
  for (const stage of Object.keys(nodeOrder) as Stage[]) {
    for (const row of rows) {
      const code = String(row[stage]);
      if (!nodeOrder[stage].includes(code)) nodeOrder[stage].push(code);
    }
  }
  const chartHeight = 45 + 495 + 16 * (Math.max(...Object.values(nodeOrder).map((codes) => codes.length)) - 1) + 30;
  const byStage = Object.fromEntries((Object.keys(nodeOrder) as Stage[]).map((stage) => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(String(row[stage]), (totals.get(String(row[stage])) ?? 0) + number(row.n));
    return [stage, totals];
  })) as Record<Stage, Map<string, number>>;
  const scale = 495 / total;
  const positions = {} as Record<Stage, Map<string, { y: number; h: number }>>;
  for (const stage of Object.keys(nodeOrder) as Stage[]) {
    const mapped = new Map<string, { y: number; h: number }>(); let y = 45;
    for (const code of nodeOrder[stage]) { const h = (byStage[stage].get(code) ?? 0) * scale; mapped.set(code, { y, h }); y += h + 16; }
    positions[stage] = mapped;
  }
  const offsets: Record<Stage, Map<string, number>> = { entry: new Map(), path: new Map(), outcome: new Map() };
  const ordered = [...rows].sort((a, b) =>
    nodeOrder.entry.indexOf(String(a.entry)) - nodeOrder.entry.indexOf(String(b.entry)) ||
    nodeOrder.path.indexOf(String(a.path)) - nodeOrder.path.indexOf(String(b.path)) ||
    nodeOrder.outcome.indexOf(String(a.outcome)) - nodeOrder.outcome.indexOf(String(b.outcome)));
  const ribbons = ordered.map((row, i) => {
    const height = Math.max(.35, number(row.n) * scale);
    const at = (stage: Stage) => { const key = String(row[stage]); const y = (positions[stage].get(key)?.y ?? 0) + (offsets[stage].get(key) ?? 0); offsets[stage].set(key, (offsets[stage].get(key) ?? 0) + number(row.n) * scale); return y; };
    const a = at('entry'), b = at('path'), c = at('outcome');
    const shape = (x0: number, y0: number, x1: number, y1: number) => {
      const curve = (x0 + x1) / 2;
      return `M${x0},${y0} C${curve},${y0} ${curve},${y1} ${x1},${y1} L${x1},${y1+height} C${curve},${y1+height} ${curve},${y0+height} ${x0},${y0+height}Z`;
    };
    const outcome = String(row.outcome);
    const title = `${String(row.entry)} → ${journeyNames[String(row.path)]?.[zh ? 1 : 0] ?? row.path} → ${outcomeNames[outcome]?.[zh ? 1 : 0] ?? outcome}: ${formatted(row.n)}`;
    const activate = () => { setSelected(title); onSelect?.({ entry: String(row.entry), path: String(row.path), outcome }, title); };
    return <g key={i} className={styles.ribbon} fill={outcomeColors[outcome] ?? '#8892a0'} tabIndex={0} role="button"
      aria-label={title} onClick={activate} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') activate(); }}><title>{title}</title>
      <path d={shape(170, a, 450, b)} opacity={String(row.entry) === 'bot' && !outcome.startsWith('ai_') ? .48 : .72} />
      <path d={shape(460, b, 750, c)} opacity=".76" /></g>;
  });
  const labels = (stage: Stage, x: number) => nodeOrder[stage].map((code) => {
    const node = positions[stage].get(code); if (!node || !node.h) return null;
    const label = stage === 'entry' ? (code === 'bot' ? (zh ? '机器人入口' : 'Bot entry') : code === 'ticket_direct' ? (zh ? '直接建单' : 'Direct ticket') : code)
      : stage === 'path' ? journeyNames[code]?.[zh ? 1 : 0] ?? code : outcomeNames[code]?.[zh ? 1 : 0] ?? code;
    const filter: Record<string, string> = stage === 'entry' ? { entry: code } : stage === 'path' ? { path: code } : { outcome: code };
    const activate = () => onSelect?.(filter, `${label} · ${formatted(byStage[stage].get(code))}`);
    return <g key={`${stage}-${code}`} className={onSelect ? styles.nodeClick : ''} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
      onClick={activate} onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) activate(); }}>
      <rect x={x} y={node.y} width="10" height={Math.max(.5,node.h)} rx="2" fill={stage === 'outcome' ? outcomeColors[code] : '#4a525c'} />
      <text x={stage === 'outcome' ? x+17 : x-8} y={node.y + Math.max(8,node.h/2)+4} textAnchor={stage === 'outcome' ? 'start' : 'end'} fontSize="12" fill="currentColor">{label} · {formatted(byStage[stage].get(code))}</text></g>;
  });
  return <><OutcomeLegend zh={zh} /><div className={styles.sankeyWrap}><svg viewBox={`0 0 1050 ${chartHeight}`} role="img" aria-label={zh ? '旅程从入口到路径再到结果的流向图' : 'Journey flow from entry through path to outcome'}>
    <text x="170" y="23" textAnchor="end" fontSize="12" fontWeight="bold" fill="currentColor">{zh ? '入口' : 'Entry'}</text>
    <text x="455" y="23" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">{zh ? '路径' : 'Path'}</text>
    <text x="750" y="23" fontSize="12" fontWeight="bold" fill="currentColor">{zh ? '结果' : 'Outcome'}</text>
    {ribbons}{labels('entry',170)}{labels('path',450)}{labels('outcome',750)}</svg></div>
    {selected && <div className={styles.flowSelection}><strong>{zh ? '选中的流向' : 'Selected flow'}</strong><span>{selected}</span>
      <button onClick={() => setSelected('')} aria-label={zh ? '清除选择' : 'Clear selection'}>×</button></div>}</>;
}

export function DataDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className={styles.disclosure}><summary>{title}</summary><div>{children}</div></details>;
}
