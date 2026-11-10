import { getAgentEndpoints } from '@/lib/config/agent-access';
import cliManifest from '@/public/downloads/it-aware-cli.json';
import { AgentAccessClient, type CliManifest } from './AgentAccessClient';

export default function SystemsAgentAccessPage() {
    return <AgentAccessClient endpoints={getAgentEndpoints()} cli={cliManifest as CliManifest} />;
}
