import { create } from "zustand";
import { persist } from "zustand/middleware";

//유저에 대한 정보
interface User {
  id: string;
  email: string;
}

interface UserStore {
  user: User | null;
  setUser: (newUser: User | null) => void;
  reset: () => void;
}

export const useAuthStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (newUser) =>
        set({
          user: newUser
        }),
      reset: () => set({ user: null }),
    }),
    {
      name: "user-storage",
      partialize: (state) => ({ user: state.user }),
    }
  )
);