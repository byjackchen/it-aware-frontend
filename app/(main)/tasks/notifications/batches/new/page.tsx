import { CampaignAccessGate, NotificationCreateWizard } from '@/components/campaign_notifications';

export default function CampaignNotificationCreatePage() {
    return (
        <CampaignAccessGate requireWrite>
            <NotificationCreateWizard />
        </CampaignAccessGate>
    );
}
