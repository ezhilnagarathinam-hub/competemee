import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAdminAuth } from '@/lib/auth';

export function AdminLayout() {
  const { isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/login');
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background mx-0 gap-0 items-start justify-start flex flex-row">
      <AdminSidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-y-auto my-0">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
