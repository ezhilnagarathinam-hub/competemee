import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Clock, Play, Lock, Zap, Eye, Timer, MessageCircle, Download, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStudentAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Competition, StudentCompetition } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { formatTime12, formatTimestampShort, formatDurationBetween } from '@/lib/timeFormat';
import { serverNow, syncServerTime, competitionDateTime } from '@/lib/serverTime';
import { buildResultRows, downloadResultPDF } from '@/lib/exportResult';
import { Textarea } from '@/components/ui/textarea';

const SUPPORT_WHATSAPP = '919487277924';

interface CompetitionWithStatus extends Competition {
  studentStatus?: StudentCompetition;
  isEnrolled: boolean;
}

export default function StudentDashboard() {
  const { studentId } = useStudentAuth();
  const [competitions, setCompetitions] = useState<CompetitionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactComp, setContactComp] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  const fetchCompetitions = useCallback(async () => {
    try {
      // Fetch all active competitions
      const { data: allComps, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_active', true)
        .order('date', { ascending: false });

      if (compError) throw compError;

      // Fetch student's enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from('student_competitions')
        .select('*')
        .eq('student_id', studentId);

      if (enrollError) throw enrollError;

      const enrollmentMap = new Map<string, any>();
      (enrollments || []).forEach((e: any) => {
        enrollmentMap.set(e.competition_id, e);
      });

      const compsWithStatus: CompetitionWithStatus[] = ((allComps || []) as Competition[]).map((comp) => {
        const enrollment = enrollmentMap.get(comp.id);
        // If we have a localStorage override (recently submitted), prefer that for immediate UI
        const localFlagRaw = (() => {
          try {
            return localStorage.getItem(`submittedCompetition:${comp.id}`);
          } catch {
            return null;
          }
        })();

        const baseStatus = enrollment ? {
          id: enrollment.id,
          student_id: enrollment.student_id,
          competition_id: enrollment.competition_id,
          has_started: enrollment.has_started,
          has_submitted: enrollment.has_submitted,
          started_at: enrollment.started_at,
          submitted_at: enrollment.submitted_at,
          total_marks: enrollment.total_marks,
          is_locked: enrollment.is_locked ?? false,
        } as StudentCompetition : undefined;

        // Decide whether to use the local flag: only if it's recent (TTL) and server hasn't reflected submission yet.
        if (localFlagRaw) {
          const ttlMs = 60 * 1000; // 60 seconds
          let usedLocal = false;
          try {
            const localDate = new Date(localFlagRaw);
            const age = Date.now() - localDate.getTime();
            const serverShowsSubmitted = !!baseStatus?.has_submitted || !!baseStatus?.is_locked;
            if (age <= ttlMs && !serverShowsSubmitted) {
              usedLocal = true;
            } else {
              // stale or server already updated: remove local flag
              try { localStorage.removeItem(`submittedCompetition:${comp.id}`); } catch {}
            }
          } catch {
            try { localStorage.removeItem(`submittedCompetition:${comp.id}`); } catch {}
          }

          if (usedLocal) {
            return {
              ...comp,
              isEnrolled: !!enrollment,
              studentStatus: {
                id: baseStatus?.id || '',
                student_id: baseStatus?.student_id || '',
                competition_id: comp.id,
                has_started: baseStatus?.has_started ?? true,
                has_submitted: true,
                started_at: baseStatus?.started_at || null,
                submitted_at: localFlagRaw,
                total_marks: baseStatus?.total_marks ?? 0,
                is_locked: true,
              } as StudentCompetition,
            };
          }
        }

        return {
          ...comp,
          isEnrolled: !!enrollment,
          studentStatus: baseStatus,
        };
      });

      setCompetitions(compsWithStatus);
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast.error('Failed to load competitions');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      fetchCompetitions();
    }
  }, [studentId, fetchCompetitions]);

  // Keep the clock trusted (server-side), not device-dependent
  useEffect(() => {
    void syncServerTime(true);
    const t = setInterval(() => void syncServerTime(true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Poll competitions every 5 seconds so status (submitted/locked) updates promptly
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (studentId) {
      interval = setInterval(() => {
        fetchCompetitions();
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [studentId, fetchCompetitions]);

  function canStartTest(comp: CompetitionWithStatus): boolean {
    if (!comp.isEnrolled) return false;
    if (comp.studentStatus?.is_locked) return false;
    if (comp.studentStatus?.has_submitted) return false;
    
    const now = serverNow();
    const windowStart = competitionDateTime(comp.date, comp.start_time);
    const windowEnd = competitionDateTime(comp.end_date || comp.date, comp.end_time);

    return now >= windowStart && now <= windowEnd;
  }

  function isBeforeStart(comp: CompetitionWithStatus): boolean {
    return serverNow() < competitionDateTime(comp.date, comp.start_time);
  }

  function formatDuration(minutes: number): string {
    if (minutes >= 60 && minutes % 60 === 0) {
      const hrs = minutes / 60;
      return `${hrs} hr${hrs > 1 ? 's' : ''}`;
    }
    if (minutes > 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hrs}h ${mins}m`;
    }
    return `${minutes} min`;
  }

  async function handleStartTest(competitionId: string) {
    try {
      await syncServerTime(true);
      const comp = competitions.find((c) => c.id === competitionId);
      if (comp) {
        const now = serverNow();
        if (now < competitionDateTime(comp.date, comp.start_time)) {
          toast.error('This test has not started yet.');
          return;
        }
        if (now > competitionDateTime(comp.end_date || comp.date, comp.end_time)) {
          toast.error('This test window has closed.');
          fetchCompetitions();
          return;
        }
      }

      const { data: existing } = await supabase
        .from('student_competitions')
        .select('*')
        .eq('student_id', studentId)
        .eq('competition_id', competitionId)
        .maybeSingle();

      if (!existing) {
        toast.error('You are not enrolled in this competition');
        return;
      } else if (existing.has_submitted || existing.is_locked) {
        toast.error('This test is already submitted and locked. Contact admin to unlock.');
        fetchCompetitions();
        return;
      } else if (!existing.has_started) {
        const { error } = await supabase
          .from('student_competitions')
          .update({
            has_started: true,
            started_at: serverNow().toISOString(),
          })
          .eq('id', existing.id);

        if (error) {
          toast.error(error.message || 'Failed to start test');
          return;
        }
      }

      navigate(`/student/test/${competitionId}`);
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Failed to start test');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">MY <span className="neon-text">ARENA</span></h1>
        <p className="text-muted-foreground mt-1">View your battles and scores</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : competitions.length === 0 ? (
        <Card className="border-dashed glass-card">
          <CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bold text-foreground mb-1 font-display">NO BATTLES YET</h3>
            <p className="text-sm text-muted-foreground">Check back later for upcoming tests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitions.map((comp) => {
            const canStart = canStartTest(comp);
            const hasSubmitted = !!comp.studentStatus?.has_submitted;
            const hasStarted = !!comp.studentStatus?.has_started;
            const isLocked = !!comp.studentStatus?.is_locked;
            const isCompleted = hasSubmitted || isLocked;
            const isEnrolled = comp.isEnrolled;

            return (
              <Card key={comp.id} className={`glass-card overflow-hidden transition-all ${isEnrolled ? 'hover:border-primary/50' : 'opacity-80'}`}>
                <div
                  className="h-2 shadow-lg"
                  style={{ backgroundColor: comp.primary_color }}
                />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg text-foreground font-display">{comp.name}</h3>
                        {!isEnrolled && !isBeforeStart(comp) && (
                          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-muted text-muted-foreground">
                            NOT ENROLLED
                          </span>
                        )}
                      </div>
                      {comp.description && (
                        <p className="text-sm text-muted-foreground mb-3">{comp.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {comp.end_date && comp.end_date !== comp.date
                            ? `${format(parseISO(comp.date), 'MMM dd')} – ${format(parseISO(comp.end_date), 'MMM dd, yyyy')}`
                            : format(parseISO(comp.date), 'MMM dd, yyyy')
                          }
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime12(comp.start_time)} - {formatTime12(comp.end_time)}
                        </span>
                        <span>{formatDuration(comp.duration_minutes)}</span>
                      </div>
                      {/* Countdown timer */}
                      {isEnrolled && !isCompleted && (
                        <CountdownTimer comp={comp} />
                      )}
                    </div>

                    <div className="ml-4">
                      {!isEnrolled ? (
                        isBeforeStart(comp) ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground border border-border">
                              <Lock className="w-5 h-5" />
                              <span className="font-bold font-display">NOT YET STARTED</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Test opens on {format(parseISO(comp.date), 'MMM dd')} at {formatTime12(comp.start_time)}
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => { setContactComp({ id: comp.id, name: comp.name }); setContactDialogOpen(true); }}
                            className="border-primary/30 hover:bg-primary/10"
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Enroll Now
                          </Button>
                        )
                      ) : isCompleted ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/20 text-destructive border border-destructive/30">
                            <Lock className="w-5 h-5" />
                            <span className="font-bold">LOCKED</span>
                          </div>
                          {comp.studentStatus?.submitted_at && (
                            <div className="text-[11px] text-muted-foreground mt-1">Locked on {format(parseISO(comp.studentStatus.submitted_at), 'MMM dd, yyyy HH:mm')}</div>
                          )}
                        </div>
                      ) : hasStarted ? (
                        <Button
                          onClick={() => navigate(`/student/test/${comp.id}`)}
                          className="gradient-primary text-primary-foreground shadow-primary compete-btn"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Continue Test
                        </Button>
                      ) : canStart ? (
                        <Button
                          onClick={() => handleStartTest(comp.id)}
                          className="gradient-primary text-primary-foreground shadow-neon compete-btn energy-pulse"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          {hasStarted ? 'CONTINUE' : 'START BATTLE'}
                        </Button>
                      ) : isBeforeStart(comp) ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground border border-border">
                          <Lock className="w-5 h-5" />
                          <span className="font-bold font-display">NOT YET STARTED</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground">
                          <Lock className="w-5 h-5" />
                          <span className="font-bold">ENDED</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Enrollment request dialog - WhatsApp + in-app support message */}
      <EnrollDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        competitionName={contactComp?.name}
        competitionId={contactComp?.id}
      />


      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary animate-glow" />
            My Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudentResults />
        </CardContent>
      </Card>
    </div>
  );
}

/* Countdown timer component for each competition */
function CountdownTimer({ comp }: { comp: CompetitionWithStatus }) {
  const [countdown, setCountdown] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = serverNow();
      const startTime = competitionDateTime(comp.date, comp.start_time);
      const endTime = competitionDateTime(comp.end_date || comp.date, comp.end_time);

      if (now < startTime) {
        const diff = Math.floor((startTime.getTime() - now.getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setLabel('Starts in');
        setCountdown(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
      } else if (now >= startTime && now <= endTime) {
        const diff = Math.floor((endTime.getTime() - now.getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setLabel('Ends in');
        setCountdown(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
      } else {
        setLabel('');
        setCountdown('Ended');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [comp]);

  if (!countdown) return null;

  return (
    <div className="mt-2 flex items-center gap-2 text-sm">
      <Timer className="w-4 h-4 text-primary animate-pulse" />
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold font-display ${countdown === 'Ended' ? 'text-destructive' : 'text-primary'}`}>
        {countdown}
      </span>
    </div>
  );
}


function StudentResults() {
  const { studentId, studentName } = useStudentAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      // Authoritative, server-computed results (also covers attempts that ran out of time)
      const { data: reports, error } = await (supabase as any)
        .from('competition_result_reports')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_finalized', true)
        .order('submitted_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const compIds = Array.from(new Set((reports || []).map((r: any) => r.competition_id)));
      let compMap = new Map<string, any>();

      if (compIds.length > 0) {
        const { data: comps } = await supabase
          .from('competitions')
          .select('*')
          .in('id', compIds as string[]);
        (comps || []).forEach((c: any) => compMap.set(c.id, c));
      }

      setResults(
        (reports || []).map((r: any) => ({
          ...r,
          competitions: compMap.get(r.competition_id) || { name: r.competition_name },
          correct_marks: Math.round((Number(r.correct_marks) || 0) * 100) / 100,
          negative_marks: Math.round((Number(r.negative_marks) || 0) * 100) / 100,
          computed_total: Math.round((Number(r.total_marks) || 0) * 100) / 100,
          max_marks: Math.round((Number(r.max_marks) || 0) * 100) / 100,
        })),
      );
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;

    fetchResults();
    const interval = setInterval(fetchResults, 10000);
    return () => clearInterval(interval);
  }, [studentId, fetchResults]);

  /** Load every question of the paper plus this student's answers (unanswered included). */
  const loadDetail = useCallback(async (result: any) => {
    const [{ data: questions, error: qErr }, { data: answers, error: aErr }] = await Promise.all([
      supabase
        .from('questions')
        .select('*')
        .eq('competition_id', result.competition_id)
        .order('question_number'),
      supabase
        .from('student_answers')
        .select('*')
        .eq('student_id', studentId)
        .eq('competition_id', result.competition_id),
    ]);

    if (qErr) throw qErr;
    if (aErr) throw aErr;

    const answerMap = new Map<string, any>();
    (answers || []).forEach((a: any) => answerMap.set(a.question_id, a));
    return buildResultRows(questions || [], answerMap);
  }, [studentId]);

  async function viewDetails(result: any) {
    setSelectedResult(result);
    setDetailsLoading(true);
    try {
      const { rows } = await loadDetail(result);
      setDetailRows(rows);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load answers');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function download(result: any) {
    try {
      toast.loading('Preparing your result…', { id: 'result-pdf' });
      const { rows, correctMarks, negativeMarks, maxMarks } = await loadDetail(result);
      downloadResultPDF({
        studentName: studentName || 'Player',
        competitionName: result.competitions?.name || result.competition_name || 'Competition',
        startedAt: result.started_at,
        submittedAt: result.submitted_at,
        totalMarks: Math.round((correctMarks - negativeMarks) * 100) / 100,
        maxMarks,
        correctMarks,
        negativeMarks,
        rows,
      });
      toast.success('Result downloaded', { id: 'result-pdf' });
    } catch (error) {
      console.error('Result download failed:', error);
      toast.error('Could not generate the result PDF', { id: 'result-pdf' });
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading results...</p>;
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No results yet. Complete a test to see your scores.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {results.map((result) => {
          const comp = result.competitions;
          const showResult = comp?.show_results;
          const showDetails = comp?.show_detailed_results;

          return (
            <div
              key={result.competition_id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-all"
            >
              <div className="flex-1">
                <h4 className="font-bold text-foreground font-display">{comp?.name || result.competition_name || 'Unknown'}</h4>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="px-2 py-1 rounded-md bg-background/60 border border-border/40">
                    <span className="text-muted-foreground">Started: </span>
                    <span className="font-bold text-foreground">{formatTimestampShort(result.started_at)}</span>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-background/60 border border-border/40">
                    <span className="text-muted-foreground">Submitted: </span>
                    <span className="font-bold text-foreground">{formatTimestampShort(result.submitted_at)}</span>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-primary/10 border border-primary/30">
                    <span className="text-muted-foreground">Time taken: </span>
                    <span className="font-bold text-primary">{formatDurationBetween(result.started_at, result.submitted_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {showResult ? (
                  <>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary font-display">
                        {result.computed_total} <span className="text-sm text-muted-foreground">/ {result.max_marks} pts</span>
                      </div>
                      <div className="flex justify-end gap-2 mt-1 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent font-bold">
                          Correct +{result.correct_marks}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-destructive/15 text-destructive font-bold">
                          Negative −{result.negative_marks}
                        </span>
                      </div>
                    </div>
                    {showDetails && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewDetails(result)}
                          className="border-accent/50 text-accent hover:bg-accent/10"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Answers
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => download(result)}
                          className="border-primary/50 text-primary hover:bg-primary/10"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground italic px-3 py-1 bg-muted/50 rounded-lg">
                    Results coming soon...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Results Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="glass-card max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              ANSWER REVIEW - {selectedResult?.competitions?.name || selectedResult?.competition_name}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading answers...</div>
          ) : (
            <div className="space-y-4">
              {selectedResult && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => download(selectedResult)}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Download className="w-4 h-4 mr-1" /> Download this answer sheet (PDF)
                </Button>
              )}

              {detailRows.length === 0 && (
                <p className="text-center text-muted-foreground py-6">No questions found for this test.</p>
              )}

              {detailRows.map((row) => {
                const answered = !!row.selected;
                const isCorrect = answered && row.selected === row.correct;

                return (
                  <div
                    key={row.number}
                    className={`p-4 rounded-xl border-2 ${
                      !answered
                        ? 'border-border bg-muted/20'
                        : isCorrect
                          ? 'border-accent/50 bg-accent/10'
                          : 'border-destructive/50 bg-destructive/10'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm ${
                        !answered
                          ? 'bg-muted text-muted-foreground'
                          : isCorrect
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-destructive text-destructive-foreground'
                      }`}>
                        {row.number}
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-medium whitespace-pre-wrap">{row.question}</p>
                        {row.question_secondary && (
                          <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{row.question_secondary}</p>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold shrink-0 ${
                        !answered
                          ? 'bg-muted text-muted-foreground'
                          : isCorrect
                            ? 'bg-accent/20 text-accent'
                            : 'bg-destructive/20 text-destructive'
                      }`}>
                        {!answered ? 'Not answered' : `${row.awarded > 0 ? '+' : ''}${row.awarded}`}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const isThisCorrect = row.correct === opt;
                        const isThisSelected = row.selected === opt;

                        return (
                          <div
                            key={opt}
                            className={`p-2 rounded-lg ${
                              isThisCorrect
                                ? 'bg-accent/20 text-accent border border-accent/50'
                                : isThisSelected
                                  ? 'bg-destructive/20 text-destructive border border-destructive/50'
                                  : 'bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            <span className="font-bold">{opt}.</span> {row.options[opt]}
                            {isThisCorrect && <span className="ml-2">✓</span>}
                            {isThisSelected && !isThisCorrect && <span className="ml-2">✗</span>}
                          </div>
                        );
                      })}
                    </div>

                    {row.explanation && (
                      <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                        <span className="font-bold text-primary">Explanation:</span>{' '}
                        <span className="text-foreground">{row.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}


/* Enrollment request: WhatsApp redirect + in-app support message (no phone calls) */
function EnrollDialog({
  open,
  onOpenChange,
  competitionName,
  competitionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionName?: string;
  competitionId?: string;
}) {
  const { studentId, studentName } = useStudentAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const waText = `Hi, I am ${studentName || 'a player'} on Compete Me. I would like to be enrolled in "${competitionName || 'a competition'}".`;
  const waLink = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(waText)}`;

  async function sendSupportMessage() {
    const text = message.trim();
    if (text.length < 5) {
      toast.error('Please type your message');
      return;
    }
    setSending(true);
    try {
      const { error } = await (supabase as any).from('support_tickets').insert({
        student_uuid: studentId,
        student_name: studentName || 'Unknown',
        test_id: competitionId || null,
        test_name: competitionName || null,
        message: `[Enrollment request] ${text}`,
      });
      if (error) throw error;
      toast.success('Request sent to admin');
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      console.error('Support message failed:', error);
      toast.error('Could not send your request. Please try WhatsApp.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">REQUEST ENROLLMENT</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <p className="text-sm text-muted-foreground">
            Competitions are allotted by the admin. Send your request below and we will enroll you.
          </p>

          <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full gradient-primary text-primary-foreground shadow-primary h-12">
              <MessageCircle className="w-5 h-5 mr-2" />
              Message us on WhatsApp
            </Button>
          </a>

          <div className="relative text-center">
            <span className="relative z-10 px-3 text-xs uppercase tracking-wide text-muted-foreground bg-background">
              or send a support message
            </span>
          </div>

          <div className="space-y-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`I would like to join "${competitionName || 'this competition'}"...`}
              maxLength={500}
              rows={3}
            />
            <Button
              variant="outline"
              className="w-full border-primary/30"
              disabled={sending}
              onClick={sendSupportMessage}
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Sending...' : 'Send to Admin'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
