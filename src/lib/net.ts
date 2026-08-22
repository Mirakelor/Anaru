/** Text fetcher that works on every shell.
 *
 * The Tauri WebView's origin (tauri://localhost) fails CORS against most
 * CDNs, so on desktop the request goes through a Rust command instead of
 * `fetch`. Media elements (video/img) are not CORS-restricted, so only
 * manifest/subtitle text needs this path.
 */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const timeout = new Promise<string>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out while downloading the pack.')), 60_000);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('Aborted.'));
      });
    });
    return Promise.race([invoke<string>('fetch_text', { url }), timeout]);
  }
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`);
  return response.text();
}
