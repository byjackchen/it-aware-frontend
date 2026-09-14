interface Props {
    title: string;
    subtitle: string;
    slogan: string;
}

/**
 * 页头。对应原型 original-dashboard.html:174-185。
 *
 * 版面按原型还原 sticky 吸顶横幅，配色不还原 —— 原型那条蓝色渐变换成
 * IT-Aware 的主题变量，吸顶位置让开固定 TopBar（见 overview.css 的 .header）。
 *
 * 右侧原本有「本周周期」「数据更新时间」两个信息胶囊和一个字母头像，随手填
 * 内容一并删除：那三个值(2026-07-27 ~ 07-31 / 2026-08-04 09:00 / "R")都是写死的，
 * 没有任何真实来源。要恢复这一格，得先有真东西可填 —— 例如后端下发的数据
 * 生成时间。
 *
 * 同样未搬的是指向 /admin 的「后台配置」按钮：录入后台没搬，按钮点了没有去处。
 */
export async function DashboardHeader({
    title,
    subtitle,
    slogan,
}: Props) {
    return (
        <header className="header">
            <div className="header-left">
                <h1>{title}</h1>
                <div className="en">{subtitle}</div>
                <div className="slogan">{slogan}</div>
            </div>
        </header>
    );
}
