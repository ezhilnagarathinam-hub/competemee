import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, Check, Globe2, Mail, Phone, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const plans = [
  { code: 'starter', name: 'Starter', price: '₹2,499', detail: 'Up to 250 active students', accent: 'primary' },
  { code: 'growth', name: 'Growth', price: '₹7,500', detail: 'Up to 1,000 active students', accent: 'accent' },
  { code: 'professional', name: 'Professional', price: '₹20,000', detail: 'Up to 5,000 active students', accent: 'primary' },
  { code: 'enterprise', name: 'Enterprise', price: 'Custom', detail: 'For large institutions and networks', accent: 'accent' },
] as const;

const benefits = [
  { icon: Globe2, title: 'Your own branded space', text: 'Give students a focused portal with your organization name, colors, and welcome message.' },
  { icon: Users, title: 'One place for every batch', text: 'Manage students, categories, tests, assignments, and access from one control center.' },
  { icon: BarChart3, title: 'Clear performance insights', text: 'Track attempts, scores, rankings, and downloadable reports as your organization grows.' },
  { icon: ShieldCheck, title: 'Separate organization data', text: 'Your students and test records stay separated from every other organization on the platform.' },
];

export default function OrganizationSignup() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [form, setForm] = useState({
    organizationName: '',
    slug: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) {
      toast.error('Please choose an organization URL name');
      return;
    }

    setSubmitting(true);
    const { error } = await (supabase as any).from('organization_signup_requests').insert({
      organization_name: form.organizationName.trim(),
      slug,
      contact_name: form.contactName.trim(),
      contact_email: form.contactEmail.trim(),
      contact_phone: form.contactPhone.trim() || null,
      plan_code: selectedPlan,
      notes: form.notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      console.error('Organization registration failed:', error);
      toast.error(error.code === '23505' ? 'That organization URL is already requested. Try another one.' : 'Could not submit your request. Please try again.');
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto flex min-h-16 items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3" aria-label="Back to Compete Me home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold"><span className="neon-text">COMPETE</span> ME</span>
          </Link>
          <Button variant="ghost" onClick={() => navigate('/student/login')}>
            Student login <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="container relative mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div className="max-w-2xl">
              <p className="mb-4 font-semibold uppercase tracking-[0.18em] text-primary">For coaching centers and institutions</p>
              <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-6xl">Build your own <span className="neon-text">competition hub.</span></h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">Run branded online tests, organize every student group, and give learners a reliable place to practice, compete, and review results.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#register"><Button size="lg" className="gradient-primary text-primary-foreground shadow-neon">Register your organization <ArrowRight className="ml-2 h-4 w-4" /></Button></a>
                <a href="#benefits"><Button size="lg" variant="outline">See benefits</Button></a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {benefits.map(({ icon: Icon, title, text }) => (
                <Card key={title} className="glass-card">
                  <CardContent className="p-5">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                    <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="benefits" className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold uppercase tracking-[0.18em] text-accent">Choose a starting point</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">Plans that grow with your organization</h2>
            <p className="mt-4 text-muted-foreground">Submit your details and the platform team will help set up your branded workspace. Access begins after approval.</p>
          </div>
          <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const selected = selectedPlan === plan.code;
              return (
                <button key={plan.code} type="button" onClick={() => setSelectedPlan(plan.code)} className={`text-left ${selected ? 'ring-2 ring-primary' : ''}`}>
                  <Card className="h-full glass-card transition-transform hover:-translate-y-1">
                    <CardHeader>
                      <div className={`mb-2 h-1 w-12 rounded-full ${plan.accent === 'accent' ? 'bg-accent' : 'bg-primary'}`} />
                      <CardTitle className="font-display">{plan.name}</CardTitle>
                      <CardDescription>{plan.detail}</CardDescription>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold text-foreground">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.price !== 'Custom' ? ' / month' : ''}</span></p><p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-accent" /> Branded organization workspace</p></CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        </section>

        <section id="register" className="border-t border-border/60 bg-muted/20 px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <Card className="glass-card shadow-neon">
              {submitted ? (
                <CardContent className="space-y-5 py-14 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent"><Check className="h-8 w-8" /></div>
                  <h2 className="font-display text-3xl font-bold">Request received</h2>
                  <p className="mx-auto max-w-lg text-muted-foreground">Thank you. We’ll review your organization details and contact you about setting up your selected plan. Your dashboard access will be provided after approval.</p>
                  <div className="flex flex-wrap justify-center gap-3"><Button onClick={() => navigate('/admin/login')} className="gradient-primary text-primary-foreground">Go to dashboard sign-in</Button><Button variant="outline" onClick={() => navigate('/')}>Back to home</Button></div>
                </CardContent>
              ) : (
                <>
                  <CardHeader><CardTitle className="font-display text-2xl">Register your organization</CardTitle><CardDescription>Tell us about your organization and we’ll prepare the right branded workspace.</CardDescription></CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2"><Label htmlFor="organizationName">Organization name *</Label><Input id="organizationName" value={form.organizationName} onChange={(e) => updateField('organizationName', e.target.value)} placeholder="EADREAMSS" required /></div>
                      <div className="space-y-2"><Label htmlFor="slug">Preferred workspace name *</Label><div className="relative"><Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="slug" value={form.slug} onChange={(e) => updateField('slug', e.target.value)} className="pl-10" placeholder="your-organization" required /></div><p className="text-xs text-muted-foreground">Used for your organization’s branded entry address.</p></div>
                      <div className="space-y-2"><Label>Selected plan</Label><Select value={selectedPlan} onValueChange={setSelectedPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{plans.map((plan) => <SelectItem key={plan.code} value={plan.code}>{plan.name} — {plan.price}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label htmlFor="contactName">Your name *</Label><Input id="contactName" value={form.contactName} onChange={(e) => updateField('contactName', e.target.value)} placeholder="Contact person" required /></div>
                      <div className="space-y-2"><Label htmlFor="contactEmail">Work email *</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => updateField('contactEmail', e.target.value)} className="pl-10" placeholder="you@example.com" required /></div></div>
                      <div className="space-y-2"><Label htmlFor="contactPhone">Phone / WhatsApp</Label><div className="relative"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="contactPhone" value={form.contactPhone} onChange={(e) => updateField('contactPhone', e.target.value)} className="pl-10" placeholder="9876543210" /></div></div>
                      <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">What would you like to run?</Label><Textarea id="notes" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Tell us about your students, exams, or expected usage." maxLength={600} /></div>
                      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Back to home</Link><Button type="submit" disabled={submitting} className="gradient-primary text-primary-foreground">{submitting ? 'Submitting...' : 'Submit registration'} <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
                    </form>
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}