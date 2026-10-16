type Row = Record<string, unknown>;

export const journeyOutcomeColors: Record<string, string> = {
  ai_confirmed: '#1c5cab', ai_unconfirmed: '#86b6ef', human_confirmed: '#177245',
  human_unconfirmed: '#8fd1a8', elsewhere: '#6b7688', unknown: '#d6dae0', unresolved: '#b64a3c',
};

export function journeyBandColors(entry: string, outcome: string): { entryToPath: string; pathToOutcome: string } {
  const pathToOutcome = journeyOutcomeColors[outcome] ?? '#8892a0';
  const botDidNotResolve = entry === 'bot' && outcome !== 'ai_confirmed' && outcome !== 'ai_unconfirmed';
  return { entryToPath: botDidNotResolve ? journeyOutcomeColors.ai_unconfirmed : pathToOutcome, pathToOutcome };
}

function object(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(object) : [];
}

export function catalogLabel(catalog: Row, dimension: string, code: string, zh: boolean): string {
  const entries = rows(catalog[dimension === 'topic' ? 'topics' : dimension === 'subtopic' ? 'subtopics' : '']);
  const entry = entries.find((row) => row.code === code);
  return String((zh ? entry?.name_zh : entry?.name_en) ?? code);
}

export function catalogText(value: unknown, catalog: Row, zh: boolean): string {
  let result = String(value ?? '—');
  const entries = [...rows(catalog.subtopics), ...rows(catalog.topics)]
    .sort((a, b) => String(b.code ?? '').length - String(a.code ?? '').length);
  const replacements = new Map<string, string>();
  for (const entry of entries) {
    const code = String(entry.code ?? '');
    if (!code || !result.includes(code)) continue;
    const marker = `\u0000${replacements.size}\u0000`;
    replacements.set(marker, String((zh ? entry.name_zh : entry.name_en) ?? code));
    result = result.replaceAll(code, marker);
  }
  for (const [marker, label] of replacements) result = result.replaceAll(marker, label);
  return result;
}

export function otherOutcomeCount(outcomes: Row): number {
  return ['elsewhere', 'unknown', 'unresolved'].reduce((sum, key) => sum + Number(outcomes[key] ?? 0), 0);
}

export function escalationRate(row: Row): number | null {
  const denominator = Number(row.bot_entry ?? 0);
  return denominator > 0 ? Number(row.escalated ?? 0) / denominator : null;
}

export function auditTaskCounts(step: Row): { newTasks: number; totalTasks: number } {
  const totalTasks = Number(step.agents ?? 0) + Number(step.models ?? 0);
  return { newTasks: totalTasks - Number(step.reused ?? 0), totalTasks };
}

export function preferredTiming(times: Row): (Row & { metric: 'T1' }) | null {
  const first = object(times.T1_session ?? times.T1);
  return typeof first.median_sec === 'number' ? { ...first, metric: 'T1' } : null;
}

export function reportWindowDays(start: string, end: string): number {
  const days = Math.ceil((Date.parse(end) - Date.parse(start)) / 86400000);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

export function gapTopicCounts(items: Row[]): Array<{ topic: string; knowledge: number; action: number; other: number; total: number }> {
  const byTopic = new Map<string, { topic: string; knowledge: number; action: number; other: number; total: number }>();
  for (const item of items) {
    const topic = String(item.topic ?? 'unknown');
    const row = byTopic.get(topic) ?? { topic, knowledge: 0, action: 0, other: 0, total: 0 };
    row.total += 1;
    if (item.gap_family === 'knowledge') row.knowledge += 1;
    if (item.gap_family === 'action') row.action += 1;
    if (item.gap_family !== 'knowledge' && item.gap_family !== 'action') row.other += 1;
    byTopic.set(topic, row);
  }
  return [...byTopic.values()].sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic));
}
