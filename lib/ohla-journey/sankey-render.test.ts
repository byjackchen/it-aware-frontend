import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JourneySankey } from '../../app/(main)/ohla-journey/ReportVisuals';

describe('Journey Sankey rendered bands', () => {
  it('renders the bot stage blue and the human outcome green at their full colors', () => {
    const markup = renderToStaticMarkup(createElement(JourneySankey, {
      flow: { flows: [{ entry: 'bot', path: 'BOT_ASKED_HUMAN', outcome: 'human_confirmed', n: 1 }] },
      zh: false,
    }));
    const bands = [...markup.matchAll(/<path\b[^>]*>/g)].map((match) => match[0]);

    expect(bands).toHaveLength(2);
    expect(bands[0]).toContain('fill="#86b6ef"');
    expect(bands[1]).toContain('fill="#177245"');
    expect(bands[0]).not.toContain('opacity=');
    expect(bands[1]).not.toContain('opacity=');
  });
});
