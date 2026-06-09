'use client';

import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders a chat-message body as GitHub-flavored markdown.
 *
 * - No raw HTML (react-markdown's default) — safe for arbitrary agent /
 *   user input.
 * - Styles are kept compact and inherit the surrounding chat-bubble
 *   colors so the bubble accent (agent_reply purple, system_note amber)
 *   still drives the chrome.
 * - External links open in a new tab with safe `rel`.
 */
const components: Components = {
    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
    a: ({ href, children }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-color)] underline-offset-2 hover:underline break-words"
        >
            {children}
        </a>
    ),
    ul: ({ children }) => (
        <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    h1: ({ children }) => <h1 className="text-base font-semibold mt-2 mb-1.5">{children}</h1>,
    h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-1.5">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mt-1.5 mb-1">{children}</h3>,
    h4: ({ children }) => <h4 className="text-sm font-semibold mt-1.5 mb-1">{children}</h4>,
    h5: ({ children }) => <h5 className="text-sm font-semibold mt-1.5 mb-1">{children}</h5>,
    h6: ({ children }) => <h6 className="text-sm font-semibold mt-1.5 mb-1">{children}</h6>,
    blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-[var(--text-secondary)] pl-3 my-2 text-[var(--text-secondary)] italic">
            {children}
        </blockquote>
    ),
    code: ({ className, children, ...props }) => {
        // ReactMarkdown emits inline code without a language class and block
        // code with `language-xxx`. Detect inline by the absence of the class.
        const isBlock = /language-/.test(className ?? '');
        if (isBlock) {
            return (
                <code
                    className={`block bg-black/30 dark:bg-black/40 rounded px-2 py-1.5 text-xs font-mono overflow-x-auto whitespace-pre ${className ?? ''}`}
                    {...props}
                >
                    {children}
                </code>
            );
        }
        return (
            <code
                className="bg-black/20 dark:bg-black/30 rounded px-1 py-0.5 text-[0.85em] font-mono break-words"
                {...props}
            >
                {children}
            </code>
        );
    },
    pre: ({ children }) => (
        <pre className="my-2 last:mb-0 first:mt-0 overflow-x-auto">{children}</pre>
    ),
    hr: () => <hr className="my-2 border-[var(--card-border)]" />,
    table: ({ children }) => (
        <div className="my-2 overflow-x-auto">
            <table className="text-xs border-collapse">{children}</table>
        </div>
    ),
    th: ({ children }) => (
        <th className="border border-[var(--card-border)] px-2 py-1 text-left font-semibold">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="border border-[var(--card-border)] px-2 py-1 align-top">{children}</td>
    ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
};

interface MarkdownBodyProps {
    children: string;
    /** Adds bottom-margin reset for one-liners that should sit flush in a bubble. */
    compact?: boolean;
}

function MarkdownBodyImpl({ children, compact }: MarkdownBodyProps) {
    return (
        <div className={`text-sm break-words ${compact ? '' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {children}
            </ReactMarkdown>
        </div>
    );
}

export const MarkdownBody = memo(MarkdownBodyImpl);
