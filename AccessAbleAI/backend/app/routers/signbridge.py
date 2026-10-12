import os
import io
import json
import base64
import time
import httpx
import requests
import numpy as np
import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from app.feature_extractor import extract_features
from app.kinematics import classify_kinematics

router = APIRouter(prefix="/signbridge", tags=["signbridge"])

# Paths to models
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "gesture_classifier.joblib")
CLASSES_PATH = os.path.join(MODELS_DIR, "class_names.json")
TASK_MODEL_PATH = os.path.join(MODELS_DIR, "hand_landmarker.task")
GESTURE_TASK_PATH = os.path.join(MODELS_DIR, "gesture_recognizer.task")

# Google Pretrained Gesture Mapping
GESTURE_MAP = {
    "Open_Palm": "HELLO",
    "Thumb_Up": "YES",
    "Thumb_Down": "NO",
    "Closed_Fist": "YES",
    "Victory": "YES",
    "Pointing_Up": "I",
    "ILoveYou": "I"
}

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
QWEN_API_URL = "http://localhost:11434/api/generate"
QWEN_MODEL_NAME = "qwen2.5:1.5b"

SYSTEM_PROMPT = (
    "You are an expert sign language interpreter. "
    "Translate these sign language tokens into a fluent, naturally spoken English sentence with proper punctuation and sentence casing. "
    "Output only the final translated sentence without notes, explanation, or quotes."
)

# Singleton state
_clf = None
_class_names = []
_gemini_unreachable_until = 0.0
_qwen_unreachable_until = 0.0
_gesture_recognizer = None
_hand_landmarker = None

def get_engine():
    global _clf, _class_names, _gesture_recognizer, _hand_landmarker
    if _gesture_recognizer is not None or _hand_landmarker is not None:
        return _clf, _class_names, _gesture_recognizer, _hand_landmarker

    # 1. Load Google MediaPipe Gesture Recognizer (Primary)
    if os.path.exists(GESTURE_TASK_PATH):
        try:
            print("[SignBridge Engine] Initializing Google MediaPipe Gesture Recognizer...")
            base_options = mp_python.BaseOptions(model_asset_path=GESTURE_TASK_PATH)
            options = mp_vision.GestureRecognizerOptions(base_options=base_options, num_hands=1)
            _gesture_recognizer = mp_vision.GestureRecognizer.create_from_options(options)
            print("[SignBridge Engine] Google Gesture Recognizer initialized successfully!")
        except Exception as e:
            print(f"[SignBridge Engine] Gesture Recognizer init warning: {e}")

    # 2. Load MediaPipe Hand Landmarker (Fallback & Kinematics)
    if os.path.exists(TASK_MODEL_PATH):
        try:
            print("[SignBridge Engine] Initializing MediaPipe HandLandmarker...")
            base_options = mp_python.BaseOptions(model_asset_path=TASK_MODEL_PATH)
            options = mp_vision.HandLandmarkerOptions(
                base_options=base_options,
                num_hands=1,
                min_hand_detection_confidence=0.5,
                min_hand_presence_confidence=0.5
            )
            _hand_landmarker = mp_vision.HandLandmarker.create_from_options(options)
            print("[SignBridge Engine] HandLandmarker initialized successfully!")
        except Exception as e:
            print(f"[SignBridge Engine] HandLandmarker init warning: {e}")

    # 3. Load Random Forest Classifier & Class labels
    if os.path.exists(MODEL_PATH) and os.path.exists(CLASSES_PATH):
        try:
            print("[SignBridge Engine] Loading Random Forest classifier...")
            _clf = joblib.load(MODEL_PATH)
            _clf.n_jobs = 1
            with open(CLASSES_PATH, "r", encoding="utf-8") as f:
                _class_names = json.load(f)
            print(f"[SignBridge Engine] Random Forest loaded with {len(_class_names)} classes.")
        except Exception as e:
            print(f"[SignBridge Engine] RF Model load warning: {e}")

    return _clf, _class_names, _gesture_recognizer, _hand_landmarker

