import { create } from "zustand";

export interface SaveRouteInfo {
  from: string;
  to: string;
  distance: string;
  duration: string;
  travelMode: "WALKING" | "DRIVING" | "TRANSIT";
}

export interface SaveAiplace {
  title: string;
  date: string;
  latitude: number;
  longitude: number;
  time: string;
  description?: string;
  url?: string;
  distance?: string;
  duration?: string;
  travelMode?: "WALKING" | "DRIVING" | "TRANSIT";
  imageUrl?: string;
}

export interface SaveMessage {
  id: string;
  userId: string | null;
  role: "user" | "ai";
  planName?: string | null;
  planDate?: string | null;
  planContent: string | null;
  weather?: string | null;
  planPlaces?: SaveAiplace[];
  routeInfos?: SaveRouteInfo[];
  createdAt: string;
}

interface SaveChatStore {
  sessions: SaveMessage[];
  addSession: (session: SaveMessage) => void;
  removeSession: (messageId: string) => void;
  clearSessions: () => void;
}

export const useSaveChatStore =
  create<SaveChatStore>((set) => ({
    sessions: [],

    addSession: (session) =>
      set((state) => ({
        sessions: [
          session,
          ...state.sessions,
        ],
      })),

    removeSession: (messageId) =>
      set((state) => ({
        sessions:
          state.sessions.filter(
            (message) =>
              message.id !== messageId
          ),
      })),

    clearSessions: () =>
      set({
        sessions: [],
      }),
  }));