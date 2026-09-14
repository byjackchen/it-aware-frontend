import type { StatusTally } from '@/lib/itopsdashboard/dashboard';

/**
 * 卡片左上角那个环。对应线上版 `.status-ring`（58×58，::before 用 conic-gradient
 * 画环）—— 这里改成内联 conic-gradient，因为各段角度要按红黄绿计数实时算，
 * 写死在 CSS 里就做不到。
 *
 * 全部待接入时画成一整圈中性色，而不是空环：空环看着像加载失败。
 */
export function StatusRing({ tally }: { tally: StatusTally }) {
    const { green, yellow, red, total } = tally;
    const seg = (n: number) => (total > 0 ? (n / total) * 360 : 0);

    const g = seg(green);
    const y = seg(yellow);
    const r = seg(red);
    const known = g + y + r;

    const stops = known > 0
        ? [
              `var(--oit-green) 0deg ${g}deg`,
              `var(--oit-amber) ${g}deg ${g + y}deg`,
              `var(--oit-red) ${g + y}deg ${g + y + r}deg`,
              `var(--oit-neutral-bg) ${known}deg 360deg`,
          ].join(', ')
        : `var(--oit-neutral-bg) 0deg 360deg`;

    return (
        <div className="status-ring" style={{ background: `conic-gradient(${stops})` }} aria-hidden="true">
            <span className="status-ring-hole" />
        </div>
    );
}
