/**
 * 总览页的视图装配 —— 同时是 wire 格式与视图格式之间唯一的边界。
 *
 * 后端出 **snake_case**（与全后端一致），组件消费 **camelCase**（与前端其余部分
 * 一致）。两者的映射只发生在本文件的 `assembleDashboard` 里，且两边都有类型：
 * 任何一侧改字段名都会变成编译错误，不会静默漂移。
 *
 * 状态判定刻意留在前端：`resolveStatus` 与它编码的阈值规则是这个看板的核心，
 * 带着 400+ 行测试，在 Python 里再抄一份必然漂移。所以接口只出 `value` +
 * `definition`，规则只存在于一种语言里。
 */

import { resolveStatus } from './domain/status';
import type { MetricDefinition, MetricStatus, MetricThresholds } from './domain/types';

// ── wire 类型（后端 snake_case 原样）──────────────────────────────────────

interface WireDefinition {
    code: string;
    unit: string;
    direction: string;
    decimals: number;
    scale_max: number | null;
    baseline: number | null;
    target: number | null;
    /** 内容文件里的原样透传对象，键名不受后端命名风格影响。 */
    thresholds: MetricThresholds | null;
    manual_status: MetricStatus | null;
    rule_confirmed: boolean;
}

interface WireCumulative {
    pct: number;
    total: number;
    year: number;
}

interface WireMetric {
    code: string;
    name: string;
    short_desc: string | null;
    definition: WireDefinition;
    /** 只可能来自真实数据源；内容文件里没有任何数值。算不出来就是 null。 */
    value: number | null;
    target_label: string | null;
    cumulative?: WireCumulative | null;
}

interface WireGroup {
    label: string | null;
    metrics: WireMetric[];
}

interface WireOffice {
    code: string;
    name: string;
    status: MetricStatus | null;
}

interface WireDomain {
    code: string;
    name_zh: string;
    name_en: string;
    icon: string;
    tone: string;
    description: string;
    groups: WireGroup[];
    office_regions: { region: string; offices: WireOffice[] }[];
    office_summary: { healthy: number | null; total: number; target_label: string | null } | null;
    projects: { name: string; status: string; progress_pct: number }[];
}

export interface ApiDashboard {
    config: {
        title: string;
        subtitle: string;
        slogan: string;
        footer_note: string;
        footer_sources: string;
    };
    domains: WireDomain[];
}

// ── 视图类型（组件消费的）─────────────────────────────────────────────────

export interface DashboardConfig {
    title: string;
    subtitle: string;
    slogan: string;
    footerNote: string;
    footerSources: string;
}

export interface MetricCumulative {
    pct: number;
    total: number;
    year: number;
}

export interface MetricView {
    code: string;
    name: string;
    shortDesc: string | null;
    definition: MetricDefinition;
    value: number | null;
    targetLabel: string | null;
    cumulative: MetricCumulative | null;
    status: MetricStatus;
}

export interface MetricGroupView {
    label: string | null;
    metrics: MetricView[];
}

export interface OfficeView {
    code: string;
    name: string;
    status: MetricStatus | null;
}

export interface OfficeRegionView {
    region: string;
    offices: OfficeView[];
}

export interface OfficeSummaryView {
    /** null 表示未接入，**不是 0**。 */
    healthy: number | null;
    total: number;
    targetLabel: string | null;
}

export interface ProjectView {
    name: string;
    status: string;
    progressPct: number;
}

/** 一张卡的状态摘要：环形图与「1绿·5黄·0红」那行都用它。 */
export interface StatusTally {
    green: number;
    yellow: number;
    red: number;
    pending: number;
    total: number;
    overall: MetricStatus;
}

export interface DomainView {
    code: string;
    nameZh: string;
    nameEn: string;
    icon: string;
    tone: string;
    description: string;
    groups: MetricGroupView[];
    officeRegions: OfficeRegionView[];
    officeSummary: OfficeSummaryView | null;
    projects: ProjectView[];
    tally: StatusTally;
}

export interface DashboardData {
    config: DashboardConfig;
    domains: DomainView[];
}

// ── 映射 + 状态解析 ───────────────────────────────────────────────────────

function toDefinition(d: WireDefinition): MetricDefinition {
    return {
        code: d.code,
        unit: d.unit as MetricDefinition['unit'],
        direction: d.direction as MetricDefinition['direction'],
        decimals: d.decimals,
        scaleMax: d.scale_max,
        baseline: d.baseline,
        target: d.target,
        thresholds: d.thresholds,
        manualStatus: d.manual_status,
        ruleConfirmed: d.rule_confirmed,
    };
}

function toMetric(m: WireMetric): MetricView {
    const definition = toDefinition(m.definition);
    return {
        code: m.code,
        name: m.name,
        shortDesc: m.short_desc,
        definition,
        value: m.value,
        targetLabel: m.target_label,
        cumulative: m.cumulative ?? null,
        status: resolveStatus(definition, m.value),
    };
}

/**
 * 一张卡的整体状态取其指标里最差的那个；全部待接入就仍是待接入。
 *
 * 线上原版把这个状态写死在数据里，于是它可能和正下方列出的指标自相矛盾。
 * 这里是算出来的，不会。
 */
function aggregate(list: MetricStatus[]): MetricStatus {
    if (list.some((s) => s === 'RED')) return 'RED';
    if (list.some((s) => s === 'YELLOW')) return 'YELLOW';
    if (list.some((s) => s === 'GREEN')) return 'GREEN';
    return 'PENDING';
}

function tally(list: MetricStatus[]): StatusTally {
    const n = (s: MetricStatus) => list.filter((x) => x === s).length;
    return {
        green: n('GREEN'), yellow: n('YELLOW'), red: n('RED'), pending: n('PENDING'),
        total: list.length, overall: aggregate(list),
    };
}

/** 解析出 payload 里的每一个状态。纯函数，两侧都能跑。 */
export function assembleDashboard(api: ApiDashboard): DashboardData {
    return {
        config: {
            title: api.config.title,
            subtitle: api.config.subtitle,
            slogan: api.config.slogan,
            footerNote: api.config.footer_note,
            footerSources: api.config.footer_sources,
        },
        domains: api.domains.map((d) => {
            const groups = d.groups.map((g) => ({ label: g.label, metrics: g.metrics.map(toMetric) }));
            const officeRegions = d.office_regions.map((r) => ({
                region: r.region,
                offices: r.offices.map((o) => ({ code: o.code, name: o.name, status: o.status })),
            }));
            const statuses = groups.flatMap((g) => g.metrics.map((m) => m.status));
            // 职场稳定性没有指标行，状态由办公室决定；办公室目前全是待接入。
            const officeStatuses = officeRegions.flatMap((r) =>
                r.offices.map((o) => o.status ?? ('PENDING' as MetricStatus)),
            );
            return {
                code: d.code, nameZh: d.name_zh, nameEn: d.name_en,
                icon: d.icon, tone: d.tone, description: d.description,
                groups,
                officeRegions,
                officeSummary: d.office_summary
                    ? {
                          healthy: d.office_summary.healthy,
                          total: d.office_summary.total,
                          targetLabel: d.office_summary.target_label,
                      }
                    : null,
                projects: d.projects.map((p) => ({
                    name: p.name, status: p.status, progressPct: p.progress_pct,
                })),
                tally: tally([...statuses, ...officeStatuses]),
            };
        }),
    };
}
