'use client';

/**
 * Top-of-page progress bar. Becomes visible when NavigationProvider's isPending
 * is true (route transition in flight) and animates a determinate ramp toward
 * 90%, then snaps to 100% and fades out when the transition resolves.
 *
 * The bar always renders 2px tall, fixed at the top, above all app chrome
 * (z-index 100). It does not depend on any third-party library.
 */

import { useEffect, useState } from 'react';
import { useNavigation } from './NavigationProvider';

const RAMP: ReadonlyArray<{ at: number; pct: number }> = [
    { at: 0, pct: 8 },
    { at: 90, pct: 30 },
    { at: 350, pct: 60 },
    { at: 900, pct: 80 },
    { at: 2000, pct: 90 },
];

export function RouteProgressBar() {
    const { isPending } = useNavigation();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isPending) {
            setVisible(true);
            const timers: ReturnType<typeof setTimeout>[] = [];
            for (const { at, pct } of RAMP) {
                timers.push(setTimeout(() => setProgress(pct), at));
            }
            return () => timers.forEach(clearTimeout);
        }

        // transition finished — snap to 100, then hide
        if (visible) {
            setProgress(100);
            const hide = setTimeout(() => {
                setVisible(false);
                setProgress(0);
            }, 220);
            return () => clearTimeout(hide);
        }
    }, [isPending, visible]);

    if (!visible) return null;

    return (
        <div
            aria-hidden
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="fixed top-0 left-0 right-0 z-[100] pointer-events-none"
            style={{ height: 2 }}
        >
            <div
                className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]"
                style={{
                    width: `${progress}%`,
                    transition: 'width 220ms ease-out, opacity 220ms linear',
                    opacity: progress >= 100 ? 0 : 1,
                }}
            />
        </div>
    );
}
