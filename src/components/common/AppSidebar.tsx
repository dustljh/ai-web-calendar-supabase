import { useNavigate } from "react-router-dom";
import { type ChatSession } from "@/storage/ChatSession";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useChatStore } from "@/storage/ChatSession";

interface AppSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
}

function AppSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const removeSession = useChatStore((state) => state.removeSession);

  const onDeleteSession = async (id: string) => {
    try {
      const response = await fetch(
        "https://ai-web-calendar-supabase.onrender.com/api/session-delete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("세션 삭제 실패");
      }

      removeSession(id);

      if (activeSessionId === id) {
        navigate("/ai-calendar");
      }

      toast.success("삭제 완료");
    } catch (error) {
      toast.warning(String(error));
    }
  };

  return (
    <aside className="w-full h-full max-h-[calc(100vh-120px)] flex flex-col gap-4 bg-gray-50 border rounded-2xl p-4 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-2 pt-2 shrink-0">
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">
          PLAN History
        </h2>

        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          {sessions.length}
        </span>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-muted-foreground">
              새로운 플랜을 짜보세요.
            </p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = activeSessionId === session.id;

            return (
              <div
                key={session.id}
                className={`w-full border rounded-xl transition-all ${isActive
                  ? "bg-white border-primary shadow-sm ring-1 ring-primary/20"
                  : "bg-white hover:bg-slate-50 border-gray-100"
                  }`}
              >
                <div className="flex items-start justify-between p-3 gap-2">
                  {/* 클릭 영역 */}
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p
                      className={`font-medium truncate ${isActive ? "text-primary" : "text-slate-700"
                        }`}
                    >
                      {session.title}
                    </p>

                    <span className="text-[10px] text-muted-foreground">
                      메시지 {session.messages?.length || 0}개
                    </span>
                  </button>

                  {/* 메뉴 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded-md hover:bg-slate-100 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => onDeleteSession(session.id)}
                      >
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 새 플랜 */}
      <div className="pt-2 border-t shrink-0">
        <button onClick={() => navigate("/ai-calendar")}
          className="w-full py-2.5 text-sm font-semibold text-slate-600 hover:text-primary hover:bg-primary/5 border border-dashed border-slate-300 hover:border-primary rounded-xl transition-all"
        >
          + New Plan
        </button>
      </div>
    </aside>
  );
}

export default AppSidebar;