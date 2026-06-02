import { useAuthStore } from "@/storage/User";
import { Separator } from "../ui/separator";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function AppHeader() {
  const navigate = useNavigate();
  const { user, reset } = useAuthStore();
  
  const stateReset = () => {
    navigate("/");
    reset();

    toast.success("로그아웃되었습니다.");
  }

  return (
    <header className="fixed top-0 z-20 w-full flex items-center justify-center bg-gray-100 border-b border-gray-200 shadow-sm">
      <div className="w-full max-w-[1328px] flex items-center justify-between px-6 py-3">
        <h1 className="cursor-pointer text-2xl font-bold"
          onClick={() => navigate("/")}
        >
          플랜B AI
        </h1>
        <div className="flex items-center gap-5">
          {user ? (
            <div className="flex items-center gap-5">
              {/* 마이페이지 버튼 추가 */}
              <p
                className="cursor-pointer text-sm font-medium hover:text-primary transition-colors"
                onClick={() => navigate("/mypage")}
              >
                마이페이지
              </p>
              <Separator orientation="vertical" className="h-4" />
              {/* 마이페이지 버튼 끝 */}

              <p className="text-sm text-gray-600">{user?.email}</p>
              <Separator orientation="vertical" className="h-4" />
              <p className="cursor-pointer text-sm hover:text-red-500 transition-colors" onClick={() => stateReset()}>로그아웃</p>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <p className="cursor-pointer text-sm hover:text-primary transition-colors" onClick={() => navigate("sign-in")}>로그인</p>
              <Separator orientation="vertical" className="h-4" />
              <p className="cursor-pointer text-sm hover:text-primary transition-colors" onClick={() => navigate("sign-up")}>회원가입</p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppHeader