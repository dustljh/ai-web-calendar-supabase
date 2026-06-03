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

        msg_delete = supabase.table("chat_messages") \
            .delete() \
            .eq("session_id", session_id) \
            .execute()

        print("CHAT MESSAGES DELETE:", msg_delete.data)

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

    # 오류 수정: 프론트 입력값은 그대로 두고, 백엔드 내부에서만 AI 분류/생성/검증 단계를 분리
    def extract_json(raw_content: str):
        try:
            return json.loads(raw_content)
        except Exception:
            start = raw_content.find("{")
            end = raw_content.rfind("}")

            if start == -1 or end == -1:
                raise ValueError("JSON 없음")

            return json.loads(raw_content[start:end + 1])

    # 오류 수정: Gemini JSON 응답을 강제하고, 실패 시 기존 중괄호 추출 방식으로 한 번 더 복구
    def generate_json(prompt_text: str, max_tokens: int = 12000):
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_text,
            config={
                "temperature": 0.2,
                "max_output_tokens": max_tokens,
                "response_mime_type": "application/json"
            }
        )

        raw_content = response.text or ""

        if not raw_content:
            raise ValueError("Gemini가 빈 응답을 반환했습니다.")

        return extract_json(raw_content)

    def normalize_ai_data(ai_data: dict):
        places = ai_data.get("planPlaces") or []

        if not isinstance(places, list):
            places = []

        normalized_places = []

        for place in places:
            if not isinstance(place, dict):
                continue

            normalized_places.append({
                "title": str(place.get("title") or "").strip(),
                "date": str(place.get("date") or "").strip(),
                "latitude": place.get("latitude") or 0.0,
                "longitude": place.get("longitude") or 0.0,
                "time": str(place.get("time") or "").strip(),
                "description": str(place.get("description") or "").strip(),
                "url": str(place.get("url") or "").strip()
            })

        return {
            "planName": ai_data.get("planName") or "여행 계획",
            "planDate": ai_data.get("planDate") or "",
            "planContent": ai_data.get("planContent") or "",
            "weather": ai_data.get("weather") or "",
            "planPlaces": normalized_places
        }

    def save_ai_message(ai_data: dict):
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
                image_url = get_place_image_url(p.get("title", ""))
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
                print("PLACE ERROR:", str(place_error))
                continue

        if places_data:
            supabase.table("ai_places").insert(places_data).execute()

        supabase.table("chat_sessions").update({
            "title": ai_data["planName"]
        }).eq("id", session_id).execute()

        return message_id

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

        user_message = request.user_message.strip()

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

        # 오류 수정: 키워드만으로 분기하지 않고 AI가 요청 유형을 먼저 분류해서 애매한 문장 처리 정확도 개선
        classifier_prompt = f"""
        너는 여행 서비스 요청 분류기다.
        반드시 JSON만 출력한다.

        분류 타입:
        - CHAT: 단순 대화, 인사, 여행과 무관한 말
        - TRIP: 날짜/기간/코스/일정/동선이 필요한 여행 계획 요청
        - SINGLE_PLACE: 장소 1개만 추천 요청
        - PLACE_RECOMMEND: 날짜 없는 여러 장소 추천 요청
        - EDIT_TRIP: 기존 일정에서 장소/날짜/조건을 바꾸는 요청

        판단 규칙:
        - "바꿔", "대신", "빼고", "말고", "교체", "수정"이 있고 기존 일정 문맥이 있으면 EDIT_TRIP
        - "3박 4일", "당일치기", "일정", "코스", "루트", "짜줘"는 TRIP
        - "하나", "한 곳", "1곳"과 "추천"이 같이 있으면 SINGLE_PLACE
        - "맛집 추천", "카페 추천", "명소 추천"처럼 날짜가 없고 여러 개 추천이면 PLACE_RECOMMEND

        출력 형식:
        {{
          "type": "TRIP"
        }}

        [이전 대화]
        {conversation_history}

        [현재 사용자 메시지]
        {user_message}
        """

        try:
            intent_data = generate_json(classifier_prompt, max_tokens=1000)
            request_type = intent_data.get("type", "TRIP")
        except Exception as classify_error:
            print("CLASSIFY ERROR:", str(classify_error))
            request_type = "TRIP"

        if request_type not in ["CHAT", "TRIP", "SINGLE_PLACE", "PLACE_RECOMMEND", "EDIT_TRIP"]:
            request_type = "TRIP"

        # ==================================================
        # 일반 채팅 처리
        # ==================================================
        if request_type == "CHAT":
            chat_prompt = f"""
            너는 플랜B AI 여행 도우미다.
            답변은 1~3문장으로 짧게 작성한다.
            여행과 무관한 말에는 자연스럽게 반응하고, 필요하면 여행/장소 추천으로 부드럽게 유도한다.
            JSON이 아니라 일반 문장으로만 답한다.

            [이전 대화]
            {conversation_history}

            [현재 사용자 메시지]
            {user_message}
            """

            chat_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=chat_prompt,
                config={
                    "temperature": 0.3,
                    "max_output_tokens": 1000
                }
            )

            chat_content = chat_response.text or "무엇을 도와드릴까요? 😊"

            chat_msg_res = supabase.table("chat_messages").insert({
                "session_id": session_id,
                "role": "ai",
                "plan_name": None,
                "plan_date": None,
                "plan_content": chat_content
            }).execute()

            return {
                "role": "ai",
                "messageId": chat_msg_res.data[0]["id"] if chat_msg_res.data else None,
                "planName": None,
                "planDate": None,
                "planContent": chat_content,
                "planPlaces": []
            }

        # ==================================================
        # 기존 일정 수정 처리
        # ==================================================
        if request_type == "EDIT_TRIP":
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
            반드시 JSON만 출력한다.

            핵심 규칙:
            - 기존 일정 전체를 새로 만들지 말 것
            - 사용자가 바꾸라고 한 장소/조건만 변경
            - 변경하지 않는 장소는 title, date, time, latitude, longitude를 그대로 유지
            - 교체 장소는 같은 날짜의 다른 장소들과 가까워야 함
            - 반드시 실제 존재하는 장소만 사용
            - latitude와 longitude는 실제 좌표 사용
            - description은 2문장 이하
            - imageUrl은 만들지 말 것

            [기존 일정]
            {json.dumps(existing_plan, ensure_ascii=False)}

            [수정 요청]
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

            ai_data = normalize_ai_data(generate_json(edit_prompt))

            if not ai_data["planPlaces"]:
                ai_data["planPlaces"] = existing_plan["planPlaces"]

            message_id = save_ai_message(ai_data)

            return {
                "role": "ai",
                "messageId": message_id,
                **ai_data
            }

        if request_type == "SINGLE_PLACE":
            trip_rule = """
            - 장소 1개만 추천
            - planPlaces는 반드시 1개
            - date와 time은 빈 문자열 가능
            - 사용자가 음식 종류를 요청한 경우에만 음식점 추천
            - 음식 요청이 아니면 관광지/명소/전시/공원/카페 등 요청 의도에 맞는 장소 추천
            """
        elif request_type == "PLACE_RECOMMEND":
            trip_rule = """
            - 날짜 기반 일정 생성 금지
            - planDate는 빈 문자열
            - date와 time은 빈 문자열
            - planPlaces는 3~6개
            - 요청 카테고리에 맞는 실제 장소만 추천
            """
        else:
            trip_rule = """
            - 사용자가 요청한 여행 기간 기준으로 일정 생성
            - 기간 언급이 없으면 기본 2박 3일
            - 하루마다 관광지는 3개씩 추천
            - 음식 여행 요청일 때만 식당/카페 포함 가능
            - 일반 여행 요청에는 관광지, 랜드마크, 자연경관, 전시, 공원, 체험 위주
            - 같은 날짜의 장소는 가까운 지역끼리 묶기
            - 하루 안에 도시 반대편을 왕복하는 동선 금지
            - 오전/점심/오후 흐름이 자연스럽게 이어지게 구성
            - 산, 등산, 트레킹은 최소 3~5시간 체류 배정
            """

        planning_prompt = f"""
        너는 여행 동선을 설계하는 AI다.
        최종 사용자 화면에 보여줄 문장이 아니라 내부 계획 JSON만 출력한다.

        현재 날짜: {today_str}
        기본 여행 가능 기간: {today_str} ~ {after_3days}
        요청 유형: {request_type}

        계획 규칙:
        - 사용자의 목적지, 기간, 테마를 해석
        - 날짜 표현이 있으면 실제 날짜로 변환
        - 날짜가 없고 일정 요청이면 현재 날짜 기준 기본 2박 3일
        - 같은 날짜는 가까운 지역끼리 묶기
        - 음식 요청이 아닌 일반 여행은 식당/카페 금지
        - 장소 수가 너무 많거나 적지 않게 계획
        - 장소명은 실제 검색 가능한 이름만 사용

        [요청별 규칙]
        {trip_rule}

        출력 형식:
        {{
          "intentSummary": "string",
          "startDate": "YYYY-MM-DD 또는 빈 문자열",
          "endDate": "YYYY-MM-DD 또는 빈 문자열",
          "dailyPlanLogic": [
            {{
              "date": "YYYY-MM-DD 또는 빈 문자열",
              "area": "string",
              "placeCount": 3,
              "reason": "string"
            }}
          ]
        }}

        [이전 대화]
        {conversation_history}

        [현재 사용자 요청]
        {user_message}
        """

        planning_data = generate_json(planning_prompt, max_tokens=5000)

        final_prompt = f"""
        너는 실제 존재하는 장소만 추천하는 여행 일정 생성 AI다.
        반드시 JSON만 출력한다.

        현재 날짜: {today_str}
        기본 여행 가능 기간: {today_str} ~ {after_3days}
        요청 유형: {request_type}

        절대 규칙:
        - 영어 key만 사용
        - 값은 한국어로 작성
        - planPlaces는 항상 배열
        - 실제 존재하는 장소명만 사용
        - "~맛집", "~카페", "~전문점" 같은 일반명 금지
        - latitude와 longitude는 실제 좌표값 사용
        - url은 실제 지도/공식 사이트 링크만 사용
        - 실제 링크를 확신하지 못하면 url은 빈 문자열
        - imageUrl 생성 금지
        - description은 2문장 이하
        - planContent는 3~5문장
        - 장소 중복 금지

        [요청별 규칙]
        {trip_rule}

        [내부 동선 계획]
        {json.dumps(planning_data, ensure_ascii=False)}

        [출력 형식]
        {{
          "planName": "string",
          "planDate": "string",
          "planContent": "string",
          "weather": "string",
          "planPlaces": [
            {{
              "title": "string",
              "date": "YYYY-MM-DD 또는 빈 문자열",
              "latitude": 0.0,
              "longitude": 0.0,
              "time": "HH:MM-HH:MM 또는 빈 문자열",
              "description": "string",
              "url": "string"
            }}
          ]
        }}

        [현재 사용자 요청]
        {user_message}
        """

        ai_data = normalize_ai_data(generate_json(final_prompt))

        validator_prompt = f"""
        너는 여행 일정 검수 AI다.
        반드시 JSON만 출력한다.

        아래 JSON을 검사하고 문제가 있으면 수정한 최종 JSON을 반환한다.
        문제가 없어도 같은 형식으로 그대로 반환한다.

        검사 항목:
        - 사용자의 요청 유형과 맞는지
        - 음식 요청이 아닌데 식당/카페가 섞였는지
        - 날짜 없는 장소 추천인데 date/time이 들어갔는지
        - 단일 장소 추천인데 장소가 2개 이상인지
        - 일정 요청인데 날짜와 시간이 비어 있는지
        - 같은 날짜 장소가 너무 멀리 떨어져 있는지
        - 시간이 겹치거나 이동이 불가능한지
        - 장소명이 실제 지도 검색 가능한 고유명사인지
        - 좌표가 0 또는 비정상 값인지

        [요청별 규칙]
        {trip_rule}

        [사용자 요청]
        {user_message}

        [검수할 JSON]
        {json.dumps(ai_data, ensure_ascii=False)}
        """

        try:
            checked_data = normalize_ai_data(generate_json(validator_prompt))

            if checked_data["planPlaces"]:
                ai_data = checked_data

        except Exception as validate_error:
            print("VALIDATION SKIPPED:", str(validate_error))

        message_id = save_ai_message(ai_data)

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