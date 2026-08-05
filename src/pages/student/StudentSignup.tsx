import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, User, Phone, GraduationCap, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const EXAM_OPTIONS = [
  'UPSC Civil Services',
  'TNPSC',
  'SSC',
  'Banking (IBPS / SBI)',
  'Railway (RRB)',
  'TNUSRB / Police',
  'Teaching (TET / NET)',
  'Other',
];

export default function StudentSignup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [exam, setExam] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanName.length < 3) {
      toast.error('Please enter your full name');
      return;
    }
    if (cleanPhone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    if (!exam) {
      toast.error('Please select the exam you are preparing for');
      return;
    }

    setLoading(true);
    try {
      // Already a player with this phone?
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existing) {
        toast.error('An account already exists for this phone number. Please log in.');
        setLoading(false);
        return;
      }

      const { data: pending } = await (supabase as any)
        .from('student_signup_requests')
        .select('id, status')
        .eq('phone', cleanPhone)
        .eq('status', 'pending')
        .maybeSingle();

      if (pending) {
        setDone(true);
        setLoading(false);
        return;
      }

      const { error } = await (supabase as any).from('student_signup_requests').insert({
        name: cleanName,
        phone: cleanPhone,
        exam,
        note: note.trim() || null,
      });

      if (error) throw error;
      setDone(true);
    } catch (error) {
      console.error('Signup request failed:', error);
      toast.error('Could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse-slow" />

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-accent shadow-accent mb-4 energy-pulse">
            <Zap className="w-10 h-10 text-accent-foreground animate-glow" />
          </div>
          <h1 className="text-3xl font-bold font-display">
            <span className="neon-text">COMPETE</span> <span className="text-foreground">ME</span>
          </h1>
          <p className="text-muted-foreground mt-2">Create your player account</p>
        </div>

        <Card className="glass-card shadow-neon">
          {done ? (
            <CardContent className="py-10 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 mx-auto text-accent" />
              <h2 className="text-xl font-bold font-display">REQUEST SUBMITTED</h2>
              <p className="text-sm text-muted-foreground">
                Your request is waiting for admin approval. Once approved, your username and password
                will be sent to your WhatsApp / phone number.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/student/login')}>
                Go to Login
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="font-display">SIGN UP</CardTitle>
                <CardDescription>
                  Admin approval is required. Your login credentials are sent to you after approval.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        maxLength={80}
                        className="pl-10 bg-background/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number (WhatsApp) *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        maxLength={15}
                        className="pl-10 bg-background/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Exam You Are Preparing For *</Label>
                    <Select value={exam} onValueChange={setExam}>
                      <SelectTrigger className="bg-background/50">
                        <GraduationCap className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Select exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Anything else? (optional)</Label>
                    <Textarea
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional message for the admin"
                      maxLength={500}
                      className="bg-background/50"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full gradient-primary text-primary-foreground shadow-primary hover:opacity-90 compete-btn h-12"
                  >
                    {loading ? 'Submitting...' : 'REQUEST ACCOUNT'}
                  </Button>
                </form>

                <Link
                  to="/student/login"
                  className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary"
                >
                  <ArrowLeft className="w-3 h-3" /> Already have credentials? Log in
                </Link>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
