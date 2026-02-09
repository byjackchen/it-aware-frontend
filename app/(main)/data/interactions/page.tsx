import { getAllInteractions } from '@/lib/api/objects';
import { InteractionsListPage } from './InteractionsListPage';

export default async function InteractionsPage() {
    const interactions = await getAllInteractions({
        sort_by: 'created_at',
        order: 'desc',
    });

    return <InteractionsListPage interactions={interactions} />;
}
