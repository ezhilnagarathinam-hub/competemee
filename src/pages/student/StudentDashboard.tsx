import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Clock, Play, CheckCircle, Lock, Zap, Eye, Phone, Medal, Award, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudentAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Competition, StudentCompetition } from '@/types/database';
import { format, isToday, parseISO } from 'date-fns';
import { formatTime12 } from '@/lib/timeFormat';

interface CompetitionWithStatus extends Competition {
  studentStatus?: StudentCompetition;
  isEnrolled: boolean;
}

export default function StudentDashboard() {
  const { studentId } = useStudentAuth();
  const [competitions, setCompetitions] = useState<CompetitionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [, setTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (studentId) {
      fetchCompetitions();
    }
  }, [studentId]);

  // Force re-render every 5 seconds so button states update in real-time
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCompetitions() {
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
        return {
          ...comp,
          isEnrolled: !!enrollment,
          studentStatus: enrollment ? {
            id: enrollment.id,
            student_id: enrollment.student_id,
            competition_id: enrollment.competition_id,
            has_started: enrollment.has_started,
            has_submitted: enrollment.has_submitted,
            started_at: enrollment.started_at,
            submitted_at: enrollment.submitted_at,
            total_marks: enrollment.total_marks,
            is_locked: enrollment.is_locked ?? false,
          } as StudentCompetition : undefined,
        };
      });

      setCompetitions(compsWithStatus);
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast.error('Failed to load competitions');
    } finally {
      setLoading(false);
    }
  }

  function canStartTest(comp: CompetitionWithStatus): boolean {
    if (!comp.isEnrolled) return false;
    if (comp.studentStatus?.is_locked) return false;
    if (comp.studentStatus?.has_submitted) return false;
    
    const now = new Date();
    const startDate = parseISO(comp.date);
    const endDate = comp.end_date ? parseISO(comp.end_date) : startDate;
    
    const [startH, startM] = comp.start_time.split(':').map(Number);
    const [endH, endM] = comp.end_time.split(':').map(Number);
    
    const windowStart = new Date(startDate);
    windowStart.setHours(startH, startM, 0, 0);
    
    const windowEnd = new Date(endDate);
    windowEnd.setHours(endH, endM, 0, 0);
    
    return now >= windowStart && now <= windowEnd;
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
      const { data: existing } = await supabase
        .from('student_competitions')
        .select('*')
        .eq('student_id', studentId)
        .eq('competition_id', competitionId)
        .maybeSingle();

      if (!existing) {
        toast.error('You are not enrolled in this competition');
        return;
      } else if (!existing.has_started) {
        const { error } = await supabase
          .from('student_competitions')
          .update({
            has_started: true,
            started_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
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
            const hasSubmitted = comp.studentStatus?.has_submitted;
            const hasStarted = comp.studentStatus?.has_started;
            const isLocked = comp.studentStatus?.is_locked;
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
                        {!isEnrolled && (
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
                      {isEnrolled && !hasSubmitted && !isLocked && (
                        <CountdownTimer comp={comp} />
                      )}
                    </div>

                    <div className="ml-4">
                      {!isEnrolled ? (
                        <Button
                          variant="outline"
                          onClick={() => setContactDialogOpen(true)}
                          className="border-primary/30 hover:bg-primary/10"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Enroll Now
                        </Button>
                      ) : isLocked ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/20 text-destructive border border-destructive/30">
                          <Lock className="w-5 h-5" />
                          <span className="font-bold">LOCKED</span>
                        </div>
                      ) : hasSubmitted ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent border border-accent/30">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-bold font-display">DONE</span>
                        </div>
                      ) : hasStarted && !canStart ? (
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
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground">
                          <Lock className="w-5 h-5" />
                          <span className="font-bold">NOT YET</span>
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

      {/* Contact Dialog for non-enrolled students */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="glass-card text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">ENROLL IN THIS COMPETITION</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <Phone className="w-16 h-16 mx-auto text-primary" />
            <p className="text-foreground text-lg">
              Contact our team to get enrolled into this competition
            </p>
            <a 
              href="tel:9487277924"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-lg shadow-primary"
            >
              <Phone className="w-5 h-5" />
              9487277924
            </a>
            <p className="text-sm text-muted-foreground">
              Call or WhatsApp us to register
            </p>
          </div>
        </DialogContent>
      </Dialog>


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
      const now = new Date();
      const startDate = parseISO(comp.date);
      const endDate = comp.end_date ? parseISO(comp.end_date) : startDate;
      const [startH, startM] = comp.start_time.split(':').map(Number);
      const [endH, endM] = comp.end_time.split(':').map(Number);
      
      const startTime = new Date(startDate);
      startTime.setHours(startH, startM, 0, 0);
      const endTime = new Date(endDate);
      endTime.setHours(endH, endM, 0, 0);

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
  const { studentId } = useStudentAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [detailedAnswers, setDetailedAnswers] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (studentId) {
      fetchResults();
    }
  }, [studentId]);

  async function fetchResults() {
    try {
      const { data, error } = await supabase
        .from('student_competitions')
        .select(`
          *,
          competitions!inner(*)
        `)
        .eq('student_id', studentId)
        .eq('has_submitted', true);

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  }

  async function viewDetails(result: any) {
    setSelectedResult(result);
    setDetailsLoading(true);
    
    try {
      const { data: answers, error } = await supabase
        .from('student_answers')
        .select(`
          *,
          questions!inner(*)
        `)
        .eq('student_id', studentId)
        .eq('competition_id', result.competition_id);

      if (error) throw error;
      
      const sorted = (answers || []).sort((a: any, b: any) => 
        (a.questions?.question_number || 0) - (b.questions?.question_number || 0)
      );
      setDetailedAnswers(sorted);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load details');
    } finally {
      setDetailsLoading(false);
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
              key={result.id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-all"
            >
              <div>
                <h4 className="font-bold text-foreground font-display">{comp?.name || 'Unknown'}</h4>
                <p className="text-sm text-muted-foreground">
                  Submitted: {result.submitted_at ? new Date(result.submitted_at).toLocaleString() : '-'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {showResult ? (
                  <>
                    <div className="text-2xl font-bold text-primary font-display">
                      {result.total_marks} <span className="text-sm text-muted-foreground">pts</span>
                    </div>
                    {showDetails && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewDetails(result)}
                        className="border-accent/50 text-accent hover:bg-accent/10"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Answers
                      </Button>
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
              ANSWER REVIEW - {selectedResult?.competitions?.name}
            </DialogTitle>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading answers...</div>
          ) : (
            <div className="space-y-4">
              {detailedAnswers.map((answer) => {
                const q = answer.questions;
                if (!q) return null;
                const isCorrect = answer.is_correct;
                const selectedAnswer = answer.selected_answer;
                const correctAnswer = q.correct_answer;
                
                return (
                  <div 
                    key={answer.id}
                    className={`p-4 rounded-xl border-2 ${
                      isCorrect 
                        ? 'border-accent/50 bg-accent/10' 
                        : 'border-destructive/50 bg-destructive/10'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        isCorrect ? 'bg-accent text-accent-foreground' : 'bg-destructive text-destructive-foreground'
                      }`}>
                        {q.question_number}
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-medium whitespace-pre-wrap">{q.question_text}</p>
                        {q.image_url && (
                          <img src={q.image_url} alt="Question" className="mt-2 max-h-24 rounded-lg" />
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        isCorrect ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {isCorrect ? `+${q.marks}` : '0'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const optKey = `option_${opt.toLowerCase()}` as keyof typeof q;
                        const isThisCorrect = correctAnswer === opt;
                        const isThisSelected = selectedAnswer === opt;
                        
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
                            <span className="font-bold">{opt}.</span> {q[optKey] as string}
                            {isThisCorrect && <span className="ml-2">✓</span>}
                            {isThisSelected && !isThisCorrect && <span className="ml-2">✗</span>}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                        <span className="font-bold text-primary">Explanation:</span>{' '}
                        <span className="text-foreground">{q.explanation}</span>
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
