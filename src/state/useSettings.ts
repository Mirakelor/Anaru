import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from '../lib/db';
import type { AppSettings } from '../lib/types';

/** Live-reads settings; creation happens outside the live query's read-only transaction. */
export function useSettings(): AppSettings | null {
  const row = useLiveQuery(() => db.settings.toCollection().first(), []);
  useEffect(() => {
    if (!row) void getSettings();
  }, [row]);
  return row ?? null;
}
