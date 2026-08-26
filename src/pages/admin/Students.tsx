import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, Trash2, Edit, Eye, EyeOff, Copy, Trophy, RotateCcw, Lock, Unlock, Search, UserPlus2, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DownloadMenu } from '@/components/admin/DownloadMenu';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Student, Competition } from '@/types/database';
import { softDelete } from '@/lib/undoDelete';

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [studentCompetitions, setStudentCompetitions] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkAssignCompId, setBulkAssignCompId] = useState<string>('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBatch, setBulkBatch] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    username: '',
    password: '',
    batch: '',
    category: 'Free',
  });

  useEffect(() => {
    fetchStudents();
    fetchCompetitions();

    // Poll student competition statuses so admin sees locks/submissions promptly
    const interval = setInterval(() => {
      fetchStudents();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function fetchStudents() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('student_number');

      if (error) throw error;
      const sorted = ((data as Student[]) || []).slice().sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      setStudents(sorted);

      const { data: scData } = await supabase
        .from('student_competitions')
        .select('student_id, competition_id, has_started, has_submitted, is_locked, attempts_allowed, attempts_used');
      
      const mappings: Record<string, any[]> = {};
      (scData || []).forEach((sc: any) => {
        if (!mappings[sc.student_id]) mappings[sc.student_id] = [];
        mappings[sc.student_id].push(sc);
      });
      setStudentCompetitions(mappings);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompetitions() {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setCompetitions((data as Competition[]) || []);
    } catch (error) {
      console.error('Error fetching competitions:', error);
    }
  }

  const batchOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.batch) set.add(s.batch); });
    return Array.from(set).sort();
  }, [students]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.category) set.add(s.category); });
    if (!set.has('Free')) set.add('Free');
    if (!set.has('Paid')) set.add('Paid');
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter(s => {
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (batchFilter !== 'all' && (s.batch || '') !== batchFilter) return false;
      if (categoryFilter !== 'all' && (s.category || 'Free') !== categoryFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.username || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        String(s.student_number || '').includes(q)
      );
    });
  }, [students, searchQuery, statusFilter, batchFilter, categoryFilter]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleSelectAllFiltered() {
    const filteredIds = filteredStudents.map(s => s.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : filteredIds);
  }

  async function bulkUpdate(payload: Partial<Student>, label: string) {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('students')
        .update(payload as any)
        .in('id', selectedIds);
      if (error) throw error;
      toast.success(`${label} updated for ${selectedIds.length} player(s)`);
      setSelectedIds([]);
      fetchStudents();
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Bulk update failed');
    }
  }

  async function bulkAssignToAll() {
    if (!bulkAssignCompId) {
      toast.error('Select a competition first');
      return;
    }
    // Assign only to the currently filtered, ACTIVE players (or selected ones if any are ticked)
    const base = selectedIds.length > 0
      ? students.filter(s => selectedIds.includes(s.id))
      : filteredStudents.filter(s => s.is_active);

    if (base.length === 0) {
      toast.error(selectedIds.length > 0 ? 'No players selected' : 'No active players match the current filters');
      return;
    }
    if (!confirm(`Assign this competition to ${base.length} player(s)?`)) return;

    setBulkAssigning(true);
    try {
      const toInsert = base
        .filter(s => !(studentCompetitions[s.id] || []).some((sc: any) => sc.competition_id === bulkAssignCompId))
        .map(s => ({ student_id: s.id, competition_id: bulkAssignCompId }));

      if (toInsert.length === 0) {
        toast.info('All players are already assigned to this competition');
      } else {
        const { error } = await supabase.from('student_competitions').insert(toInsert);
        if (error) throw error;
        toast.success(`Assigned to ${toInsert.length} player(s)`);
      }
      fetchStudents();
    } catch (error) {
      console.error('Bulk assign error:', error);
      toast.error('Failed to assign to all players');
    } finally {
      setBulkAssigning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      let studentId = editingId;
      
      if (editingId) {
        const updateData: Partial<Student> = {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone,
          address: formData.address || null,
          batch: formData.batch || null,
          category: formData.category || 'Free',
        };
        
        if (formData.username) updateData.username = formData.username;
        if (formData.password) updateData.password = formData.password;
        
        const { error } = await supabase
          .from('students')
          .update(updateData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Player updated successfully');
      } else {
        const { data, error } = await supabase
          .from('students')
          .insert([{
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone,
            address: formData.address || null,
            batch: formData.batch || null,
            category: formData.category || 'Free',
          } as any])
          .select()
          .single();
        if (error) throw error;
        studentId = data.id;
        toast.success('Player enrolled! Credentials auto-generated.');
      }

      if (studentId) {
        if (editingId) {
          await supabase
            .from('student_competitions')
            .delete()
            .eq('student_id', studentId);
        }

        if (selectedCompetitions.length > 0) {
          const assignments = selectedCompetitions.map(compId => ({
            student_id: studentId,
            competition_id: compId,
          }));

          await supabase.from('student_competitions').insert(assignments);
        }
      }
      
      setDialogOpen(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      toast.error('Failed to save player');
    }
  }

  async function toggleLock(studentId: string, competitionId: string, currentlyLocked: boolean) {
    try {
      const updatePayload: any = { is_locked: !currentlyLocked };
      // When admin locks a student's competition, record the lock time as submitted_at if not set
      if (!currentlyLocked) updatePayload.submitted_at = new Date().toISOString();

      const { error } = await supabase
        .from('student_competitions')
        .update(updatePayload)
        .eq('student_id', studentId)
        .eq('competition_id', competitionId);

      if (error) throw error;

      // If unlocking, also reset submission so student can retake
      if (currentlyLocked) {
        await supabase
          .from('student_competitions')
          .update({
            has_submitted: false,
            has_started: false,
            started_at: null,
            submitted_at: null,
            total_marks: 0,
          })
          .eq('student_id', studentId)
          .eq('competition_id', competitionId);

        // Delete previous answers
        await supabase
          .from('student_answers')
          .delete()
          .eq('student_id', studentId)
          .eq('competition_id', competitionId);

        toast.success('Unlocked! Student can now retake the test.');
      } else {
        toast.success('Locked! Student cannot take this test.');
      }

      fetchStudents();
    } catch (error) {
      console.error('Error toggling lock:', error);
      toast.error('Failed to update lock status');
    }
  }

  async function deleteStudent(id: string) {
    if (!confirm('Are you sure you want to delete this player?')) return;
    await softDelete({
      table: 'students',
      ids: [id],
      label: 'Player',
      onChange: fetchStudents,
      related: [
        { table: 'student_competitions', filter: (q: any) => q.eq('student_id', id) },
        { table: 'student_answers', filter: (q: any) => q.eq('student_id', id) },
      ],
    });
  }

  function resetForm() {
    setFormData({ name: '', email: '', phone: '', address: '', username: '', password: '', batch: '', category: 'Free' });
    setEditingId(null);
    setSelectedCompetitions([]);
  }

  function openEdit(student: Student) {
    setFormData({
      name: student.name,
      email: student.email || '',
      phone: student.phone,
      address: student.address || '',
      username: student.username,
      password: student.password,
      batch: student.batch || '',
      category: student.category || 'Free',
    });
    setEditingId(student.id);
    setSelectedCompetitions((studentCompetitions[student.id] || []).map((sc: any) => sc.competition_id));
    setDialogOpen(true);
  }

  function togglePassword(id: string) {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function copyCredentials(student: Student) {
    navigator.clipboard.writeText(`Username: ${student.username}\nPassword: ${student.password}`);
    toast.success('Credentials copied!');
  }

  function getCompetitionInfo(studentId: string): { name: string; submitted: boolean; locked: boolean; compId: string; attemptsAllowed: number | null; attemptsUsed: number; testAttempts: number }[] {
    const scs = studentCompetitions[studentId] || [];
    return scs.map((sc: any) => {
      const comp = competitions.find(c => c.id === sc.competition_id);
      return {
        name: comp?.name || '',
        submitted: sc.has_submitted,
        locked: sc.is_locked ?? false,
        compId: sc.competition_id,
        attemptsAllowed: sc.attempts_allowed ?? null,
        attemptsUsed: sc.attempts_used ?? 0,
        testAttempts: (comp as any)?.max_attempts ?? 1,
      };
    }).filter(c => c.name);
  }

  async function setAttemptsOverride(studentId: string, competitionId: string, value: number | null) {
    const { error } = await supabase
      .from('student_competitions')
      .update({ attempts_allowed: value })
      .eq('student_id', studentId)
      .eq('competition_id', competitionId);
    if (error) {
      toast.error('Could not update attempts');
      return;
    }
    toast.success(value === null ? 'Using the test default' : value === 0 ? 'Unlimited attempts allowed' : `${value} attempt(s) allowed`);
    fetchStudents();
  }

  async function resetAttempts(studentId: string, competitionId: string) {
    const { error } = await supabase
      .from('student_competitions')
      .update({ attempts_used: 0 })
      .eq('student_id', studentId)
      .eq('competition_id', competitionId);
    if (error) {
      toast.error('Could not reset attempts');
      return;
    }
    toast.success('Attempt count reset');
    fetchStudents();
  }

  function toggleCompetition(compId: string) {
    setSelectedCompetitions(prev => 
      prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">PLAYERS</h1>
          <p className="text-muted-foreground mt-1">Enroll and manage competitors</p>
        </div>

        <div className="flex gap-2">
        <DownloadMenu
          filename={`players-${new Date().toISOString().split('T')[0]}`}
          title="Players"
          headers={['Student #', 'Name', 'Phone', 'Email', 'Address', 'Username', 'Password', 'Competitions Assigned']}
          rows={students.map(s => [
            s.student_number,
            s.name,
            s.phone,
            s.email || '',
            s.address || '',
            s.username,
            s.password,
            getCompetitionInfo(s.id).map(c => c.name).join('; '),
          ])}
          disabled={students.length === 0}
        />
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-primary compete-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg glass-card max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? 'EDIT PLAYER' : 'ENROLL NEW PLAYER'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="1234567890" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Enter address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="batch">Batch</Label>
                  <Input id="batch" value={formData.batch} onChange={(e) => setFormData({ ...formData, batch: e.target.value })} placeholder="e.g. Batch A" list="batch-suggestions" />
                  <datalist id="batch-suggestions">
                    {batchOptions.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Free">Free</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    Assign to Competitions
                  </Label>
                  {competitions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCompetitions(competitions.map(c => c.id))}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-muted-foreground/50">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCompetitions([])}
                        className="text-xs font-bold text-muted-foreground hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                {competitions.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <input
                      type="checkbox"
                      checked={selectedCompetitions.length === competitions.length}
                      onChange={(e) => setSelectedCompetitions(e.target.checked ? competitions.map(c => c.id) : [])}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm font-bold text-primary">
                      Assign to ALL competitions ({competitions.length})
                    </span>
                  </label>
                )}
                <div className="grid grid-cols-1 gap-2 p-3 rounded-lg bg-muted/30 border border-border max-h-40 overflow-y-auto">
                  {competitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No competitions available</p>
                  ) : (
                    competitions.map(comp => (
                      <label key={comp.id} className="flex items-center gap-2 cursor-pointer hover:bg-primary/10 p-2 rounded-lg transition-colors">
                        <input type="checkbox" checked={selectedCompetitions.includes(comp.id)} onChange={() => toggleCompetition(comp.id)} className="w-4 h-4 accent-primary" />
                        <span className="text-sm text-foreground">{comp.name}</span>
                        {comp.is_active && <Badge variant="outline" className="text-xs border-accent text-accent">LIVE</Badge>}
                      </label>
                    ))
                  )}
                </div>
                {selectedCompetitions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedCompetitions.length} of {competitions.length} selected
                  </p>
                )}
              </div>

              {editingId && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username (Override)</Label>
                    <Input id="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password (Override)</Label>
                    <Input id="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                </>
              )}

              {!editingId && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-primary">Note:</strong> Credentials auto-generated:
                    <br />• Username: stu{101 + students.length} (unlimited)
                    <br />• Password: name@last2digits
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full gradient-primary text-primary-foreground compete-btn">
                {editingId ? 'Update Player' : 'Enroll Player'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search + Bulk-assign toolbar */}
      <Card className="glass-card border-primary/20">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px] space-y-1">
            <Label htmlFor="searchPlayers" className="text-xs uppercase tracking-wide text-muted-foreground">Search Players</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="searchPlayers"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, login ID or phone…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Batch</Label>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {batchOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 min-w-[260px] space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Allot Competition to {selectedIds.length > 0 ? `${selectedIds.length} Selected` : 'Filtered Active Players'}
            </Label>
            <div className="flex gap-2">
              <Select value={bulkAssignCompId} onValueChange={setBulkAssignCompId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose competition…" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={bulkAssignToAll}
                disabled={!bulkAssignCompId || bulkAssigning || students.length === 0}
                className="gradient-primary text-primary-foreground"
              >
                <UserPlus2 className="w-4 h-4 mr-2" />
                Allot to All
              </Button>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Showing</p>
            <p className="text-2xl font-bold text-primary font-display">
              {filteredStudents.length}
              <span className="text-sm text-muted-foreground font-normal"> / {students.length}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : students.length === 0 ? (
        <Card className="border-dashed glass-card">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bold text-foreground mb-1 font-display">NO PLAYERS YET</h3>
            <p className="text-sm text-muted-foreground">Enroll your first competitor to get started</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Competitions</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} className="hover:bg-primary/5">
                  <TableCell className="font-bold">{student.name}</TableCell>
                  <TableCell>{student.phone}</TableCell>
                  <TableCell>
                    {(() => {
                      const assigned = getCompetitionInfo(student.id);
                      if (assigned.length === 0) {
                        return <span className="text-xs text-muted-foreground">None</span>;
                      }
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10">
                              <Trophy className="w-3.5 h-3.5 mr-1.5 text-primary" />
                              {assigned.length} assigned
                              <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
                            <DropdownMenuLabel className="text-xs uppercase tracking-wide">
                              Allotted competitions
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {assigned.map((info) => (
                              <div key={info.compId} className="px-2 py-1.5 space-y-1.5 border-b border-border/50 last:border-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm truncate">
                                  {info.name}
                                  {info.submitted ? ' ✓' : ''}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-6 w-6 p-0 shrink-0 ${info.locked ? 'text-destructive hover:bg-destructive/10' : 'text-accent hover:bg-accent/10'}`}
                                  title={info.locked ? 'Click to unlock (allow retake)' : 'Click to lock'}
                                  onClick={(e) => { e.preventDefault(); toggleLock(student.id, info.compId, info.locked); }}
                                >
                                  {info.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground shrink-0">
                                  Used {info.attemptsUsed}
                                </span>
                                <select
                                  className="flex-1 h-7 rounded-md border border-border bg-background px-1 text-[11px]"
                                  value={info.attemptsAllowed === null ? 'default' : info.attemptsAllowed === 0 ? 'unlimited' : String(info.attemptsAllowed)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setAttemptsOverride(
                                      student.id,
                                      info.compId,
                                      v === 'default' ? null : v === 'unlimited' ? 0 : Number(v)
                                    );
                                  }}
                                >
                                  <option value="default">
                                    Test default ({info.testAttempts === 0 ? 'unlimited' : info.testAttempts})
                                  </option>
                                  <option value="1">1 attempt</option>
                                  <option value="2">2 attempts</option>
                                  <option value="3">3 attempts</option>
                                  <option value="5">5 attempts</option>
                                  <option value="10">10 attempts</option>
                                  <option value="unlimited">Unlimited</option>
                                </select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] shrink-0"
                                  title="Reset the attempt counter to zero"
                                  onClick={(e) => { e.preventDefault(); resetAttempts(student.id, info.compId); }}
                                >
                                  Reset
                                </Button>
                              </div>
                              </div>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <code className="px-2 py-1 rounded bg-primary/10 text-sm text-primary font-mono">{student.username}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 rounded bg-muted/50 text-sm font-mono">
                        {showPasswords[student.id] ? student.password : '••••••••'}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => togglePassword(student.id)}>
                        {showPasswords[student.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyCredentials(student)} className="border-primary/30 hover:bg-primary/10">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(student)} className="border-primary/30 hover:bg-primary/10">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteStudent(student.id)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
