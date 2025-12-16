import { redirect } from 'next/navigation';

/**
 * Security index page - redirects to Permissions page.
 */
export default function SecurityPage() {
  redirect('/security/permissions');
}

