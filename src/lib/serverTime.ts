import { supabase } from '@/integrations/supabase/client';

/**
 * Trusted clock helper.
 *
 * Exam timing must never depend on the student's device clock (it can be wrong,
 * manually changed, or drift). We sync once against the database clock and keep
 * the offset, so every timing decision uses server time.
 */

let offsetMs = 0;
let synced = false;
let inFlight: Promise<void> | null = null;

export async function syncServerTime(force = false): Promise<void> {
  if (synced && !force) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await (supabase as any).rpc('server_now');
      const t1 = Date.now();
      if (error || !data) throw error || new Error('No server time returned');

      const serverMs = new Date(data as string).getTime();
      if (!Number.isFinite(serverMs)) throw new Error('Invalid server time');

      // Compensate for half the round trip
      offsetMs = serverMs - (t0 + (t1 - t0) / 2);
      synced = true;
    } catch (err) {
      console.warn('Server time sync failed, falling back to device clock:', err);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function serverNowMs(): number {
  return Date.now() + offsetMs;
}

export function serverNow(): Date {
  return new Date(serverNowMs());
}

export function serverTimeSynced(): boolean {
  return synced;
}

/** Build a Date for a competition's date (yyyy-mm-dd) + time (HH:mm[:ss]) in local time. */
export function competitionDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h = 0, min = 0] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h, min, 0, 0);
}
