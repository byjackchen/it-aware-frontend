/**
 * Data module base page - redirects to organizations.
 */

import { redirect } from 'next/navigation';

export default function DataPage() {
    redirect('/data/organizations');
}
