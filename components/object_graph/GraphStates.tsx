'use client';

interface GraphLoadingStateProps {
    isLight: boolean;
}

export function GraphLoadingState({ isLight }: GraphLoadingStateProps) {
    return (
        <div className={`h-[400px] flex items-center justify-center text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Loading graph…
        </div>
    );
}

interface GraphErrorStateProps {
    isLight: boolean;
    message: string;
}

export function GraphErrorState({ isLight, message }: GraphErrorStateProps) {
    return (
        <div className="h-[400px] flex flex-col items-center justify-center gap-3">
            <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-400'}`}>{message}</p>
        </div>
    );
}

interface GraphEmptyStateProps {
    isLight: boolean;
}

export function GraphEmptyState({ isLight }: GraphEmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
            <p className="text-sm">No relationships found</p>
        </div>
    );
}
