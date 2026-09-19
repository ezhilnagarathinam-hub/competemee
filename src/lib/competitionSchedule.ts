import type { Competition } from '@/types/database';
import { competitionDateTime } from '@/lib/serverTime';

type ScheduledCompetition = Pick<Competition, 'schedule_type' | 'date' | 'end_date' | 'start_time' | 'end_time'>;

export function competitionWindow(comp: ScheduledCompetition): { start: Date | null; end: Date | null } {
  if (comp.schedule_type === 'lifetime') return { start: null, end: null };
  if (!comp.date) return { start: null, end: null };

  if (comp.schedule_type === 'date_range') {
    return {
      start: competitionDateTime(comp.date, '00:00'),
      end: competitionDateTime(comp.end_date || comp.date, '23:59:59'),
    };
  }

  if (!comp.start_time || !comp.end_time) return { start: null, end: null };
  return {
    start: competitionDateTime(comp.date, comp.start_time),
    end: competitionDateTime(comp.end_date || comp.date, comp.end_time),
  };
}

export function isCompetitionWindowOpen(comp: ScheduledCompetition, now: Date): boolean {
  const { start, end } = competitionWindow(comp);
  return (!start || now >= start) && (!end || now <= end);
}

export function isCompetitionBeforeStart(comp: ScheduledCompetition, now: Date): boolean {
  const { start } = competitionWindow(comp);
  return !!start && now < start;
}