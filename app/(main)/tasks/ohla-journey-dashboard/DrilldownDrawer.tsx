'use client';

import { useEffect, useState } from 'react';
import { DataDisclosure } from './ReportVisuals';
import { fetchOhlaJourney } from '@/lib/api/ohla_journey';
import { buildJourneyTimeline, loadJourneyUnits } from '@/lib/ohla-journey/drilldown';
import styles from './DrilldownDrawer.module.css';

export type Kind = 'units' | 'requests' | 'journeys' | 'gap_items' | 'users' | 'personas';
export type Drill = { kind: Kind; title: string; query?: Record<string, string>; id?: string };
type Row = Record<string, unknown>;
type Page = { rows: Row[]; total: number };
const idFields: Record<Kind, string> = { units: 'unit_id', requests: 'request_id', journeys: 'journey_id', gap_items: 'gap_id', users: 'user_id', personas: 'persona_id' };
const obj = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const value = (v: unknown) => v === null || v === undefined || v === '' ? '—' : String(v);
const date = (v: unknown) => {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? value(v) : d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
};
const duration = (v: unknown) => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return n < 3600 ? `${Math.round(n / 60)} min` : n < 86400 ? `${(n / 3600).toFixed(1)} h` : `${(n / 86400).toFixed(1)} d`;
};

function Pairs({ rows }: { rows: Array<[string, unknown]> }) {
  return <dl className={styles.pairs}>{rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([key, v]) =>
    <div key={key}><dt>{key}</dt><dd>{value(v)}</dd></div>)}</dl>;
}

function FullData({ row, zh }: { row: Row; zh: boolean }) {
  return <DataDisclosure title={zh ? '查看全部字段' : 'All fields'}><pre className={styles.json}>{JSON.stringify(row, null, 2)}</pre></DataDisclosure>;
}

