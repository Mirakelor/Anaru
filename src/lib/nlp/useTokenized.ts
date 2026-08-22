import { useEffect, useReducer } from 'react';
import { tokenizeLine, type TokenizedLine } from './tokenize';

const cache = new Map<string, TokenizedLine>();
const pending = new Set<string>();

export function useTokenized(text: string): TokenizedLine | null {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (cache.has(text) || pending.has(text)) return;
    pending.add(text);
    let cancelled = false;
    tokenizeLine(text)
      .then((line) => {
        cache.set(text, line);
        if (!cancelled) rerender();
      })
      .catch(() => {
        /* tokenizer unavailable; render plain text */
      })
      .finally(() => pending.delete(text));
    return () => {
      cancelled = true;
    };
  }, [text]);

  return cache.get(text) ?? null;
}
