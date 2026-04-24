import { useEffect, useState } from 'react';
import { HelpCircle, Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useStudentAuth } from '@/lib/auth';
import { toast } from 'sonner';

const SUPPORT_EMAIL = 'eadreamssindia@gmail.com';

export function HelpDialog() {
  const { studentName, studentId } = useStudentAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [tests, setTests] = useState<{ id: string; name: string }[]>([]);
  const [selectedTest, setSelectedTest] = useState('other');
  const [message, setMessage] = useState('');

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

  function handleSend() {
    if (!message.trim()) {
      toast.error('Please type your issue / message before sending');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const testLabel =
      selectedTest === 'other'
        ? 'Other / General'
        : tests.find((t) => t.id === selectedTest)?.name || 'Other';

    const subject = `[Compete Me Help] ${testLabel} — ${name}`;
    const body =
      `Name: ${name}\n` +
      `Student ID: ${studentNumber || 'N/A'}\n` +
      `Test: ${testLabel}\n\n` +
      `Issue / Message:\n${message}\n\n` +
      `— Sent from Compete Me Student Portal`;

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Open user's mail client
    window.location.href = mailto;
    toast.success('Opening your email app to send the message...');

    setTimeout(() => {
      setOpen(false);
      setMessage('');
      setSelectedTest('other');
    }, 600);
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
            <Mail className="w-5 h-5 text-primary" />
            CONTACT SUPPORT
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Your message will be sent to <strong className="text-primary">{SUPPORT_EMAIL}</strong>
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
            className="w-full gradient-primary text-primary-foreground compete-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
