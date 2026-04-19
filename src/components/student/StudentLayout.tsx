import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Trophy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentAuth } from '@/lib/auth';

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground font-display">COMPETE <span className="neon-text">ME</span></h1>
              <p className="text-xs text-muted-foreground">Student Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{studentName}</p>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                logout();
                navigate('/student/login');
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
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
