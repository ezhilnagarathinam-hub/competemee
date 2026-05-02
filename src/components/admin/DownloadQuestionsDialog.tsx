import { useState } from 'react';
import { Download, FileText, FileType2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { exportQuestions, type QuestionForExport, type ExportMode, type ExportFormat } from '@/lib/exportQuestions';

interface DownloadQuestionsDialogProps {
  questions: QuestionForExport[];
  competitionName?: string;
  disabled?: boolean;
}

export function DownloadQuestionsDialog({ questions, competitionName, disabled }: DownloadQuestionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [watermark, setWatermark] = useState('');
  const [mode, setMode] = useState<ExportMode>('questions_only');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [busy, setBusy] = useState(false);

  function openDialog() {
    setTitle(competitionName ? `${competitionName} — Question Paper` : 'Question Paper');
    setWatermark('');
    setMode('questions_only');
    setFormat('pdf');
    setOpen(true);
  }

  async function handleDownload() {
    if (!title.trim()) {
      toast.error('Please enter a title for the question paper');
      return;
    }
    if (!questions || questions.length === 0) {
      toast.error('No questions available to download');
      return;
    }
    setBusy(true);
    try {
      await exportQuestions(questions, {
        title: title.trim(),
        watermark: watermark.trim() || undefined,
        mode,
        format,
        competitionName,
      });
      toast.success(`Downloaded as ${format.toUpperCase()}`);
      setOpen(false);
    } catch (err) {
      console.error('Question export failed:', err);
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? openDialog() : setOpen(false))}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-primary/50 text-primary hover:bg-primary/10"
          disabled={disabled}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Paper
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">DOWNLOAD QUESTION PAPER</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="qp-title">Title of Question Paper *</Label>
            <Input
              id="qp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. UPSC Mock Test - Set A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qp-watermark">Watermark (optional)</Label>
            <Input
              id="qp-watermark"
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              placeholder="e.g. CONFIDENTIAL"
            />
            <p className="text-xs text-muted-foreground">Applied diagonally on every page.</p>
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as ExportMode)} className="grid grid-cols-1 gap-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-primary/5">
                <RadioGroupItem value="questions_only" id="m-q" />
                <div>
                  <p className="font-bold text-foreground text-sm">Questions Only</p>
                  <p className="text-xs text-muted-foreground">Just the questions and options — no answers.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-primary/5">
                <RadioGroupItem value="with_answers" id="m-a" />
                <div>
                  <p className="font-bold text-foreground text-sm">Questions + Answers</p>
                  <p className="text-xs text-muted-foreground">Includes correct answer & explanation.</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)} className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-border cursor-pointer hover:bg-primary/5">
                <RadioGroupItem value="pdf" id="f-pdf" />
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">PDF (.pdf)</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-lg border border-border cursor-pointer hover:bg-primary/5">
                <RadioGroupItem value="word" id="f-word" />
                <FileType2 className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold">Word (.docx)</span>
              </label>
            </RadioGroup>
          </div>

          <p className="text-xs text-muted-foreground">
            {questions.length} question{questions.length === 1 ? '' : 's'} will be exported.
          </p>

          <Button
            onClick={handleDownload}
            disabled={busy || questions.length === 0}
            className="w-full gradient-primary text-primary-foreground"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" /> Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
