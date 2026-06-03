import { type Message, type Aiplace } from "@/storage/ChatSession";
import { getGroupedAndSortedPlaces } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/storage/User";
import { useEffect, useState } from "react";

type RouteInfo = {
  from: string;
  to: string;
  distance: string;
  duration: string;
  travelMode: "WALKING" | "DRIVING" | "TRANSIT";
};

type MessageProps = {
  message: Message;
  onSelectPlaces?: (places: Aiplace[]) => void;
  routeInfos?: RouteInfo[];
};

export function AiMessage({
  message,
  onSelectPlaces,
  routeInfos = [],
}: MessageProps) {
  const [fetchedRouteInfos, setRouteInfos] = useState<RouteInfo[]>([]);

  const visibleRouteInfos =
    routeInfos && routeInfos.length > 0
      ? routeInfos
      : fetchedRouteInfos;

  useEffect(() => {
    if (!message.messageId) return;

    const fetchRoutes = async () => {
      try {
        const res = await fetch(
          `https://ai-web-calendar-supabase.onrender.com/api/routes/${message.messageId}`
        );

        const data = await res.json();

        const normalizedRoutes = data.map((route: any) => ({
          from: route.from_place_title,
          to: route.to_place_title,
          distance: route.distance,
          duration: route.duration,
          travelMode: route.travel_mode,
        }));

        setRouteInfos(normalizedRoutes);
      } catch (error) {
        console.error("ROUTES FETCH ERROR:", error);
      }
    };

    fetchRoutes();
  }, [message.messageId]);

  const navigate = useNavigate();
  const { chatId } = useParams();

  const { sortedDates, groupedPlaces } =
    getGroupedAndSortedPlaces(message.planPlaces || []);

  const user = useAuthStore((state) => state.user);
  const hasPlaces = sortedDates.length > 0;
  const isSinglePlace = message.planPlaces?.length === 1;
  const isMultiPlaceRecommend =
    message.planPlaces &&
    message.planPlaces.length > 1 &&
    !message.planPlaces.some((place) => place.date?.trim());

  const hasScheduledPlaces =
    message.planPlaces?.some(
      (place) =>
        place.date?.trim() &&
        place.time?.trim()
    ) ?? false;

  const canSaveSchedule =
    hasScheduledPlaces &&
    !isSinglePlace &&
    !isMultiPlaceRecommend;

  let placeNumber = 1;

  const isTravelMessage =
    hasPlaces || (!!message.planDate && message.planDate.trim() !== "");

  const handleSave = async () => {
    if (!chatId) {
      console.error("chatId가 없습니다.");
      return;
    }

    if (!user?.email) {
      alert("로그인이 필요한 서비스입니다.");
      return;
    }

    const uniqueId = `${chatId}-${Date.now()}`;

    const sessionData = {
      id: uniqueId,
      userId: user.email,
      title: message.planName ?? "여행 일정",
      createdAt: new Date().toISOString(),
      messages: [
        {
          role: "ai",
          planName: message.planName,
          planDate: message.planDate,
          planContent: message.planContent,
          weather: message.weather,
          planPlaces:
            message.planPlaces?.map((place) => ({
              title: place.title,
              date: place.date,
              latitude: place.latitude,
              longitude: place.longitude,
              time: place.time,
              description: place.description,
              url: place.url,
              imageUrl: place.imageUrl,
            })) || [],
          routeInfos: visibleRouteInfos,
        },
      ],
    };

    try {
      const res = await fetch(
        "https://ai-web-calendar-supabase.onrender.com/sessions/save",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sessionData),
        }
      );

      if (!res.ok) throw new Error("DB 저장 실패");

      navigate("/mypage");
    } catch (error) {
      console.error("저장 실패:", error);
    }
  };

  return (
    <div
      className="mr-auto bg-white border p-4 rounded-lg shadow-sm max-w-[80%]"
      onClick={() => {
        if (
          onSelectPlaces &&
          message.planPlaces &&
          message.planPlaces.length > 0
        ) {
          onSelectPlaces(message.planPlaces);
        }
      }}
    >
      {!hasPlaces ? (
        isTravelMessage ? (
          <div className="mt-4 text-sm text-gray-500 italic">
            ⚠️ 여행 장소 정보가 없습니다.
          </div>
        ) : (
          <p className="whitespace-pre-wrap">
            {message.planContent}
          </p>
        )
      ) : isSinglePlace ? (
        <div className="mt-4">
          {message.planPlaces?.map((place, index) => (
            <div
              key={index}
              className="mt-2 border-t pt-3 first:border-t-0"
            >
              <div className="flex gap-4">
                {place.imageUrl && (
                  <img
                    src={place.imageUrl}
                    alt={place.title}
                    className="w-28 h-28 object-cover rounded-xl border shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}

                <div className="flex-1">
                  <h3 className="text-lg font-bold text-black">
                    📌 {place.title || "장소명 없음"}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-1">
                    {place.description}
                  </p>
                  {place.url && (
                    <a
                      href={place.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-600 font-medium hover:underline"
                    >
                      🔗 링크
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isMultiPlaceRecommend ? (

        <div className="mt-4 space-y-4">
          {message.planPlaces?.map((place, index) => (
            <div key={index} className="mt-3 border-t pt-3 first:border-t-0">
              <div className="flex gap-4">
                {place.imageUrl && (
                  <img src={place.imageUrl} alt={place.title} className="w-28 h-28 object-cover rounded-xl border shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-black text-lg">
                    📌 {place.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                    {place.description}
                  </p>
                  {place.url && (
                    <a href={place.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-green-600 font-medium hover:underline mt-2 inline-block"
                    >
                      🔗 링크
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6">
            <h3 className="text-lg font-bold text-black">
              제목: {message.planName}
            </h3>

            {message.weather?.trim() && (
              <p className="text-sm text-blue-500 font-medium mt-1">
                예상날씨: {message.weather}
              </p>
            )}

            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              {message.planContent}
            </p>
          </div>

          {sortedDates.map((date) => (
            <div key={date} className="mt-8">
              <p className="font-bold text-primary text-lg mb-3">
                {date}
              </p>

              {groupedPlaces[date].map((place) => (
                <div
                  key={`${date}-${place.title}`}
                  className="mt-3 border-t pt-3 first:border-t-0"
                >
                  <div className="flex gap-4">
                    {place.imageUrl && (
                      <img
                        src={place.imageUrl}
                        alt={place.title}
                        className="w-28 h-28 object-cover rounded-xl border shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}

                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        📌 {placeNumber++}. {place.title}
                      </p>

                      <p className="text-sm text-gray-600 leading-relaxed mt-1">
                        {place.description}
                      </p>

                      {visibleRouteInfos
                        .filter((info) => info.from === place.title)
                        .map((info, routeIndex) => (
                          <div
                            key={routeIndex}
                            className="mt-2 flex gap-3 text-xs text-gray-500 flex-wrap"
                          >
                            <span>➡️ {info.to}</span>
                            <span>📏 {info.distance}</span>
                            <span>🕒 {info.duration}</span>

                            <span>
                              {info.travelMode === "WALKING"
                                ? "🚶 도보"
                                : info.travelMode === "DRIVING"
                                  ? "🚗 차량"
                                  : "🚌 대중교통"}
                            </span>
                          </div>
                        ))}

                      <div className="flex gap-2 mt-2">
                        <p className="text-xs text-blue-500 font-medium">
                          🕒 {place.time}
                        </p>

                        {place.url && (
                          <a
                            href={place.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 font-medium hover:underline"
                          >
                            🔗 링크
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {canSaveSchedule && (
        <div className="flex justify-end mt-4">
          <Button
            className="bg-[#ffffff] text-black hover:bg-gray-200 border"
            onClick={handleSave}
          >
            일정 저장하기
          </Button>
        </div>
      )}
    </div>
  );
}