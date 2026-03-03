import { useEffect, useState } from 'react';
import { Plus, Image, Trash2, Edit, FileQuestion, Upload, FileImage, Loader2, Sparkles, Copy, ArrowUp, ArrowDown, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Competition, Question } from '@/types/database';

export default function Questions() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    question_text: '',
    image_url: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A' as 'A' | 'B' | 'C' | 'D',
    marks: 1,
    explanation: '',
  });

  useEffect(() => {
    fetchCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      fetchQuestions(selectedCompetition);
    }
  }, [selectedCompetition]);

  async function fetchCompetitions() {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setCompetitions((data as Competition[]) || []);
      if (data && data.length > 0) {
        setSelectedCompetition(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching competitions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchQuestions(competitionId: string) {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('competition_id', competitionId)
        .order('question_number');

      if (error) throw error;
      setQuestions((data as Question[]) || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from('questions')
          .update({
            question_text: formData.question_text,
            option_a: formData.option_a,
            option_b: formData.option_b,
            option_c: formData.option_c,
            option_d: formData.option_d,
            correct_answer: formData.correct_answer,
            marks: formData.marks,
            explanation: formData.explanation || null,
            image_url: formData.image_url || null,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Question updated successfully');
      } else {
        const nextNumber = questions.length + 1;
        const { error } = await supabase
          .from('questions')
          .insert([{
            question_text: formData.question_text,
            option_a: formData.option_a,
            option_b: formData.option_b,
            option_c: formData.option_c,
            option_d: formData.option_d,
            correct_answer: formData.correct_answer,
            marks: formData.marks,
            explanation: formData.explanation || null,
            competition_id: selectedCompetition,
            question_number: nextNumber,
            image_url: formData.image_url || null,
          }]);
        if (error) throw error;
        toast.success('Question added successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchQuestions(selectedCompetition);
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Question deleted');
      fetchQuestions(selectedCompetition);
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  }

  async function moveQuestion(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;

    const q1 = questions[index];
    const q2 = questions[swapIndex];

    try {
      await Promise.all([
        supabase.from('questions').update({ question_number: q2.question_number }).eq('id', q1.id),
        supabase.from('questions').update({ question_number: q1.question_number }).eq('id', q2.id),
      ]);
      fetchQuestions(selectedCompetition);
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Failed to reorder');
    }
  }

  function copyQuestion(q: Question) {
    setFormData({
      question_text: q.question_text,
      image_url: q.image_url || '',
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: q.marks,
      explanation: (q as any).explanation || '',
    });
    setEditingId(null);
    setDialogOpen(true);
    toast.info('Question copied — save to add as new');
  }

  function resetForm() {
    setFormData({
      question_text: '',
      image_url: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      marks: 1,
      explanation: '',
    });
    setEditingId(null);
  }

  function openEdit(q: Question) {
    setFormData({
      question_text: q.question_text,
      image_url: q.image_url || '',
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: q.marks,
      explanation: (q as any).explanation || '',
    });
    setEditingId(q.id);
    setDialogOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `questions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('question-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  async function handleOcrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept images, PDFs, and Word docs
    const allowedTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
    
    if (!isAllowed) {
      toast.error('Please upload an image (JPG, PNG, WEBP), PDF, or Word document.');
      return;
    }

    setOcrProcessing(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'OCR processing failed');
      }

      const { questions: extractedQuestions } = await response.json();
      
      if (!extractedQuestions || extractedQuestions.length === 0) {
        toast.error('No questions could be extracted from the file');
        return;
      }

      let addedCount = 0;
      for (const q of extractedQuestions) {
        const nextNumber = questions.length + addedCount + 1;
        const { error } = await supabase
          .from('questions')
          .insert([{
            competition_id: selectedCompetition,
            question_number: nextNumber,
            question_text: q.question_text,
            option_a: q.option_a || '',
            option_b: q.option_b || '',
            option_c: q.option_c || '',
            option_d: q.option_d || '',
            correct_answer: q.correct_answer || 'A',
            marks: q.marks || 1,
            explanation: q.explanation || null,
          }]);
        
        if (!error) addedCount++;
      }

      toast.success(`Successfully imported ${addedCount} questions!`);
      setOcrDialogOpen(false);
      fetchQuestions(selectedCompetition);
    } catch (error) {
      console.error('OCR error:', error);
      toast.error(error instanceof Error ? error.message : 'OCR processing failed');
    } finally {
      setOcrProcessing(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">QUESTIONS</h1>
          <p className="text-muted-foreground mt-1">Build your question arsenal</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select competition" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map((comp) => (
                <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* OCR Upload Dialog */}
          <Dialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="border-accent/50 text-accent hover:bg-accent/10"
                disabled={!selectedCompetition}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                OCR Import
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card">
              <DialogHeader>
                <DialogTitle className="font-display">OCR QUESTION IMPORT</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Upload an image, PDF, or Word document of your question paper. Supports Tamil & English.
                </p>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                  {ocrProcessing ? (
                    <div className="space-y-4">
                      <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                      <p className="text-muted-foreground">Processing with AI...</p>
                    </div>
                  ) : (
                    <>
                      <FileImage className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Drag & drop or click to upload<br />
                        <span className="text-xs">JPG, PNG, WEBP, PDF, DOC, DOCX</span>
                      </p>
                      <Input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleOcrUpload}
                        className="cursor-pointer"
                      />
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button 
                className="gradient-primary text-primary-foreground shadow-primary compete-btn"
                disabled={!selectedCompetition}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card">
              <DialogHeader>
                <DialogTitle className="font-display">{editingId ? 'EDIT QUESTION' : 'ADD NEW QUESTION'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="question">Question (Tamil/English supported)</Label>
                  <Textarea
                    id="question"
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    placeholder="உங்கள் கேள்வியை இங்கே உள்ளிடவும் / Enter your question here..."
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Question Image (Optional)</Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="flex-1"
                        />
                        {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Or paste an image URL below:</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  {formData.image_url && (
                    <img 
                      src={formData.image_url} 
                      alt="Preview" 
                      className="mt-2 max-h-32 rounded-lg object-contain border border-border"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="option_a">Option A</Label>
                    <Input id="option_a" value={formData.option_a} onChange={(e) => setFormData({ ...formData, option_a: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="option_b">Option B</Label>
                    <Input id="option_b" value={formData.option_b} onChange={(e) => setFormData({ ...formData, option_b: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="option_c">Option C</Label>
                    <Input id="option_c" value={formData.option_c} onChange={(e) => setFormData({ ...formData, option_c: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="option_d">Option D</Label>
                    <Input id="option_d" value={formData.option_d} onChange={(e) => setFormData({ ...formData, option_d: e.target.value })} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <RadioGroup
                    value={formData.correct_answer}
                    onValueChange={(value) => setFormData({ ...formData, correct_answer: value as 'A' | 'B' | 'C' | 'D' })}
                    className="flex gap-6"
                  >
                    {['A', 'B', 'C', 'D'].map((opt) => (
                      <div key={opt} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt} id={`answer_${opt}`} />
                        <Label htmlFor={`answer_${opt}`}>{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="explanation" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-accent" />
                    Answer Explanation (Optional)
                  </Label>
                  <Textarea
                    id="explanation"
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    placeholder="Explain why this answer is correct..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marks">Marks</Label>
                  <Input
                    id="marks"
                    type="number"
                    min="1"
                    value={formData.marks}
                    onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                    className="w-24"
                    required
                  />
                </div>

                <Button type="submit" className="w-full gradient-primary text-primary-foreground compete-btn">
                  {editingId ? 'Update Question' : 'Add Question'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!selectedCompetition ? (
        <Card className="border-dashed glass-card">
          <CardContent className="py-12 text-center">
            <FileQuestion className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bold text-foreground mb-1 font-display">SELECT A COMPETITION</h3>
            <p className="text-sm text-muted-foreground">Choose a competition to manage its questions</p>
          </CardContent>
        </Card>
      ) : questions.length === 0 ? (
        <Card className="border-dashed glass-card">
          <CardContent className="py-12 text-center">
            <FileQuestion className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bold text-foreground mb-1 font-display">NO QUESTIONS YET</h3>
            <p className="text-sm text-muted-foreground">Add questions manually or use OCR Import</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, index) => (
            <Card key={q.id} className="glass-card hover:border-primary/30 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === 0} onClick={() => moveQuestion(index, 'up')}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 shadow-primary">
                      <span className="font-bold text-primary-foreground font-display">{q.question_number}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 'down')}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-3">{q.question_text}</p>
                    {q.image_url && (
                      <img 
                        src={q.image_url} 
                        alt="Question" 
                        className="mb-3 max-h-32 rounded-lg object-contain border border-border"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const optionKey = `option_${opt.toLowerCase()}` as keyof Question;
                        const isCorrect = q.correct_answer === opt;
                        return (
                          <div 
                            key={opt}
                            className={`p-2 rounded-lg ${isCorrect ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-muted/50 text-muted-foreground'}`}
                          >
                            <span className="font-bold">{opt}.</span> {q[optionKey] as string}
                            {isCorrect && <span className="ml-2 font-bold">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                    {(q as any).explanation && (
                      <div className="mt-2 p-2 rounded-lg bg-accent/10 border border-accent/20 text-sm">
                        <span className="font-bold text-accent">Explanation:</span>{' '}
                        <span className="text-muted-foreground">{(q as any).explanation}</span>
                      </div>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">Points: <span className="font-bold text-primary">{q.marks}</span></p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyQuestion(q)} className="border-accent/30 hover:bg-accent/10" title="Duplicate">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(q)} className="border-primary/30 hover:bg-primary/10">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => deleteQuestion(q.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
