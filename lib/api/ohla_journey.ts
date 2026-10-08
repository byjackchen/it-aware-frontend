/** Versioned Ohla Journey report reads through the matching Next.js proxy. */
export async function fetchOhlaJourney<T>(path: string): Promise<T> {
  const response = await fetch(`/api/dashboards/ohla-journey/${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