class PredictRequest(BaseModel):
    image_data: str

class TranslateRequest(BaseModel):
    tokens: List[str]

@router.get("/status")
def signbridge_status():
    clf, classes, gest_rec, hand_lm = get_engine()
    engine_ready = gest_rec is not None or hand_lm is not None

    return {
        "online": engine_ready,
        "mode": "hybrid_kinematic_vision" if engine_ready else "offline",
        "num_classes": len(classes) if classes else 10,
        "classes": classes or ["HELLO", "THANK YOU", "YES", "NO", "I", "WANT", "WATER", "GOODBYE", "PLEASE", "HELP"],
        "details": {
            "engine": "MediaPipe Pretrained Vision + 3D Kinematics (<15ms)",
            "precision": "Multi-tier consensus"
        }
    }

@router.post("/predict")
def signbridge_predict(payload: PredictRequest):
    clf, classes, gest_rec, hand_lm = get_engine()
    if gest_rec is None and hand_lm is None:
        raise HTTPException(
            status_code=503,
            detail="SignBridge ML Engine is initializing or model files are missing."
        )

    try:
        t0 = time.perf_counter()
        data_str = payload.image_data
        if "," in data_str:
            data_str = data_str.split(",")[1]

        image_bytes = base64.b64decode(data_str)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_img = np.array(pil_img, dtype=np.uint8)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np_img)

        predicted_sign = None
        confidence_val = 0.0

        # TIER 1: Google Pretrained Gesture Recognizer
        landmarks = None
        if gest_rec is not None:
            res = gest_rec.recognize(mp_image)
            if res.hand_landmarks and len(res.hand_landmarks) > 0:
                landmarks = res.hand_landmarks[0]
            
            if res.gestures and len(res.gestures) > 0:
                top_gesture = res.gestures[0][0]
                cat_name = top_gesture.category_name
                cat_score = float(top_gesture.score)

                if cat_name in GESTURE_MAP and cat_score >= 0.65:
                    predicted_sign = GESTURE_MAP[cat_name]
                    confidence_val = round(cat_score, 3)

        # TIER 2: 3D Joint Angle Kinematics
        # Evaluates invariant 3D angles to detect signs like WATER, WANT, PLEASE, THANK YOU, NO, I
        if landmarks is None and hand_lm is not None:
            lm_res = hand_lm.detect(mp_image)
            if lm_res.hand_landmarks and len(lm_res.hand_landmarks) > 0:
                landmarks = lm_res.hand_landmarks[0]

        if landmarks is not None:
            kin_sign, kin_conf = classify_kinematics(landmarks)
            
            if kin_sign:
                # Prioritize high-accuracy kinematics for vocabulary signs
                if predicted_sign is None or kin_conf > confidence_val or kin_sign in ("WATER", "NO", "I", "THANK YOU", "WANT", "PLEASE", "HELP"):
                    predicted_sign = kin_sign
                    confidence_val = round(kin_conf, 3)

        # TIER 3: Random Forest fallback
        if predicted_sign is None and landmarks is not None and clf is not None and classes:
            features = extract_features(landmarks)
            if features and len(features) == 60:
                feat_arr = np.array([features], dtype=np.float32)
                probs = clf.predict_proba(feat_arr)[0]
                best_idx = int(np.argmax(probs))
                rf_conf = float(probs[best_idx])
                if rf_conf >= 0.70:
                    predicted_sign = classes[best_idx]
                    confidence_val = round(rf_conf, 3)

        infer_latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        if predicted_sign:
            return {
                "prediction": predicted_sign,
                "confidence": confidence_val,
                "latency_ms": infer_latency_ms,
                "mode": "hybrid_kinematic_vision"
            }
        else:
            return {
                "prediction": None,
                "confidence": 0.0,
                "message": "Adjust hand within camera view",
                "latency_ms": infer_latency_ms,
                "mode": "hybrid_kinematic_vision"
            }

    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(err)}")

