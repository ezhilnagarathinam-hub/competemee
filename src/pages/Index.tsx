import { Link } from 'react-router-dom';
import { Trophy, Users, ArrowRight, Zap, Sparkles, Target, Timer, Medal, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden min-h-[80vh] flex items-center">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 py-20 relative">
          <div className="text-center max-w-3xl mx-auto animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl gradient-primary shadow-neon mb-8 energy-pulse">
              <Zap className="w-12 h-12 text-primary-foreground animate-glow" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 font-display">
              <span className="neon-text">COMPETE</span>
              <span className="text-foreground"> ME</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Unleash your potential in the ultimate online competition arena. 
              <span className="text-primary font-semibold"> Fast. Fun. Fierce.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/student/login">
                <Button size="lg" className="w-full sm:w-auto gradient-primary text-primary-foreground shadow-neon compete-btn h-14 px-8 text-lg">
                  <Users className="w-5 h-5 mr-2" />
                  Enter Arena
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 font-display">
            <span className="neon-text">POWER</span> FEATURES
          </h2>
          <p className="text-center text-muted-foreground mb-16 text-lg">
            Everything you need to run epic competitions
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Competition Management',
                description: 'Create and manage multiple competitions with custom schedules and themes.',
                icon: Trophy,
              },
              {
                title: 'Smart Questions',
                description: 'Add MCQs with images, Tamil support, and OCR upload from question papers.',
                icon: Target,
              },
              {
                title: 'Instant Credentials',
                description: 'Auto-generated login credentials for students. No hassle enrollment.',
                icon: Sparkles,
              },
              {
                title: 'Live Timer',
                description: 'Intense countdown timer with auto-submit. Every second counts!',
                icon: Timer,
              },
              {
                title: 'Detailed Results',
                description: 'Students see their answers vs correct answers for accountability.',
                icon: BarChart3,
              },
              {
                title: 'Leaderboard',
                description: 'Real-time rankings. Compete for the top spot and glory!',
                icon: Medal,
              },
            ].map((feature) => (
              <Card key={feature.title} className="glass-card hover:shadow-primary transition-all duration-300 hover:border-primary/50 group">
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-xl gradient-primary shadow-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2 font-display">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <Card className="max-w-3xl mx-auto gradient-primary border-0 shadow-neon overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse-slow" />
            <CardContent className="p-12 relative">
              <Zap className="w-16 h-16 mx-auto mb-6 text-primary-foreground animate-glow" />
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4 font-display">
                READY TO COMPETE?
              </h2>
              <p className="text-primary-foreground/90 mb-8 text-lg">
                Create your first competition and let the games begin!
              </p>
              <Link to="/student/login">
                <Button size="lg" variant="secondary" className="shadow-xl h-14 px-10 text-lg font-bold compete-btn">
                  <Users className="w-5 h-5 mr-2" />
                  Compete Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container mx-auto px-4 text-center relative">
          <p className="text-sm text-muted-foreground">
            © 2026 <span className="font-display font-bold neon-text">COMPETE ME / EA DREAM SUPPORTERS</span>. All rights reserved.
          </p>
          <Link
            to="/admin/login"
            aria-label="Admin"
            className="absolute right-4 bottom-0 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          >
            ·
          </Link>
        </div>
      </footer>
    </div>
  );
}