function JourneyTimeline({ id, round, links, zh, navigate }: { id: string; round: string; links: unknown[]; zh: boolean; navigate: (next: Drill) => void }) {
  const [requests, setRequests] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [unitDetails, setUnitDetails] = useState<Record<string, Row>>({});
  const [failedUnits, setFailedUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchOhlaJourney<Page>(`reports/${encodeURIComponent(round)}/entities/requests?journey_id=${encodeURIComponent(id)}&limit=500`)
      .then(async (page) => {
        const unitIds = page.rows.map((request) => String(request.unit_id));
        const loaded = await loadJourneyUnits(unitIds, (unitId) => fetchOhlaJourney<Row>(
          `reports/${encodeURIComponent(round)}/entities/units/${encodeURIComponent(unitId)}`));
        if (!alive) return;
        setRequests(page.rows);
        setTotal(page.total);
        setUnitDetails(loaded.units);
        setFailedUnits(loaded.failedIds);
      })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, round, attempt]);
  const retry = <button type="button" onClick={() => {
    setRequests([]);
    setUnitDetails({});
    setFailedUnits([]);
    setError(false);
    setLoading(true);
    setAttempt((current) => current + 1);
  }}>{zh ? '重试' : 'Retry'}</button>;
  if (loading) return <p>{zh ? '正在加载旅程时间线…' : 'Loading journey timeline…'}</p>;
  if (error) return <p role="alert" className={styles.error}>{zh ? '旅程时间线读取失败' : 'Could not load journey timeline'} · {retry}</p>;
  if (!requests.length) return null;
  const steps = buildJourneyTimeline(requests, unitDetails, links);
  return <section className={styles.timeline}><h4>{zh ? '旅程时间线' : 'Journey timeline'} · {total} {zh ? '项诉求' : 'requests'}</h4>
    {total > requests.length && <p className={styles.error}>{zh ? '时间线只显示前 500 项；使用下方“旅程内诉求”查看其余记录。' : 'The timeline shows the first 500 requests; use Requests below for the rest.'}</p>}
    {failedUnits.length > 0 && <p role="alert" className={styles.error}>{zh ? `${failedUnits.length} 个单元的详情读取失败；下方相关字段不完整。` : `${failedUnits.length} unit details failed to load; related fields below are incomplete.`} {retry}</p>}
    {steps.map((step, index) => { const ticket = obj(step.unit.ticket); const times = obj(step.unit.times);
      return <div key={step.unitId}>
        {index > 0 && <div className={styles.timelineJoin}><span>{step.gapSeconds === null ? '' : `+${duration(step.gapSeconds)}`}</span>
          {step.joiningLinks.length ? step.joiningLinks.map((link, linkIndex) => <span key={linkIndex}>{arr(link).slice(2).map(value).join(' · ')}</span>)
            : <span>{zh ? '通过旅程其他关联连接' : 'Joined through other journey links'}</span>}</div>}
        <div className={styles.timelineUnit}><div className={styles.timelineHeader}><span>{index + 1}</span>
          <button className={styles.inlineLink} onClick={() => navigate({ kind: 'units', title: step.unitId, id: step.unitId })}>{value(step.unit.type ?? step.requests[0].type)} · {step.unitId}</button>
          <small>{date(step.requests[0].at)} · {value(step.requests[0].channel)}</small></div>
          {step.requests.map((request) => <div className={styles.timelineRequest} key={value(request.request_id)}>
            <button className={styles.inlineLink} onClick={() => navigate({ kind: 'requests', title: value(request.summary ?? request.request_id), id: value(request.request_id) })}>{value(request.request_id)} · {value(request.summary)}</button>
            <span className={styles.requestOutcome}>{value(request.outcome)} · {value(request.attr)}</span>
            <Pairs rows={[[zh ? '主题 / 子主题' : 'Topic / subtopic', `${value(request.topic)} › ${value(request.subtopic)}`],
              [zh ? '解决要求' : 'Requirement', request.req], [zh ? '诉求类型' : 'Request kind', request.kind],
              [zh ? '交付' : 'Delivery', request.delivery], [zh ? '答复质量' : 'Answer quality', request.quality],
              [zh ? '解决机制' : 'Mechanism', request.mechanism], [zh ? '证实依据' : 'Basis', request.basis]]} />
          </div>)}
          <Pairs rows={[[zh ? '人工操作' : 'Staff actions', arr(step.unit.human_actions).join(', ')],
            [zh ? '关单情况' : 'Close context', step.unit.close_context],
            [zh ? '单元耗时' : 'Unit times', Object.entries(times).map(([key, seconds]) => `${key}: ${duration(seconds)}`).join(' · ')],
            [zh ? '工单状态 / 处理组' : 'Ticket state / group', ticket.state ? `${value(ticket.state)} · ${value(ticket.assigned_group)}` : null]]} />
        </div></div>; })}</section>;
}

