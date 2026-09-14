/**
 * 指标 -> 详情页地址；没有详情页就返回 null。
 *
 * **只有真正上线的详情页才允许出现在这里。** 没上线的指标不给链接、不做跳转、
 * 也不弹抽屉 —— 让一个指标看起来"点得进去"，然后跳到一个没有内容的壳，
 * 本身就是一种假逻辑。它们在页面上就是静态展示，等有了数据和页面再接。
 *
 * 目前只有 SLA 一族有：/itopsdashboard/service-experience 有真实的月度报表。
 */
const DEDICATED: Record<string, string> = {
    sla: '/itopsdashboard/service-experience',
    overall_sla: '/itopsdashboard/service-experience',
    response_sla: '/itopsdashboard/service-experience',
};

export function metricDetailHref(code: string): string | null {
    return DEDICATED[code] ?? null;
}
