import { redirect } from 'next/navigation';

/** The root address: everyone lands on the home page. */
export default function LandingPage() {
    redirect('/home');
}
