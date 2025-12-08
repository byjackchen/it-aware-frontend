/**
 * Empty state component when no item is selected.
 * Server Component - pure display.
 */

import { MousePointerClick } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = 'Select an item from the list to view details' }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <MousePointerClick className="w-8 h-8 text-gray-500" />
      </div>
      <p className="text-gray-500">{message}</p>
    </div>
  );
}
