'use client';

import { useEffect, useRef } from 'react';

interface InfiniteLoadTriggerProps {
    disabled?: boolean;
    onVisible: () => void;
    rootMargin?: string;
}

export function InfiniteLoadTrigger({
    disabled = false,
    onVisible,
    rootMargin = '220px 0px',
}: InfiniteLoadTriggerProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = ref.current;
        if (!node || disabled) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    onVisible();
                }
            },
            { root: null, rootMargin, threshold: 0 }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [disabled, onVisible, rootMargin]);

    return <div ref={ref} className="h-1 w-full" aria-hidden="true" />;
}
