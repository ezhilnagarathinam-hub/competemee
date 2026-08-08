import { formatTime12 } from '@/lib/timeFormat';

/** Strip non-digits and add the India country code for bare 10-digit numbers */
export function toWaNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Build a wa.me deep link with pre-filled text */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${toWaNumber(phone)}?text=${encodeURIComponent(text)}`;
}

function origin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Message 1 — credentials sent after admin approves a signup */
export function credentialsMessage(c: { name: string; username: string; password: string }): string {
  return (
    `Hi ${c.name}, your Compete Me account is approved!\n\n` +
    `Username: ${c.username}\n` +
    `Password: ${c.password}\n\n` +
    `Login here: ${origin()}/student/login\n\n` +
    `Your tests will be allotted by the admin. All the best!`
  );
}

export interface TestLikeCompetition {
  name: string;
  date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

function prettyDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return date;
  }
}

function prettyDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
  }
  return `${minutes} minutes`;
}

/** Message 2 — test is live / reminder */
export function testLiveMessage(name: string, comp: TestLikeCompetition): string {
  const dateLine =
    comp.end_date && comp.end_date !== comp.date
      ? `${prettyDate(comp.date)} – ${prettyDate(comp.end_date)}`
      : prettyDate(comp.date);

  return (
    `Hi ${name}, your Compete Me test is scheduled!\n\n` +
    `Test: ${comp.name}\n` +
    `Date: ${dateLine}\n` +
    `Window: ${formatTime12(comp.start_time)} – ${formatTime12(comp.end_time)}\n` +
    `Duration: ${prettyDuration(comp.duration_minutes)}\n\n` +
    `Log in and start on time: ${origin()}/student/login\n\n` +
    `The timer is server-controlled, so please join within the window. All the best!`
  );
}

/** Message 3 — result published */
export function resultMessage(r: {
  name: string;
  competitionName: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  rank?: number | null;
}): string {
  const rankLine = r.rank ? `Rank: ${r.rank}\n` : '';
  return (
    `Hi ${r.name}, your Compete Me result is out!\n\n` +
    `Test: ${r.competitionName}\n` +
    `Score: ${r.totalMarks} / ${r.maxMarks}\n` +
    `Percentage: ${r.percentage}%\n` +
    rankLine +
    `\nSee your full answer review and download the paper here: ${origin()}/student/login\n\n` +
    `Keep competing!`
  );
}
