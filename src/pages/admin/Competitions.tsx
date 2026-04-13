import { useEffect, useState } from 'react';
import { Plus, Calendar, Clock, Eye, EyeOff, Trophy, Trash2, Edit, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Competition } from '@/types/database';
import { format } from 'date-fns';
import { formatTime12 } from '@/lib/timeFormat';

export default function Competitions() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>('minutes');
  const [durationValue, setDurationValue] = useState(60);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    duration_minutes: 60,
    primary_color: '#0D9488',
    secondary_color: '#F59E0B',
  });

  useEffect(() => {
    fetchCompetitions();
  }, []);

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
      toast.error('Failed to load competitions');
    } finally {
      setLoading(false);
    }
  }

  function handleDurationChange(value: number, unit: 'minutes' | 'hours') {
    setDurationValue(value);
    setDurationUnit(unit);
    const minutes = unit === 'hours' ? Math.round(value * 60) : value;
    setFormData(prev => ({ ...prev, duration_minutes: minutes }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      if (editingId) {
        const submitData = {
          ...formData,
          end_date: formData.end_date || formData.date || null,
        };
        const { error } = await supabase
          .from('competitions')
          .update(submitData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Competition updated successfully');
      } else {
        const submitData = {
          ...formData,
          end_date: formData.end_date || formData.date || null,
        };
        const { error } = await supabase
          .from('competitions')
          .insert([submitData]);
        if (error) throw error;
        toast.success('Competition created successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchCompetitions();
    } catch (error) {
      console.error('Error saving competition:', error);
      toast.error('Failed to save competition');
    }
  }

  async function toggleActive(id: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from('competitions')
        .update({ is_active: !currentState })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentState ? 'Competition deactivated' : 'Competition activated');
      fetchCompetitions();
    } catch (error) {
      console.error('Error updating competition:', error);
      toast.error('Failed to update competition');
    }
  }

  async function toggleResults(id: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from('competitions')
        .update({ show_results: !currentState })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentState ? 'Marks hidden' : 'Marks visible to students');
      fetchCompetitions();
    } catch (error) {
      console.error('Error updating competition:', error);
      toast.error('Failed to update competition');
    }
  }

  async function toggleDetailedResults(id: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from('competitions')
        .update({ show_detailed_results: !currentState })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentState ? 'Detailed results hidden' : 'Answer review visible to students');
      fetchCompetitions();
    } catch (error) {
      console.error('Error updating competition:', error);
      toast.error('Failed to update competition');
    }
  }

  async function toggleLeaderboard(id: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from('competitions')
        .update({ show_leaderboard: !currentState })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentState ? 'Leaderboard hidden' : 'Leaderboard visible');
      fetchCompetitions();
    } catch (error) {
      console.error('Error updating competition:', error);
      toast.error('Failed to update competition');
    }
  }

  async function deleteCompetition(id: string) {
    if (!confirm('Are you sure you want to delete this competition?')) return;
    
    try {
      const { error } = await supabase
        .from('competitions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Competition deleted');
      fetchCompetitions();
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast.error('Failed to delete competition');
    }
  }

  function formatDuration(minutes: number): string {
    if (minutes >= 60 && minutes % 60 === 0) {
      const hrs = minutes / 60;
      return `${hrs} hr${hrs > 1 ? 's' : ''}`;
    }
    if (minutes > 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hrs}h ${mins}m`;
    }
    return `${minutes} min`;
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      date: '',
      end_date: '',
      start_time: '',
      end_time: '',
      duration_minutes: 60,
      primary_color: '#0D9488',
      secondary_color: '#F59E0B',
    });
    setDurationUnit('minutes');
    setDurationValue(60);
    setEditingId(null);
  }

  function openEdit(comp: Competition) {
    setFormData({
      name: comp.name,
      description: comp.description || '',
      date: comp.date,
      end_date: comp.end_date || comp.date,
      start_time: comp.start_time,
      end_time: comp.end_time,
      duration_minutes: comp.duration_minutes,
      primary_color: comp.primary_color,
      secondary_color: comp.secondary_color,
    });
    // Set duration display
    if (comp.duration_minutes >= 60 && comp.duration_minutes % 60 === 0) {
      setDurationUnit('hours');
      setDurationValue(comp.duration_minutes / 60);
    } else {
      setDurationUnit('minutes');
      setDurationValue(comp.duration_minutes);
    }
    setEditingId(comp.id);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">COMPETITIONS</h1>
          <p className="text-muted-foreground mt-1">Create and manage your battles</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-primary compete-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Competition
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg glass-card">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? 'EDIT COMPETITION' : 'CREATE NEW BATTLE'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Competition Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Math Olympiad 2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the competition"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Start Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value, end_date: formData.end_date || e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || formData.date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.date}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      step={durationUnit === 'hours' ? '0.5' : '1'}
                      value={durationValue}
                      onChange={(e) => handleDurationChange(parseFloat(e.target.value) || 0, durationUnit)}
                      className="flex-1"
                      required
                    />
                    <Select value={durationUnit} onValueChange={(v: 'minutes' | 'hours') => {
                      const newValue = v === 'hours' ? durationValue / 60 : durationValue * 60;
                      handleDurationChange(Math.max(v === 'hours' ? 0.5 : 1, newValue), v);
                    }}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Min</SelectItem>
                        <SelectItem value="hours">Hrs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary_color"
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full gradient-primary text-primary-foreground">
                {editingId ? 'Update Competition' : 'Launch Competition'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : competitions.length === 0 ? (
        <Card className="border-dashed glass-card">
          <CardContent className="py-12 text-center">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-bold text-foreground mb-1 font-display">NO BATTLES YET</h3>
            <p className="text-sm text-muted-foreground">Create your first competition to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitions.map((comp) => (
            <Card key={comp.id} className="glass-card hover:border-primary/50 hover:shadow-primary transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full shadow-lg"
                        style={{ backgroundColor: comp.primary_color }}
                      />
                      <h3 className="font-bold text-lg text-foreground font-display">{comp.name}</h3>
                      {comp.is_active && (
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-accent/20 text-accent font-display">
                          LIVE
                        </span>
                      )}
                    </div>
                    {comp.description && (
                      <p className="text-sm text-muted-foreground mb-3">{comp.description}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {comp.end_date && comp.end_date !== comp.date
                          ? `${format(new Date(comp.date), 'MMM dd')} – ${format(new Date(comp.end_date), 'MMM dd, yyyy')}`
                          : format(new Date(comp.date), 'MMM dd, yyyy')
                        }
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime12(comp.start_time)} - {formatTime12(comp.end_time)}
                      </span>
                      <span>{formatDuration(comp.duration_minutes)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Live</span>
                        <Switch
                          checked={comp.is_active}
                          onCheckedChange={() => toggleActive(comp.id, comp.is_active)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Marks</span>
                        <Switch
                          checked={comp.show_results}
                          onCheckedChange={() => toggleResults(comp.id, comp.show_results)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Answers</span>
                        <Switch
                          checked={comp.show_detailed_results || false}
                          onCheckedChange={() => toggleDetailedResults(comp.id, comp.show_detailed_results || false)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Leaderboard</span>
                        <Switch
                          checked={comp.show_leaderboard}
                          onCheckedChange={() => toggleLeaderboard(comp.id, comp.show_leaderboard)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(comp)}
                        className="border-primary/30 hover:bg-primary/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteCompetition(comp.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