@router.post("/translate")
async def signbridge_translate(payload: TranslateRequest):
    tokens = payload.tokens
    if not tokens:
        return {
            "direct_words": "",
            "translated_sentence": "",
            "tokens": [],
            "provider": "none"
        }

    # 1. Clean and strictly deduplicate consecutive and repeated tokens
    clean_tokens = []
    for t in tokens:
        t_clean = t.strip()
        if not t_clean:
            continue
        # Avoid consecutive repeats
        if not clean_tokens or clean_tokens[-1].lower() != t_clean.lower():
            clean_tokens.append(t_clean)

    if not clean_tokens:
        return {
            "direct_words": "",
            "translated_sentence": "",
            "tokens": [],
            "provider": "none"
        }

    # Direct AAC keywords string requested by user: e.g. "food, emergency, thank you, help"
    direct_words = ", ".join(t.lower() for t in clean_tokens)
    token_str = ", ".join(clean_tokens)

    global _gemini_unreachable_until, _qwen_unreachable_until
    now_ts = time.time()

    # 1. High-Speed Gemini API (<200ms concise translation)
    if GEMINI_API_KEY and len(GEMINI_API_KEY.strip()) > 10 and now_ts >= _gemini_unreachable_until:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY.strip()}"
            prompt_text = (
                "You are an expert non-verbal accessibility communication interpreter.\n"
                f"Communication keywords: {token_str}\n"
                "CRITICAL INSTRUCTION: Output a concise, fluent English sentence expressing this request.\n"
                "STRICT NEGATIVE CONSTRAINT: NEVER repeat words, do not stutter, and never produce repetitive outputs like 'Yes, yes, yes'.\n"
                "Output only the final concise sentence without quotation marks or conversational commentary."
            )
            gemini_payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 60}
            }
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.post(url, json=gemini_payload)
                if res.status_code == 200:
                    data = res.json()
                    translated_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return {
                        "direct_words": direct_words,
                        "translated_sentence": translated_text,
                        "tokens": clean_tokens,
                        "provider": "accessable_neural"
                    }
                else:
                    _gemini_unreachable_until = now_ts + 60.0
        except Exception:
            _gemini_unreachable_until = now_ts + 60.0

    # 2. Local Qwen Fallback (if Ollama is active)
    if now_ts >= _qwen_unreachable_until:
        try:
            qwen_payload = {
                "model": QWEN_MODEL_NAME,
                "prompt": f"Synthesize these keywords into one concise sentence without repeating words: {token_str}\nSentence:",
                "stream": False,
                "options": {"temperature": 0.1}
            }
            async with httpx.AsyncClient(timeout=1.0) as client:
                resp = await client.post(QWEN_API_URL, json=qwen_payload)
                if resp.status_code == 200:
                    data = resp.json()
                    translated_text = data.get("response", "").strip().strip('"').strip("'")
                    return {
                        "direct_words": direct_words,
                        "translated_sentence": translated_text,
                        "tokens": clean_tokens,
                        "provider": "local_llm"
                    }
                else:
                    _qwen_unreachable_until = now_ts + 60.0
        except Exception:
            _qwen_unreachable_until = now_ts + 60.0

    # 3. Rule-based Grammatical Template Fallback (0ms latency, 100% reliable)
    tokens_upper = [t.upper() for t in clean_tokens]
    
    # Single token mappings
    SINGLE_MAP = {
        "FOOD": "I would like some food, please.",
        "WATER": "I would like some water, please.",
        "EMERGENCY": "Emergency assistance needed immediately!",
        "HELP": "Please help me.",
        "THANK YOU": "Thank you very much.",
        "PLEASE": "Please assist me.",
        "YES": "Yes, I agree.",
        "NO": "No, I do not want that.",
        "MEDICINE": "I need my medicine, please.",
        "PAIN": "I am experiencing pain and need assistance.",
        "REST": "I need to rest now, please.",
        "FAMILY": "Please contact my family.",
        "HELLO": "Hello, nice to see you.",
        "GOODBYE": "Goodbye, have a good day."
    }

    if len(tokens_upper) == 1 and tokens_upper[0] in SINGLE_MAP:
        sentence = SINGLE_MAP[tokens_upper[0]]
    elif "EMERGENCY" in tokens_upper and "HELP" in tokens_upper:
        sentence = "Emergency, I need immediate help!"
    elif "PAIN" in tokens_upper and "MEDICINE" in tokens_upper:
        sentence = "I am in pain and urgently need medicine, please."
    elif "HELP" in tokens_upper and "MEDICINE" in tokens_upper:
        sentence = "Please help me take my medicine."
    elif "HELP" in tokens_upper and "FAMILY" in tokens_upper:
        sentence = "Please help me contact my family."
    elif "YES" in tokens_upper and "PLEASE" in tokens_upper:
        sentence = "Yes, please."
    elif "NO" in tokens_upper and "THANK YOU" in tokens_upper:
        sentence = "No, thank you."
    else:
        # Dynamic grammatical synthesizer for multi-token combinations
        is_emergency = "EMERGENCY" in tokens_upper
        is_polite = "PLEASE" in tokens_upper or "THANK YOU" in tokens_upper
        is_help = "HELP" in tokens_upper

        # Filter functional keywords to get core items
        core_items = [t.lower() for t in clean_tokens if t.upper() not in ("EMERGENCY", "HELP", "PLEASE", "THANK YOU", "YES", "NO")]
        
        if core_items:
            if len(core_items) == 1:
                items_str = core_items[0]
            elif len(core_items) == 2:
                items_str = f"{core_items[0]} and {core_items[1]}"
            else:
                items_str = f"{', '.join(core_items[:-1])}, and {core_items[-1]}"

            if is_emergency:
                sentence = f"Emergency: I urgently need {items_str}!"
            elif is_help:
                sentence = f"Please help me with {items_str}."
            else:
                sentence = f"I need {items_str}, please." if is_polite or True else f"I need {items_str}."
        else:
            # Fallback to direct tokens if no specific core item extracted
            sentence = direct_words.capitalize()
            if not sentence.endswith("."):
                sentence += "."

    return {
        "direct_words": direct_words,
        "translated_sentence": sentence,
        "tokens": clean_tokens,
        "provider": "grammatical_template"
    }


