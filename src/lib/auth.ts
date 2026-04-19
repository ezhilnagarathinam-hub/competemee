import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminAuth {
  isAdmin: boolean;
  adminId: string | null;
  adminName: string | null;
  hydrated: boolean;
  login: (id: string, name: string) => void;
  logout: () => void;
}

interface StudentAuth {
  isStudent: boolean;
  studentId: string | null;
  studentName: string | null;
  hydrated: boolean;
  login: (id: string, name: string) => void;
  logout: () => void;
}

export const useAdminAuth = create<AdminAuth>()(
  persist(
    (set) => ({
      isAdmin: false,
      adminId: null,
      adminName: null,
      hydrated: false,
      login: (id, name) => set({ isAdmin: true, adminId: id, adminName: name }),
      logout: () => set({ isAdmin: false, adminId: null, adminName: null }),
    }),
    {
      name: 'compete-me-admin-auth',
      onRehydrateStorage: () => () => {
        set({ hydrated: true });
      },
    }
  )
);

export const useStudentAuth = create<StudentAuth>()(
  persist(
    (set) => ({
      isStudent: false,
      studentId: null,
      studentName: null,
      hydrated: false,
      login: (id, name) => set({ isStudent: true, studentId: id, studentName: name }),
      logout: () => set({ isStudent: false, studentId: null, studentName: null }),
    }),
    {
      name: 'compete-me-student-auth',
      onRehydrateStorage: () => () => {
        set({ hydrated: true });
      },
    }
  )
);
