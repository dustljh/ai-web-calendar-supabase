import {
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CircleArrowUp } from "lucide-react";
import AppSidebar from "@/components/common/AppSidebar";
import {
  useChatStore,
  type Aiplace,
} from "@/storage/ChatSession";
import { fetchAiResponse } from "@/ai/AiResponse";
import { toast } from "sonner";
import { AiMessage } from "@/ai/AiMesseage";
import { useAuthStore } from "@/storage/User";
import ItineraryMapSkeleton from "@/components/common/ItineraryMap";

function AiCalendar() {

  const user = useAuthStore((state) => state.user);
  const sessions = useChatStore((state) => state.sessions);
  const addSession = useChatStore((state) => state.addSession);
  const addMessageToSession = useChatStore((state) => state.addMessageToSession);

  const { chatId } = useParams();

  const navigate = useNavigate();

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<Aiplace[]>([]);
  const [selectedMessageId, setSelectedMessageId] =
    useState<string>();
  const [routeInfos, setRouteInfos] = useState<
    {
      from: string;
      to: string;
      distance: string;
      duration: string;
      travelMode:
      | "WALKING"
      | "DRIVING"
      | "TRANSIT";
    }[]
  >([]);
  const [showMap, setShowMap] = useState(true);

  const mySessions = useMemo(() => {
    return sessions.filter(
      (s) => s.userId === user?.email
    );
  }, [sessions, user]);

  const currentSession = useMemo(() => {
    return (
      sessions.find(
        (s) => String(s.id) === String(chatId)
      ) ?? null
    );
  }, [sessions, chatId]);

  const currentMessages = useMemo(() => {
    return currentSession?.messages ?? [];
  }, [currentSession]);

  // 자동 스크롤
  useEffect(() => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentMessages]);

  // 현재 세션 마지막 장소 자동 표시
  useEffect(() => {

    const latestMessage = [...currentMessages]
      .reverse()
      .find(
        (msg) =>
          msg.role === "ai" &&
          msg.planPlaces &&
          msg.planPlaces.length > 0
      );

    setSelectedPlaces(
      latestMessage?.planPlaces ?? []
    );

    setSelectedMessageId(
      latestMessage?.messageId
    );

    console.log(
      "MAP MESSAGE ID:",
      latestMessage?.messageId
    );

  }, [currentMessages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!user) {
      toast.warning(
        "로그인이 필요한 서비스입니다."
      );
      return;
    }

    if (!inputValue.trim() || isLoading) {
      return;
    }

    const userMessage = {
      role: "user" as const,
      planName: null,
      planDate: null,
      planContent: inputValue,
      planPlaces: [],
    };

    const tempInput = inputValue;

    setInputValue("");
    setIsLoading(true);

    let targetId = chatId;

    try {
      // 새 세션 생성
      if (!chatId) {
        targetId = Date.now().toString();

        const newSession = {
          id: targetId,
          userId: user.email,
          title: tempInput.slice(0, 15),
          messages: [userMessage],
        };

        addSession(newSession);

        navigate(`/ai-calendar/${targetId}`, { replace: true, });
      } else {
        // 기존 세션 메시지 추가
        addMessageToSession(
          chatId,
          userMessage
        );
      }

      // 최신 메시지 배열 생성
      const latestMessages = [
        ...currentMessages,
        userMessage,
      ];

      await fetchAiResponse(
        targetId!,
        latestMessages
      );
    } catch (error) {
      toast.error(String(error));
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <main className="w-full h-[calc(100vh-72px)] flex flex-col md:flex-row mt-[72px] p-2 md:p-6 gap-2 md:gap-6 overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10B981]/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl -z-10" />

      <div className="hidden lg:block w-60 shrink-0 h-full">
        <AppSidebar
          sessions={mySessions}
          activeSessionId={chatId || null}
          onSelectSession={(id) => {
            navigate(`/ai-calendar/${id}`);
          }}
        />
      </div>

      <section
        className={`flex-1 flex flex-col h-full min-w-0 ${!chatId ? "justify-center" : "justify-between"
          }`}
      >
        {chatId && (
          <div className="flex-1 flex flex-col min-h-0 border rounded-xl bg-card mb-4 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b bg-white/80 backdrop-blur-md flex justify-between items-center">
              <h2 className="text-xl font-bold truncate">
                {currentSession?.title}
              </h2>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50"
            >
              {currentMessages.map((msg, i) =>
                msg.role === "user" ? (
                  <div
                    key={i}
                    className="w-fit max-w-[75%] p-4 rounded-2xl shadow-sm ml-auto bg-primary text-white break-words"
                  >
                    {msg.planContent}
                  </div>
                ) : (
                  <AiMessage
                    key={i}
                    message={msg}
                    routeInfos={routeInfos}
                    onSelectPlaces={(places) => {
                      setSelectedPlaces(places);
                      setSelectedMessageId(msg.messageId);
                    }}
                  />
                )
              )}

              {isLoading && (
                <div className="mr-auto bg-white border p-4 rounded-lg animate-pulse text-sm text-gray-400">
                  AI가 여행 계획을 짜는 중...
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={`w-full max-w-2xl mx-auto ${!chatId ? "scale-100" : "pb-4"
            }`}
        >
          {!chatId && (
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2">
                어디로 떠나고 싶으신가요?
              </h1>

              <p className="text-muted-foreground">
                목적지나 원하는 테마를 알려주세요.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative group">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="제주도 3박 4일 일정 짜줘!"
              className="w-full min-h-[70px] p-4 pr-14 border-2 rounded-2xl focus:border-primary outline-none resize-none shadow-lg transition-all disabled:bg-gray-50"
            />

            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className={`absolute right-4 bottom-4 p-2 rounded-full transition-all duration-200 ${!inputValue.trim() || isLoading
                ? "bg-[#10B981]/30 cursor-not-allowed shadow-none"
                : "bg-[#10B981] hover:bg-[#059669] active:scale-95 shadow-lg shadow-[#10B981]/30"
                } text-white`}
            >
              <CircleArrowUp size={24} />
            </button>
          </form>
        </div>
      </section>

      {chatId && showMap && (
        <section className="hidden md:flex w-[30%] flex-col h-full min-w-0 pb-4 animate-in slide-in-from-right-8 fade-in duration-500">
          <div className="relative flex-1 rounded-xl overflow-hidden shadow-sm border bg-card w-full h-full">

            {selectedMessageId && (
              <ItineraryMapSkeleton
                key={selectedMessageId}
                places={selectedPlaces}
                messageId={selectedMessageId}
                onRouteInfosChange={setRouteInfos}
              />
            )}

            <button
              type="button"
              onClick={() => setShowMap(false)}
              className="absolute top-3 right-3 z-[9999] flex items-center justify-center w-9 h-9 rounded-full bg-white border shadow-lg hover:bg-gray-100 text-black font-bold"
            >
              ✕
            </button>
          </div>
        </section>
      )}

      {chatId && !showMap && (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded-xl bg-white border shadow-lg hover:bg-gray-100 text-sm font-medium"
        >
          지도 열기
        </button>
      )}
    </main>
  );
}

export default AiCalendar;