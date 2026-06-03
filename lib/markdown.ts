/**
 * Tiny markdown renderer for chat-style messages.
 *
 * Supports the subset that the LLM actually emits and that humans paste:
 * - Triple-backtick code blocks (```lang ... ```)
 * - Inline `code`
 * - **bold**, *italic*
 * - [text](url) links
 * - Auto-linked bare http(s) URLs
 *
 * Returns a string with HTML safe to drop into dangerouslySetInnerHTML
 * because every interpolated value is escaped first.
 */

const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

function escapeHtml(input: string): string {
    return input.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}

function escapeAttr(input: string): string {
    return escapeHtml(input);
}

function renderInline(line: string): string {
    let html = escapeHtml(line);
    // Inline code first, so its content isn't bold/italic-parsed.
    html = html.replace(
        /`([^`]+)`/g,
        (_m, code) =>
            `<code class="bg-muted rounded px-1 py-0.5 font-mono text-sm">${code}</code>`,
    );
    // Markdown links [text](url)
    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_m, text, url) =>
            `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-300 underline">${text}</a>`,
    );
    // Bare URLs
    html = html.replace(
        /(?<![">])(https?:\/\/[^\s<]+)/g,
        (m) =>
            `<a href="${escapeAttr(m)}" target="_blank" rel="noopener noreferrer" class="text-blue-700 dark:text-blue-300 underline">${m}</a>`,
    );
    // Bold then italic (longer first, so * inside ** doesn't eat).
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    return html;
}

export function renderMarkdown(input: string): string {
    if (!input) return '';
    const out: string[] = [];
    let i = 0;
    const fenceRe = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    while ((m = fenceRe.exec(input)) !== null) {
        const before = input.slice(i, m.index);
        for (const line of before.split('\n')) {
            out.push(renderInline(line));
        }
        const lang = m[1] || '';
        const code = escapeHtml(m[2]);
        out.push(
            `<pre class="bg-muted rounded p-2 overflow-x-auto my-1"><code class="font-mono text-sm" data-lang="${escapeAttr(lang)}">${code}</code></pre>`,
        );
        i = m.index + m[0].length;
    }
    const tail = input.slice(i);
    for (const line of tail.split('\n')) {
        out.push(renderInline(line));
    }
    return out.join('<br/>').replace(/(<br\/>){3,}/g, '<br/><br/>');
}
