import { Lineage, Metric, MetricGrid, ReportPanel } from './ReportVisuals';
import styles from './AuditReport.module.css';

type Obj = Record<string, unknown>;
function obj(value: unknown): Obj { return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function rows(value: unknown): Obj[] { return Array.isArray(value) ? value.map(obj) : []; }
function formatted(value: unknown): string { return typeof value === 'number' ? value.toLocaleString() : value === null || value === undefined ? '—' : String(value); }
function percentage(value: unknown): string { return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'; }

export default function AuditReport({ data, zh, personaCount, gapCount }: { data: Obj; zh: boolean; personaCount: number; gapCount: number }) {
  const scope = obj(data.scope);
  const lineage = obj(scope.lineage);
  const exportCounts = obj(scope.export);
  const workload = obj(data.workload);
  const quality = obj(data.quality);
  const thresholds = obj(data.thresholds);
  const validation = obj(data.persona_validation);
  const criteria = rows(obj(validation.previous).criteria);
  const checks = Object.entries(quality).flatMap(([family,value]) => Object.entries(obj(value)).map(([name,result]) => ({family,name,result:obj(result),threshold:obj(thresholds[family])[name]})));
  return <div className={styles.report}>
    <ReportPanel title={zh ? '研究问题' : 'Question'}><p className={styles.statement}>{zh ? '用户带着 IT 问题来到 Ohla：问题解决了吗？由谁解决？花了多久？若未解决，缺少的是知识还是执行动作？' : 'When a user brings an IT problem to Ohla: was it solved, who solved it, how long did it take, and what was missing for unsolved problems?'}</p></ReportPanel>

    <ReportPanel title={zh ? '范围' : 'Scope'} description={zh ? '报告时间与输入覆盖；下面的漏斗只计入分析产物中的对象。' : 'Report window and input coverage. The lineage below counts objects in the derived report.'}>
      <MetricGrid><Metric label={zh ? '输入互动' : 'Input interactions'} value={formatted(exportCounts.interactions)} /><Metric label={zh ? '输入工单' : 'Input tickets'} value={formatted(exportCounts.tickets)} />
        <Metric label={zh ? '分析单元' : 'Units'} value={formatted(lineage.units)} /><Metric label={zh ? '旅程' : 'Journeys'} value={formatted(lineage.journeys)} /></MetricGrid>
      <div className={styles.lineage}><Lineage scope={scope} zh={zh} personaCount={personaCount} /></div>
      <p className={styles.note}>{zh ? '时间窗口' : 'Window'}: {Array.isArray(scope.window) ? scope.window.map(String).join(' → ') : '—'} · {zh ? '旅程关联窗口' : 'Journey link window'}: {formatted(scope.journey_window_days)} {zh ? '天' : 'days'}</p>
    </ReportPanel>

    <ReportPanel title={zh ? '数据结构' : 'Data structures'} description={zh ? '从输入到画像的对象关系；每一层都由上一层构成。' : 'Objects from input to persona; each level is built from the one above it.'}>
      <div className={styles.structure}>{[
        [zh ? '活动段' : 'Segments',lineage.segments,zh ? '源活动段' : 'source segment',zh ? '机器人互动的活动片段' : 'Bot activity segments'],
        [zh ? '单元' : 'Units',lineage.units,'unit_id',zh ? '有操作的活动段或工单' : 'An active segment or a ticket'],
        [zh ? '诉求' : 'Requests',lineage.requests,'request_id',zh ? '用户提出的一项具体需求' : 'One thing the user asked for'],
        [zh ? '旅程' : 'Journeys',lineage.journeys,'journey_id',zh ? '一个用户跨单元的一项问题' : 'One problem of one user across units'],
        [zh ? '缺口项' : 'Gap items',gapCount,'gap_id',zh ? '一项可修复的知识或执行缺口' : 'One fixable knowledge or action gap'],
        [zh ? '用户' : 'Users',lineage.users,'user_id',zh ? '有旅程的自然人' : 'A person with a journey'],
        [zh ? '画像' : 'Personas',personaCount,'persona_id',zh ? '求助习惯相近的一组用户' : 'Users with similar support habits'],
      ].map(([label,value,id,description]) => <div key={String(label)}><span>{String(label)}</span><strong>{formatted(value)}</strong><small>{String(description)}</small><code>{String(id)}</code></div>)}</div>
    </ReportPanel>

    <ReportPanel title={zh ? '方法' : 'Method'} description={zh ? '本版本的阶段记录。继承表示该阶段复用上一轮的冻结结果。' : 'Stage record for this version. Inherited stages reuse a frozen result from an earlier round.'}>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '阶段' : 'Stage'}</th><th>{zh ? '方法' : 'Method'}</th><th>{zh ? '复用来源' : 'Inherited from'}</th><th>{zh ? 'Agent 任务' : 'Agent tasks'}</th><th>{zh ? '耗时' : 'Time'}</th></tr></thead>
        <tbody>{rows(workload.steps).map((step) => <tr key={String(step.stage_id)}><td>{formatted(step.stage_id)}</td><td>{Array.isArray(step.methods) ? step.methods.join(', ') : '—'}</td><td>{formatted(step.inherited_from)}</td><td>{formatted(step.agents)}</td><td>{typeof step.seconds === 'number' ? `${formatted(step.seconds)} s` : '—'}</td></tr>)}</tbody></table></div>
    </ReportPanel>

    <ReportPanel title={zh ? '质量' : 'Quality'} description={zh ? '独立抽样审核的正确数与门槛；通过标记由数字计算，不依赖报告文字。' : 'Independent sample checks against gates; status is calculated from the values.'}>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '审核类别' : 'Family'}</th><th>{zh ? '检查' : 'Check'}</th><th>{zh ? '正确 / 样本' : 'Correct / N'}</th><th>{zh ? '准确率' : 'Accuracy'}</th><th>{zh ? '门槛' : 'Threshold'}</th><th>{zh ? '状态' : 'Status'}</th></tr></thead>
        <tbody>{checks.map(({family,name,result,threshold}) => { const correct=Number(result.correct ?? 0);const n=Number(result.n ?? 0);const rate=n ? correct/n : null;const target=typeof threshold==='number'?threshold:null;return <tr key={`${family}-${name}`}><td>{family.replaceAll('_',' ')}</td><td>{name.replaceAll('_',' ')}</td><td>{formatted(result.correct)} / {formatted(result.n)}</td><td>{percentage(rate)}</td><td>{percentage(target)}</td><td className={rate !== null && target !== null && rate >= target ? styles.pass : styles.fail}>{rate === null || target === null ? '—' : rate >= target ? (zh ? '通过' : 'Pass') : (zh ? '未通过' : 'Fail')}</td></tr>; })}</tbody></table></div>
    </ReportPanel>

    <ReportPanel title={zh ? '画像模型检验' : 'Persona model checks'}>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '检验' : 'Criterion'}</th><th>{zh ? '判定' : 'Verdict'}</th><th>{zh ? '门槛' : 'Threshold'}</th><th>{zh ? '观测值' : 'Observed'}</th></tr></thead>
        <tbody>{criteria.map((item) => <tr key={String(item.id)}><td>{formatted(item.statement)}</td><td className={item.verdict === 'pass' ? styles.pass : styles.fail}>{item.verdict === 'pass' ? (zh ? '通过' : 'Pass') : (zh ? '未通过' : 'Fail')}</td><td>{formatted(item.threshold)}</td><td>{Array.isArray(item.values) ? item.values.map((value) => typeof value === 'number' ? percentage(value) : String(value)).join(' · ') : JSON.stringify(item.values ?? {})}</td></tr>)}</tbody></table></div>
    </ReportPanel>

    <ReportPanel title={zh ? '解释边界' : 'Limits'}><ol className={styles.limits}>{(Array.isArray(data.limits) ? data.limits : []).map((item,i) => <li key={i}>{String(item)}</li>)}</ol></ReportPanel>
  </div>;
}