function EntityDetail({ row, kind, round, zh, navigate }: { row: Row; kind: Kind; round: string; zh: boolean; navigate: (next: Drill) => void }) {
  const title = value(row[idFields[kind]]);
  const relation = (next: Drill) => <button key={`${next.kind}-${next.id ?? JSON.stringify(next.query)}`} className={styles.relation} onClick={() => navigate(next)}>{next.title} →</button>;
  const actions: React.ReactNode[] = [];
  let primary: React.ReactNode = null;
  if (kind === 'journeys') {
    const assessment = obj(row.assessment);
    primary = <><div className={styles.badges}><span>{value(row.flow)}</span><span>{value(row.path)}</span><span>{value(row.topic)}</span></div>
      <h4 className={styles.sectionTitle}>{zh ? '旅程信息' : 'Journey facts'}</h4>
      <Pairs rows={[[zh ? '用户' : 'User', row.user_id], [zh ? '入口' : 'Entry', row.entry],
        [zh ? '路径' : 'Path', row.path], [zh ? '最终结果' : 'Final outcome', row.flow],
        [zh ? '主题 / 子主题' : 'Topic / subtopic', `${value(row.topic)} › ${value(row.subtopic)}`],
        [zh ? '解决要求' : 'Requirement', row.req], [zh ? '首次接触' : 'First contact', date(row.first)],
        [zh ? '最后接触' : 'Last contact', date(row.last)], [zh ? '单元' : 'Units', `${value(row.segments)} ${zh ? '活动段' : 'segments'} · ${value(row.tickets)} ${zh ? '工单' : 'tickets'}`],
        ['T6', duration(row.t6)], ['T7', arr(row.t7).map(duration).join(' · ')], [zh ? '再次联系' : 'Recontacts', row.recontacts]]} />
      <JourneyTimeline key={`${round}:${title}`} id={title} round={round} links={arr(row.links)} zh={zh} navigate={navigate} />
      {row.assessment && <div className={styles.callout}><strong>{zh ? '缺口判断' : 'Gap assessment'}</strong>
        <Pairs rows={[[zh ? '类别' : 'Family', assessment.family], [zh ? '知识缺口类型' : 'Knowledge gap type', assessment.knowledge_type],
          [zh ? '执行缺口类型' : 'Action gap type', assessment.action_type], [zh ? '所需知识' : 'Knowledge needed', assessment.knowledge],
          [zh ? '所需操作' : 'Action needed', assessment.action], [zh ? '判定理由' : "Judges' reason", assessment.reason],
          [zh ? '判定方式' : 'Decided by', assessment.method], [zh ? '状态' : 'Status', assessment.status]]} /></div>}
      {arr(row.links).length > 0 && <div className={styles.callout}><strong>{zh ? '旅程关联依据' : 'Journey links'}</strong>
        {arr(row.links).map((link, index) => { const parts = arr(link); return <p key={index}>{parts.length >= 2 ? `${value(parts[0])} → ${value(parts[1])} · ${parts.slice(2).map(value).join(' · ')}` : value(link)}</p>; })}</div>}</>;
    actions.push(relation({ kind: 'requests', title: `${zh ? '旅程内诉求' : 'Requests'} · ${arr(row.request_ids).length}`, query: { journey_id: title } }));
    if (row.user_id) actions.push(relation({ kind: 'users', title: zh ? '查看用户' : 'View user', id: value(row.user_id) }));
  } else if (kind === 'requests') {
    primary = <><div className={styles.summary}>{value(row.summary)}</div><div className={styles.badges}><span>{value(row.outcome)}</span><span>{value(row.attr)}</span><span>{value(row.channel)}</span></div>
      <Pairs rows={[[zh ? '提出时间' : 'At', date(row.at)], [zh ? '来源单元' : 'Unit', row.unit_id],
        [zh ? '单元类型 / 渠道' : 'Unit type / channel', `${value(row.type)} · ${value(row.channel)}`],
        [zh ? '主题' : 'Topic', `${value(row.topic)} › ${value(row.subtopic)}`],
        [zh ? '解决要求' : 'Requirement', row.req], [zh ? '诉求类型' : 'Request kind', row.kind],
        [zh ? '交付' : 'Delivery', row.delivery], [zh ? '答复质量' : 'Answer quality', row.quality],
        [zh ? '解决机制' : 'Mechanism', row.mechanism], [zh ? '证实依据' : 'Basis', row.basis],
        [zh ? '人工路径' : 'Human path', row.human_path], [zh ? '地区' : 'Region', row.region]]} /></>;
    if (row.journey_id) actions.push(relation({ kind: 'journeys', title: zh ? '查看所属旅程' : 'View journey', id: value(row.journey_id) }));
    if (row.unit_id) actions.push(relation({ kind: 'units', title: zh ? '查看来源单元' : 'View unit', id: value(row.unit_id) }));
  } else if (kind === 'users') {
    const attrs = obj(row.attrs);
    primary = <><div className={styles.badges}><span>{value(row.persona_id)}</span></div>
      <Pairs rows={[[zh ? '首次接触' : 'First', date(row.first)], [zh ? '最后接触' : 'Last', date(row.last)],
        [zh ? '入职日期' : 'Hire date', attrs.hire_date], [zh ? '工龄' : 'Tenure', attrs.tenure],
        [zh ? '工作地区' : 'Work region', attrs.location], [zh ? '国家' : 'Country', attrs.country],
        [zh ? '时区' : 'Time zone', attrs.timezone], [zh ? '业务群' : 'Business group', attrs.business_group],
        [zh ? '部门' : 'Department', attrs.department], [zh ? '员工类型' : 'Worker type', attrs.worker_type],
        [zh ? '岗位类型' : 'Job category', attrs.job_category], [zh ? '职级' : 'Job band', attrs.job_band]]} />
      <div className={styles.callout}><strong>{zh ? '使用方式特征' : 'Support-use features'}</strong>
        <Pairs rows={Object.entries(obj(row.features))} /></div></>;
    actions.push(relation({ kind: 'journeys', title: `${zh ? '用户旅程' : 'User journeys'} · ${arr(row.journey_ids).length}`, query: { user_id: title } }));
    if (row.persona_id) actions.push(relation({ kind: 'personas', title: zh ? '查看画像规则' : 'View persona rules', id: value(row.persona_id) }));
  } else if (kind === 'gap_items') {
    primary = <><div className={styles.summary}>{value(zh ? row.title_zh : row.title_en)}</div>
      <div className={styles.badges}><span>{value(row.gap_family)}</span><span>{value(row.verification_status)}</span></div>
      <Pairs rows={[[zh ? '主题' : 'Topic', row.topic], [zh ? '键' : 'Key', row.key],
        [zh ? '类型' : 'Types', arr(row.types).join(', ')], [zh ? '优先级' : 'Priority rank', row.priority_rank],
        [zh ? '覆盖旅程' : 'Journeys', obj(row.volume).journeys], [zh ? '覆盖工单' : 'Tickets', obj(row.volume).tickets],
        [zh ? '成熟度' : 'Maturity', row.maturity], [zh ? '可转化旅程' : 'Convertible journeys', `${value(obj(obj(row.conversion).lower).journeys)}–${value(obj(obj(row.conversion).upper).journeys)}`],
        [zh ? '可减少工单' : 'Tickets deflectable', `${value(obj(obj(row.conversion).lower).tickets_deflected)}–${value(obj(obj(row.conversion).upper).tickets_deflected)}`],
        [zh ? '可避免等待' : 'Wait avoided', `${duration(obj(obj(row.conversion).lower).time_saved_sec)}–${duration(obj(obj(row.conversion).upper).time_saved_sec)}`],
        [zh ? '合并来源' : 'Merged from', arr(row.merged_from).join(', ')]]} />
      <div className={styles.callout}><strong>{zh ? '建议' : 'Recommendation'}</strong><p>{value(row.recommendation)}</p></div>
      <div className={styles.callout}><strong>{zh ? '可行性依据' : 'Feasibility basis'}</strong><p>{value(row.feasibility_basis)}</p></div></>;
    actions.push(relation({ kind: 'journeys', title: `${zh ? '关联旅程' : 'Member journeys'} · ${arr(row.journey_ids).length}`, query: { gap_id: title } }));
  } else if (kind === 'personas') {
    primary = <><div className={styles.summary}>{value(zh ? row.name_zh : row.name_en)}</div><p>{value(zh ? row.description_zh : row.description_en)}</p>
      <Pairs rows={[[zh ? '用户' : 'Users', row.users], [zh ? '旅程' : 'Journeys', row.journeys], [zh ? '占比' : 'Share', row.share]]} />
      <div className={styles.callout}><strong>{zh ? '画像规则' : 'Persona rules'}</strong><pre className={styles.json}>{JSON.stringify(row.rules, null, 2)}</pre></div></>;
    actions.push(relation({ kind: 'users', title: zh ? '查看画像用户' : 'View persona users', query: { persona_id: title } }));
  } else {
    const ticket = obj(row.ticket); const times = obj(row.times);
    primary = <><div className={styles.badges}><span>{value(row.type)}</span><span>{value(row.close_context)}</span></div>
      <Pairs rows={[[zh ? '开始' : 'Start', date(row.start)], [zh ? '结束' : 'End', date(row.end)],
        [zh ? '事件数' : 'Events', row.events], [zh ? '工单状态' : 'Ticket state', ticket.state],
        [zh ? '处理组' : 'Assigned group', ticket.assigned_group], [zh ? '优先级' : 'Priority', ticket.priority],
        [zh ? '重开次数' : 'Reopens', ticket.reopen_count], [zh ? '改派次数' : 'Reassignments', ticket.reassignment_count],
        ['CSAT', ticket.csat_score], [zh ? '解决时间' : 'Resolved at', ticket.resolved_at ? date(ticket.resolved_at) : null],
        [zh ? '关闭时间' : 'Closed at', ticket.closed_at ? date(ticket.closed_at) : null],
        [zh ? '人工操作' : 'Staff actions', arr(row.human_actions).join(', ')],
        [zh ? '耗时' : 'Time', Object.entries(times).map(([key, seconds]) => `${key}: ${duration(seconds)}`).join(' · ')]]} /></>;
    actions.push(relation({ kind: 'requests', title: zh ? '单元内诉求' : 'Unit requests', query: { unit_id: title } }));
  }
  return <article className={styles.detail}><h3>{title}</h3>{primary}<div className={styles.relations}>{actions}</div><FullData row={row} zh={zh} /></article>;
}

