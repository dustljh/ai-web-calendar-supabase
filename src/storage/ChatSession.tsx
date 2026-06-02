import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RouteInfo {
  from: string;
  to: string;
  distance: string;
  duration: string;
  travelMode: "WALKING" | "DRIVING" | "TRANSIT";
}

export interface Aiplace {
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

export interface Message {
  role: "user" | "ai";
  messageId?: string;
  planName?: string | null;
  planDate?: string | null;
  planContent?: string | null;
  weather?: string | null;
  planPlaces?: Aiplace[];
  routeInfos?: RouteInfo[];
}

export interface ChatSession {
  id: string;
  userId: string | null;
  title: string;
  messages: Message[];
}

interface ChatStore {
  sessions: ChatSession[];
  addSession: (session: ChatSession) => void;
  addMessageToSession: (sessionId: string, message: Message) => void;
  updateMessageRoutes: (sessionId: string, messageId: string, routeInfos: RouteInfo[]) => void;
  removeSession: (id: string) => void;
}

export const useChatStore =
  create<ChatStore>()(
    persist(
      (set) => ({
        sessions: [],

        addSession: (
          session
        ) =>
          set((state) => ({
            sessions: [
              session,
              ...state.sessions,
            ],
          })),

        addMessageToSession: (
          sessionId,
          message
        ) =>
          set((state) => ({
            sessions:
              state.sessions.map(
                (s) =>
                  s.id === sessionId
                    ? {
                      ...s,
                      messages: [
                        ...s.messages,
                        message,
                      ],
                    }
                    : s
              ),
          })),
        removeSession: (
          id
        ) =>
          set((state) => ({
            sessions:
              state.sessions.filter(
                (session) =>
                  session.id !== id
              ),
          })),
        updateMessageRoutes: (
          sessionId,
          messageId,
          routeInfos
        ) =>
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === sessionId
                ? {
                  ...session,
                  messages: session.messages.map((message) =>
                    message.messageId === messageId
                      ? {
                        ...message,
                        routeInfos,
                      }
                      : message
                  ),
                }
                : session
            ),
          })),
      }),
      {
        name: "chat-storage",
      }
    )
  );