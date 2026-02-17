'use client';

interface TimelineInitialLoadingStateProps {
    isLight: boolean;
    message: string;
}

export function TimelineInitialLoadingState({ isLight, message }: TimelineInitialLoadingStateProps) {
    return (
        <div className={`h-[430px] flex items-center justify-center text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {message}
        </div>
    );
}

interface TimelineErrorStateProps {
    isLight: boolean;
    message: string;
    retryLabel: string;
    onRetry: () => void;
}

export function TimelineErrorState({ isLight, message, retryLabel, onRetry }: TimelineErrorStateProps) {
    return (
        <div className="h-[430px] flex flex-col items-center justify-center gap-3">
            <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-400'}`}>{message}</p>
            <button
                onClick={onRetry}
                className={`px-3 py-1.5 rounded-md text-sm ${isLight ? 'bg-slate-200 text-slate-800 hover:bg-slate-300' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
            >
                {retryLabel}
            </button>
        </div>
    );
}

interface TimelineEmptyOverlayProps {
    isLight: boolean;
    message: string;
}

export function TimelineEmptyOverlay({ isLight, message }: TimelineEmptyOverlayProps) {
    return (
        <div
            className={`
                pointer-events-none absolute inset-0 flex items-center justify-center text-sm
                ${isLight ? 'text-slate-500' : 'text-slate-400'}
            `}
        >
            {message}
        </div>
    );
}

interface TimelineBackgroundLoadingBadgeProps {
    isLight: boolean;
    message: string;
}

export function TimelineBackgroundLoadingBadge({ isLight, message }: TimelineBackgroundLoadingBadgeProps) {
    return (
        <div
            className={`
                pointer-events-none absolute right-4 top-3 rounded-md border px-2 py-1 text-[11px]
                ${isLight
                    ? 'border-blue-200 bg-blue-50/95 text-blue-700'
                    : 'border-blue-900/80 bg-blue-950/80 text-blue-300'}
            `}
        >
            {message}
        </div>
    );
}

interface TimelineNonBlockingErrorBadgeProps {
    isLight: boolean;
    message: string;
}

export function TimelineNonBlockingErrorBadge({ isLight, message }: TimelineNonBlockingErrorBadgeProps) {
    return (
        <div
            className={`
                pointer-events-none absolute right-4 top-11 rounded-md border px-2 py-1 text-[11px]
                ${isLight
                    ? 'border-red-200 bg-red-50/95 text-red-700'
                    : 'border-red-900/80 bg-red-950/80 text-red-300'}
            `}
        >
            {message}
        </div>
    );
}