export default function DrilldownDrawer({ round, initial, zh, onClose }: { round: string; initial: Drill; zh: boolean; onClose: () => void }) {
  const [stack, setStack] = useState<Drill[]>([initial]);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Page | Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const current = stack[stack.length - 1];
  const queryKey = JSON.stringify(current.query ?? {});
  useEffect(() => {
    let alive = true;
    const query = new URLSearchParams({ limit: '25', offset: String(page * 25), ...JSON.parse(queryKey) as Record<string,string> });
    const base = `reports/${encodeURIComponent(round)}/entities/${current.kind}`;
    const path = current.id ? `${base}/${encodeURIComponent(current.id)}` : `${base}?${query}`;
    fetchOhlaJourney<Page | Row>(path).then((data) => { if (alive) setResult(data); }).catch((err) => { if (alive) setError(String(err)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [round, current.kind, current.id, queryKey, page, attempt]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const navigate = (next: Drill) => { setStack((items) => [...items, next]); setPage(0); setResult(null); setError(''); setLoading(true); };
  const back = () => { setStack((items) => items.slice(0, -1)); setPage(0); setResult(null); setError(''); setLoading(true); };
  const list = !current.id ? result as Page | null : null;
  const row = current.id ? result as Row | null : null;
  return <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={current.title}>
      <header className={styles.header}><div><div className={styles.caption}>{zh ? '报告明细' : 'Report details'} · {round}</div><h2>{current.title}</h2></div>
        <div className={styles.headerActions}>{stack.length > 1 && <button onClick={back}>{zh ? '返回' : 'Back'}</button>}<button onClick={onClose} aria-label={zh ? '关闭' : 'Close'}>×</button></div></header>
      <div className={styles.body}>{loading && <p>{zh ? '正在加载明细…' : 'Loading details…'}</p>}{error && <p role="alert" className={styles.error}>{zh ? '读取失败' : 'Failed to load'}: {error} <button type="button" onClick={() => { setError(''); setLoading(true); setAttempt((value) => value + 1); }}>{zh ? '重试' : 'Retry'}</button></p>}
        {!loading && !error && row && <EntityDetail row={row} kind={current.kind} round={round} zh={zh} navigate={navigate} />}
        {!loading && !error && list && <><p className={styles.total}>{zh ? '共' : 'Total'} <strong>{list.total.toLocaleString()}</strong> {zh ? '项' : 'items'}</p>
          <div className={styles.items}>{list.rows.map((item) => { const id = value(item[idFields[current.kind]]);
            const heading = value(item.summary ?? (zh ? item.title_zh : item.title_en) ?? (zh ? item.name_zh : item.name_en) ?? item.topic ?? item.type ?? id);
            return <button className={styles.item} key={id} onClick={() => navigate({ kind: current.kind, title: heading, id })}>
              <span className={styles.itemId}>{id}</span><span className={styles.itemTitle}>{heading}</span>
              <small>{value(item.flow ?? item.outcome ?? item.gap_family ?? item.persona_id ?? item.channel ?? '')}</small><span aria-hidden="true">›</span></button>; })}</div>
          {list.total > 25 && <div className={styles.pagination}><button disabled={page === 0} onClick={() => { setPage(page - 1); setResult(null); setLoading(true); }}>{zh ? '上一页' : 'Previous'}</button>
            <span>{page + 1} / {Math.ceil(list.total / 25)}</span><button disabled={(page + 1) * 25 >= list.total} onClick={() => { setPage(page + 1); setResult(null); setLoading(true); }}>{zh ? '下一页' : 'Next'}</button></div>}
        </>}
      </div>
    </aside>
  </div>;
}
