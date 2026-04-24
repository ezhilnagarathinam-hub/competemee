import { useEffect, useState } from 'react';
import { LifeBuoy, RefreshCw, CheckCircle2, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatTimestampShort } from '@/lib/timeFormat';

interface Ticket {
  id: string;
  student_uuid: string | null;
  student_name: string;
  student_number: string | null;
  test_id: string | null;
  test_name: string | null;
  message: string;
  status: string;
  created_at: string;
}

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error(error);
      toast.error('Could not load tickets');
      return;
    }
    setTickets((data || []) as Ticket[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: 'open' | 'resolved') {
    const { error } = await (supabase as any)
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Could not update');
      return;
    }
    toast.success(`Marked as ${status}`);
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  const visible = tickets.filter((t) => filter === 'all' || t.status === filter);
  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-primary">
            <LifeBuoy className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Support Tickets</h1>
            <p className="text-sm text-muted-foreground">
              {openCount} open · {tickets.length} total
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'open', 'resolved'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          No tickets to show.
        </div>
      ) : (
        <div className="grid gap-4">
          {visible.map((t) => (
            <div
              key={t.id}
              className="bg-card border border-border rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground font-display">{t.student_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {t.student_number || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.status === 'open' ? (
                    <Badge variant="destructive" className="gap-1">
                      <Clock className="w-3 h-3" /> Open
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-green-500/15 text-green-700 border border-green-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Resolved
                    </Badge>
                  )}
                  <Badge variant="outline">{t.test_name || 'General'}</Badge>
                </div>
              </div>

              <p className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {t.message}
              </p>

              <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-muted-foreground">
                  Sent {formatTimestampShort(t.created_at)}
                </p>
                {t.status === 'open' ? (
                  <Button size="sm" onClick={() => setStatus(t.id, 'resolved')}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Resolved
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setStatus(t.id, 'open')}>
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
