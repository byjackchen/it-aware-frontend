import { redirect } from 'next/navigation';
import { getTaskHome } from '@/lib/api/tasks';
import { landingAddress } from '@/lib/tasks/landing';

/**
 * The root address: the start page an admin set for the person, or the home
 * page. While the backend's tasks switch is off, the landing page of before.
 */
export default async function LandingPage() {
    redirect(landingAddress(await getTaskHome()));
}
