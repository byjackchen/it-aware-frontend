import { Lineage, Metric, MetricGrid, ReportPanel } from './ReportVisuals';
import styles from './AuditReport.module.css';

type Obj = Record<string, unknown>;
function obj(value: unknown): Obj { return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function rows(value: unknown): Obj[] { return Array.isArray(value) ? value.map(obj) : []; }
function formatted(value: unknown): string { return typeof value === 'number' ? value.toLocaleString() : value === null || value === undefined ? '—' : String(value); }
function percentage(value: unknown): string { return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'; }
function observed(item: Obj, zh: boolean): string {
  if (Array.isArray(item.values)) return item.values.map((value) => typeof value === 'number' ? percentage(value) :
    typeof value === 'boolean' ? (value ? (zh ? '相同' : 'Same') : (zh ? '变化' : 'Changed')) : formatted(value)).join(' · ');
  const values = obj(item.values);
  if (item.id === 'baseline') return Object.entries(values).map(([key, pair]) => `${key.replaceAll('_',' ')}: ${Array.isArray(pair) ? pair.map(percentage).join(' vs ') : formatted(pair)}`).join(' · ');
  if (item.id === 'reformation') return `${zh ? '组数' : 'Groups'} ${Array.isArray(values.groups) ? values.groups.map(formatted).join(' vs ') : '—'} · ${zh ? '一致性' : 'Agreement'} ${percentage(values.agreement)} · ${zh ? '共同用户' : 'Shared users'} ${formatted(values.users)}`;
  return Object.entries(values).map(([key, value]) => `${key}: ${formatted(value)}`).join(' · ') || '—';
}

export default function AuditReport({ data, zh, personaCount, gapCount }: { data: Obj; zh: boolean; personaCount: number; gapCount: number }) {
  const scope = obj(data.scope);
  const lineage = obj(scope.lineage);
  const exportCounts = obj(scope.export);
  const workload = obj(data.workload);
  const quality = obj(data.quality);
  const thresholds = obj(data.thresholds);
  const validation = obj(data.persona_validation);
  const criteria = rows(obj(validation.previous).criteria);
  const roundCounts = obj(scope.round);
  const personaModel = obj(data.persona_model);
  const checks = Object.entries(quality).map(([family,value]) => ({family, rows:Object.entries(obj(value)).map(([name,result]) => ({name,result:obj(result),threshold:obj(thresholds[family])[name]}))}));
  const stageGroups: Record<string,[string,string]> = {P00:['Prepare · P00–P03','准备 · P00–P03'],P04:['What happened · P04–P08','发生了什么 · P04–P08'],
    P09:['What was asked · P09–P14','诉求分类 · P09–P14'],P15:['Journeys and time · P15–P17','旅程与耗时 · P15–P17'],
    P18:['Gaps · P18–P21','缺口 · P18–P21'],U01:['Users and personas · U01–U05','用户与画像 · U01–U05'],
    M01:['Patterns · M01–M03','使用模式 · M01–M03'],P22:['Publish · P22–P23','发布 · P22–P23']};
  return <div className={styles.report}>
    <ReportPanel title={zh ? '研究问题' : 'Question'}><p className={styles.statement}>{zh ? '用户带着 IT 问题来到 Ohla：问题解决了吗？由谁解决？花了多久？若未解决，缺少的是知识还是执行动作？' : 'When a user brings an IT problem to Ohla: was it solved, who solved it, how long did it take, and what was missing for unsolved problems?'}</p></ReportPanel>

    <ReportPanel title={zh ? '范围' : 'Scope'} description={zh ? '报告时间与输入覆盖；下面的漏斗只计入分析产物中的对象。' : 'Report window and input coverage. The lineage below counts objects in the derived report.'}>
      <MetricGrid><Metric label={zh ? '输入互动' : 'Input interactions'} value={formatted(exportCounts.interactions)} /><Metric label={zh ? '输入工单' : 'Input tickets'} value={formatted(exportCounts.tickets)} />
        <Metric label={zh ? '分析单元' : 'Units'} value={formatted(lineage.units)} /><Metric label={zh ? '旅程' : 'Journeys'} value={formatted(lineage.journeys)} /></MetricGrid>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th></th><th>{zh ? '输入全量' : 'Inputs, all'}</th><th>{zh ? '本轮读取' : 'Read this round'}</th></tr></thead><tbody>
        <tr><td>{zh ? '机器人交互记录' : 'Chatbot interactions'}</td><td>{formatted(exportCounts.interactions)} · {formatted(exportCounts.interactions_mb)} MB</td><td>{formatted(roundCounts.segment_events)} {zh ? '条活动，组成' : 'events in'} {formatted(lineage.unit_segments)} {zh ? '个活动段' : 'segments'}</td></tr>
        <tr><td>{zh ? '工单' : 'Tickets'}</td><td>{formatted(exportCounts.tickets)} · {formatted(exportCounts.tickets_mb)} MB</td><td>{formatted(lineage.unit_tickets)}</td></tr>
        <tr><td>{zh ? '工单聊天记录' : 'Ticket chat histories'}</td><td>{formatted(exportCounts.chat_messages)} {zh ? '条消息，涉及' : 'messages in'} {formatted(exportCounts.tickets_with_chat)} {zh ? '张工单' : 'tickets'}</td><td>{formatted(roundCounts.chat_messages)} {zh ? '条消息，涉及' : 'messages in'} {formatted(roundCounts.tickets_with_chat)} {zh ? '张工单' : 'tickets'}</td></tr>
        <tr><td>{zh ? '问卷' : 'Surveys'}</td><td>{formatted(exportCounts.surveys)}</td><td>—</td></tr>
      </tbody></table></div>
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
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '阶段' : 'Stage'}</th><th>{zh ? '方法' : 'Method'}</th><th>{zh ? '本轮新跑' : 'New this round'}</th><th>{zh ? '累计任务' : 'Tasks in all'}</th><th>{zh ? '累计智能体耗时' : 'Agent time in all'}</th><th>{zh ? '本轮耗时' : 'Time this round'}</th></tr></thead>
        <tbody>{rows(workload.steps).flatMap((step) => { const id=String(step.stage_id); const group=stageGroups[id.slice(0,3)]; return [
          ...(group ? [<tr key={`${id}-group`}><th colSpan={6}>{group[zh?1:0]}</th></tr>] : []),
          <tr key={id}><td>{formatted(step.stage_id)}</td><td>{Array.isArray(step.methods) ? step.methods.join(', ') : '—'}</td><td>{step.inherited_from ? (zh ? '复用' : 'Reused') : formatted(step.ran_in)}</td><td>{formatted(step.agents)}</td><td>{typeof step.agent_seconds === 'number' ? `${formatted(step.agent_seconds)} s` : '—'}</td><td>{typeof step.seconds === 'number' ? `${formatted(step.seconds)} s` : '—'}</td></tr>]; })}</tbody></table></div>
    </ReportPanel>

    <ReportPanel title={zh ? '质量' : 'Quality'} description={zh ? '独立抽样审核的正确数与门槛；通过标记由数字计算，不依赖报告文字。' : 'Independent sample checks against gates; status is calculated from the values.'}>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '审核类别' : 'Family'}</th><th>{zh ? '检查' : 'Check'}</th><th>{zh ? '正确 / 样本' : 'Correct / N'}</th><th>{zh ? '准确率' : 'Accuracy'}</th><th>{zh ? '门槛' : 'Threshold'}</th><th>{zh ? '状态' : 'Status'}</th></tr></thead>
        <tbody>{checks.flatMap(({family,rows:familyRows}) => [<tr key={`${family}-heading`}><th colSpan={6}>{family.replaceAll('_',' ')}</th></tr>, ...familyRows.map(({name,result,threshold}) => { const correct=Number(result.correct ?? 0);const n=Number(result.n ?? 0);const rate=n ? correct/n : null;const target=typeof threshold==='number'?threshold:null;return <tr key={`${family}-${name}`}><td></td><td>{name.replaceAll('_',' ')}</td><td>{formatted(result.correct)} / {formatted(result.n)}</td><td>{percentage(rate)}</td><td>{percentage(target)}</td><td className={rate !== null && target !== null && rate >= target ? styles.pass : styles.fail}>{rate === null || target === null ? '—' : rate >= target ? (zh ? '通过' : 'Pass') : (zh ? '未通过' : 'Fail')}</td></tr>; })])}</tbody></table></div>
    </ReportPanel>

    <ReportPanel title={zh ? '画像模型检验' : 'Persona model checks'}>
      <MetricGrid><Metric label={zh ? '规则还原度' : 'Rule fidelity'} value={percentage(personaModel.tree_fidelity)} /><Metric label={zh ? '稳定性（调整兰德指数）' : 'Stability (ARI)'} value={formatted(personaModel.stability_ari)} /></MetricGrid>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh ? '检验' : 'Criterion'}</th><th>{zh ? '判定' : 'Verdict'}</th><th>{zh ? '门槛' : 'Threshold'}</th><th>{zh ? '观测值' : 'Observed'}</th></tr></thead>
        <tbody>{criteria.map((item) => <tr key={String(item.id)}><td>{formatted(item.statement)}</td><td className={item.verdict === 'pass' ? styles.pass : styles.fail}>{item.verdict === 'pass' ? (zh ? '通过' : 'Pass') : (zh ? '未通过' : 'Fail')}</td><td>{formatted(item.threshold)}</td><td>{observed(item, zh)}</td></tr>)}</tbody></table></div>
    </ReportPanel>

    <ReportPanel title={zh ? '解释边界' : 'Limits'}><ol className={styles.limits}>{(Array.isArray(data.limits) ? data.limits : []).map((item,i) => <li key={i}>{String(item)}</li>)}</ol></ReportPanel>
  </div>;
}
