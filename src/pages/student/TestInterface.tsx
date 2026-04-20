import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Flag, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useStudentAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Competition, Question, StudentAnswer } from '@/types/database';

export default function TestInterface() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { studentId } = useStudentAuth();
  const navigate = useNavigate();
  
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Array<{ student_id: string; name: string; total_marks: number; current_question: number | null }>>([]);
  const [readyDialogOpen, setReadyDialogOpen] = useState(true);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [statusId, setStatusId] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef<Map<string, StudentAnswer>>(new Map());
  const queuedAnswerSavesRef = useRef<Record<string, { saving: boolean; pending: { answer: 'A' | 'B' | 'C' | 'D' | null; isReview: boolean } | null }>>({});
  const submittingRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const computeTotalMarks = useCallback((answerMap: Map<string, StudentAnswer>, questionList: Question[] = questions) => {
    let correctMarks = 0;
    let negativeMarks = 0;

    questionList.forEach((q) => {
      const ans = answerMap.get(q.id);
      if (!ans?.selected_answer) return;

      if (ans.is_correct) {
        correctMarks += Number(q.marks) || 0;
      } else {
        negativeMarks += (Number(q.marks) || 0) / 3;
      }
    });

    return Math.round((correctMarks - negativeMarks) * 100) / 100;
  }, [questions]);

  const waitForPendingAnswerSaves = useCallback(async () => {
    const startedAt = Date.now();

    while (Object.values(queuedAnswerSavesRef.current).some((entry) => entry?.saving || entry?.pending)) {
      if (Date.now() - startedAt > 5000) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }, []);

  const finalizeSubmission = useCallback(async ({
    submittedAt,
    successMessage,
    redirect = true,
  }: {
    submittedAt?: string;
    successMessage?: string;
    redirect?: boolean;
  } = {}) => {
    if (!studentId || !competitionId || submittingRef.current) return false;

    submittingRef.current = true;

    try {
      await waitForPendingAnswerSaves();

      const timestamp = submittedAt || new Date().toISOString();
      const totalMarks = computeTotalMarks(answersRef.current);

      const { data: existingRows, error: existingError } = await supabase
        .from('student_competitions')
        .select('id')
        .eq('student_id', studentId)
        .eq('competition_id', competitionId)
        .limit(1);

      if (existingError) throw existingError;

      const existingRowId = existingRows?.[0]?.id || statusId;

      if (existingRowId) {
        const { error: updateError } = await supabase
          .from('student_competitions')
          .update({
            has_submitted: true,
            submitted_at: timestamp,
            total_marks: totalMarks,
            is_locked: true,
            has_started: true,
            last_seen: timestamp,
          })
          .eq('id', existingRowId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('student_competitions')
          .insert([{ 
            student_id: studentId,
            competition_id: competitionId,
            has_submitted: true,
            submitted_at: timestamp,
            total_marks: totalMarks,
            is_locked: true,
            has_started: true,
            last_seen: timestamp,
          }]);

        if (insertError) throw insertError;
      }

      try {
        localStorage.setItem(`submittedCompetition:${competitionId}`, timestamp);
      } catch {
        // ignore storage issues
      }

      setSubmitDialogOpen(false);
      setTimeExpired(false);

      if (successMessage) {
        toast.success(successMessage);
      }

      if (redirect) {
        navigate('/student');
      }

      return true;
    } catch (error) {
      console.error('Error finalizing test submission:', error);
      toast.error('Failed to save your submission');
      return false;
    } finally {
      submittingRef.current = false;
    }
  }, [competitionId, computeTotalMarks, navigate, statusId, studentId, waitForPendingAnswerSaves]);

  useEffect(() => {
    if (competitionId && studentId) {
      fetchTestData();
    }
  }, [competitionId, studentId]);

  // Poll other players when in multiplayer mode / leaderboard visible
  useEffect(() => {
    let poll: NodeJS.Timeout | null = null;
    const startPolling = () => {
      fetchPlayers();
      poll = setInterval(fetchPlayers, 5000);
    };

    if (competition?.show_leaderboard) {
      startPolling();
    }

    return () => { if (poll) clearInterval(poll); };
  }, [competition, competitionId]);

  useEffect(() => {
    if (hasStarted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [hasStarted, timeLeft]);

  async function fetchTestData() {
    try {
      const { data: comp, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single();

      if (compError) throw compError;
      setCompetition(comp as Competition);
      setTimeLeft(comp.duration_minutes * 60);

      const { data: qs, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('competition_id', competitionId)
        .order('question_number');

      if (qError) throw qError;
      setQuestions((qs as Question[]) || []);

      // Fetch existing answers
      const { data: existingAnswers, error: ansError } = await supabase
        .from('student_answers')
        .select('*')
        .eq('student_id', studentId)
        .eq('competition_id', competitionId);

      if (ansError) throw ansError;

      const answerMap = new Map<string, StudentAnswer>();
      (existingAnswers as StudentAnswer[])?.forEach((a) => {
        answerMap.set(a.question_id, a);
      });
      setAnswers(answerMap);

      // Check if already started
      const { data: status } = await supabase
        .from('student_competitions')
        .select('*')
        .eq('student_id', studentId)
        .eq('competition_id', competitionId)
        .maybeSingle();

      if (status?.id) {
        setStatusId(status.id);
      }

      if (status?.current_question && status.current_question > 0 && status.current_question <= ((qs as Question[]) || []).length) {
        setCurrentIndex(status.current_question - 1);
      }

      if (status?.is_locked || status?.has_submitted) {
        toast.error('This test is locked. Contact admin to unlock.');
        navigate('/student');
        return;
      }

      if (status?.has_started) {
        setHasStarted(true);
        setReadyDialogOpen(false);

        // Calculate remaining time
        if (status.started_at) {
          const startTime = new Date(status.started_at).getTime();
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = (comp.duration_minutes * 60) - elapsed;

          if (remaining <= 0 && !status?.has_submitted && !status?.is_locked) {
            await finalizeSubmission({
              submittedAt: status.last_seen || new Date().toISOString(),
              successMessage: 'Time ended. Your test was saved and locked.',
            });
            return;
          }

          setTimeLeft(Math.max(0, remaining));
        }
      }
    } catch (error) {
      console.error('Error fetching test data:', error);
      toast.error('Failed to load test');
      navigate('/student');
    } finally {
      setLoading(false);
    }
  }

  // Fetch players' progress and marks for multiplayer UI (calls minimal REST API with supabase fallback)
  async function fetchPlayers() {
    if (!competitionId) return;
    const apiBase = (import.meta.env.VITE_PLAYERS_API_URL as string) || 'http://localhost:4000';
    try {
      const res = await fetch(`${apiBase}/players?competition_id=${competitionId}`);
      if (!res.ok) throw new Error('Players API responded with status ' + res.status);
      const playersData = await res.json();
      setPlayers(playersData || []);
      return;
    } catch (err) {
      console.warn('Players API fetch failed, falling back to direct DB (supabase):', err);
    }

    // Fallback: existing supabase-based aggregation (keeps UI working without the API)
    try {
      const { data: scRows, error: scErr } = await supabase
        .from('student_competitions')
        .select('student_id,total_marks')
        .eq('competition_id', competitionId)
        .eq('has_started', true);

      if (scErr) throw scErr;

      const studentIds = (scRows || []).map((r: any) => r.student_id);
      if (studentIds.length === 0) {
        setPlayers([]);
        return;
      }

      const { data: studs, error: sErr } = await supabase
        .from('students')
        .select('id,name')
        .in('id', studentIds as string[]);

      if (sErr) throw sErr;

      const { data: qData } = await supabase
        .from('student_answers')
        .select('student_id,questions(question_number)')
        .eq('competition_id', competitionId)
        .in('student_id', studentIds as string[])
        .order('created_at', { ascending: false });

      const currentMap = new Map<string, number | null>();
      (qData || []).forEach((row: any) => {
        const sid = row.student_id as string;
        const qn = row.questions?.question_number as number | undefined;
        if (!qn) return;
        const prev = currentMap.get(sid) || 0;
        if (qn > (prev as number)) currentMap.set(sid, qn);
      });

      const playerList = (scRows as any[]).map((r) => {
        const stud = (studs || []).find((s: any) => s.id === r.student_id) || { name: r.student_id };
        return {
          student_id: r.student_id,
          name: stud.name || r.student_id,
          total_marks: r.total_marks || 0,
          current_question: currentMap.get(r.student_id) ?? null,
        };
      });

      setPlayers(playerList);
    } catch (error) {
      console.error('Error fetching players (fallback):', error);
    }
  }

  const handleStartTest = async () => {
    try {
      const { data: existing } = await supabase
        .from('student_competitions')
        .select('*')
        .eq('student_id', studentId)
        .eq('competition_id', competitionId)
        .maybeSingle();

       if (!existing) {
         const { data: inserted, error } = await supabase.from('student_competitions').insert([{
          student_id: studentId,
          competition_id: competitionId,
          has_started: true,
          started_at: new Date().toISOString(),
           current_question: 1,
           is_locked: false,
         }]).select('id').single();
         if (error) throw error;
         setStatusId(inserted.id);
      } else {
         const { error } = await supabase
          .from('student_competitions')
           .update({ has_started: true, started_at: existing.started_at || new Date().toISOString(), current_question: existing.current_question || 1 })
          .eq('id', existing.id);
         if (error) throw error;
         setStatusId(existing.id);
      }

      setHasStarted(true);
      setReadyDialogOpen(false);
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Failed to start test');
    }
  };

  const saveAnswer = useCallback(async (questionId: string, answer: 'A' | 'B' | 'C' | 'D' | null, isReview: boolean) => {
    if (!studentId || !competitionId || submittingRef.current) return;

    const question = questions.find(q => q.id === questionId);
    const isCorrect = answer ? answer === question?.correct_answer : null;
    const pendingState = queuedAnswerSavesRef.current[questionId] || { saving: false, pending: null };
    pendingState.pending = { answer, isReview };
    queuedAnswerSavesRef.current[questionId] = pendingState;

    setAnswers((prev) => {
      const existing = prev.get(questionId);
      const next = new Map(prev);
      next.set(questionId, {
        ...existing,
        id: existing?.id || '',
        student_id: studentId,
        question_id: questionId,
        competition_id: competitionId,
        selected_answer: answer,
        is_marked_for_review: isReview,
        is_correct: isCorrect,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as StudentAnswer);
      return next;
    });

    if (pendingState.saving) return;
    pendingState.saving = true;

    while (pendingState.pending) {
      const nextSave = pendingState.pending;
      pendingState.pending = null;
      const currentExisting = answersRef.current.get(questionId);
      const nextIsCorrect = nextSave.answer ? nextSave.answer === question?.correct_answer : null;

      try {
        if (currentExisting?.id) {
          const { error } = await supabase
            .from('student_answers')
            .update({
              selected_answer: nextSave.answer,
              is_marked_for_review: nextSave.isReview,
              is_correct: nextIsCorrect,
            })
            .eq('id', currentExisting.id);

          if (error) throw error;

          setAnswers((prev) => {
            const next = new Map(prev);
            const existing = next.get(questionId);
            if (existing) {
              next.set(questionId, {
                ...existing,
                selected_answer: nextSave.answer,
                is_marked_for_review: nextSave.isReview,
                is_correct: nextIsCorrect,
                updated_at: new Date().toISOString(),
              });
            }
            return next;
          });
        } else {
          const { data: insertedAnswer, error } = await supabase
            .from('student_answers')
            .insert([{ 
              student_id: studentId,
              question_id: questionId,
              competition_id: competitionId,
              selected_answer: nextSave.answer,
              is_marked_for_review: nextSave.isReview,
              is_correct: nextIsCorrect,
            }])
            .select()
            .single();

          if (error) throw error;

          setAnswers((prev) => {
            const next = new Map(prev);
            next.set(questionId, insertedAnswer as StudentAnswer);
            return next;
          });
        }
      } catch (error) {
        console.error('Error saving answer:', error);
        toast.error('Failed to save answer');
      }
    }

    pendingState.saving = false;
  }, [competitionId, questions, studentId]);

  const handleSelectAnswer = (option: 'A' | 'B' | 'C' | 'D') => {
    const currentQ = questions[currentIndex];
    const currentAnswer = answers.get(currentQ.id);
    saveAnswer(currentQ.id, option, currentAnswer?.is_marked_for_review || false);
  };

  useEffect(() => {
    if (!statusId || !hasStarted || !competitionId || !studentId || questions.length === 0) return;

    const questionNumber = questions[currentIndex]?.question_number;
    if (!questionNumber) return;

    void supabase
      .from('student_competitions')
      .update({
        current_question: questionNumber,
        last_seen: new Date().toISOString(),
      })
      .eq('id', statusId)
      .eq('student_id', studentId)
      .eq('competition_id', competitionId);
  }, [statusId, hasStarted, competitionId, studentId, questions, currentIndex]);

  const handleMarkReview = () => {
    const currentQ = questions[currentIndex];
    const currentAnswer = answers.get(currentQ.id);
    saveAnswer(currentQ.id, currentAnswer?.selected_answer || null, true);
    toast.success('Marked for review');
  };

  const handleDeleteAnswer = () => {
    const currentQ = questions[currentIndex];
    saveAnswer(currentQ.id, null, false);
    toast.success('Answer cleared');
  };

  const [timeExpired, setTimeExpired] = useState(false);

  const handleAutoSubmit = async () => {
    setTimeExpired(true);
    await finalizeSubmission({
      submittedAt: new Date().toISOString(),
      successMessage: 'Time ended. Your test was saved and locked.',
    });
  };

  const submitTest = async () => {
    if (timeExpired) {
      toast.error('This test is already locked.');
      return;
    }

    await finalizeSubmission({
      submittedAt: new Date().toISOString(),
      successMessage: 'Test submitted successfully!',
    });
  };

  const handleFinalSubmit = () => {
    if (timeExpired) {
      toast.error('You cannot submit the test as time has ended. Contact Admin for recovery.');
      return;
    }
    setSubmitDialogOpen(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading test...</p>
      </div>
    );
  }

  if (!competition || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <p className="text-muted-foreground">No questions available for this test.</p>
          <Button onClick={() => navigate('/student')} className="mt-4">Go Back</Button>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers.get(currentQuestion.id);
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Ready Dialog */}
      <Dialog open={readyDialogOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ready to start the test?</DialogTitle>
            <DialogDescription>
              <div className="mt-4 space-y-2">
                <p><strong>Competition:</strong> {competition.name}</p>
                <p><strong>Duration:</strong> {competition.duration_minutes} minutes</p>
                <p><strong>Questions:</strong> {questions.length}</p>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-sm text-warning">
                  ⚠️ Once you start, the timer cannot be paused. Make sure you're ready.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => navigate('/student')}>
              Go Back
            </Button>
            <Button onClick={handleStartTest} className="gradient-primary text-primary-foreground">
              Start Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirm Submission
            </DialogTitle>
            <DialogDescription>
              <div className="mt-4 space-y-2">
                <p>Are you sure you want to submit your test?</p>
                <div className="mt-4 p-3 rounded-lg bg-muted">
                  <p className="text-sm">
                    <strong>Answered:</strong> {Array.from(answers.values()).filter(a => a.selected_answer).length} / {questions.length}
                  </p>
                  <p className="text-sm">
                    <strong>Marked for review:</strong> {Array.from(answers.values()).filter(a => a.is_marked_for_review).length}
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Continue Test
            </Button>
            <Button onClick={submitTest} className="gradient-primary text-primary-foreground">
              Submit Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {timeExpired && (
        <div className="fixed inset-0 z-[100] bg-background/95 flex items-center justify-center">
          <Card className="max-w-md p-8 text-center glass-card border-destructive/50">
            <AlertTriangle className="w-16 h-16 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-bold text-destructive font-display mb-2">TIME ENDED</h2>
            <p className="text-foreground mb-4">You cannot submit the test as time has ended.</p>
            <p className="text-muted-foreground mb-6">Contact Admin for recovery.</p>
            <Button onClick={() => navigate('/student')} variant="outline">
              Go Back to Dashboard
            </Button>
          </Card>
        </div>
      )}

      {hasStarted && (
        <>
          {/* Header with Timer */}
          <header 
            className="sticky top-0 z-50 border-b py-3 px-4"
            style={{ backgroundColor: competition.primary_color }}
          >
            <div className="container mx-auto flex items-center justify-between">
              <div className="text-primary-foreground">
                <h1 className="font-bold text-lg font-display uppercase tracking-wider">
                  <span className="text-primary-foreground/70">COMPETE</span> ME | {competition.name}
                </h1>
                <p className="text-sm opacity-90">Question {currentIndex + 1} of {questions.length}</p>
              </div>
              <div className={`timer-display px-4 py-2 rounded-xl ${timeLeft <= 60 ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-card text-foreground'}`}>
                <Clock className="w-5 h-5 inline-block mr-2" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </header>

          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Question Panel */}
              <div className="lg:col-span-3">
                <Card className="border-border/50">
                  <CardContent className="p-6">
                    {/* Question */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm">
                          Question {currentQuestion.question_number}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {currentQuestion.marks} mark{currentQuestion.marks > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-lg text-foreground">{currentQuestion.question_text}</p>
                      {currentQuestion.image_url && (
                        <img 
                          src={currentQuestion.image_url} 
                          alt="Question" 
                          className="mt-4 max-h-64 rounded-lg object-contain"
                        />
                      )}
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const optionKey = `option_${opt.toLowerCase()}` as keyof Question;
                        const isSelected = currentAnswer?.selected_answer === opt;
                        
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelectAnswer(opt)}
                            className={`question-option w-full text-left ${isSelected ? 'selected' : ''}`}
                          >
                            <div className="flex items-center gap-4">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                              }`}>
                                {opt}
                              </span>
                              <span className="flex-1">{currentQuestion[optionKey] as string}</span>
                              {isSelected && <Check className="w-5 h-5 text-primary" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-border">
                      <Button
                        variant="outline"
                        onClick={handleMarkReview}
                        className="text-warning border-warning hover:bg-warning/10"
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Mark for Review
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDeleteAnswer}
                        className="text-destructive border-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear Answer
                      </Button>
                      {isLastQuestion && (
                        <Button
                          onClick={handleFinalSubmit}
                          className="ml-auto gradient-primary text-primary-foreground"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Submit Test
                        </Button>
                      )}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between mt-6">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                        disabled={currentIndex === 0}
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
                        disabled={isLastQuestion}
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Question Navigator */}
              <div className="lg:col-span-1">
                <Card className="border-border/50 sticky top-24">
                  <CardContent className="p-4 space-y-4">
                    {/* Players Panel (multiplayer) */}
                    {competition?.show_leaderboard && (
                      <div>
                        <h3 className="font-medium text-foreground mb-3">Players</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {players.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No players active</p>
                          ) : (
                            players.map((p) => (
                              <div key={p.student_id} className={`p-2 rounded border ${p.student_id === studentId ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-medium">{p.name}</div>
                                  <div className="text-xs text-muted-foreground">{p.total_marks} pts</div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">Q: {p.current_question ?? '-'} </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Question Navigator */}
                    <div>
                      <h3 className="font-medium text-foreground mb-4">Question Navigator</h3>
                      <div className="grid grid-cols-5 gap-2">
                        {questions.map((q, idx) => {
                          const ans = answers.get(q.id);
                          const isAnswered = !!ans?.selected_answer;
                          const isReview = ans?.is_marked_for_review;
                          const isCurrent = idx === currentIndex;
                          
                          return (
                            <button
                              key={q.id}
                              onClick={() => setCurrentIndex(idx)}
                              className={`question-nav-btn ${
                                isReview ? 'review' : isAnswered ? 'answered' : 'unanswered'
                              } ${isCurrent ? 'current' : ''}`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-muted" />
                          <span className="text-muted-foreground">Not Answered</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-primary" />
                          <span className="text-muted-foreground">Answered</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-warning" />
                          <span className="text-muted-foreground">Marked for Review</span>
                        </div>
                      </div>

                      <Button
                        onClick={handleFinalSubmit}
                        className="w-full mt-4 gradient-primary text-primary-foreground"
                      >
                        Submit Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
