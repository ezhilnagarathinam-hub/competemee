import { useEffect, useState } from 'react';
import { Plus, Users, Trash2, Edit, Eye, EyeOff, Copy, Trophy, RotateCcw, Lock, Unlock } from 'lucide-react';
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

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [studentCompetitions, setStudentCompetitions] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    username: '',
    password: '',
  });

  useEffect(() => {
    fetchStudents();
    fetchCompetitions();
  }, []);

  async function fetchStudents() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('student_number');

      if (error) throw error;
      setStudents((data as Student[]) || []);

      const { data: scData } = await supabase
        .from('student_competitions')
        .select('student_id, competition_id, has_started, has_submitted, is_locked');
      
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
      const { error } = await supabase
        .from('student_competitions')
        .update({ is_locked: !currentlyLocked })
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
    
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Player deleted');
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to delete player');
    }
  }

  function resetForm() {
    setFormData({ name: '', email: '', phone: '', address: '', username: '', password: '' });
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

  function getCompetitionInfo(studentId: string): { name: string; submitted: boolean; locked: boolean; compId: string }[] {
    const scs = studentCompetitions[studentId] || [];
    return scs.map((sc: any) => {
      const comp = competitions.find(c => c.id === sc.competition_id);
      return { name: comp?.name || '', submitted: sc.has_submitted, locked: sc.is_locked ?? false, compId: sc.competition_id };
    }).filter(c => c.name);
  }

  function toggleCompetition(compId: string) {
    setSelectedCompetitions(prev => 
      prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">PLAYERS</h1>
          <p className="text-muted-foreground mt-1">Enroll and manage competitors</p>
        </div>
        
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Assign to Competitions
                </Label>
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
              {students.map((student) => (
                <TableRow key={student.id} className="hover:bg-primary/5">
                  <TableCell className="font-bold">{student.name}</TableCell>
                  <TableCell>{student.phone}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                      {getCompetitionInfo(student.id).length > 0 ? (
                        getCompetitionInfo(student.id).map((info, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-xs ${info.submitted ? 'border-accent/50 text-accent' : info.locked ? 'border-destructive/50 text-destructive' : 'border-primary/50 text-primary'}`}>
                              {info.name} {info.submitted ? '✓' : info.locked ? '🔒' : ''}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 w-6 p-0 ${info.locked ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : 'text-accent hover:text-accent hover:bg-accent/10'}`}
                              title={info.locked ? 'Click to unlock (allow retake)' : 'Click to lock'}
                              onClick={() => toggleLock(student.id, info.compId, info.locked)}
                            >
                              {info.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
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
