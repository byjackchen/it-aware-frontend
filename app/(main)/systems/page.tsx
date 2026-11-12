import { redirect } from 'next/navigation';
import { pageHref } from '@/lib/tasks/catalog';

/** The old Systems area opens Manage Jobs (the LLM routing pages were retired with the catalog v3). */
export default function SystemsPage() {
  redirect(pageHref('/tasks/jobs'));
}
