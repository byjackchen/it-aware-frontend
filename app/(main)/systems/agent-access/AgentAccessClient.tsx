'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Copy, Download, Plug, Terminal } from 'lucide-react';
import { useUser } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import type { AgentEndpoints } from '@/lib/config/agent-access';

export interface CliManifest {
    file: string;
    bytes: number;
    sha256: string;
    source: string;
    tools: number;
}

interface Props {
    endpoints: AgentEndpoints;
    cli: CliManifest;
}

const noopSubscribe = () => () => {};

function CodeBlock({ code }: { code: string }) {
    const t = useTranslations('Systems.agentAccess');
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };
    return (
        <div className="group relative mt-2 rounded-lg border border-white/10 bg-black/20">
            <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs theme-text-primary">{code}</pre>
            <button
                type="button"
                onClick={copy}
                title={t('copy')}
                aria-label={t('copy')}
                className="absolute right-2 top-2 rounded-md p-1.5 theme-text-muted hover:bg-white/10"
            >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
        </div>
    );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-400">
                {n}
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium theme-text-primary">{title}</div>
                <div className="mt-1 text-sm theme-text-secondary">{children}</div>
            </div>
        </li>
    );
}

export function AgentAccessClient({ endpoints, cli }: Props) {
    const t = useTranslations('Systems.agentAccess');
    const { hasAnyPermission, isLoading } = useUser();
    // The site's own origin, for the curl line (empty during server render).
    const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '');

    if (!isLoading && !hasAnyPermission([PERMISSIONS.UI.NAVIGATION_SYSTEMS])) {
        return <div className="p-8 text-sm theme-text-secondary">{t('noAccess')}</div>;
    }

    const downloadPath = `/downloads/${cli.file}`;
    const install = [
        `curl -fsSLO ${origin || '<this site>'}${downloadPath}`,
        `tar -xzf ${cli.file} && ./it-aware-cli/install.sh`,
    ].join('\n');

    return (
        <div className="h-[calc(100vh-4rem)] overflow-auto p-4">
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
                <div className="rounded-xl glass-card p-5">
                    <h1 className="text-xl font-semibold theme-text-primary">{t('title')}</h1>
                    <p className="mt-1 text-sm theme-text-secondary">{t('help')}</p>
                    <p className="mt-2 text-xs theme-text-muted">
                        {t('environment', { env: endpoints.environment })}
                    </p>
                </div>

                <section className="rounded-xl glass-card p-5">
                    <div className="flex items-center gap-2">
                        <Plug className="h-5 w-5 text-blue-400" />
                        <h2 className="text-base font-semibold theme-text-primary">{t('mcp.title')}</h2>
                    </div>
                    <p className="mt-2 text-sm theme-text-secondary">{t('mcp.help')}</p>
                    {endpoints.mcpBase ? (
                        <CodeBlock code={endpoints.mcpBase} />
                    ) : (
                        <p className="mt-2 text-xs theme-text-muted">{t('mcp.noEndpoint')}</p>
                    )}
                </section>

                <section className="rounded-xl glass-card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-blue-400" />
                            <h2 className="text-base font-semibold theme-text-primary">{t('cli.title')}</h2>
                        </div>
                        <a
                            href={downloadPath}
                            download
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                        >
                            <Download className="h-4 w-4" />
                            {t('cli.download')}
                        </a>
                    </div>
                    <p className="mt-2 text-sm theme-text-secondary">{t('cli.help')}</p>
                    <p className="mt-1 text-xs theme-text-muted">
                        {t('cli.meta', {
                            source: cli.source,
                            tools: cli.tools,
                            kb: Math.max(1, Math.round(cli.bytes / 1024)),
                        })}
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] theme-text-muted">sha256 {cli.sha256}</p>

                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{t('cli.identityWarning')}</span>
                    </div>

                    <ol className="mt-5 flex flex-col gap-5">
                        <Step n={1} title={t('cli.step1Title')}>
                            {t('cli.step1Help')}
                            <CodeBlock code={install} />
                        </Step>
                        <Step n={2} title={t('cli.step2Title')}>
                            {t('cli.step2Help')}{' '}
                            <Link href="/auth/accounts" className="text-blue-400 hover:underline">
                                {t('cli.step2Link')}
                            </Link>
                        </Step>
                        <Step n={3} title={t('cli.step3Title')}>
                            {t('cli.step3Help', { apiBase: endpoints.apiBase })}
                            <CodeBlock code="it-aware-setup" />
                        </Step>
                        <Step n={4} title={t('cli.step4Title')}>
                            {t('cli.step4Help')}
                            <CodeBlock
                                code={[
                                    'it-aware --help',
                                    'it-aware interactions_faq_monthly',
                                    'it-aware list_interactions --created-at-from 2026-10-01 --created-at-to 2026-11-01 \\',
                                    '  --all --fields oid,content_text,service_catalog_oid --out oct.jsonl',
                                ].join('\n')}
                            />
                        </Step>
                    </ol>
                    <p className="mt-5 text-xs theme-text-muted">{t('cli.requirements')}</p>
                </section>
            </div>
        </div>
    );
}