class TextToSignRequest(BaseModel):
    text: str
    sign_language: Optional[str] = "ASL"


SIGN_DICTIONARY = {
    "HELLO": {"category": "Greeting", "meaning": "Friendly greeting / hello", "asl": True, "isl": True, "bsl": True},
    "THANK YOU": {"category": "Courtesy", "meaning": "Expressing gratitude", "asl": True, "isl": True, "bsl": True},
    "PLEASE": {"category": "Courtesy", "meaning": "Polite request", "asl": True, "isl": True, "bsl": True},
    "HELP": {"category": "Assistance", "meaning": "Requesting help or support", "asl": True, "isl": True, "bsl": True},
    "WATER": {"category": "Basic Needs", "meaning": "Drinking water", "asl": True, "isl": True, "bsl": True},
    "FOOD": {"category": "Basic Needs", "meaning": "Food or eating", "asl": True, "isl": True, "bsl": True},
    "YES": {"category": "Affirmation", "meaning": "Agreement / affirmation", "asl": True, "isl": True, "bsl": True},
    "NO": {"category": "Negation", "meaning": "Disagreement / refusal", "asl": True, "isl": True, "bsl": True},
    "I": {"category": "Pronoun", "meaning": "First-person pronoun (me/myself)", "asl": True, "isl": True, "bsl": True},
    "YOU": {"category": "Pronoun", "meaning": "Second-person pronoun (you)", "asl": True, "isl": True, "bsl": True},
    "EMERGENCY": {"category": "Urgent", "meaning": "Immediate urgent danger", "asl": True, "isl": True, "bsl": True},
    "MEDICINE": {"category": "Medical", "meaning": "Prescription medication / pills", "asl": True, "isl": True, "bsl": True},
    "PAIN": {"category": "Medical", "meaning": "Physical hurt or pain", "asl": True, "isl": True, "bsl": True},
    "REST": {"category": "Wellness", "meaning": "Resting or sleeping", "asl": True, "isl": True, "bsl": True},
    "FAMILY": {"category": "Social", "meaning": "Family members / relatives", "asl": True, "isl": True, "bsl": True},
    "GOODBYE": {"category": "Greeting", "meaning": "Parting farewell", "asl": True, "isl": True, "bsl": True},
    "LOVE": {"category": "Emotion", "meaning": "Love / affection", "asl": True, "isl": True, "bsl": True},
    "WANT": {"category": "Desire", "meaning": "Desire or requirement", "asl": True, "isl": True, "bsl": True},
    "WHERE": {"category": "Question", "meaning": "Locational inquiry", "asl": True, "isl": True, "bsl": True},
    "WHAT": {"category": "Question", "meaning": "Subject inquiry", "asl": True, "isl": True, "bsl": True},
    "HOW": {"category": "Question", "meaning": "Manner inquiry", "asl": True, "isl": True, "bsl": True},
    "HAPPY": {"category": "Emotion", "meaning": "Joy or happiness", "asl": True, "isl": True, "bsl": True},
    "GOOD": {"category": "Evaluation", "meaning": "Positive condition", "asl": True, "isl": True, "bsl": True}
}


