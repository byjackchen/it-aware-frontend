import { redirect } from 'next/navigation';
import { getTaskHome } from '@/lib/api/tasks';
import { landingAddress } from '@/lib/tasks/landing';

/**
 * The root address: the start page an admin set for the person, or the home
 * page.
 */
export default async function LandingPage() {
    redirect(landingAddress(await getTaskHome()));
}
