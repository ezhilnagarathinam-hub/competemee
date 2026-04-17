import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from 'react';
import AnalyticsLoader from '@/components/AnalyticsLoader';

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Competitions from "./pages/admin/Competitions";
import Questions from "./pages/admin/Questions";
import Students from "./pages/admin/Students";
import Results from "./pages/admin/Results";
import Settings from "./pages/admin/Settings";
import { AdminLayout } from "./components/admin/AdminLayout";

// Student Pages
import StudentLogin from "./pages/student/StudentLogin";
import StudentDashboard from "./pages/student/StudentDashboard";
import TestInterface from "./pages/student/TestInterface";
import { StudentLayout } from "./components/student/StudentLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Suspense>
        {/* Attempt to dynamically render the Analytics component if available */}
        {/* Lazy import the react entry; if not present, the loader fallback will silently no-op */}
        {/** @ts-ignore */}
        {typeof window !== 'undefined' ? lazy(() => import('@vercel/analytics/react')).then((m) => ({ default: m.Analytics || m.default })) : null}
        <AnalyticsLoader />
      </Suspense>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="competitions" element={<Competitions />} />
            <Route path="competitions/new" element={<Competitions />} />
            <Route path="questions" element={<Questions />} />
            <Route path="students" element={<Students />} />
            <Route path="results" element={<Results />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          {/* Student Routes */}
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
          </Route>
          <Route path="/student/test/:competitionId" element={<TestInterface />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
