import { useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Trophy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentAuth } from '@/lib/auth';
import { HelpDialog } from './HelpDialog';

export function StudentLayout() {
  const { isStudent, studentName, logout, hydrated } = useStudentAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !isStudent) {
      navigate('/student/login');
    }
  }, [hydrated, isStudent, navigate]);

  if (!hydrated || !isStudent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" aria-label="Go to home">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground font-display">COMPETE <span className="neon-text">ME</span></h1>
              <p className="text-xs text-muted-foreground">Student Portal</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{studentName}</p>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
            <HelpDialog />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                navigate('/student/login');
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
