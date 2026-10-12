"""
Eye Gaze & Blink Communication Router
Uses Google MediaPipe Face Landmarker with 478 Landmarks & Blendshapes:
- Direct Iris / Pupil Tracking (pure eyeball movement, independent of head posture)
- Sub-pixel horizontal & vertical eye ratios
- Dual Blink Detection (Blendshapes + Eye Aspect Ratio)
- Sub-5ms latency
"""

import io
import os
import base64
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from PIL import Image
import numpy as np

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

router = APIRouter(prefix="/eyegaze", tags=["Eye Gaze & Blink Communicator"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")
FACE_TASK_PATH = os.path.join(MODELS_DIR, "face_landmarker.task")

_face_landmarker = None

def get_face_landmarker():
    global _face_landmarker
    if _face_landmarker is None and os.path.exists(FACE_TASK_PATH):
        try:
            base_options = mp_python.BaseOptions(model_asset_path=FACE_TASK_PATH)
            options = mp_vision.FaceLandmarkerOptions(
                base_options=base_options,
                output_face_blendshapes=True,
                num_faces=1
            )
            _face_landmarker = mp_vision.FaceLandmarker.create_from_options(options)
            print("[Init] FaceLandmarker initialized with 52 blendshapes & 478 iris landmarks.")
        except Exception as e:
            print(f"[Init] FaceLandmarker load error: {e}")
    return _face_landmarker

class PredictEyeRequest(BaseModel):
    image: str

@router.get("/status")
def eyegaze_status():
    landmarker = get_face_landmarker()
    return {
        "online": landmarker is not None,
        "engine": "MediaPipe FaceLandmarker with Iris Pupil Tracking",
        "latency_target": "<5ms",
        "capabilities": ["iris_gaze_direction", "pupil_screen_coords", "dual_blink_detection", "aac_typing"]
    }

@router.post("/predict")
async def eyegaze_predict(payload: PredictEyeRequest):
    t0 = time.perf_counter()
    landmarker = get_face_landmarker()
    if landmarker is None:
        raise HTTPException(status_code=503, detail="Face landmarker engine unavailable")

    try:
        data_str = payload.image
        if "," in data_str:
            data_str = data_str.split(",")[1]

        image_bytes = base64.b64decode(data_str)
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        np_img = np.array(pil_img, dtype=np.uint8)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np_img)

        res = landmarker.detect(mp_image)
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        has_landmarks = res.face_landmarks and len(res.face_landmarks) > 0 and len(res.face_landmarks[0]) >= 478
        has_blendshapes = res.face_blendshapes and len(res.face_blendshapes) > 0

        if not has_landmarks and not has_blendshapes:
            return {
                "face_detected": False,
                "is_blink": False,
                "blink_score": 0.0,
                "gaze_direction": "CENTER",
                "gaze_x": 0.5,
                "gaze_y": 0.5,
                "latency_ms": latency_ms,
                "message": "Center face in webcam view"
            }

        scores: Dict[str, float] = {}
        if has_blendshapes:
            scores = {b.category_name: float(b.score) for b in res.face_blendshapes[0]}

        blink_left_bs = scores.get("eyeBlinkLeft", 0.0)
        blink_right_bs = scores.get("eyeBlinkRight", 0.0)
        blink_score_bs = max(blink_left_bs, blink_right_bs)

        # Default values
        h_ratio = 0.50
        v_ratio = 0.50
        ear = 0.28
        is_blink = False

        if has_landmarks:
            lms = res.face_landmarks[0]

            # Right eye landmarks (user's anatomical right, on image left):
            # Iris center: 468
            # Outer corner (temporal, left edge of image): 33
            # Inner corner (nasal, towards nose): 133
            # Top eyelid: 159
            # Bottom eyelid: 145
            r_iris = lms[468]
            r_outer = lms[33]
            r_inner = lms[133]
            r_top = lms[159]
            r_bottom = lms[145]

            # Left eye landmarks (user's anatomical left, on image right):
            # Iris center: 473
            # Inner corner (nasal, towards nose): 362
            # Outer corner (temporal, right edge of image): 263
            # Top eyelid: 386
            # Bottom eyelid: 374
            l_iris = lms[473]
            l_inner = lms[362]
            l_outer = lms[263]
            l_top = lms[386]
            l_bottom = lms[374]

            # 1. Pupil Horizontal Ratio (pure eyeball rotation)
            r_w = abs(r_inner.x - r_outer.x)
            l_w = abs(l_outer.x - l_inner.x)

            if r_w > 1e-4 and l_w > 1e-4:
                r_ratio_x = (r_iris.x - r_outer.x) / r_w
                l_ratio_x = (l_iris.x - l_inner.x) / l_w
                h_ratio = float((r_ratio_x + l_ratio_x) / 2.0)

            # 2. Pupil Vertical Ratio (eyeball up/down within eye socket)
            r_h = abs(r_bottom.y - r_top.y)
            l_h = abs(l_bottom.y - l_top.y)

            if r_h > 1e-4 and l_h > 1e-4:
                r_ratio_y = (r_iris.y - r_top.y) / r_h
                l_ratio_y = (l_iris.y - l_top.y) / l_h
                v_ratio = float((r_ratio_y + l_ratio_y) / 2.0)

            # 3. Eye Aspect Ratio (EAR) for ultra-accurate blink detection
            ear_r = r_h / (r_w + 1e-6)
            ear_l = l_h / (l_w + 1e-6)
            ear = (ear_r + ear_l) / 2.0

        # Combine Blendshapes & Geometric EAR for rock-solid blink detection
        blink_score = max(blink_score_bs, float(np.clip((0.22 - ear) / 0.15, 0.0, 1.0)) if ear < 0.22 else 0.0)
        is_blink = bool(blink_score >= 0.42 or ear < 0.16)

        # 4. Gaze Direction & Screen Coordinates from Pupil Position:
        # dev_x: Positive when looking RIGHT on screen (h_ratio < 0.50), Negative when looking LEFT (h_ratio > 0.50)
        dev_x = 0.50 - h_ratio

        # dev_y: Positive when looking DOWN on screen (v_ratio > 0.50), Negative when looking UP (v_ratio < 0.50)
        dev_y = v_ratio - 0.50

        # If iris landmarks were not detected, fallback smoothly to blendshapes
        if not has_landmarks and has_blendshapes:
            look_in_left = scores.get("eyeLookInLeft", 0.0)
            look_out_left = scores.get("eyeLookOutLeft", 0.0)
            look_in_right = scores.get("eyeLookInRight", 0.0)
            look_out_right = scores.get("eyeLookOutRight", 0.0)
            look_up = (scores.get("eyeLookUpLeft", 0.0) + scores.get("eyeLookUpRight", 0.0)) / 2.0
            look_down = (scores.get("eyeLookDownLeft", 0.0) + scores.get("eyeLookDownRight", 0.0)) / 2.0

            bs_left = (look_out_left + look_in_right) / 2.0
            bs_right = (look_in_left + look_out_right) / 2.0
            dev_x = bs_right - bs_left
            dev_y = look_down - look_up

        # Determine Direction with responsive 0.038 threshold (natural eye movement)
        direction = "CENTER"
        threshold = 0.038

        if not is_blink:
            abs_x = abs(dev_x)
            abs_y = abs(dev_y)
            if max(abs_x, abs_y) >= threshold:
                if abs_x >= abs_y:
                    direction = "RIGHT" if dev_x > 0 else "LEFT"
                else:
                    direction = "DOWN" if dev_y > 0 else "UP"

        # Normalized screen coordinates: 0.0 (left/top) to 1.0 (right/bottom), center = 0.5
        gaze_x = float(np.clip(0.5 + dev_x * 3.6, 0.0, 1.0))
        gaze_y = float(np.clip(0.5 + dev_y * 3.6, 0.0, 1.0))

        return {
            "face_detected": True,
            "is_blink": is_blink,
            "blink_score": round(blink_score, 3),
            "gaze_direction": direction,
            "gaze_x": round(gaze_x, 3),
            "gaze_y": round(gaze_y, 3),
            "metrics": {
                "h_ratio": round(h_ratio, 3),
                "v_ratio": round(v_ratio, 3),
                "ear": round(ear, 3),
                "dev_x": round(dev_x, 3),
                "dev_y": round(dev_y, 3),
                "blink_score": round(blink_score, 3)
            },
            "latency_ms": latency_ms
        }

    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Eye tracking error: {str(err)}")
