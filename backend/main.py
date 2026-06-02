import os
import json
import re
import requests
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from google import genai
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from fastapi.responses import Response
load_dotenv()

print("GEMINI API KEY:", os.getenv("GEMINI_API_KEY"))
app = FastAPI(title="AI Travel Calendar Full API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Missing Supabase environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_place_image_url(place_title: str):

    try:
        google_key = os.getenv("GOOGLE_MAPS_API_KEY")

        if not google_key:
            return ""

        search_res = requests.post(
            "https://places.googleapis.com/v1/places:searchText",

            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": google_key,
                "X-Goog-FieldMask": "places.displayName,places.photos"
            },
            json={
                "textQuery": place_title,
                "languageCode": "ko"
            },
            timeout=3
        )

        search_data = search_res.json()
        places = search_data.get("places", [])

        if not places:
            return ""
        
        photos = places[0].get("photos", [])

        if not photos:
            return ""
        
        photo_name = photos[0].get("name")

        if not photo_name:
            return ""
        
        photo_res = requests.get(
            f"https://places.googleapis.com/v1/{photo_name}/media",
            params={
                "maxWidthPx": 400,
                "skipHttpRedirect": "true",
                "key": google_key
            },
            timeout=3
        )
        photo_data = photo_res.json()
        return photo_data.get("photoUri", "")

    except Exception as e:

        print("PLACE IMAGE ERROR:", str(e))

        return ""
    
class UserData(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    session_id: str
    user_email: str
    user_message: str

class DeleteSessionRequest(BaseModel):
    session_id: str


class SaveAiplace(BaseModel):
    title: str
    date: str
    latitude: float
    longitude: float
    time: str
    description: str | None = None
    url: str | None = None
    imageUrl: str | None = None

class SaveRouteInfo(BaseModel):
    from_place_title: str | None = None
    to_place_title: str | None = None
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    travel_mode: str | None = None
    travelMode: str | None = None
    distance: str | None = None
    duration: str | None = None

class SaveMessage(BaseModel):
    role: str
    planName: str | None = None
    planDate: str | None = None
    planContent: str | None = None
    weather: str | None = None
    planPlaces: list[SaveAiplace] | None = []
    routeInfos: list[SaveRouteInfo] | None = []


class SaveRequest(BaseModel):
    userId: str
    messages: list[SaveMessage]

class DeleteSavedSessionRequest(BaseModel):
    message_id: str

class RouteInfo(BaseModel):
    from_place_title: str | None = None
    to_place_title: str
    travel_mode: str
    distance: str | None = None
    duration: str | None = None

class SaveRoutesRequest(BaseModel):
    message_id: str
    routes: list[RouteInfo]  

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)


##################################################################################
# --- 1. 회원가입 ---
##################################################################################
@app.post("/save-user")
async def save_user(user: UserData):
    try:
        auth_response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
        })


        user_id = auth_response.user.id

        supabase.table("users").insert({
            "user_id": user_id,
            "email": user.email
        }).execute()

        return {
            "status": "success", 
            "message": "회원가입이 완료되었습니다. 이메일 인증을 확인해 주세요!"
        }

    except Exception as e:
        return {
            "status": "error", 
            "message": f"회원가입 중 오류가 발생했습니다: {str(e)}"
        }


##################################################################################
# --- 2. 로그인 ---
##################################################################################
@app.post("/login")
async def login(user: UserData):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        return {
            "status": "success",
            "message": "로그인 성공!",
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email
            },
            "session": {
                "access_token": auth_response.session.access_token,
                "refresh_token": auth_response.session.refresh_token
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"로그인에 실패했습니다. 이메일 또는 비밀번호를 확인하세요."
        }


