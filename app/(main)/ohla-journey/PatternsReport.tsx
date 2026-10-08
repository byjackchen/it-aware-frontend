'use client';

import { useMemo, useState } from 'react';
import { Metric, MetricGrid, RankedBars, ReportPanel } from './ReportVisuals';
import styles from './PatternsReport.module.css';

type Obj = Record<string, unknown>;
const horizons = ['7', '14', '30', '60', '90'];
function obj(value: unknown): Obj { return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function arr(value: unknown): Obj[] { return Array.isArray(value) ? value.map(obj) : []; }
function count(value: unknown): string { return typeof value === 'number' ? value.toLocaleString() : '—'; }
function percent(value: unknown): string { return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'; }
function name(value: unknown): string { return value === null || value === undefined ? '—' : String(value); }

function RecurrenceFigure({ rows, zh }: { rows: Obj[]; zh: boolean }) {
  const [selected, setSelected] = useState<string[]>(['1', '2', '3', '4', 'all']);
  const lines = rows.filter((row) => row.scope === 'times_before' || row.scope === 'all').map((row) => ({
    id: row.scope === 'all' ? 'all' : name(row.times), values: obj(row.came_back), n: Number(row.needs ?? 0),
  }));
  const colors: Record<string, string> = { '1': '#87a8db', '2': '#5b8acb', '3': '#2f5fc4', '4': '#1c3975', all: '#ba7052' };
  const width = 760; const height = 260; const left = 46; const right = 18; const top = 12; const bottom = 34;
  const x = (index: number) => left + index * (width - left - right) / (horizons.length - 1);
  const y = (value: number) => top + (1 - value) * (height - top - bottom);
  return <div>
    <div className={styles.legend}>{lines.map((line) => <button key={line.id} className={selected.includes(line.id) ? styles.legendActive : ''}
      onClick={() => setSelected((old) => old.includes(line.id) ? old.filter((item) => item !== line.id) : [...old, line.id])}>
      <i style={{ background: colors[line.id] ?? '#536070' }} />{line.id === 'all' ? (zh ? '全部' : 'All') : `${zh ? '第' : 'After '} ${line.id} ${zh ? '次后' : 'times'}`} · n={count(line.n)}
    </button>)}</div>
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label={zh ? '同一需求复发比例' : 'Same need recurrence rate'}>
      {[0,.2,.4,.6,.8,1].map((value) => <g key={value}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="#e2e6eb" />
        <text x={left-8} y={y(value)+4} textAnchor="end">{Math.round(value*100)}%</text></g>)}
      {horizons.map((day,index) => <text key={day} x={x(index)} y={height-8} textAnchor="middle">{day}{zh ? ' 天' : ' d'}</text>)}
      {lines.filter((line) => selected.includes(line.id)).map((line) => <g key={line.id}>
        <polyline fill="none" stroke={colors[line.id] ?? '#536070'} strokeWidth={line.id === 'all' ? 3 : 2.5}
          points={horizons.map((day,index) => `${x(index)},${y(Number(line.values[day] ?? 0))}`).join(' ')} />
        {horizons.map((day,index) => <circle key={day} cx={x(index)} cy={y(Number(line.values[day] ?? 0))} r="3.5" fill={colors[line.id] ?? '#536070'}>
          <title>{line.id} · {day} {zh ? '天' : 'days'} · {percent(line.values[day])}</title></circle>)}
      </g>)}
    </svg>
  </div>;
}

function RuleLiftFigure({ rules, zh }: { rules: Obj[]; zh: boolean }) {
  const held = rules.filter((rule) => rule.verdict === 'held' && Number(obj(rule.derive).lift) > 0 && Number(obj(rule.confirm).lift) > 0);
  const left=310, right=28, width=960, rowHeight=18, top=32, height=top+held.length*rowHeight+24;
  const max=Math.max(20,...held.flatMap((rule)=>[Number(obj(rule.derive).lift),Number(obj(rule.confirm).lift)]));
  const x=(value:number)=>left+(Math.log(Math.max(1,value))/Math.log(max))*(width-left-right);
  return <div className={styles.chartScroll}><svg className={styles.liftChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={zh?'成立规律在发现期和复核期的提升倍数':'Held rules: lift at discovery and confirmation'}>
    {[1,2,5,10,20].filter((tick)=>tick<=max).map((tick)=><g key={tick}><line x1={x(tick)} x2={x(tick)} y1={top-8} y2={height-10} stroke="#d9dee7" strokeOpacity=".35"/><text x={x(tick)} y="15" textAnchor="middle">×{tick}</text></g>)}
    {held.map((rule,i)=>{const y=top+i*rowHeight;const derive=Number(obj(rule.derive).lift),confirm=Number(obj(rule.confirm).lift);
      const label=`${name(rule.condition)} → ${name(rule.need)}`;return <g key={`${label}-${i}`}><title>{label} · ${zh?'发现':'found'} ×${derive.toFixed(1)} · ${zh?'复核':'checked'} ×${confirm.toFixed(1)}</title>
        <text x="0" y={y+4}>{label.length>44?`${label.slice(0,41)}…`:label}</text><line x1={x(derive)} x2={x(confirm)} y1={y} y2={y} stroke="#7d94bb" strokeWidth="2"/>
        <circle cx={x(derive)} cy={y} r="3.5" fill="#88aee4"/><circle cx={x(confirm)} cy={y} r="4" fill="#234f9b"/></g>;})}
  </svg></div>;
}

function BacktestFigure({ backtest, zh }: { backtest: Obj; zh: boolean }) {
  const objectives=obj(backtest.objectives);
  const comparison=['50','200'].flatMap((size)=>['rate','value'].map((objective)=>({size,objective,row:obj(obj(obj(objectives[objective]).top_per_cutoff)[size])})));
  return <div className={styles.backtestBars}>{comparison.map(({size,objective,row})=><div key={`${size}-${objective}`}>
    <span>{zh?`每期前 ${size} 条 · ${objective==='rate'?'按应验率':'按可省人工'}`:`Top ${size} per cutoff · by ${objective==='rate'?'rate':'value'}`}</span>
    <div className={styles.backtestTrack}><i style={{width:`${Math.max(0,Math.min(100,100*Number(row.precision??0)))}%`}}/></div>
    <strong>{percent(row.precision)}</strong><small>{zh?'每百次人工':'Human / 100'} {name(row.human_per_100)} ({count(row.human_resolved)})</small>
  </div>)}</div>;
}

export default function PatternsReport({ data, zh }: { data: Obj; zh: boolean }) {
  const needs = obj(data.needs);
  const recurrence = arr(data.recurrence);
  const rules = arr(data.rules);
  const candidates = obj(data.candidates);
  const backtest = obj(data.backtest);
  const generatorsSummary = obj(obj(data.mining).generators);
  const [ruleVerdict, setRuleVerdict] = useState('all');
  const [ruleGenerator, setRuleGenerator] = useState('all');
  const [ruleSearch, setRuleSearch] = useState('');
  const [showAllRules, setShowAllRules] = useState(false);
  const [needSearch, setNeedSearch] = useState('');
  const [showAllNeeds, setShowAllNeeds] = useState(false);
  const [objective, setObjective] = useState('rate');
  const filteredRules = useMemo(() => rules.filter((rule) => (ruleVerdict === 'all' || rule.verdict === ruleVerdict)
    && (ruleGenerator === 'all' || rule.generator === ruleGenerator)
    && (name(rule.condition).toLowerCase().includes(ruleSearch.toLowerCase()) || name(rule.need).toLowerCase().includes(ruleSearch.toLowerCase()))),
  [rules, ruleVerdict, ruleGenerator, ruleSearch]);
  const needRows = recurrence.filter((row) => row.scope === 'need')
    .filter((row) => name(row.subtopic).toLowerCase().includes(needSearch.toLowerCase()))
    .sort((a,b) => Number(b.needs ?? 0) - Number(a.needs ?? 0));
  const test = obj(obj(backtest.objectives)[objective]);
  const generators = obj(test.by_generator);
  const featuredNeeds = recurrence.filter((row) => row.scope === 'need' && Number(row.needs ?? 0) >= 25)
    .sort((a, b) => Number(obj(b.came_back)['90'] ?? 0) - Number(obj(a.came_back)['90'] ?? 0)).slice(0, 15);
  return <div className={styles.report}>
    <p className={styles.lede}>{zh ? '观察同一需求是否复发、哪些规律经复核成立，以及按规律推送的回测表现。' : 'Explore repeated needs, confirmed rules and the backtested push strategy.'}</p>
    <MetricGrid columns={4}><Metric label={zh ? '需求' : 'Needs'} value={count(needs.needs)} note={zh ? '同一子主题三天内合并' : 'Same subtopic merged within three days'} />
      <Metric label={zh ? '涉及用户' : 'Users'} value={count(needs.users)} /><Metric label={zh ? '规律' : 'Rules'} value={count(rules.length)} />
      <Metric label={zh ? '建议推送' : 'Suggested pushes'} value={count(candidates.pushes)} /></MetricGrid>

    <ReportPanel title={zh ? '同一需求再次出现' : 'The same need again'} description={zh ? 'Kaplan–Meier 估计：同一用户再次提出同一需求的比例。点击图例切换线条。' : 'Kaplan–Meier estimate of the same user returning with the same need. Toggle lines in the legend.'}>
      <RecurrenceFigure rows={recurrence} zh={zh} />
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '此前次数 / 需求' : 'Times before / need'}</th><th>{zh ? '需求' : 'Needs'}</th>{horizons.map((day) => <th key={day}>{day}{zh ? ' 天' : ' d'}</th>)}<th>{zh ? '规律用户' : 'Regular users'}</th></tr></thead>
        <tbody>{[...recurrence.filter((row) => row.scope === 'times_before'), ...featuredNeeds].map((row) => <tr key={name(row.key)}><td>{row.scope === 'need' ? name(row.subtopic) : `${zh ? '第' : 'After '}${name(row.times)}${zh ? '次后' : ' times'}`}</td><td>{count(row.needs)}</td>
          {horizons.map((day) => <td key={day}>{percent(obj(row.came_back)[day])}</td>)}<td>{row.scope === 'need' ? `${count(row.users_regular)} / ${count(row.users_4_or_more)}` : '—'}</td></tr>)}</tbody></table></div>
    </ReportPanel>

    <ReportPanel title={zh ? '哪些需求会复发' : 'Which needs come back'} description={zh ? '按需求量排序；表中显示 30 天复发率和常见间隔。' : 'Ordered by volume, with the 30-day return rate and typical interval.'}>
      <div className={styles.pair}><div><strong>{zh ? '30 天内复发（%）' : 'Returned within 30 days (%)'}</strong><RankedBars rows={featuredNeeds.slice(0,10).map((row)=>({label:name(row.subtopic),value:Math.round(1000*Number(obj(row.came_back)['30']??0))/10}))} zh={zh} /></div>
        <div><strong>{zh ? '90 天内复发（%）' : 'Returned within 90 days (%)'}</strong><RankedBars rows={featuredNeeds.slice(0,10).map((row)=>({label:name(row.subtopic),value:Math.round(1000*Number(obj(row.came_back)['90']??0))/10}))} zh={zh} /></div></div>
      <div className={styles.controls}><input aria-label={zh ? '搜索需求' : 'Search needs'} placeholder={zh ? '搜索需求' : 'Search needs'} value={needSearch} onChange={(event) => setNeedSearch(event.target.value)} />
        <span>{needRows.length} / {recurrence.filter((row) => row.scope === 'need').length}</span></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '需求' : 'Need'}</th><th>{zh ? '数量' : 'Needs'}</th><th>30 {zh ? '天复发' : 'day return'}</th><th>{zh ? '再次出现中位天数' : 'Median days to return'}</th><th>{zh ? '规律用户' : 'Regular users'}</th></tr></thead>
        <tbody>{(showAllNeeds ? needRows : needRows.slice(0,15)).map((row) => <tr key={name(row.key)}><td>{name(row.subtopic)}</td><td>{count(row.needs)}</td><td>{percent(obj(row.came_back)['30'])}</td>
          <td>{name(row.median_days_to_return)}</td><td>{count(row.users_regular)}</td></tr>)}</tbody></table></div>
      {needRows.length > 15 && <button className={styles.more} onClick={() => setShowAllNeeds(!showAllNeeds)}>{showAllNeeds ? (zh ? '收起' : 'Show less') : (zh ? `显示全部 ${needRows.length} 项` : `Show all ${needRows.length}`)}</button>}
    </ReportPanel>

    <ReportPanel title={zh ? '从数据中发现的规律' : 'Rules found in the data'} description={zh ? '按验证结果、规则来源筛选；展开每行查看训练与复核证据。' : 'Filter by verdict and generator; expand a row for derivation and confirmation evidence.'}>
      <div className={styles.pair}><div><strong>{zh ? '按来源：检验数量' : 'Tested by generator'}</strong><RankedBars rows={Object.entries(generatorsSummary).map(([label, values])=>({label,value:Number(obj(values).tested??0)}))} zh={zh} /></div>
        <div><strong>{zh ? '按来源：复核成立' : 'Held by generator'}</strong><RankedBars rows={Object.entries(generatorsSummary).map(([label, values])=>({label,value:Number(obj(values).held??0)}))} zh={zh} /></div></div>
      <h3 className={styles.subheading}>{zh?'复核成立的规律 · 发现期与复核期提升倍数':'Rules that held · lift when found and checked'}</h3>
      <RuleLiftFigure rules={rules} zh={zh} />
      <div className={styles.controls}><label>{zh ? '验证结果' : 'Verdict'} <select value={ruleVerdict} onChange={(event) => setRuleVerdict(event.target.value)}><option value="all">{zh ? '全部' : 'All'}</option><option value="held">{zh ? '成立' : 'Held'}</option><option value="not held">{zh ? '未成立' : 'Not held'}</option></select></label>
        <label>{zh ? '生成方式' : 'Generator'} <select value={ruleGenerator} onChange={(event) => setRuleGenerator(event.target.value)}><option value="all">{zh ? '全部' : 'All'}</option>
          {[...new Set(rules.map((row) => name(row.generator)))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <input aria-label={zh ? '搜索规律' : 'Search rules'} placeholder={zh ? '搜索条件或需求' : 'Search condition or need'} value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} />
        <span>{filteredRules.length} / {rules.length}</span></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '条件' : 'Condition'}</th><th>{zh ? '需求' : 'Need'}</th><th>{zh ? '来源' : 'Generator'}</th><th>{zh ? '复核用户' : 'Confirmed users'}</th><th>{zh ? '复核率' : 'Confirm rate'}</th><th>{zh ? '提升' : 'Lift'}</th><th>{zh ? '结果' : 'Verdict'}</th></tr></thead>
        <tbody>{(showAllRules ? filteredRules : filteredRules.slice(0,20)).map((rule,i) => { const confirm=obj(rule.confirm);const derive=obj(rule.derive);return <tr key={`${name(rule.condition)}-${i}`}><td><details><summary>{name(rule.condition)}</summary><div className={styles.ruleDetail}>
          {[[zh ? '训练' : 'Derivation',derive],[zh ? '复核' : 'Confirmation',confirm]].map(([label,values]) => { const evidence=obj(values);return <p key={String(label)}><strong>{String(label)}</strong>: {count(evidence.came)} / {count(evidence.users)} {zh ? '用户再次提出需求' : 'users returned'} · {zh ? '观察比例' : 'rate'} {percent(evidence.rate)} · {zh ? '预期' : 'expected'} {name(evidence.expected)} · {zh ? '提升' : 'lift'} {typeof evidence.lift === 'number' ? `${evidence.lift.toFixed(2)}×` : '—'}</p>; })}
        </div></details></td><td>{name(rule.need)}</td><td>{name(rule.generator)}</td><td>{count(confirm.users)}</td><td>{percent(confirm.rate)}</td><td>{typeof confirm.lift === 'number' ? `${confirm.lift.toFixed(2)}×` : '—'}</td><td>{rule.verdict === 'held' ? (zh ? '成立' : 'Held') : (zh ? '未成立' : 'Not held')}</td></tr>; })}</tbody></table></div>
      {filteredRules.length > 20 && <button className={styles.more} onClick={() => setShowAllRules(!showAllRules)}>{showAllRules ? (zh ? '收起' : 'Show less') : (zh ? `显示全部 ${filteredRules.length} 条` : `Show all ${filteredRules.length}`)}</button>}
    </ReportPanel>

    <ReportPanel title={zh ? '推送策略' : 'Push strategy'} description={zh ? '候选推送及其来源；回测数字是历史模拟，不是上线效果。' : 'Candidate pushes and origins. Backtests are historical simulations, not live results.'}>
      <MetricGrid><Metric label={zh ? '推送' : 'Pushes'} value={count(candidates.pushes)} /><Metric label={zh ? '涉及用户' : 'Users'} value={count(candidates.users)} />
        <Metric label={zh ? '预计回访' : 'Expected returns'} value={name(candidates.expected_came)} /><Metric label={zh ? '预计避免人工' : 'Expected staff saved'} value={name(candidates.expected_saved)} /></MetricGrid>
      <div className={styles.pair}><RankedBars rows={Object.entries(obj(candidates.by_generator)).map(([label,value]) => ({label,value:Number(value)}))} zh={zh} />
        <RankedBars rows={Object.entries(obj(candidates.by_door)).map(([label,value]) => ({label,value:Number(value)}))} zh={zh} /></div>
    </ReportPanel>

    <ReportPanel title={zh ? '两种排序的回测' : 'Two orders, backtested'} description={zh ? '按命中率或预期价值选择排序目标；每轮取前 50 / 200 条。' : 'Select precision or expected value as the ranking objective; compare top 50 and 200 per cutoff.'}>
      <div className={styles.controls}><label>{zh ? '排序目标' : 'Objective'} <select value={objective} onChange={(event) => setObjective(event.target.value)}><option value="rate">{zh ? '命中率' : 'Precision'}</option><option value="value">{zh ? '预期价值' : 'Expected value'}</option></select></label></div>
      <BacktestFigure backtest={backtest} zh={zh} />
      <RankedBars rows={Object.entries(obj(test.top_per_cutoff)).map(([label,value])=>({label:`top ${label}`,value:Number(obj(value).came_true??0)}))} zh={zh} />
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '范围' : 'Scope'}</th><th>{zh ? '推送' : 'Pushes'}</th><th>{zh ? '实际再来' : 'Returned'}</th><th>{zh ? '命中率' : 'Precision'}</th><th>{zh ? '预计节省' : 'Expected saved'}</th><th>{zh ? '每百次人工' : 'Human / 100'}</th></tr></thead>
        <tbody>{[['all',test.all],...Object.entries(obj(test.top_per_cutoff)).map(([key,value]) => [`top ${key}`,value])].map(([label,value]) => { const row=obj(value);return <tr key={name(label)}><td>{name(label)}</td><td>{count(row.pushes)}</td><td>{count(row.came_true)}</td><td>{percent(row.precision)}</td><td>{name(row.expected_saved)}</td><td>{name(row.human_per_100)}</td></tr>; })}</tbody></table></div>
    </ReportPanel>
    <ReportPanel title={zh ? '按规律类型（当前排序）' : 'By kind of rule, order in use'}>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '类型' : 'Kind'}</th><th>{zh ? '推送' : 'Pushes'}</th><th>{zh ? '实际再来' : 'Returned'}</th><th>{zh ? '命中率' : 'Precision'}</th><th>{zh ? '预计节省' : 'Expected saved'}</th><th>{zh ? '每百次人工' : 'Human / 100'}</th></tr></thead><tbody>
        {Object.entries(generators).map(([label, value]) => { const row = obj(value); return <tr key={label}><td>{label}</td><td>{count(row.pushes)}</td><td>{count(row.came_true)}</td><td>{percent(row.precision)}</td><td>{name(row.expected_saved)}</td><td>{name(row.human_per_100)}</td></tr>; })}
      </tbody></table></div>
    </ReportPanel>
  </div>;
}
