'use client';

/**
 * Permission create form.
 * Client Component - handles form state and submission.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, Loader2 } from 'lucide-react';
import { createPermission } from '../actions';

export function PermissionForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [description, setDescription] = useState('');

  // Generate preview of permission code
  const previewCode = [domain, resource, action].filter(Boolean).join(':') || 'domain:resource:action';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('domain', domain);
    formData.set('resource', resource);
    formData.set('action', action);
    formData.set('description', description);

    startTransition(async () => {
      const result = await createPermission(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleCancel = () => {
    router.push('/security/permissions');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Create Permission</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={isPending || !domain || !resource || !action}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Permission Code Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Permission Code (Preview)</label>
            <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 font-mono text-sm">
              {previewCode}
            </div>
            <p className="mt-1 text-xs text-gray-500">Auto-generated from domain:resource:action</p>
          </div>

          {/* Domain, Resource, Action */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Domain <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g., auth"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Resource <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g., users"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Action <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g., read"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Enter description..."
            />
          </div>
        </div>
      </form>
    </div>
  );
}
