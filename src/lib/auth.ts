import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminAuth {
  isAdmin: boolean;
  adminId: string | null;
  adminName: string | null;
  hydrated: boolean;
  login: (id: string, name: string) => void;
  logout: () => void;
  setHydrated: () => void;
}

interface StudentAuth {
  isStudent: boolean;
  studentId: string | null;
  studentName: string | null;
  hydrated: boolean;
  login: (id: string, name: string) => void;
  logout: () => void;
  setHydrated: () => void;
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
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'compete-me-admin-auth',
      partialize: (state) => ({
        isAdmin: state.isAdmin,
        adminId: state.adminId,
        adminName: state.adminName,
      }),
      onRehydrateStorage: () => (state) => {
        // Set hydrated true after rehydration completes (or fails)
        setTimeout(() => {
          useAdminAuth.getState().setHydrated();
        }, 0);
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
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'compete-me-student-auth',
      partialize: (state) => ({
        isStudent: state.isStudent,
        studentId: state.studentId,
        studentName: state.studentName,
      }),
      onRehydrateStorage: () => (state) => {
        setTimeout(() => {
          useStudentAuth.getState().setHydrated();
        }, 0);
      },
    }
  )
);
