'use client';

import { useTranslations } from 'next-intl';
import type { DomainView, MetricView } from '@/lib/itopsdashboard/dashboard';
import { formatValue, statusClass } from '@/lib/itopsdashboard/domain/format';
import { metricDetailHref } from '@/lib/itopsdashboard/routes';
import { StatusBadge } from './StatusBadge';
import { StatusRing } from './StatusRing';

/**
 * 一张领域卡。版面按 oitops 线上版 1:1（几何规格见
 * docs/itops-overview-original-layout-spec.md），配色走 IT-Aware 主题变量。
 *
 * 三段：运营目标状态 / 核心指标（职场稳定性用办公室网格代替）/ 关键项目。
 * 指标行只有真上线的才是链接，其余是静态 div —— 给点不进去的东西加 hover
 * 等于骗人。
 */
export function ModuleCard({ domain }: { domain: DomainView }) {
    const t = useTranslations('ItopsOverview');
    const { tally } = domain;

    return (
        <article className="module">
            <div className="module-header">
                <div className={`module-icon tone-${domain.tone}`} aria-hidden="true" />
                <div className="module-title">{domain.nameZh}</div>
            </div>

            <div className="module-status-section">
                <div className="status-section-title">{t('module.goalStatus')}</div>
                <div className="status-section-body">
                    <StatusRing tally={tally} />
                    <div className="status-section-text">
                        <div className="status-main-row">
                            <StatusBadge status={tally.overall} />
                            <div className="status-logic-line">
                                <b className="logic-g">{t('module.green', { n: tally.green })}</b>
                                <span>·</span>
                                <b className="logic-y">{t('module.yellow', { n: tally.yellow })}</b>
                                <span>·</span>
                                <b className="logic-r">{t('module.red', { n: tally.red })}</b>
                                {tally.pending > 0 && (
                                    <>
                                        <span>·</span>
                                        <b className="logic-n">{t('module.pending', { n: tally.pending })}</b>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="module-subtitle">{domain.description}</div>
                    </div>
                </div>
            </div>

            <div className="divider" />

            {domain.officeSummary ? <OfficeBlock domain={domain} /> : <MetricsBlock domain={domain} />}

            <div className="projects">
                <div className="projects-head">
                    <div className="projects-title">{t('projects.title')}</div>
                </div>
                {domain.projects.length === 0 ? (
                    <div className="block-empty">{t('projects.none')}</div>
                ) : (
                    <>
                        <div className="project-head">
                            <div>{t('projects.name')}</div>
                            <div>{t('projects.status')}</div>
                            <div>{t('projects.progress')}</div>
                        </div>
                        {domain.projects.map((p) => (
                            <div className="project-row" key={p.name}>
                                <div className="project-name" title={p.name}>{p.name}</div>
                                <div className="project-status">{p.status}</div>
                                <div className="project-progress">
                                    {p.progressPct}%
                                    <div className="mini-progress">
                                        <i style={{ width: `${p.progressPct}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </article>
    );
}

function MetricsBlock({ domain }: { domain: DomainView }) {
    const t = useTranslations('ItopsOverview');

    return (
        <div className="metrics">
            <div className="metrics-title">{t('module.coreMetrics')}</div>
            <div className="metric-head">
                <div />
                <div>{t('module.current')}</div>
                <div>{t('module.target')}</div>
                <div>{t('module.status')}</div>
            </div>
            {domain.groups.map((g, gi) => (
                <div key={g.label ?? gi}>
                    {g.label && <div className="group-title">{g.label}</div>}
                    {g.metrics.map((m) => (
                        <MetricRow key={m.code} metric={m} />
                    ))}
                </div>
            ))}
        </div>
    );
}

function MetricRowBody({ metric }: { metric: MetricView }) {
    return (
        <>
            <div className="metric-name" title={metric.name}>{metric.name}</div>
            <div className="metric-value">{formatValue(metric.definition, metric.value)}</div>
            <div className="metric-target">{metric.targetLabel}</div>
            <i className={`dot ${statusClass(metric.status)}`} />
        </>
    );
}

function MetricRow({ metric }: { metric: MetricView }) {
    const href = metricDetailHref(metric.code);
    if (!href) {
        return (
            <div className="metric-row">
                <MetricRowBody metric={metric} />
            </div>
        );
    }
    return (
        <a className="metric-row" href={href} target="_blank" rel="noopener noreferrer">
            <MetricRowBody metric={metric} />
        </a>
    );
}

function OfficeBlock({ domain }: { domain: DomainView }) {
    const t = useTranslations('ItopsOverview');
    const s = domain.officeSummary!;

    return (
        <div className="workplace-metrics">
            <div className="metrics-title">{t('module.coreOffices')}</div>
            <div className="office-overall">
                <div className="metric-name">{t('office.healthy')}</div>
                <div className="metric-value">
                    {/* healthy 为 null 是"未接入"，不是 0 —— 显示 — 而非 0 / 9 */}
                    {s.healthy === null ? '—' : `${s.healthy} / ${s.total}`}
                </div>
                <div className="office-target">{s.targetLabel}</div>
                <i className="dot n" />
            </div>

            {domain.officeRegions.map((r) => (
                <div className="office-region" key={r.region}>
                    <div className="region-name">{r.region}</div>
                    {r.offices.map((o) => (
                        <div className="office-cell" key={o.code}>
                            <span>{o.name}</span>
                            <i className={`dot ${statusClass(o.status ?? 'PENDING')}`} />
                        </div>
                    ))}
                </div>
            ))}

            <div className="office-rule-note">{t('office.note')}</div>
        </div>
    );
}
