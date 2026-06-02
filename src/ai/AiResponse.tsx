import { type Message } from "@/storage/ChatSession";
import { useChatStore } from "@/storage/ChatSession";
import { useAuthStore } from "@/storage/User";

export const fetchAiResponse = async (id: string, messages: Message[]) => {

  const user = useAuthStore.getState().user;

  try {
    const lastUserMessage = messages[messages.length - 1]?.planContent;

    const response = await fetch("https://ai-web-calendar-supabase.onrender.com/api/generate-itinerary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: id,
        user_email: user?.email,
        user_message: lastUserMessage,
      }),
    });

    if (!response.ok) throw new Error("네트워크 응답이 올바르지 않습니다.");

    const data = await response.json();
    console.log("WEATHER:", data.weather);
    console.log("GENERATE RESPONSE:", data);
    console.log("GENERATE MESSAGE ID:", data.messageId);
    const normalizedPlaces = (data.planPlaces || []).map((place: any) => ({
      ...place,
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      url: place.url || "",
    }));

    const aiMessage: Message = {
      role: "ai",

      messageId: data.messageId,

      planName: data.planName || "여행 계획",
      planContent: data.planContent || "",
      weather: data.weather || "",
      planPlaces: normalizedPlaces,
      planDate: data.planDate || "",
    };

    useChatStore.getState().addMessageToSession(id, aiMessage);

    console.log(" AI 응답 처리 완료:", aiMessage);

  } catch (error) {
    console.error(" AI 호출 실패:", error);
  }
};