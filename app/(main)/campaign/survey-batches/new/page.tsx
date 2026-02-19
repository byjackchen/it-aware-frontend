import { SurveyAccessGate, SurveyCreateWizard } from '@/components/campaign_surveys';

export default function CampaignSurveyCreatePage() {
    return (
        <SurveyAccessGate requireWrite>
            <SurveyCreateWizard />
        </SurveyAccessGate>
    );
}