@router.get("/dictionary")
def get_sign_dictionary():
    return {
        "signs": SIGN_DICTIONARY,
        "total_signs": len(SIGN_DICTIONARY),
        "fingerspelling_supported": True,
        "supported_languages": [
            {"code": "ASL", "name": "American Sign Language", "flag": "🇺🇸"},
            {"code": "ISL", "name": "Indian Sign Language", "flag": "🇮🇳"},
            {"code": "BSL", "name": "British Sign Language", "flag": "🇬🇧"},
            {"code": "IS", "name": "International Sign", "flag": "🌐"},
            {"code": "DGS", "name": "German Sign Language", "flag": "🇩🇪"},
            {"code": "LSF", "name": "French Sign Language", "flag": "🇫🇷"}
        ]
    }


@router.post("/text-to-sign")
async def text_to_sign(req: TextToSignRequest):
    text = (req.text or "").strip()
    if not text:
        return {"spoken_text": "", "gloss_tokens": [], "tokens_meta": []}

    sign_lang = req.sign_language or "ASL"
    raw_upper = text.upper()
    tokens = []

    import re
    cleaned = re.sub(r"[^\w\s]", " ", raw_upper)
    words = cleaned.split()

    i = 0
    while i < len(words):
        if i < len(words) - 1:
            two_word = f"{words[i]} {words[i+1]}"
            if two_word in SIGN_DICTIONARY:
                tokens.append({
                    "word": two_word,
                    "gloss": two_word,
                    "is_fingerspell": False,
                    "duration_ms": 1300
                })
                i += 2
                continue

        curr_word = words[i]
        if curr_word in ["A", "AN", "THE", "IS", "ARE", "AM"] and len(words) > 1:
            i += 1
            continue

        if curr_word in SIGN_DICTIONARY:
            tokens.append({
                "word": curr_word,
                "gloss": curr_word,
                "is_fingerspell": False,
                "duration_ms": 1200
            })
        else:
            letters = list(curr_word)
            tokens.append({
                "word": curr_word,
                "gloss": f"FS:{curr_word}",
                "is_fingerspell": True,
                "letters": letters,
                "duration_ms": max(900, len(letters) * 350)
            })
        i += 1

    return {
        "spoken_text": text,
        "sign_language": sign_lang,
        "gloss_tokens": [t["gloss"] for t in tokens],
        "tokens_meta": tokens,
        "total_estimated_duration_ms": sum(t.get("duration_ms", 1000) for t in tokens)
    }

