import { redirect } from 'next/navigation';

/**
 * Security index page - redirects to Users page.
 */
export default function SecurityPage() {
  redirect('/security/users');
}
