import { useEffect, useState } from 'react';
import { Download, FileText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { downloadCSV } from '@/lib/csvExport';
import { toast } from 'sonner';

interface ReportRow {
  student_id: string;
  name: string;
  location: string;
  mobile: string;
  email: string;
  tests_written: number;
  test_names: string;
  total_score: number;
  details: { competition_name: string; total_marks: number; max_marks: number; submitted_at: string | null }[];
}

export default function Reports() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadReport();

    // Realtime subscription for updates
    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_result_summaries' }, () => loadReport(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => loadReport(true))
      .subscribe();

    const interval = setInterval(() => loadReport(true), 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  async function loadReport(silent = false) {
    try {
      const [{ data: students, error: sErr }, { data: summaries, error: rErr }, { data: comps, error: cErr }] = await Promise.all([
        supabase.from('students').select('id, name, address, phone, email').order('name'),
        (supabase as any).from('competition_result_summaries').select('student_id, competition_id, total_marks, max_marks, submitted_at, is_finalized').eq('is_finalized', true),
        supabase.from('competitions').select('id, name'),
      ]);

      if (sErr) throw sErr;
      if (rErr) throw rErr;
      if (cErr) throw cErr;

      const compMap: Record<string, string> = {};
      (comps || []).forEach((c: any) => { compMap[c.id] = c.name; });

      const byStudent: Record<string, ReportRow['details']> = {};
      (summaries || []).forEach((s: any) => {
        if (!byStudent[s.student_id]) byStudent[s.student_id] = [];
        byStudent[s.student_id].push({
          competition_name: compMap[s.competition_id] || 'Unknown',
          total_marks: Number(s.total_marks) || 0,
          max_marks: Number(s.max_marks) || 0,
          submitted_at: s.submitted_at,
        });
      });

      const reportRows: ReportRow[] = (students || []).map((stu: any) => {
        const details = byStudent[stu.id] || [];
        return {
          student_id: stu.id,
          name: stu.name,
          location: stu.address || '',
          mobile: stu.phone || '',
          email: stu.email || '',
          tests_written: details.length,
          test_names: details.map(d => d.competition_name).join('; '),
          total_score: details.reduce((sum, d) => sum + d.total_marks, 0),
          details,
        };
      });

      setRows(reportRows);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Error loading report:', e);
      if (!silent) toast.error('Failed to load report');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function handleDownloadSummary() {
    const headers = ['Student Name', 'Location', 'Mobile', 'Email', 'Tests Written', 'Test Names', 'Total Score'];
    const data = filtered.map(r => [r.name, r.location, r.mobile, r.email, r.tests_written, r.test_names, r.total_score]);
    downloadCSV(`student-report-${new Date().toISOString().split('T')[0]}.csv`, headers, data);
    toast.success('Report downloaded');
  }

  function handleDownloadDetailed() {
    const headers = ['Student Name', 'Location', 'Mobile', 'Email', 'Test Name', 'Score', 'Max Marks', 'Submitted At'];
    const data: any[][] = [];
    filtered.forEach(r => {
      if (r.details.length === 0) {
        data.push([r.name, r.location, r.mobile, r.email, '-', 0, 0, '-']);
      } else {
        r.details.forEach(d => {
          data.push([r.name, r.location, r.mobile, r.email, d.competition_name, d.total_marks, d.max_marks, d.submitted_at || '-']);
        });
      }
    });
    downloadCSV(`detailed-report-${new Date().toISOString().split('T')[0]}.csv`, headers, data);
    toast.success('Detailed report downloaded');
  }

  const filtered = rows.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.mobile.includes(search) ||
    r.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">REPORTS</h1>
          <p className="text-muted-foreground mt-1">
            Real-time student performance overview
            {lastUpdated && <span className="ml-2 text-xs">(updated {lastUpdated.toLocaleTimeString()})</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownloadSummary} className="gradient-primary text-primary-foreground compete-btn">
            <Download className="w-4 h-4 mr-2" />
            Summary CSV
          </Button>
          <Button onClick={handleDownloadDetailed} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Detailed CSV
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Users className="w-5 h-5 text-primary" />
            All Players ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by name, mobile, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No data</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-center">Tests Written</TableHead>
                    <TableHead>Tests</TableHead>
                    <TableHead className="text-right">Total Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.student_id} className="hover:bg-primary/5">
                      <TableCell className="font-bold">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.location || '—'}</TableCell>
                      <TableCell>{r.mobile}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-primary font-display">{r.tests_written}</span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate" title={r.test_names}>
                        {r.test_names || '—'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-accent font-display">
                        {r.total_score}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
