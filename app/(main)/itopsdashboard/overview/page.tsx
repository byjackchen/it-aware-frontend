import './overview.css';

import { getItopsOverview } from '@/lib/api/itopsdashboard';
import { DashboardHeader } from '@/components/itopsdashboard/DashboardHeader';
import { ModuleCard } from '@/components/itopsdashboard/ModuleCard';

/**
 * 数据按周更新，但 SLA 是按调用者 ABAC 范围实时算的 —— 两个账号看到的内容不同，
 * 因此不能静态化。
 */
export const dynamic = 'force-dynamic';

/**
 * 样式作用域容器。
 *
 * overview.css 每条选择器都以 .itops-overview-root 开头：原样式用的是
 * .header / .module / .metrics 这类极通用类名，不收作用域会污染 Tailwind 层
 * 和其它页面。
 */
export default async function ItopsOverviewPage() {
    const data = await getItopsOverview();

    return (
        <div className="itops-overview-root">
            <DashboardHeader
                title={data.config.title}
                subtitle={data.config.subtitle}
                slogan={data.config.slogan}
            />
            <div className="dashboard">
                {data.domains.map((d) => (
                    <ModuleCard key={d.code} domain={d} />
                ))}
            </div>
            <div className="footer-note">
                <span>{data.config.footerNote}</span>
                <span>{data.config.footerSources}</span>
            </div>
        </div>
    );
}
