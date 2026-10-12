import os
import re
import json
import httpx
from fastapi import APIRouter
from app.models import AIChatRequest, AIChatResponse
from app.database import get_db_connection

router = APIRouter(prefix="/ai", tags=["ai"])

def get_platform_context_summary():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM reports WHERE resolved = 0")
    active_barriers = cursor.fetchone()[0]
    cursor.execute("SELECT title, category, location_name, severity FROM reports WHERE resolved = 0 ORDER BY created_at DESC LIMIT 5")
    recent = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return active_barriers, recent

DEFAULT_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
DEFAULT_GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

async def call_gemini_api(api_key: str, messages: list, context: dict = None, model_name: str = DEFAULT_GEMINI_MODEL) -> str:
    contents = []
    
    # System instruction context
    system_text = (
        "You are BREAKING BARIERS Assistant, an empathetic, expert accessibility specialist and platform co-pilot. "
        "You help people with visual, hearing, mobility, speech, and communication needs. "
        "BREAKING BARIERS features flagship modules:\n"
        "1. VisionMate: High-speed OCR and text-to-speech for printed documents, medicine boxes, and signs.\n"
        "2. AccessRoute: Barrier reporting map with spoken step-by-step navigation for wheelchair and blind users.\n"
        "3. Live Captions: Real-time speech-to-text captions for deaf and hard-of-hearing users.\n"
        "4. SafeReach SOS: One-touch emergency alert preparation and trusted contact sharing.\n"
        "5. SignBridge: Scale-invariant hand sign detection and local Qwen linguistic translation.\n\n"
        "Always be concise, compassionate, supportive, and accessible. If the user asks how to use a feature or wants to navigate, guide them directly."
    )
    
    for m in messages:
        role = "user" if m.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m.content}]})

    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 800}
    }

    candidates = [model_name, "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"]
    seen = set()
    unique_models = [m for m in candidates if m and not (m in seen or seen.add(m))]

    last_err = None
    for m_cand in unique_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m_cand}:generateContent?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                else:
                    last_err = f"Gemini model {m_cand} returned status {res.status_code}: {res.text}"
        except Exception as e:
            last_err = str(e)
            continue

    raise Exception(f"Gemini API error across candidate models: {last_err}")

async def call_openai_api(api_key: str, messages: list, context: dict = None) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    formatted = [
        {"role": "system", "content": "You are BREAKING BARIERS Assistant, an accessibility assistant helping with VisionMate, AccessRoute, Live Captions, SafeReach, and SignBridge."}
    ]
    for m in messages:
        formatted.append({"role": m.role, "content": m.content})

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": "gpt-4o-mini", "messages": formatted, "temperature": 0.4}

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, headers=headers, json=payload)
        if res.status_code == 200:
            data = res.json()
            return data["choices"][0]["message"]["content"].strip()
        else:
            raise Exception(f"OpenAI API error {res.status_code}: {res.text}")

