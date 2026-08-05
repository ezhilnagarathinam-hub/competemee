import { useEffect, useState } from 'react';
import { UserPlus2, Check, X, Copy, MessageCircle, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatTimestampShort } from '@/lib/timeFormat';

interface SignupRequest {
  id: string;
  name: string;
  phone: string;
  exam: string;
  note: string | null;
  status: string;
  student_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface ApprovedCreds {
  name: string;
  phone: string;
  username: string;
  password: string;
}

export default function Signups() {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [working, setWorking] = useState<string | null>(null);
  const [creds, setCreds] = useState<ApprovedCreds | null>(null);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => fetchRequests(true), 15000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRequests(silent = false) {
    try {
      const { data, error } = await (supabase as any)
        .from('student_signup_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data || []) as SignupRequest[]);
    } catch (error) {
      console.error('Error fetching signup requests:', error);
      if (!silent) toast.error('Failed to load signup requests');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function approve(req: SignupRequest) {
    setWorking(req.id);
    try {
      // Guard against duplicates
      const { data: existing } = await supabase
        .from('students')
        .select('id, username, password, name, phone')
        .eq('phone', req.phone)
        .maybeSingle();

      let student = existing as any;

      if (!student) {
        const { data: created, error: createError } = await (supabase as any)
          .from('students')
          .insert({ name: req.name, phone: req.phone, exam: req.exam })
          .select('id, username, password, name, phone')
          .single();
        if (createError) throw createError;
        student = created;
      }

      const { error: updateError } = await (supabase as any)
        .from('student_signup_requests')
        .update({ status: 'approved', student_id: student.id, reviewed_at: new Date().toISOString() })
        .eq('id', req.id);
      if (updateError) throw updateError;

      setCreds({
        name: student.name,
        phone: student.phone,
        username: student.username,
        password: student.password,
      });
      toast.success('Approved — send the credentials to the player');
      fetchRequests(true);
    } catch (error: any) {
      console.error('Approve failed:', error);
      toast.error(error?.message || 'Failed to approve request');
    } finally {
      setWorking(null);
    }
  }

  async function reject(req: SignupRequest) {
    if (!confirm(`Reject the signup request from ${req.name}?`)) return;
    setWorking(req.id);
    try {
      const { error } = await (supabase as any)
        .from('student_signup_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;
      toast.success('Request rejected');
      fetchRequests(true);
    } catch (error) {
      console.error('Reject failed:', error);
      toast.error('Failed to reject request');
    } finally {
      setWorking(null);
    }
  }

  function credentialMessage(c: ApprovedCreds) {
    return (
      `Hi ${c.name}, your Compete Me account is approved!\n\n` +
      `Username: ${c.username}\n` +
      `Password: ${c.password}\n\n` +
      `Login here: ${window.location.origin}/student/login\n\n` +
      `Your tests will be allotted by the admin. All the best!`
    );
  }

  function whatsappLink(c: ApprovedCreds) {
    const digits = c.phone.replace(/\D/g, '');
    const withCode = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCode}?text=${encodeURIComponent(credentialMessage(c))}`;
  }

  const filtered = requests.filter((r) => r.status === tab);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">SIGNUP REQUESTS</h1>
          <p className="text-muted-foreground mt-1">
            Approve new players — credentials are generated automatically on approval
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchRequests()} className="border-primary/30">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending {pendingCount > 0 && <Badge className="ml-2 bg-primary text-primary-foreground">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed glass-card">
          <CardContent className="py-12 text-center">
            <UserPlus2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bold text-foreground mb-1 font-display">NOTHING HERE</h3>
            <p className="text-sm text-muted-foreground">No {tab} signup requests</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> {filtered.length} {tab} request{filtered.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((req) => (
                    <TableRow key={req.id} className="hover:bg-primary/5">
                      <TableCell className="font-bold whitespace-nowrap">{req.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{req.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-primary/40 text-primary">{req.exam}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] text-sm text-muted-foreground">{req.note || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatTimestampShort(req.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={working === req.id}
                              onClick={() => approve(req)}
                              className="gradient-primary text-primary-foreground"
                            >
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={working === req.id}
                              onClick={() => reject(req)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : req.status === 'approved' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-accent/40 text-accent"
                            onClick={async () => {
                              const { data } = await supabase
                                .from('students')
                                .select('name, phone, username, password')
                                .eq('id', req.student_id || '')
                                .maybeSingle();
                              if (data) setCreds(data as ApprovedCreds);
                              else toast.error('Player record not found');
                            }}
                          >
                            <MessageCircle className="w-4 h-4 mr-1" /> Credentials
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Rejected</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials dialog */}
      <Dialog open={!!creds} onOpenChange={() => setCreds(null)}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">PLAYER CREDENTIALS</DialogTitle>
          </DialogHeader>
          {creds && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <p className="font-bold text-foreground">{creds.name}</p>
                <p className="text-sm text-muted-foreground">{creds.phone}</p>
                <div className="pt-2 space-y-1 text-sm">
                  <p>
                    Username: <code className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{creds.username}</code>
                  </p>
                  <p>
                    Password: <code className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{creds.password}</code>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(credentialMessage(creds));
                    toast.success('Message copied');
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
                <a href={whatsappLink(creds)} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gradient-primary text-primary-foreground">
                    <MessageCircle className="w-4 h-4 mr-2" /> Send on WhatsApp
                  </Button>
                </a>
              </div>

              <p className="text-xs text-muted-foreground">
                Competitions are allotted only by admin — assign tests from the Students page.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
