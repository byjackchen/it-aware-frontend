import { getInquiries } from '@/lib/api/objects';
import { InquiriesListPage } from './InquiriesListPage';

export default async function InquiriesPage() {
    const inquiries = await getInquiries();

    return <InquiriesListPage inquiries={inquiries} />;
}
