/**
 * Endpoints an agent host dials to reach IT-Aware, per deployment environment.
 *
 * These are the addresses reachable from agent workspaces (DevCloud, Knot),
 * not the in-cluster BACKEND_DOMAIN the frontend itself uses. Shown on
 * Systems → Agent access; the CLI's it-aware-setup asks for the API base.
 */
import { RUNTIME_CONFIG } from './runtime';

export interface AgentEndpoints {
    environment: string;
    apiBase: string;
    mcpBase: string | null;
}

const ENDPOINTS: Record<string, Omit<AgentEndpoints, 'environment'>> = {
    prod: { apiBase: 'https://api-itaware.oit-svc.com', mcpBase: 'https://mcp-itaware.oit-svc.com' },
    test: { apiBase: 'https://api-itaware-test.oit-svc.com', mcpBase: 'https://mcp-itaware-test.oit-svc.com' },
    dev: { apiBase: 'http://21.91.220.231:8000', mcpBase: 'http://21.91.220.231:18802' },
    local: { apiBase: 'http://localhost:8007', mcpBase: null },
};

export function getAgentEndpoints(): AgentEndpoints {
    const environment = RUNTIME_CONFIG.app.itAwareEnv;
    return { environment, ...(ENDPOINTS[environment] ?? ENDPOINTS.local) };
}