def platform_rule_based_assistant(user_text: str, context: dict = None) -> tuple:
    txt = user_text.lower().strip()
    active_barriers, recent_barriers = get_platform_context_summary()

    tool_action = None

    # Navigation intents
    if re.search(r"\b(ocr|read document|read image|extract text|photo text|vision)\b", txt):
        reply = (
            "**VisionMate** helps you read printed documents, signs, and labels aloud.\n\n"
            "**How to use:**\n"
            "1. Upload a picture or click 'Use Device Camera'.\n"
            "2. Our in-browser Tesseract.js engine extracts the text.\n"
            "3. Review or edit the text in the box.\n"
            "4. Click **Speak Aloud** to listen with browser speech synthesis.\n\n"
            "Would you like me to open VisionMate for you?"
        )
        tool_action = {"type": "navigate", "page": "visionmate"}

    elif re.search(r"\b(barrier|report obstacle|broken lift|blocked|pothole|ramp|elevation|hazard)\b", txt):
        barriers_str = "\n".join([f"- **{b['title']}** ({b['category']}, {b['severity']} severity at {b['location_name']})" for b in recent_barriers])
        reply = (
            f"**Community Barrier Reporting** in AccessRoute allows users to warn fellow pedestrians about obstacles.\n\n"
            f"Currently, there are **{active_barriers} active barriers** reported nearby:\n"
            f"{barriers_str}\n\n"
            "**To submit a new report:**\n"
            "Open AccessRoute, click **'Report a Barrier'**, choose category & severity, and click save. The next person on that route will automatically receive a safety warning!"
        )
        tool_action = {"type": "navigate", "page": "accessroute"}

    elif re.search(r"\b(sign|sign language|isl|gesture|hand sign|deaf sign)\b", txt):
        reply = (
            "**SignBridge AI** recognizes Indian Sign Language (ISL) words in real-time.\n\n"
            "**Capabilities:**\n"
            "- Pretrained 82-class PyTorch ResNet-34 model.\n"
            "- Real-time camera preview with center-crop hand alignment.\n"
            "- Add Word, Undo, and Transcript Staging to avoid repeating word floods.\n"
            "- Rule-based natural sentence polish & spoken output.\n\n"
            "Shall I navigate to SignBridge AI?"
        )
        tool_action = {"type": "navigate", "page": "signbridge"}

    elif re.search(r"\b(caption|transcribe|live caption|speech to text|stt|voice caption|can't hear)\b", txt):
        reply = (
            "**Live Captions** provides real-time speech-to-text for deaf and hard-of-hearing users.\n\n"
            "**How it works:**\n"
            "1. Activate your microphone by clicking **'Start Listening'**.\n"
            "2. Words spoken around you are transcribed into large, high-legibility captions on screen in real time.\n"
            "3. Pause, edit, or copy the transcript anytime.\n\n"
            "Would you like to open Live Captions now?"
        )
        tool_action = {"type": "navigate", "page": "captions"}

    elif re.search(r"\b(sos|emergency|help me|danger|ambulance|trusted contact)\b", txt):
        reply = (
            "**SafeReach SOS** is your accessible emergency communication tool.\n\n"
            "**Features:**\n"
            "- High-contrast, large emergency trigger with intentional confirmation.\n"
            "- Pre-formatted templates (*Medical Emergency, Wheelchair Barrier, Disoriented*).\n"
            "- Optional GPS location attachment with explicit permission.\n"
            "- Direct share sheet and clipboard copy fallback.\n\n"
            "⚠️ *Reminder: SafeReach prepares messages for trusted contacts. For life-threatening emergencies, always dial 112 or 911 directly.*"
        )
        tool_action = {"type": "navigate", "page": "safereach"}

    elif re.search(r"\b(high contrast|contrast|font size|settings|theme|dark mode|yellow)\b", txt):
        reply = (
            "You can customize your accessibility settings at any time:\n\n"
            "- **Theme:** Standard, High Contrast (Yellow on Black / WCAG AAA), or Dark Mode.\n"
            "- **Font Scaling:** 100%, 115%, 130%, or 145% across all views.\n"
            "- **Speech Rate:** Adjust TTS playback speed (0.6x to 1.5x).\n"
            "- **Quick Switcher:** You can also toggle ⚡ High Contrast using the button in the top navigation header!"
        )
        tool_action = {"type": "navigate", "page": "settings"}

    elif re.search(r"\b(what can you do|features|overview|help|capabilities)\b", txt):
        reply = (
            "**Welcome to BREAKING BARIERS!** Here is what you can do on the platform:\n\n"
            "1. **VisionMate** — Extract text from photos & signs and hear them read aloud.\n"
            "2. **AccessRoute** — Interactive accessible map, turn-by-turn navigation, and community barrier reports.\n"
            "3. **Live Captions** — Live speech-to-text captions for deaf and hard-of-hearing users.\n"
            "4. **SafeReach SOS** — Prepare emergency alerts with location consent and trusted contacts.\n"
            "5. **SignBridge** — Recognize Indian Sign Language hand signs and translate them to speech.\n"
            "6. **Ask Assistant** — I can guide you, look up barriers, and navigate between tools!"
        )
    else:
        reply = (
            "I am **BREAKING BARIERS Assistant**. I can help you read documents aloud, navigate accessible routes, "
            "report community barriers, generate live speech captions, prepare emergency SOS alerts, or translate sign language.\n\n"
            "Try asking:\n"
            "- *'How do I report a barrier?'*\n"
            "- *'How can I read an image aloud?'*\n"
            "- *'Show me live captions for speech'*\n"
            "- *'How does sign language recognition work?'*"
        )

    return reply, tool_action

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_assistant(payload: AIChatRequest):
    if not payload.messages:
        return AIChatResponse(
            reply="Hello! How can I assist you with digital accessibility today?",
            provider="platform_default"
        )

    last_user_msg = payload.messages[-1].content
    gemini_key = os.environ.get("GEMINI_API_KEY", DEFAULT_GEMINI_KEY)
    gemini_model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    openai_key = os.environ.get("OPENAI_API_KEY")

    # Check contextual navigation intent
    _, tool_action = platform_rule_based_assistant(last_user_msg, payload.context)

    # 1. Real Google Gemini 3.1 Flash Lite
    if gemini_key and len(gemini_key.strip()) > 10:
        try:
            reply = await call_gemini_api(gemini_key.strip(), payload.messages, payload.context, model_name=gemini_model)
            return AIChatResponse(
                reply=reply, 
                provider="breaking_bariers",
                tool_action=tool_action
            )
        except Exception as e:
            print(f"[AI Chat] Gemini API error: {e}")

    # 2. Real OpenAI Provider
    if openai_key and len(openai_key.strip()) > 10:
        try:
            reply = await call_openai_api(openai_key.strip(), payload.messages, payload.context)
            return AIChatResponse(reply=reply, provider="openai_gpt4o_mini")
        except Exception as e:
            print(f"[AI Chat] OpenAI API error: {e}")

    # 3. Contextual Platform Intelligence Fallback
    reply, tool_action = platform_rule_based_assistant(last_user_msg, payload.context)
    return AIChatResponse(
        reply=reply,
        provider="platform_intelligent_copilot",
        tool_action=tool_action
    )
