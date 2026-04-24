import { useEffect, useState } from 'react';
import { HelpCircle, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useStudentAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function HelpDialog() {
  const { studentName, studentId } = useStudentAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [tests, setTests] = useState<{ id: string; name: string }[]>([]);
  const [selectedTest, setSelectedTest] = useState('other');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !studentId) return;
    setName(studentName || '');

    (async () => {
      const { data: stu } = await supabase
        .from('students')
        .select('student_number, username')
        .eq('id', studentId)
        .maybeSingle();
      if (stu) setStudentNumber(String(stu.student_number ?? stu.username ?? ''));

      const { data: comps } = await supabase
        .from('competitions')
        .select('id, name')
        .order('date', { ascending: false });
      setTests((comps || []) as any);
    })();
  }, [open, studentId, studentName]);

  async function handleSend() {
    if (!message.trim()) {
      toast.error('Please type your issue / message before sending');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setSending(true);
    const isOther = selectedTest === 'other';
    const testLabel = isOther
      ? 'Other / General'
      : tests.find((t) => t.id === selectedTest)?.name || 'Other';

    const { error } = await (supabase as any).from('support_tickets').insert({
      student_uuid: studentId || null,
      student_name: name.trim(),
      student_number: studentNumber?.trim() || null,
      test_id: isOther ? null : selectedTest,
      test_name: testLabel,
      message: message.trim(),
      status: 'open',
    });
    setSending(false);

    if (error) {
      console.error('support ticket insert error', error);
      toast.error('Could not submit your message. Please try again.');
      return;
    }

    toast.success('Your message was sent to the support team!');
    setOpen(false);
    setMessage('');
    setSelectedTest('other');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            CONTACT SUPPORT
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Your message will be delivered to the <strong className="text-primary">Compete Me</strong> support team. We'll get back to you soon.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="help-name">Name</Label>
            <Input
              id="help-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-sid">Student ID</Label>
            <Input
              id="help-sid"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="Your student number / username"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Report on which test?</Label>
            <Select value={selectedTest} onValueChange={setSelectedTest}>
              <SelectTrigger>
                <SelectValue placeholder="Select a test" />
              </SelectTrigger>
              <SelectContent>
                {tests.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                <SelectItem value="other">Other / General issue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-msg">Your Message</Label>
            <Textarea
              id="help-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or feedback..."
              rows={5}
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {message.length}/2000
            </p>
          </div>

          <Button
            onClick={handleSend}
            disabled={sending}
            className="w-full gradient-primary text-primary-foreground compete-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
