import { useEffect, useState } from 'react';
import { Trophy, Medal, Award, Zap, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { Competition } from '@/types/database';

interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  correct_marks: number;
  negative_marks: number;
  total_marks: number;
  submitted_at: string | null;
  isLate?: boolean;
}

interface CompetitionWithCount extends Competition {
  submission_count: number;
}

export default function Results() {
  const [competitions, setCompetitions] = useState<CompetitionWithCount[]>([]);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [maxMarks, setMaxMarks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingComps, setLoadingComps] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCompetitions();
  }, []);

  async function fetchCompetitions() {
    try {
      const { data: comps, error } = await supabase
        .from('competitions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      // Get submission counts
      const { data: counts, error: countError } = await supabase
        .from('student_competitions')
        .select('competition_id')
        .eq('has_submitted', true);

      if (countError) throw countError;

      const countMap: Record<string, number> = {};
      (counts || []).forEach((c: any) => {
        countMap[c.competition_id] = (countMap[c.competition_id] || 0) + 1;
      });

      const compsWithCount: CompetitionWithCount[] = ((comps || []) as Competition[]).map(c => ({
        ...c,
        submission_count: countMap[c.id] || 0,
      }));

      setCompetitions(compsWithCount);

      // Auto-load the most recent competition's leaderboard
      if (compsWithCount.length > 0) {
        const first = compsWithCount[0];
        if (first.submission_count > 0) {
          loadLeaderboard(first.id, first);
        }
      }
    } catch (error) {
      console.error('Error fetching competitions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard(compId: string, comp?: Competition) {
    if (leaderboards[compId]) return; // already loaded

    setLoadingComps(prev => new Set(prev).add(compId));

    try {
      const compData = comp || competitions.find(c => c.id === compId);

      const [{ data: submissions, error: subError }, { data: questions, error: qError }, { data: rawAnswers, error: aError }] = await Promise.all([
        supabase
          .from('student_competitions')
          .select(`student_id, total_marks, submitted_at, started_at, students!inner(name)`)
          .eq('competition_id', compId)
          .eq('has_submitted', true),
        supabase
          .from('questions')
          .select('id, marks')
          .eq('competition_id', compId),
        supabase
          .from('student_answers')
          .select('student_id, question_id, is_correct, selected_answer')
          .eq('competition_id', compId),
      ]);

      if (subError) throw subError;
      if (qError) throw qError;
      if (aError) throw aError;

      const total = questions?.reduce((sum, q) => sum + (q.marks || 0), 0) || 0;
      setMaxMarks(prev => ({ ...prev, [compId]: total }));

      // Build per-question marks map
      const qMarks = new Map<string, number>();
      (questions || []).forEach((q: any) => qMarks.set(q.id, q.marks || 0));

      // Build per-student score breakdown
      const breakdown = new Map<string, { correct: number; negative: number }>();
      (rawAnswers || []).forEach((a: any) => {
        if (!a.selected_answer) return; // unattempted, no penalty
        const m = qMarks.get(a.question_id) || 0;
        const cur = breakdown.get(a.student_id) || { correct: 0, negative: 0 };
        if (a.is_correct) {
          cur.correct += m;
        } else {
          cur.negative += m / 3;
        }
        breakdown.set(a.student_id, cur);
      });

      const entries: LeaderboardEntry[] = (submissions || []).map((s: any) => {
        let isLate = false;
        if (compData && s.started_at && s.submitted_at) {
          const startedAt = new Date(s.started_at).getTime();
          const submittedAt = new Date(s.submitted_at).getTime();
          const durationMs = compData.duration_minutes * 60 * 1000;
          if (submittedAt - startedAt > durationMs + 30000) {
            isLate = true;
          }
        }
        const b = breakdown.get(s.student_id) || { correct: 0, negative: 0 };
        const correct_marks = Math.round(b.correct * 100) / 100;
        const negative_marks = Math.round(b.negative * 100) / 100;
        const total_marks = Math.round((b.correct - b.negative) * 100) / 100;
        return {
          student_id: s.student_id,
          student_name: s.students?.name || 'Unknown',
          correct_marks,
          negative_marks,
          total_marks,
          submitted_at: s.submitted_at,
          isLate,
        };
      });

      // Sort by total_marks desc
      entries.sort((a, b) => b.total_marks - a.total_marks);

      setLeaderboards(prev => ({ ...prev, [compId]: entries }));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoadingComps(prev => {
        const next = new Set(prev);
        next.delete(compId);
        return next;
      });
    }
  }

  function getRankIcon(rank: number) {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">{rank}</span>;
    }
  }

  const safePercentage = (marks: number, max: number) => {
    if (!max || max === 0) return 0;
    return Math.round((marks / max) * 100);
  };

  function formatCompDate(comp: Competition) {
    if (comp.end_date && comp.end_date !== comp.date) {
      return `${format(new Date(comp.date), 'MMM dd')} – ${format(new Date(comp.end_date), 'MMM dd, yyyy')}`;
    }
    return format(new Date(comp.date), 'MMM dd, yyyy');
  }

  function renderLeaderboard(compId: string) {
    const entries = leaderboards[compId];
    const max = maxMarks[compId] || 0;

    if (loadingComps.has(compId)) {
      return <p className="text-muted-foreground text-center py-6">Loading results...</p>;
    }

    if (!entries || entries.length === 0) {
      return (
        <div className="text-center py-6">
          <Zap className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No submissions yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Top 3 cards */}
        {entries.length >= 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {entries.slice(0, 3).map((entry, index) => (
              <Card
                key={entry.student_id}
                className={`glass-card border-2 ${
                  index === 0 ? 'border-primary/70 shadow-neon' :
                  index === 1 ? 'border-accent/50 shadow-accent' :
                  'border-warning/50'
                }`}
              >
                <CardContent className="p-6 text-center">
                  <div className="mb-4">{getRankIcon(index + 1)}</div>
                  <h3 className="font-bold text-lg text-foreground font-display">{entry.student_name}</h3>
                  <p className="text-3xl font-bold mt-2 text-primary font-display">
                    {entry.total_marks}
                    <span className="text-lg text-muted-foreground">/{max} pts</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {safePercentage(entry.total_marks, max)}%
                  </p>
                  <div className="flex justify-center gap-3 mt-3 text-xs">
                    <span className="px-2 py-1 rounded-md bg-accent/15 text-accent font-bold">
                      +{entry.correct_marks}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-destructive/15 text-destructive font-bold">
                      −{entry.negative_marks}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Full table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Percentage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={entry.student_id} className="hover:bg-primary/5">
                <TableCell>
                  <div className="flex items-center justify-center">
                    {getRankIcon(index + 1)}
                  </div>
                </TableCell>
                <TableCell className="font-bold">{entry.student_name}</TableCell>
                <TableCell>
                  <span className="font-bold text-primary font-display">{entry.total_marks}</span>
                  <span className="text-muted-foreground">/{max}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-primary rounded-full"
                        style={{ width: `${safePercentage(entry.total_marks, max)}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {safePercentage(entry.total_marks, max)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {entry.isLate ? (
                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-destructive/20 text-destructive">LATE</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-accent/20 text-accent">ON TIME</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.submitted_at
                    ? new Date(entry.submitted_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' })
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  const compsWithSubmissions = competitions.filter(c => c.submission_count > 0);
  

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">LEADERBOARD</h1>
        <p className="text-muted-foreground mt-1">View player scores and rankings by competition</p>
      </div>

      {compsWithSubmissions.length === 0 ? (
        <Card className="border-dashed glass-card">
          <CardContent className="py-12 text-center">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bold text-foreground mb-1 font-display">NO RESULTS YET</h3>
            <p className="text-sm text-muted-foreground">No competitions have submissions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Most recent competition - always expanded */}
          {compsWithSubmissions.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-primary" />
                    <span className="font-display">{compsWithSubmissions[0].name}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {formatCompDate(compsWithSubmissions[0])}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {compsWithSubmissions[0].submission_count} players
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderLeaderboard(compsWithSubmissions[0].id)}
              </CardContent>
            </Card>
          )}

          {/* Older competitions - collapsible */}
          {compsWithSubmissions.length > 1 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">HISTORY</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {compsWithSubmissions.slice(1).map((comp) => (
                    <AccordionItem key={comp.id} value={comp.id}>
                      <AccordionTrigger
                        className="hover:no-underline"
                        onClick={() => loadLeaderboard(comp.id)}
                      >
                        <div className="flex items-center gap-4 text-left">
                          <Trophy className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-display font-bold">{comp.name}</span>
                          <span className="text-sm text-muted-foreground">{formatCompDate(comp)}</span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="w-3 h-3" />
                            {comp.submission_count}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {renderLeaderboard(comp.id)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
