import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStudentAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function StudentLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useStudentAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // SECURITY WARNING: Insecure client-side password verification against direct database column.
      // This should be replaced with Supabase Auth or server-side hashing in a production environment.
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('username', username.trim())
        .eq('password', password)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        login(data.id, data.name);
        toast.success('Welcome, ' + data.name);
        navigate('/student');
      } else {
        toast.error('Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
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
          <p className="text-muted-foreground mt-2">Enter the Arena</p>
        </div>

        <Card className="glass-card shadow-neon">
          <CardHeader className="text-center">
            <CardTitle className="font-display">PLAYER LOGIN</CardTitle>
            <CardDescription>Enter your credentials to join the competition</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="stu101"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-background/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full gradient-primary text-primary-foreground shadow-primary hover:opacity-90 compete-btn h-12"
                disabled={loading}
              >
                {loading ? 'Entering...' : 'ENTER ARENA'}
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
