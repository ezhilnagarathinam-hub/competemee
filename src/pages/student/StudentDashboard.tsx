import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Clock, Play, CheckCircle, Lock, Zap, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStudentAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Competition, StudentCompetition } from '@/types/database';
import { format, isToday, parseISO } from 'date-fns';

interface CompetitionWithStatus extends Competition {
  studentStatus?: StudentCompetition;
}

export default function StudentDashboard() {
  const { studentId } = useStudentAuth();
  const [competitions, setCompetitions] = useState<CompetitionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (studentId) {
      fetchCompetitions();
    }
  }, [studentId]);

  async function fetchCompetitions() {
    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from('student_competitions')
        .select(`
          *,
          competitions!inner(*)
        `)
        .eq('student_id', studentId);

      if (enrollError) throw enrollError;

      const compsWithStatus: CompetitionWithStatus[] = ((enrollments || []) as any[])
        .filter((e) => e.competitions?.is_active)
        .map((e) => ({
          ...(e.competitions as Competition),
          studentStatus: {
            id: e.id,
            student_id: e.student_id,
            competition_id: e.competition_id,
            has_started: e.has_started,
            has_submitted: e.has_submitted,
            started_at: e.started_at,
            submitted_at: e.submitted_at,
            total_marks: e.total_marks,
            is_locked: e.is_locked ?? false,
          } as StudentCompetition,
        }));

      setCompetitions(compsWithStatus);
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast.error('Failed to load competitions');
    } finally {
      setLoading(false);
    }
  }

  function canStartTest(comp: CompetitionWithStatus): boolean {
    // If locked by admin, cannot start
    if (comp.studentStatus?.is_locked) return false;
    // If already submitted, cannot start
    if (comp.studentStatus?.has_submitted) return false;
    
    const now = new Date();
    const compDate = parseISO(comp.date);
    
    if (!isToday(compDate)) return false;
    
    const [startH, startM] = comp.start_time.split(':').map(Number);
    const [endH, endM] = comp.end_time.split(':').map(Number);
    
    const startTime = new Date(now);
    startTime.setHours(startH, startM, 0, 0);
    
    const endTime = new Date(now);
    endTime.setHours(endH, endM, 0, 0);
    
    return now >= startTime && now <= endTime;
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
        const { error } = await supabase
          .from('student_competitions')
          .insert([{
            student_id: studentId,
            competition_id: competitionId,
            has_started: true,
            started_at: new Date().toISOString(),
          }]);
        
        if (error) throw error;
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

            return (
              <Card key={comp.id} className="glass-card overflow-hidden hover:border-primary/50 transition-all">
                <div
                  className="h-2 shadow-lg"
                  style={{ backgroundColor: comp.primary_color }}
                />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground mb-2 font-display">{comp.name}</h3>
                      {comp.description && (
                        <p className="text-sm text-muted-foreground mb-3">{comp.description}</p>
                      )}
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(parseISO(comp.date), 'MMM dd, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {comp.start_time} - {comp.end_time}
                        </span>
                        <span>{comp.duration_minutes} minutes</span>
                      </div>
                    </div>

                    <div className="ml-4">
                      {isLocked ? (
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
      
      // Sort by question_number client-side
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
                        <p className="text-foreground font-medium">{q.question_text}</p>
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
