import { useEffect, useState } from "react";
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

export interface SaveAiplace {
  title: string;
  date: string;
  latitude: number;
  longitude: number;
  time: string;
  description?: string;
  url?: string;
  imageUrl?: string;
}

interface SaveRouteInfo {
  from: string;
  to: string;
  travelMode: "WALKING" | "DRIVING" | "TRANSIT";
  distance: string;
  duration: string;
}

interface SaveMessage {
  id: string;
  userId: string | null;
  role: "user" | "ai";
  planName?: string | null;
  planDate?: string | null;
  planContent: string | null;
  weather?: string | null;
  planPlaces?: SaveAiplace[];
  createdAt: string;
  routeInfos?: SaveRouteInfo[];
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SaveMessage | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-lg bg-[#f9fafb]">
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
          className="px-6 py-2 bg-[#10B981] text-white rounded-xl font-bold shadow-lg shadow-[#10B981]/20"
        >
          뒤로 가기
        </button>
      </div>
    );
  }

 
  const planInfo = {
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
      },
    })),
    places: session.planPlaces || [],
  };

  return (
    <div className="relative min-h-screen bg-[#f9fafb] overflow-x-hidden antialiased">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <main className="relative z-10 w-full min-h-screen pt-24 px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto space-y-8">
          <section className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="h-[420px] xl:h-[520px] min-h-[420px] overflow-y-auto pr-2 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 text-xs font-bold text-[#10B981]">
                  <Sparkles size={14} />
                  <span>저장된 여행 일정</span>
                </div>

                <div>
                  <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight">
                    {planInfo.title || "저장된 여행 계획"}
                  </h2>

                  {session.planDate && (
                    <p className="mt-3 text-sm md:text-base text-gray-500 font-medium">
                      📅 {session.planDate}
                    </p>
                  )}
                </div>

                {session.planContent && (
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-4xl">
                    {session.planContent}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:min-w-[220px]">
                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs font-bold text-blue-500 mb-1">
                    예상날씨
                  </p>

                  <p className="text-sm font-semibold text-gray-700">
                    {session.weather || "날씨 정보 없음"}
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                  <p className="text-xs font-bold text-[#10B981] mb-1">
                    장소 수
                  </p>

                  <p className="text-sm font-semibold text-gray-700">
                    {planInfo.places.length}개 장소
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.95fr] gap-8 items-start">
            <section className="bg-white p-5 md:p-6 rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] xl:sticky xl:top-24 self-start">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <MapPin className="text-blue-500" size={20} />

                  <h3 className="text-lg font-bold text-gray-800">
                    여행 동선 지도
                  </h3>
                </div>

                <span className="text-xs text-gray-400 font-medium">
                  장소 순서대로 표시
                </span>
              </div>

              <div className="rounded-2xl overflow-hidden shadow-sm border bg-card w-full h-[420px] xl:h-[520px] min-h-[420px]">
                <ItineraryMapSkeleton places={planInfo.places} />
              </div>
            </section>

            <section className="bg-white p-5 md:p-6 rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] self-start">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-[#10B981]" size={20} />

                  <h3 className="text-lg font-bold text-gray-800">
                    AI 추천 상세 계획
                  </h3>
                </div>
              </div>

              <div className="h-[420px] xl:h-[520px] min-h-[420px] overflow-y-auto pr-2 space-y-4">
                {planInfo.places.length > 0 ? (
                  planInfo.places.map((place, index) => (
                    <article
                      key={`${place.date}-${place.title}-${index}`}
                      className="bg-gray-50 rounded-2xl p-4 border border-gray-100"
                    >
                      {place.imageUrl && (
                        <img
                          src={place.imageUrl}
                          alt={place.title}
                          className="w-full h-44 object-cover rounded-xl border mb-4 bg-white"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}

                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-xs text-[#10B981] font-bold mb-1">
                            PLACE {index + 1}
                          </p>

                          <h4 className="text-lg font-extrabold text-gray-900">
                            {place.title}
                          </h4>
                        </div>

                        {place.time && (
                          <span className="shrink-0 text-xs text-[#10B981] font-bold bg-white border border-emerald-100 px-3 py-1 rounded-full">
                            {place.time}
                          </span>
                        )}
                      </div>

                      {place.date && (
                        <p className="text-sm text-gray-400 mb-3">
                          {place.date}
                        </p>
                      )}

                      <p className="text-gray-600 leading-relaxed text-[15px]">
                        {place.description || "설명이 없습니다."}
                      </p>

                      {session.routeInfos
                        ?.filter((route) => route.from === place.title)
                        .map((route, routeIndex) => (
                          <div
                            key={routeIndex}
                            className="mt-3 rounded-xl bg-white border border-gray-100 p-3 flex gap-3 text-xs text-gray-500 flex-wrap"
                          >
                            <span>➡️ {route.to}</span>
                            <span>📏 {route.distance}</span>
                            <span>🕒 {route.duration}</span>
                            <span>
                              {route.travelMode === "WALKING"
                                ? "🚶 도보"
                                : route.travelMode === "DRIVING"
                                  ? "🚗 차량"
                                  : "🚌 대중교통"}
                            </span>
                          </div>
                        ))}

                      {place.url && (
                        <a
                          href={place.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center mt-3 text-sm text-green-600 font-bold hover:underline"
                        >
                          🔗 장소 링크
                        </a>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="text-center p-10 text-gray-400 bg-gray-50 rounded-2xl">
                    상세 계획 내용이 없습니다.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="bg-white p-5 md:p-6 rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 mb-6">
              <CalendarIcon className="text-[#10B981]" size={20} />

              <h3 className="text-lg font-bold text-gray-800">
                일정 달력
              </h3>
            </div>

            <div className="calendar-container rounded-xl overflow-hidden">
              <FullCalendar
                plugins={[
                  dayGridPlugin,
                  interactionPlugin,
                ]}
                initialView="dayGridMonth"
                initialDate={
                  planInfo.events.length > 0
                    ? planInfo.events[0].date
                    : new Date()
                }
                events={planInfo.events}
                height="auto"
                handleWindowResize={true}
                stickyHeaderDates={false}
                headerToolbar={{
                  left: "prev",
                  center: "title",
                  right: "next",
                }}
              />
            </div>
          </section>
        </div>
      </main>

      <style>{`
        html {
          scroll-behavior: smooth;
        }

        .fc {
          --fc-border-color: #f1f5f9;
          --fc-button-bg-color: #10B981;
          --fc-button-border-color: #10B981;
        }

        .fc .fc-toolbar-title {
          font-size: 1rem !important;
          font-weight: 700;
          color: #1f2937;
        }

        .fc .fc-button-primary:disabled {
          background-color: #e2e8f0;
          border-color: #e2e8f0;
          color: #94a3b8;
        }

        .fc .fc-daygrid-day-number {
          font-size: 0.85rem;
          color: #64748b;
          padding: 8px !important;
        }

        .fc .fc-event {
          border-radius: 6px;
          padding: 2px 4px;
          font-size: 0.75rem;
          background-color: #10B981;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
