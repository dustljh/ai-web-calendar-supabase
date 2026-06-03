import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MoreVertical } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { useAuthStore } from "@/storage/User";

type SaveSession = {
  id: string;
  userId: string;
  createdAt: string;
  role: "user" | "ai";
  planName?: string | null;
  planDate?: string | null;
  planContent?: string | null;
};

const MyPage = () => {
  const user = useAuthStore((state) => state.user);

  const [sessions, setSessions] = useState<SaveSession[]>([]);

  useEffect(() => {
    if (!user?.email) return;

    const fetchSessions = async () => {
      try {
        const res = await fetch(
          `https://ai-web-calendar-supabase.onrender.com/sessions/user/${user.email}`
        );

        if (!res.ok) {
          throw new Error("목록 조회 실패");
        }

        const data = await res.json();

        setSessions(Array.isArray(data) ? data : []);
      } catch (error) {
        toast.error(String(error));
        setSessions([]);
      }
    };

    fetchSessions();
  }, [user]);

  const onDeleteSession = async (id: string) => {
    try {
      const response = await fetch(
        "https://ai-web-calendar-supabase.onrender.com/api/messages-delete",
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
        throw new Error("삭제 실패");
      }

      setSessions((prev) => prev.filter((session) => session.id !== id));

      toast.success("삭제 완료");
    } catch (error) {
      toast.warning(String(error));
    }
  };

  return (
    <div className="relative flex justify-center items-center min-h-svh p-4 bg-[#f9fafb]">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-[800px] bg-white rounded-2xl shadow-md p-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">나의 여행 계획</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
            {sessions.length}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {sessions.length === 0 ? (
            <div className="text-center p-10 text-slate-400 bg-slate-50 rounded-xl">
              저장된 여행 기록이 없습니다.
            </div>
          ) : (
            /* 변경된 부분: 리스트 전체를 감싸는 하나의 통일된 박스 */
            <div className="w-full border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  /* 변경된 부분: 개별 테두리를 없애고, 마지막 아이템이 아닐 때만 하단 구분선(border-b) 추가 */
                  className={`flex items-start justify-between p-5 gap-2 hover:bg-slate-50 transition-all ${
                    index !== sessions.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <Link
                    to={`/plan-detail/${session.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="text-lg font-semibold truncate">
                      {session.planName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded-md hover:bg-slate-200 shrink-0 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-500 cursor-pointer"
                        onClick={() => onDeleteSession(session.id)}
                      >
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPage;