import { Sparkles, ArrowRight, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/storage/User";
import { toast } from "sonner";

export function App() {

  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);

  const userLoggedIn = () => {
    if (user) {
      navigate("/ai-calendar")
    } else {
      toast.error("로그인 후 이용할 수 있습니다.");
      return;
    }
  }

  return (
    <div className="relative flex justify-center z-10 items-center min-h-svh p-4 overflow-hidden bg-[#f9fafb]">

      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10B981]/10 rounded-full blur-3xl z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl z-10" />

      <div className="relative z-20 w-full max-w-3xl bg-white p-12 md:p-16 rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-10 duration-700 border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] shadow-[#10B981]/5">
        
        <div className="flex flex-col  gap-10 text-center md:text-left md:flex-row md:items-center">

          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 text-xs font-bold text-[#10B981]">
              <Sparkles size={14} />
              <span>캡스톤 디자인 2026 - 세미콜론 팀</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
              Plan B <span className="text-[#10B981]">AI</span><br />
              여행을 그리다
            </h1>

            <p className="text-xl text-gray-500 leading-relaxed max-w-md mx-auto md:mx-0">
              인공지능이 제안하는 스마트한 여행 동반자.<br />
              완벽한 일정을 지금 시작하세요.
            </p>
          </div>

          {/* 로그인 시 작동 */}
          <div className="flex flex-col gap-4 shrink-0 md:border-l md:border-gray-100 md:pl-10">
            <Button className="h-16 px-10 bg-[#10B981] hover:bg-[#059669] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#10B981]/30 transition-all active:scale-95 group"
              onClick={userLoggedIn}
            >
              <UserCheck size={20} className="mr-2" />
              여행 시작하기
              <ArrowRight size={20} className="ml-3 transition-transform group-hover:translate-x-1" />
            </Button>

            <p className="text-sm text-gray-400 text-center font-medium">
              (버튼을 눌러 자신만의 여행 일정을 계획해 보세요.)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App
