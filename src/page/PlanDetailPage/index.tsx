import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  MapPin,
  Calendar as CalendarIcon,
  Sparkles,
} from "lucide-react";
import ItineraryMapSkeleton from "@/components/common/ItineraryMap";

interface SaveAiplace {
  title: string;
  date: string;
  latitude: number;
  longitude: number;
  time: string;
  description?: string;
  imageUrl?: string;
  url?: string;
}

interface SaveMessage {
  id: number;
  userId: string | null;
  role: "user" | "ai";
  planName?: string | null;
  planDate?: string | null;
  planContent: string | null;
  weather?: string | null;
  planPlaces?: SaveAiplace[];
  createdAt: string;
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SaveMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDatePlan, setSelectedDatePlan] = useState<string | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [routeInfos, setRouteInfos] = useState<any[]>([]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await fetch(
          `https://ai-web-calendar-supabase.onrender.com/sessions/${id}`
        );
        if (!response.ok) {
          throw new Error("데이터 조회 실패");
        }
        const data = await response.json();
        setSession(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id]);

  const planInfo = useMemo(() => {
    if (!session) return { title: "", aiText: "", events: [], places: [] };
    
    return {
      title: session.planName,
      aiText: session.planContent || "",
      events: (session.planPlaces || []).map((place: SaveAiplace) => ({
        title: place.title,
        date: place.date,
        extendedProps: {
          lat: place.latitude,
          lng: place.longitude,
          description: place.description,
          time: place.time,
          originalDate: place.date,
        },
      })),
      places: session.planPlaces || [],
    };
  }, [session]);

  const groupedPlaces = useMemo(() => {
    return planInfo.places.reduce((acc, place) => {
      const date = place.date || "일정 미상";
      if (!acc[date]) acc[date] = [];
      acc[date].push(place);
      return acc;
    }, {} as Record<string, SaveAiplace[]>);
  }, [planInfo.places]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedPlaces).sort();
  }, [groupedPlaces]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-lg">
        불러오는 중...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f9fafb]">
        <p className="text-xl font-bold mb-4 text-gray-400">
          데이터를 찾을 수 없습니다.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-[#10B981] text-white rounded-xl font-bold shadow-lg shadow-[#10B981]/20 hover:bg-[#0ea5e9] transition-colors"
        >
          뒤로 가기
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f9fafb] antialiased pb-20">
      {/* 배경 블러 효과 */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 중앙 정렬 컨테이너 */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        
        {/* 최상단 타이틀 영역 */}
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 text-xs font-bold text-[#10B981] mb-3">
            <Sparkles size={14} />
            <span>저장된 여행 일정입니다</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
            {planInfo.title}
          </h2>
        </div>

        {/* 메인 통합 박스 */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] animate-in fade-in slide-in-from-bottom-6 duration-1000">
          
          {/* 1. 상단: AI 상세 코멘트 영역 */}
          <div className="mb-10 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="text-blue-500" size={20} />
              <h3 className="text-lg font-bold text-gray-800">AI 추천 코멘트</h3>
            </div>
            
            {session.weather && (
              <p className="text-sm text-blue-600 font-medium mb-3">
                🌤️ 예상 날씨: {session.weather}
              </p>
            )}
            
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {planInfo.aiText || "AI 코멘트가 없습니다."}
            </p>
          </div>

          {/* 2. 하단: 좌측(상세 일정 리스트) + 우측(지도) */}
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* ==========================================
                좌측: 일차별 일정 리스트 (이전/다음 버튼 적용) 
                ========================================== */}
            <div className="w-full lg:w-1/2 flex flex-col gap-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <MapPin className="text-[#10B981]" size={20} />
                상세 일정
              </h3>
              
              <div className="space-y-6 pr-2">
                {sortedDates.length > 0 ? (
                  <div className="animate-in fade-in duration-500">
                    
                    {/* 날짜 이동 네비게이션 버튼 */}
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl mb-5 border border-gray-100">
                      <button
                        onClick={() => setCurrentDayIndex((prev) => Math.max(prev - 1, 0))}
                        disabled={currentDayIndex === 0}
                        className="px-4 py-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all font-bold text-gray-600 shadow-sm disabled:shadow-none"
                      >
                        ← 이전
                      </button>
                      
                      <h4 className="font-extrabold text-lg text-[#10B981]">
                        {currentDayIndex + 1}일차 
                        <span className="text-sm font-medium text-gray-500 ml-2">
                          ({sortedDates[currentDayIndex]})
                        </span>
                      </h4>
                      
                      <button
                        onClick={() => setCurrentDayIndex((prev) => Math.min(prev + 1, sortedDates.length - 1))}
                        disabled={currentDayIndex === sortedDates.length - 1}
                        className="px-4 py-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all font-bold text-gray-600 shadow-sm disabled:shadow-none"
                      >
                        다음 →
                      </button>
                    </div>

                    {/* 현재 선택된 일차의 장소 리스트만 렌더링 */}
                    <div className="space-y-4">
                      {groupedPlaces[sortedDates[currentDayIndex]].map((place, idx) => (
                        <div
                          key={`${sortedDates[currentDayIndex]}-${place.title}`}
                          className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex gap-4"
                        >
                          {/* 썸네일 */}
                          {place.imageUrl && (
                            <img
                              src={place.imageUrl}
                              alt={place.title}
                              className="w-24 h-24 md:w-28 md:h-28 object-cover rounded-xl border border-gray-100 shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}

                          {/* 텍스트 정보 */}
                          <div className="flex-1 flex flex-col min-w-0">
                            <h5 className="text-[1.1rem] font-bold text-gray-900 truncate">
                              {/* 번호를 일차별로 1, 2, 3... 다시 매기도록 idx + 1 사용 */}
                              📌 {idx + 1}. {place.title}
                            </h5>
                            <p className="text-[14px] text-gray-600 leading-relaxed mt-2 line-clamp-3">
                              {place.description || "설명이 없습니다."}
                            </p>

                            {routeInfos
                              .filter((info) => info.from === place.title)
                              .map((info, routeIndex) => (
                                <div
                                  key={routeIndex}
                                  className="mt-3 bg-gray-50 p-2.5 rounded-lg flex items-center gap-3 text-[13px] text-gray-600 flex-wrap font-medium border border-gray-100"
                                >
                                  <span className="text-blue-500 font-bold">➡️ {info.to}</span>
                                  <span className="flex items-center gap-1">📏 {info.distance}</span>
                                  <span className="flex items-center gap-1">🕒 {info.duration}</span>
                                  <span className="text-[#10B981] ml-auto">
                                    {info.travelMode === "WALKING"
                                      ? "🚶 도보"
                                      : info.travelMode === "DRIVING"
                                      ? "🚗 차량"
                                      : "🚌 대중교통"}
                                  </span>
                                </div>
                              ))}

                            <div className="flex items-center gap-3 mt-auto pt-3">
                              <span className="text-[13px] font-semibold text-[#6366f1] flex items-center gap-1">
                                🕒 {place.time}
                              </span>
                              {place.url && (
                                <a
                                  href={place.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[13px] font-semibold text-[#10B981] hover:underline flex items-center gap-1"
                                >
                                  🔗 링크
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-10 text-gray-400 bg-gray-50 rounded-xl">
                    상세 계획 내용이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/*  우측: 지도 영역 (선택된 일차의 동선만 표시) */}
            <div className="w-full lg:w-1/2 flex flex-col">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <MapPin className="text-blue-500" size={20} />
                {sortedDates.length > 0 ? `${currentDayIndex + 1}일차 동선 지도` : "여행 동선 지도"}
              </h3>
              <div className="flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-gray-50 w-full min-h-[500px] relative">
                <div className="absolute inset-0">
                  <ItineraryMapSkeleton 
                    /* 지도에도 현재 선택된 일차의 장소들만 전달*/
                    places={sortedDates.length > 0 ? groupedPlaces[sortedDates[currentDayIndex]] : []} 
                    onRouteInfosChange={setRouteInfos}
                    />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 3. 캘린더 섹션 */}
        <section className="mt-8 bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-6">
            <CalendarIcon className="text-[#10B981]" size={20} />
            <h3 className="text-lg font-bold text-gray-800">
              한눈에 보는 달력
            </h3>
          </div>
          <div className="calendar-container">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate={
                planInfo.events.length > 0
                  ? planInfo.events[0].date
                  : new Date()
              }
              events={planInfo.events}
              height="auto"
              contentHeight="auto"
              headerToolbar={{
                left: "prev",
                center: "title",
                right: "next",
              }}
              eventClick={(arg) => {
                setSelectedDatePlan(arg.event.extendedProps.originalDate);
              }}
              eventContent={(arg) => (
                <div
                  title={`[${arg.event.extendedProps.time}] ${arg.event.title}`}
                  className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap px-1 cursor-pointer"
                >
                  <span className="font-bold bg-white/20 px-1 rounded text-[10px] shrink-0">
                    {arg.event.extendedProps.time}
                  </span>
                  <span className="truncate">{arg.event.title}</span>
                </div>
              )}
            />
          </div>
        </section>
      </div> {/* max-w-7xl 컨테이너 종료 */}

      {/* 모달(팝업) 영역 */}
      {selectedDatePlan && groupedPlaces[selectedDatePlan as string] && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedDatePlan(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              onClick={() => setSelectedDatePlan(null)}
            >
              ✕
            </button>

            <h3 className="text-xl font-extrabold text-gray-900 mb-5 border-b pb-3">
              📅 {selectedDatePlan} 일정
            </h3>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {groupedPlaces[selectedDatePlan as string].map((place, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="px-2 py-1 bg-[#10B981]/10 text-[#10B981] text-xs font-bold rounded-lg mt-0.5 shrink-0 border border-[#10B981]/20">
                    {place.time}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-[15px] leading-tight">
                      {place.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 캘린더 및 팝업용 커스텀 스타일링 */}
      <style>{`
        html { scroll-behavior: smooth; }
        .fc-scroller { overflow: hidden !important; }
        .fc {
          --fc-border-color: #f1f5f9;
          --fc-button-bg-color: #10B981;
          --fc-button-border-color: #10B981;
          --fc-button-hover-bg-color: #059669;
          --fc-button-hover-border-color: #059669;
        }
        .fc .fc-toolbar-title { font-size: 1.1rem !important; font-weight: 700; color: #1f2937; }
        .fc .fc-button-primary:disabled { background-color: #e2e8f0; border-color: #e2e8f0; color: #94a3b8; }
        .fc .fc-daygrid-day-number { font-size: 0.85rem; color: #64748b; padding: 8px !important; }
        .fc .fc-event { border-radius: 6px; padding: 3px 6px; font-size: 0.75rem; font-weight: 600; background-color: #10B981; border: none; cursor: pointer; }
        
        /* 팝업 스크롤바 디자인 */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>
    </div>
  );
}