import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, FileQuestion, ClipboardList, Plus, ArrowRight, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  totalCompetitions: number;
  totalStudents: number;
  totalQuestions: number;
  activeCompetitions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCompetitions: 0,
    totalStudents: 0,
    totalQuestions: 0,
    activeCompetitions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [competitionsRes, studentsRes, questionsRes, activeRes] = await Promise.all([
          supabase.from('competitions').select('id', { count: 'exact', head: true }),
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase.from('questions').select('id', { count: 'exact', head: true }),
          supabase.from('competitions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);

        setStats({
          totalCompetitions: competitionsRes.count || 0,
          totalStudents: studentsRes.count || 0,
          totalQuestions: questionsRes.count || 0,
          activeCompetitions: activeRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    { 
      title: 'Total Competitions', 
      value: stats.totalCompetitions, 
      icon: Trophy, 
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    { 
      title: 'Active Competitions', 
      value: stats.activeCompetitions, 
      icon: ClipboardList, 
      color: 'text-success',
      bg: 'bg-success/10'
    },
    { 
      title: 'Total Students', 
      value: stats.totalStudents, 
      icon: Users, 
      color: 'text-accent',
      bg: 'bg-accent/10'
    },
    { 
      title: 'Total Questions', 
      value: stats.totalQuestions, 
      icon: FileQuestion, 
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
  ];

  const quickActions = [
    { label: 'Create Competition', path: '/admin/competitions/new', icon: Trophy },
    { label: 'Add Questions', path: '/admin/questions', icon: FileQuestion },
    { label: 'Enroll Students', path: '/admin/students', icon: Users },
    { label: 'View Results', path: '/admin/results', icon: ClipboardList },
  ];

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground font-display">COMMAND CENTER</h1>
        <p className="text-sm lg:text-base text-muted-foreground mt-1">
          Welcome to <span className="neon-text font-bold">Compete Me</span> - Your competition headquarters
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="stat-card hover:shadow-neon transition-all duration-300">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs lg:text-sm text-muted-foreground truncate">{stat.title}</p>
                  <p className="text-2xl lg:text-3xl font-bold mt-1 text-foreground font-display">
                    {loading ? '...' : stat.value}
                  </p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl gradient-primary flex items-center justify-center shadow-primary shrink-0">
                  <stat.icon className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="glass-card">
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="flex items-center gap-2 font-display text-base lg:text-lg">
              <Zap className="w-5 h-5 text-primary animate-glow" />
              QUICK ACTIONS
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:gap-4 p-4 lg:p-6 pt-0 lg:pt-0">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 p-3 lg:p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:shadow-primary transition-all duration-300 group text-center sm:text-left"
              >
                <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-primary shrink-0">
                  <action.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {action.label}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="flex items-center justify-between font-display text-base lg:text-lg">
              <span>GET STARTED</span>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6 pt-0 lg:pt-0">
            <div className="space-y-2 lg:space-y-3">
              {[
                'Create a new competition with date and time',
                'Add questions (or use OCR import!)',
                'Enroll players & assign to competitions',
                'Go LIVE and let the battle begin!',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 lg:p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-xs lg:text-sm font-bold shadow-primary shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-xs lg:text-sm text-foreground">{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
