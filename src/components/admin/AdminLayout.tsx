import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAdminAuth } from '@/lib/auth';

export function AdminLayout() {
  const { isAdmin, hydrated } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (hydrated && !isAdmin) {
      navigate('/admin/login');
    }
  }, [hydrated, isAdmin, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="lg:ml-64 px-4 py-4 pt-20 lg:px-6 lg:py-6 lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