##################################################################################
# --- 3. 세션(저장된 일정) 저장 ---
##################################################################################
@app.post("/sessions/save")
async def save_session(data: SaveRequest):
    try:

        user_res = supabase.table("users") \
            .select("user_id") \
            .eq("email", data.userId) \
            .single() \
            .execute()

        user_id = user_res.data["user_id"]

        ai_message = next(
            (
                msg for msg in data.messages
                if msg.role == "ai"
            ),
            None
        )

        if not ai_message:

            raise HTTPException(
                status_code=400,
                detail="AI 메시지가 없습니다."
            )

        msg_data = {
            "user_id": user_id,
            "role": ai_message.role,
            "plan_name": ai_message.planName,
            "plan_date": ai_message.planDate,
            "plan_content": ai_message.planContent,
            "weather": ai_message.weather
        }

        msg_res = supabase.table("save_messages") \
            .insert(msg_data) \
            .execute()

        message_id = msg_res.data[0]["id"]
        
        routes_data = []

        for route in ai_message.routeInfos or []:
            routes_data.append({
                "message_id": message_id,
                "from_place_title": route.from_place_title or route.from_,
                "to_place_title": route.to_place_title or route.to,
                "travel_mode": route.travel_mode or route.travelMode,
                "distance": route.distance,
                "duration": route.duration
            })

        if routes_data:
            supabase.table("save_place_routes") \
                .insert(routes_data) \
                .execute()
            
        places_data = []
        for place in ai_message.planPlaces or []:

            places_data.append({
                "message_id": message_id,
                "title": place.title,
                "date": place.date,
                "latitude": place.latitude,
                "longitude": place.longitude,
                "time": place.time,
                "description": place.description,
                "url": place.url,
                "image_url": place.imageUrl
            })

        if places_data:

            supabase.table("save_ai_places") \
                .insert(places_data) \
                .execute()

        return {
            "status": "success",
            "message": "저장 완료",
            "messageId": message_id
        }

    except Exception as e:

        print("SAVE ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

##################################################################################
# --- 3. 세션(저장된 일정) 삭제 ---
##################################################################################
@app.post("/api/session-delete")
async def delete_chat_session(request: DeleteSessionRequest):
    try:

        session_id = request.session_id

        print("DELETE SESSION:", session_id)

        messages_res = supabase.table("chat_messages") \
            .select("id") \
            .eq("session_id", session_id) \
            .execute()

        print("MESSAGES:", messages_res.data)

        message_ids = [
            msg["id"]
            for msg in messages_res.data
        ]

        print("MESSAGE IDS:", message_ids)

        if message_ids:

            place_delete = supabase.table("ai_places") \
                .delete() \
                .in_("message_id", message_ids) \
                .execute()

            print("AI PLACES DELETE:", place_delete.data)

        # 3. 메시지 삭제
        msg_delete = supabase.table("chat_messages") \
            .delete() \
            .eq("session_id", session_id) \
            .execute()

        print("CHAT MESSAGES DELETE:", msg_delete.data)

        # 4. 세션 삭제
        session_delete = supabase.table("chat_sessions") \
            .delete() \
            .eq("id", session_id) \
            .execute()

        print("CHAT SESSION DELETE:", session_delete.data)

        return {
            "success": True,
            "message": "삭제 완료"
        }

    except Exception as e:

        print("DELETE ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        ) 
##################################################################################
# --- 5. 사용자별 저장된 세션 목록 삭제 API ---
##################################################################################
@app.post("/api/messages-delete")
async def delete_saved_message(request: DeleteSessionRequest):
    try:
        supabase.table("save_place_routes") \
            .delete() \
            .eq(
                "message_id",
                request.session_id
            ) \
            .execute()

        supabase.table("save_ai_places") \
            .delete() \
            .eq(
                "message_id",
                request.session_id
            ) \
            .execute()

        supabase.table("save_messages") \
            .delete() \
            .eq(
                "id",
                request.session_id
            ) \
            .execute()

        return {
            "success": True,
            "message": "삭제 완료"
        }

    except Exception as e:

        print(
            "DELETE ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    

##################################################################################
# --- 6. 사용자별 저장된 세션 목록 조회 API ---
##################################################################################
@app.get("/sessions/user/{user_id}")
async def get_user_sessions(user_id: str):
    try:
        user_res = supabase.table("users") \
            .select("user_id") \
            .eq("email", user_id) \
            .single() \
            .execute()

        real_user_id = user_res.data["user_id"]

        result = supabase.table("save_messages") \
            .select("*") \
            .eq("user_id", real_user_id) \
            .execute()

        print("조회 결과:", result.data)

        formatted_data = []

        for msg in result.data:

            formatted_data.append({
                "id": msg["id"],
                "userId": msg["user_id"],
                "role": msg["role"],
                "planName": msg["plan_name"],
                "planDate": msg["plan_date"],
                "planContent": msg["plan_content"],
                "weather": msg.get("weather", ""),
                "createdAt": str(msg["created_at"])
            })

        return formatted_data

    except Exception as e:

        print("오류 발생:", str(e))

        return {
            "error": str(e)
        }


##################################################################################
# --- 7. 특정 저장 세션 상세 조회 API ---
##################################################################################
@app.get("/sessions/{message_id}")
async def get_saved_session(message_id: str):
    try:

        msg_res = supabase.table("save_messages") \
            .select("*") \
            .eq("id", message_id) \
            .single() \
            .execute()

        msg = msg_res.data

        places_res = supabase.table("save_ai_places") \
            .select("*") \
            .eq("message_id", message_id) \
            .execute()
        
        routes_res = supabase.table("save_place_routes") \
            .select("*") \
            .eq("message_id", message_id) \
            .execute()
    
        result_places = []

        for place in places_res.data:

            result_places.append({
                "title": place["title"],
                "date": place["date"],
                "latitude": float(place["latitude"]),
                "longitude": float(place["longitude"]),
                "time": place["time"],
                "description": place["description"],
                "url": place.get("url", ""),
                "imageUrl": place.get("image_url", "")
            })

        return {
            "id": msg["id"],
            "userId": msg["user_id"],
            "role": msg["role"],
            "planName": msg["plan_name"],
            "planDate": msg["plan_date"],
            "planContent": msg["plan_content"],
            "weather": msg.get("weather", ""),
            "planPlaces": result_places,
            "createdAt": str(msg["created_at"]),
             "routeInfos": [
                {
                    "from": route["from_place_title"],
                    "to": route["to_place_title"],
                    "distance": route["distance"],
                    "duration": route["duration"],
                    "travelMode": route["travel_mode"]
                }
                for route in routes_res.data
            ]
        }

    except Exception as e:

        print("DETAIL ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


##################################################################################
# --- 8. 여행 일정 생성 API ---
##################################################################################
@app.post("/api/generate-itinerary")
async def generate_itinerary(request: ChatRequest):

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    after_3days = (now + timedelta(days=2)).strftime("%Y-%m-%d")

    session_id = request.session_id

    try:
        session_res = supabase.table("chat_sessions") \
            .select("id") \
            .eq("id", session_id) \
            .execute()

        if not session_res.data:

            user_res = supabase.table("users") \
                .select("user_id") \
                .eq("email", request.user_email) \
                .execute()

            user_id = user_res.data[0]["user_id"] if user_res.data else None

            supabase.table("chat_sessions").insert({
                "id": session_id,
                "user_id": user_id,
                "title": "새 채팅"
            }).execute()

        single_place_keywords = [
            "하나", "한 곳", "1곳", "한군데", "한 군데",
            "추천", "추천해줘", "추천좀", "알려줘",
            "카페", "맛집", "명소", "술집", "식당",
            "레스토랑", "빵집", "베이커리", "디저트",
            "공원", "해수욕장", "바다", "산",
            "전시", "박물관", "미술관",
            "국밥", "삼겹살", "치킨", "피자",
            "초밥", "라멘", "우동", "돈까스",
            "브런치", "커피", "와인", "맥주",
            "핫플", "관광지", "랜드마크"
        ]

        duration_keywords = [
            "1박", "2박", "3박", "4박",
            "1일", "2일", "3일", "4일",
            "여행", "일정", "플랜", "코스",
            "루트", "동선", "숙소",
            "호텔", "펜션", "게스트하우스",
            "체크인", "체크아웃",
            "당일", "당일치기",
            "주말", "휴가", "연휴",
            "며칠", "일주일",
            "짜줘", "계획"
        ]

        chat_keywords = [
            "안녕", "하이", "반가워", "뭐해",
            "심심해", "배고파", "졸려",
            "피곤해", "ㅋㅋ", "ㅎㅎ",
            "너 누구야", "대화", "잡담",
            "이야기", "추천 말고"
        ]

        user_message = request.user_message.strip()
        if len(user_message) <= 2:
            is_force_chat = True
        else:

            is_force_chat = False
            edit_keywords = [
                "바꿔줘",
                "변경해줘",
                "교체해줘",
                "대신",
                "말고",
                "빼고",
                "수정해줘"
            ]

        #오류 수정: 사용자 메시지 생성 후 수정 요청 판별
        is_edit_request = any(
            k in user_message
            for k in edit_keywords
        )

        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "user",
            "plan_name": "",
            "plan_date": "",
            "plan_content": user_message
        }).execute()


        history_res = supabase.table("chat_messages") \
            .select("*") \
            .eq("session_id", session_id) \
            .order("created_at") \
            .limit(8) \
            .execute()
        
        conversation_history = ""

        for msg in history_res.data:
            role = "사용자" if msg["role"] == "user" else "AI"
            content = msg.get("plan_content") or ""
            conversation_history += f"{role}: {content}\n"

        if is_edit_request:
            latest_ai_res = supabase.table("chat_messages") \
                .select("id, plan_name, plan_date, plan_content, weather, ai_places(*)") \
                .eq("session_id", session_id) \
                .eq("role", "ai") \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()

            if not latest_ai_res.data:
                guide_text = "수정할 기존 여행 일정이 없어요. 먼저 여행 일정을 생성해 주세요 😊"

                chat_msg_res = supabase.table("chat_messages").insert({
                    "session_id": session_id,
                    "role": "ai",
                    "plan_name": None,
                    "plan_date": None,
                    "plan_content": guide_text
                }).execute()

                return {
                    "role": "ai",
                    "messageId": chat_msg_res.data[0]["id"] if chat_msg_res.data else None,
                    "planName": None,
                    "planDate": None,
                    "planContent": guide_text,
                    "planPlaces": []
                }

            latest_ai = latest_ai_res.data[0]

            existing_plan = {
                "planName": latest_ai.get("plan_name", ""),
                "planDate": latest_ai.get("plan_date", ""),
                "planContent": latest_ai.get("plan_content", ""),
                "weather": latest_ai.get("weather", ""),
                "planPlaces": [
                    {
                        "title": place.get("title", ""),
                        "date": place.get("date", ""),
                        "latitude": place.get("latitude", 0.0),
                        "longitude": place.get("longitude", 0.0),
                        "time": place.get("time", ""),
                        "description": place.get("description", ""),
                        "url": place.get("url", "")
                    }
                    for place in latest_ai.get("ai_places", [])
                ]
            }

            edit_prompt = f"""
        너는 기존 여행 일정을 수정하는 AI다.

        규칙:
        - 기존 일정 전체를 새로 만들지 말 것
        - 사용자가 바꾸라고 한 장소만 교체
        - 나머지 장소는 그대로 유지
        - 교체 장소는 기존 날짜와 시간대에 어울려야 함
        - 같은 날짜 동선에서 너무 멀어지면 가까운 대체 장소 추천
        - 반드시 실제 존재하는 장소만 사용
        - latitude와 longitude는 실제 좌표 사용
        - description은 2문장 이하
        - imageUrl 생성 금지
        - JSON만 출력
        - ```json 금지
        - 사용자가 언급한 장소만 변경
        - 변경되지 않은 장소는 title/time/date 유지

        [기존 일정]
        {json.dumps(existing_plan, ensure_ascii=False)}

        [사용자 수정 요청]
        {user_message}

        [출력 형식]
        {{
        "planName": "string",
        "planDate": "string",
        "planContent": "string",
        "weather": "string",
        "planPlaces": [
            {{
            "title": "string",
            "date": "YYYY-MM-DD",
            "latitude": 0.0,
            "longitude": 0.0,
            "time": "HH:MM-HH:MM",
            "description": "string",
            "url": "string"
            }}
        ]
        }}
        """

            edit_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=edit_prompt,
               config={
                    "temperature": 0.2,
                    "max_output_tokens": 12000,
                    "response_mime_type": "application/json"
                }
            )

            raw_content = edit_response.text or ""

            try:
                start = raw_content.find("{")
                end = raw_content.rfind("}")

                if start == -1 or end == -1:
                    raise ValueError("JSON 없음")

                ai_data = json.loads(raw_content[start:end + 1])

            except Exception as parse_error:
                print("EDIT JSON 파싱 실패:", str(parse_error))
                print("EDIT RAW CONTENT:", raw_content)

                raise HTTPException(
                    status_code=500,
                    detail="수정된 일정 JSON 파싱 실패"
                )

            ai_data = {
                "planName": ai_data.get("planName") or existing_plan["planName"],
                "planDate": ai_data.get("planDate") or existing_plan["planDate"],
                "planContent": ai_data.get("planContent") or existing_plan["planContent"],
                "weather": ai_data.get("weather") or existing_plan["weather"],
                "planPlaces": ai_data.get("planPlaces") or existing_plan["planPlaces"]
            }

            ai_msg_res = supabase.table("chat_messages").insert({
                "session_id": session_id,
                "role": "ai",
                "plan_name": ai_data["planName"],
                "plan_date": ai_data["planDate"],
                "plan_content": ai_data["planContent"],
                "weather": ai_data["weather"]
            }).execute()

            message_id = ai_msg_res.data[0]["id"]

            places_data = []

            for p in ai_data["planPlaces"]:
                try:
                    image_url = get_place_image_url(p.get("title", ""))

                    p["imageUrl"] = image_url

                    places_data.append({
                        "message_id": message_id,
                        "title": p.get("title", ""),
                        "date": p.get("date", ""),
                        "latitude": float(p.get("latitude") or 0.0),
                        "longitude": float(p.get("longitude") or 0.0),
                        "time": p.get("time", ""),
                        "description": p.get("description", ""),
                        "url": p.get("url", ""),
                        "image_url": image_url
                    })

                except Exception as place_error:
                    print("EDIT PLACE ERROR:", str(place_error))
                    continue

            if places_data:
                supabase.table("ai_places").insert(places_data).execute()

            return {
                "role": "ai",
                "messageId": message_id,
                **ai_data
            }

        is_trip = any(
            k in user_message
            for k in duration_keywords
        )

        recommend_keywords = [
            "추천",
            "명소",
            "맛집",
            "카페",
            "관광지",
            "핫플",
            "술집",
            "식당",
            "가볼만한곳"
        ]

        is_single_place = (
            any(k in user_message for k in ["하나", "한 곳", "1곳", "한군데", "한 군데"])
            and any(k in user_message for k in recommend_keywords)
            and not is_trip
        )

        is_multi_place_recommend = (
            any(k in user_message for k in recommend_keywords)
            and not is_trip
            and not is_single_place
        )

        travel_intent_keywords = [
            "일정", "여행", "코스", "루트", "동선",
            "짜줘", "추천", "가볼만한곳", "맛집",
            "카페", "관광지", "명소", "계획",
            "당일치기", "1박", "2박", "3박", "4박"
        ]

        has_travel_intent = any(
            k in user_message
            for k in travel_intent_keywords
        )

        is_chat = (
            is_force_chat or (
                any(k in user_message for k in chat_keywords)
                and not has_travel_intent
                and not is_single_place
                and not is_trip
            )
        )

        # ==================================================
        # 일반 채팅 처리
        # ==================================================
        if is_chat:
            chat_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"""
                너는 친근한 여행 AI다.

                규칙:
                - 자연스럽게 대화
                - 답변은 1~2문장
                - 너무 길게 말하지 말 것
                - 여행 이야기로 자연스럽게 연결 가능
                - 절대 JSON 출력 금지
                - 절대 markdown 출력 금지

                사용자:
                {user_message}
                """,
                config={
                    "temperature": 0.7,
                    "max_output_tokens": 300
                }
            )

            chat_content = (
                chat_response.text.strip()
                if getattr(chat_response, "text", None)
                else "좋아요"
            )

            chat_msg_res = supabase.table("chat_messages").insert({
                "session_id": session_id,
                "role": "ai",
                "plan_name": None,
                "plan_date": None,
                "plan_content": chat_content
            }).execute()

            chat_message_id = (
                chat_msg_res.data[0]["id"]
                if chat_msg_res.data
                else None
            )

            return {
                "role": "ai",
                "messageId": chat_message_id,
                "planName": None,
                "planDate": None,
                "planContent": chat_content,
                "weather": "",
                "planPlaces": []
            }

        # ==================================================
        # 장소 추천 / 여행 일정
        # ==================================================

        if is_single_place:

            trip_rule = """
                - 장소 1개만 추천
                - 반드시 실제 존재하는 장소만 사용
                - 반드시 실제 상호명 사용
                - "~맛집", "~카페", "~전문점" 같은 일반적인 이름 금지
                - 장소 이름(title)은 실제 지도 검색 가능한 이름이어야 함

                - 사용자가 음식 종류를 요청한 경우에만 음식점 추천
                - 음식 요청이 아닐 경우 관광지/명소/카페/전시/공원 등 일반 장소 추천 가능

                - 음식 요청이면 실제 해당 음식 전문점만 추천
                - planPlaces는 반드시 1개만 생성
                - planPlaces는 반드시 1개의 객체만 포함
                - latitude와 longitude는 실제 좌표 사용
                """
        elif is_multi_place_recommend:
            trip_rule = """
                - 날짜 기반 일정 생성 금지
                - 여행 코스 생성 금지
                - 장소만 추천
                - planDate는 빈 문자열로 작성
                - planPlaces는 3~6개 생성
                - 모든 장소는 사용자가 요청한 카테고리에 맞게 추천
                - time은 빈 문자열로 작성
                - date는 빈 문자열로 작성
                - 장소 설명은 2문장 이하
            """
        else:

            trip_rule = """
                - 사용자가 요청한 여행 기간 기준으로 일정 생성
                - 기간 언급이 없으면 기본 2박 3일로 생성
                - 실제 존재하는 장소만 사용
                - 반드시 실제 상호명 사용

                - "~맛집", "~카페", "~전문점" 같은 일반적인 이름 금지
                - 장소 이름(title)은 실제 지도 검색 가능한 이름이어야 함

                - 일반 여행 일정은 관광지, 랜드마크, 자연경관, 전시, 공원, 체험 위주로만 구성
                - 음식점, 카페 추천 금지
                - 하루마다 관광지 3개씩만 추천
                - 같은 장소 반복 금지
                - 사용자가 음식 여행을 요청한 경우에만 음식점 추천 가능
                - 같은 날짜에 너무 멀리 떨어진 장소는 추천하지 말것

                - planPlaces 최소 3개
                - latitude와 longitude는 실제 좌표 사용
                """

        prompt = f"""
            너는 여행 일정 생성 AI다.

            현재 날짜: {today_str}
            여행 가능 기간: {today_str} ~ {after_3days}

            [규칙]
            - JSON만 출력
            - 설명 텍스트 금지
            - 반드시 영어 key만 사용
            - 값(value)은 반드시 한국어로 작성
            - 장소 이름도 한국어 사용
            - 설명도 한국어 사용
            - planPlaces는 항상 배열

            - 반드시 실제 존재하는 장소만 사용
            - 반드시 실제 상호명 사용
            - 사용자가 날짜를 직접 말하면 그 날짜를 여행 시작일로 사용
            - "내일", "모레", "다음주", "주말", "금요일" 같은 자연어 날짜 표현도 해석
            - 사용자가 날짜를 말하지 않으면 현재 날짜 기준으로 생성

            - 사용자의 음식/장소 카테고리와 실제로 관련된 장소만 추천
            - 존재하지 않는 메뉴나 특징을 지어내지 말 것
            - weather는 여행 기간 기준 예상 날씨를 간단하게 작성
            - 각 장소(url)는 실제 지도 또는 공식 사이트 링크 사용
            - url은 반드시 https:// 로 시작
            - 존재하지 않는 링크 생성 금지
            - 해당 장소에 대한 링크가 없으면 생성 금지 
            - 장소와 관련된 실제 검색 가능한 URL만 사용
            - 이미지 URL을 모르면 빈 문자열 사용

            - description은 3문장 이하로 작성
            - planContent는 사용자의 요청 의도에 맞춰 작성
            - planContent에는 왜 이 일정이 사용자 요청에 적합한지 설명
            - planContent에는 여행 동선의 특징을 포함
            - planContent에는 전체 여행 분위기와 핵심 방문 포인트를 포함
            - planContent는 3~5문장으로 작성
            - 단순한 장소 나열 금지
            여행지가 있으면:
            {trip_rule}

            [출력 형식]
            {{
                "planName": "string",
                "planDate": "{today_str} ~ {after_3days}",
                "planContent": "string",
                "weather": "string",
                "planPlaces": [
                {{
                    "title": "string",
                    "date": "YYYY-MM-DD",
                    "latitude": 0.0,
                    "longitude": 0.0,
                    "time": "HH:MM-HH:MM",
                    "description": "string",
                    "url": "string"
                }}
            ]
            }}

        
            [이전 대화]
            {conversation_history}

            [현재 사용자 요청]
            {user_message}
            """

        full_prompt = f"""
            너는 실제 존재하는 장소만 추천하는 여행 AI다.

            규칙:
            - 사용자의 요청 카테고리와 정확히 일치하는 장소만 추천
            - 음식 요청이면 해당 음식 전문점만 추천
            - 일반 여행 요청은 관광지 위주로만 추천
            - 음식 요청이 아닌 경우 음식점과 카페 추천 금지
            - 하루당 관광지는 3개만 추천
            - 사용자가 식당이나 음식을 요청한 경우 관광지 3개에 식당 2개를 추가해 총 5개 장소 추천
            - 하루 일정은 오전/점심/오후 흐름이 자연스럽게 구성
            - 장소 수 부족하거나 초과하지 말것
            - latitude와 longitude는 반드시 실제 좌표값 사용
            - 가짜 장소명 생성 금지
            - 실제 지도 검색 가능한 장소만 사용
            - 같은 날짜에 너무 멀리 떨어진 장소는 추천하지 말것
            - 하루 일정은 실제로 이동 가능한 거리와 시간 안에서 구성
            - 같은 날짜의 장소들은 서로 가까운 지역끼리 묶어서 추천
            - 하루 안에 도시 반대편을 여러 번 왕복하는 동선 금지
            - 오전 장소 → 점심/오후 장소 → 저녁 장소 순서가 자연스럽게 이어지게 구성
            - 장소 간 이동 시간이 너무 길어지면 가까운 대체 장소로 변경
            - 각 장소 종료 시간 + 다음 장소까지 이동 시간을 계산했을 때 다음 일정 시작 시간보다 늦으면 안 됨
            - 이동 시간이 긴 경우 다음 장소 시작 시간을 자동으로 늦춰서 현실적인 일정으로 구성
            - 산, 등산, 트레킹, 국립공원 일정은 최소 3~5시간 이상 체류 시간 배정
            - 한라산, 지리산 같은 등산 장소는 짧은 관광지처럼 1~2시간만 배정 금지
            - 하루 일정 생성 후 실제 시간 순서가 가능한지 다시 검토 후 출력
            추가 규칙:
            - 반드시 JSON만 출력
            - ```json 금지
            - 설명 금지

            Google Search를 사용해서 실제 존재하는 장소를 확인해라

            {prompt}
            """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config={
                "temperature": 0.2,
                "max_output_tokens": 12000,
                "response_mime_type": "application/json"
            }
        )

        print("FULL RESPONSE:", response)

        raw_content = ""

        try:
            if getattr(response, "text", None):
                raw_content = response.text

            elif (
                response.candidates
                and response.candidates[0].content
                and response.candidates[0].content.parts
            ):
                parts = response.candidates[0].content.parts

                raw_content = "".join(
                    part.text
                    for part in parts
                    if hasattr(part, "text") and part.text
                )

        except Exception as response_error:
            print(
                "GEMINI RESPONSE ERROR:",
                str(response_error)
            )

            raw_content = ""

        if not raw_content:
            print("GEMINI EMPTY RESPONSE:", response)

            raise HTTPException(
                status_code=500,
                detail="Gemini가 빈 응답을 반환했습니다."
            )

        print("RAW:", raw_content)

        try:
            start = raw_content.find("{")
            end = raw_content.rfind("}")

            if start == -1 or end == -1:
                raise ValueError("JSON 없음")

            json_text = raw_content[start:end + 1]

            ai_data = json.loads(json_text)

        except Exception as parse_error:
            print(
                "JSON 파싱 실패:",
                str(parse_error)
            )

            print("RAW CONTENT:", raw_content)

            raise HTTPException(
                status_code=500,
                detail="AI JSON 파싱 실패"
            )

        ai_data = {
            "planName": ai_data.get("planName") or "여행 계획",
            "planDate": ai_data.get("planDate") or "",
            "planContent": ai_data.get("planContent") or "",
            "weather": ai_data.get("weather") or "",
            "planPlaces": ai_data.get("planPlaces") or []
        }

        if not isinstance(ai_data["planPlaces"], list):
            ai_data["planPlaces"] = []

        ai_msg_res = supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "ai",
            "plan_name": ai_data["planName"],
            "plan_date": ai_data["planDate"],
            "plan_content": ai_data["planContent"],
            "weather": ai_data["weather"]
        }).execute()

        if not ai_msg_res.data:
            raise Exception("chat_messages insert 실패")

        message_id = ai_msg_res.data[0]["id"]

        places_data = []

        for p in ai_data["planPlaces"]:
            try:
                image_url = get_place_image_url(
                    p.get("title", "")
                )

                p["imageUrl"] = image_url

                places_data.append({
                    "message_id": message_id,
                    "title": p.get("title", ""),
                    "date": p.get("date", today_str),
                    "latitude": float(p.get("latitude") or 0.0),
                    "longitude": float(p.get("longitude") or 0.0),
                    "time": p.get("time", ""),
                    "description": p.get("description", ""),
                    "url": p.get("url", ""),
                    "image_url": image_url
                })

            except Exception as place_error:

                print(
                    "PLACE ERROR:",
                    str(place_error)
                )

                continue

        if places_data:
            supabase.table("ai_places") \
                .insert(places_data) \
                .execute()

        supabase.table("chat_sessions") \
            .update({
                "title": ai_data["planName"]
            }) \
            .eq("id", session_id) \
            .execute()

        return {
            "role": "ai",
            "messageId": message_id,
            **ai_data
        }

    except Exception as e:
        print("상세 에러:", str(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

##################################################################################
# --- 9. 채팅 내역 조회 API ---
##################################################################################
@app.get("/api/chat-history/{session_id}")
async def get_history(session_id: str):
    try:
        res = supabase.table("chat_messages") \
            .select("id, role, plan_name, plan_date, plan_content, weather, ai_places(*)") \
            .eq("session_id", session_id) \
            .order("created_at") \
            .execute()

        rows = []
        for msg in res.data:
            
            places_list = []
            for place in msg.get("ai_places", []):
                places_list.append({
                "title": place["title"],
                "date": place["date"],
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "time": place["time"],
                "description": place["description"],
                "url": place.get("url", ""),
                "imageUrl": place.get("image_url", "")
            })
                
            rows.append({
                "role": msg["role"],

                "messageId": msg.get("id"),

                "planName": msg.get("plan_name", ""),
                "planDate": msg.get("plan_date", ""),
                "planContent": msg.get("plan_content", ""),
                "weather": msg.get("weather", ""),

                "planPlaces": places_list
            })
            
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#####################################################################
#####################################################################
@app.post("/api/save-routes")
async def save_routes(
    request: SaveRoutesRequest
):

    try:

        print("SAVE ROUTES message_id:", request.message_id)
        print("SAVE ROUTES routes:", request.routes)

        if not request.message_id:
            raise HTTPException(
                status_code=400,
                detail="message_id가 없습니다."
            )

        if not request.routes:
            raise HTTPException(
                status_code=400,
                detail="routes가 없습니다."
            )
        
        message_check = supabase.table("chat_messages") \
            .select("id") \
            .eq("id", request.message_id) \
            .execute()

        if not message_check.data:
            print("SAVE ROUTES SKIPPED: chat_messages에 없는 message_id")
            return {
                "success": False,
                "message": "chat_messages에 없는 message_id라서 route 저장 생략"
            }
        route_rows = []

        for route in request.routes:

            route_rows.append({
                "message_id": request.message_id,
                "from_place_title": route.from_place_title,
                "to_place_title": route.to_place_title,
                "travel_mode": route.travel_mode,
                "distance": route.distance,
                "duration": route.duration,
            })

        #오류 수정: 실제 insert 결과 확인
        insert_res = supabase.table(
            "place_routes"
        ).upsert(
            route_rows,
            on_conflict="message_id,from_place_title,to_place_title"
        ).execute()

        print("SAVE ROUTES INSERT RESULT:", insert_res)

        return {
            "success": True,
            "savedCount": len(route_rows)
        }

    except HTTPException:
        raise

    except Exception as e:

        import traceback

        print("SAVE ROUTES ERROR:", str(e))
        print(traceback.format_exc())

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    
@app.get("/api/routes/{message_id}")
async def get_routes(message_id: str):
    try:
        res = supabase.table("place_routes") \
            .select("*") \
            .eq("message_id", message_id) \
            .execute()

        return res.data

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        ) 