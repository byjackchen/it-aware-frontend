/**
 * Prompts management — Server Component.
 *
 * Prompts are reusable role/persona instruction bundles. Agents are generic;
 * their behaviour comes from the prompts attached to them, injected via the
 * agent API at dispatch. A "skill" is just one kind of prompt.
 */
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getPrompts } from '@/lib/api/objects';
import { PromptsManagementPage } from './PromptsManagementPage';

export default async function PromptsPage() {
    const list = await getPrompts({ limit: 200 }).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        return { items: [], total: 0, skip: 0, limit: 200 };
    });
    return <PromptsManagementPage initialPrompts={list.items} />;
}
