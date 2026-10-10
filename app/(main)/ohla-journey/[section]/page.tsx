import { notFound } from 'next/navigation';
import JourneyDashboard from '../JourneyDashboard';

const SECTIONS = ['headline', 'resolution', 'gaps', 'journey', 'timeline', 'persona', 'patterns', 'audit'] as const;

export default async function JourneySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as (typeof SECTIONS)[number])) notFound();
  return <JourneyDashboard section={section as (typeof SECTIONS)[number]} />;
}
