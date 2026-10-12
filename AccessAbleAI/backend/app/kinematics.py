import math
from typing import Dict, Any, Optional, Tuple
import numpy as np

def calculate_angle_3d(a: Tuple[float, float, float], b: Tuple[float, float, float], c: Tuple[float, float, float]) -> float:
    """Calculates interior 3D angle ABC in degrees at vertex B."""
    v1 = np.array([a[0] - b[0], a[1] - b[1], a[2] - b[2]], dtype=np.float32)
    v2 = np.array([c[0] - b[0], c[1] - b[1], c[2] - b[2]], dtype=np.float32)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 < 1e-6 or norm2 < 1e-6:
        return 180.0
    cosine = np.dot(v1, v2) / (norm1 * norm2)
    cosine = np.clip(cosine, -1.0, 1.0)
    return float(math.degrees(math.acos(cosine)))

def is_finger_extended(wrist, mcp, pip, tip, y_tolerance: float = 0.03) -> bool:
    """
    Determines if a finger is extended using both 3D wrist-relative ratio and vertical elevation.
    Solves anatomical tendon constraints where human ring fingers bend when pinky is curled.
    """
    d_tip = math.dist(wrist, tip)
    d_pip = math.dist(wrist, pip)
    d_mcp = math.dist(wrist, mcp)
    
    # 1. 3D distance ratio (scale and rotation invariant)
    ratio_ext = (d_tip > d_pip * 1.08) or (d_tip > d_mcp * 1.35)
    
    # 2. Vertical elevation (in camera coordinates, smaller y is higher up)
    elev_ext = (tip[1] < pip[1] - y_tolerance) or (tip[1] < mcp[1] - y_tolerance)
    
    return bool(ratio_ext or elev_ext)

def classify_kinematics(landmarks) -> Tuple[Optional[str], float]:
    """
    Classifies hand signs using invariant 3D joint bending angles and anatomical finger ratios.
    Handles: WATER, I, YES, NO, HELLO, GOODBYE, THANK YOU, WANT, PLEASE, HELP.
    Returns (predicted_sign, confidence).
    """
    if landmarks is None or len(landmarks) < 21:
        return None, 0.0

    pts = [(lm.x, lm.y, getattr(lm, 'z', 0.0)) for lm in landmarks]
    wrist = pts[0]
    
    # Palm scale reference (distance from wrist 0 to middle MCP 9)
    palm_size = math.dist(pts[0], pts[9])
    if palm_size < 1e-4:
        palm_size = 1.0

    # 3D Joint Angles (MCP -> PIP -> TIP)
    angle_thumb = calculate_angle_3d(pts[1], pts[2], pts[4])
    angle_index = calculate_angle_3d(pts[5], pts[6], pts[8])
    angle_middle = calculate_angle_3d(pts[9], pts[10], pts[12])
    angle_ring = calculate_angle_3d(pts[13], pts[14], pts[16])
    angle_pinky = calculate_angle_3d(pts[17], pts[18], pts[20])

    # Robust finger extension flags using anatomical ratios
    is_index_ext = is_finger_extended(wrist, pts[5], pts[6], pts[8])
    is_middle_ext = is_finger_extended(wrist, pts[9], pts[10], pts[12])
    # Ring finger has relaxed threshold because tendon is naturally restricted when pinky is down
    is_ring_ext = is_finger_extended(wrist, pts[13], pts[14], pts[16], y_tolerance=0.015)
    is_pinky_ext = is_finger_extended(wrist, pts[17], pts[18], pts[20])
    
    # Thumb extension: tip distance to index MCP vs thumb base
    dist_thumb_tip_wrist = math.dist(pts[0], pts[4])
    dist_thumb_mcp_wrist = math.dist(pts[0], pts[2])
    is_thumb_ext = (dist_thumb_tip_wrist > dist_thumb_mcp_wrist * 1.15) or (angle_thumb > 135)

    # Key inter-finger pinches normalized by palm size
    pinch_thumb_index = math.dist(pts[4], pts[8]) / palm_size
    pinch_thumb_middle = math.dist(pts[4], pts[12]) / palm_size
    pinch_thumb_ring = math.dist(pts[4], pts[16]) / palm_size
    pinch_thumb_pinky = math.dist(pts[4], pts[20]) / palm_size

    # Thumb vertical direction (relative to wrist)
    is_thumb_pointing_up = (pts[4][1] < pts[2][1]) and (pts[4][1] < pts[0][1] - 0.05)
    is_thumb_pointing_down = (pts[4][1] > pts[2][1]) and (pts[4][1] > pts[0][1] + 0.05)

    # Relative spread between index and pinky (to distinguish open waving from flat hands)
    finger_spread = math.dist(pts[8], pts[20]) / palm_size

    # -------------------------------------------------------------
    # 0. FOOD (ASL EAT/FOOD: All fingertips gathered together touching thumb tip)
    # -------------------------------------------------------------
    if pinch_thumb_index < 0.28 and pinch_thumb_middle < 0.30 and pinch_thumb_ring < 0.35 and pinch_thumb_pinky < 0.38:
        return "FOOD", 0.94

    # -------------------------------------------------------------
    # 0b. EMERGENCY (Thumb & Pinky extended, middle 3 curled - 'Y' / Call for Help sign)
    # -------------------------------------------------------------
    if is_thumb_ext and is_pinky_ext and not is_index_ext and not is_middle_ext and not is_ring_ext:
        return "EMERGENCY", 0.95

    # -------------------------------------------------------------
    # 1. WATER (ASL 'W' sign: Index, Middle, Ring EXTENDED; Pinky CURLED)
    # -------------------------------------------------------------
    # In real hands, Ring tip is higher/further than folded Pinky
    ring_higher_than_pinky = pts[16][1] < (pts[20][1] - 0.04) or (math.dist(wrist, pts[16]) > math.dist(wrist, pts[20]) * 1.15)
    if is_index_ext and is_middle_ext and ring_higher_than_pinky and not is_pinky_ext:
        return "WATER", 0.95

    # -------------------------------------------------------------
    # 2. I / ME
    # A) Pointing up (Index only extended, middle/ring/pinky curled)
    # B) ASL 'I' (Pinky only extended, index/middle/ring curled)
    # C) ASL 'I Love You' (Thumb, Index, Pinky extended; Middle & Ring curled)
    # -------------------------------------------------------------
    if is_index_ext and not is_middle_ext and not is_ring_ext and not is_pinky_ext:
        return "I", 0.96
    if is_pinky_ext and not is_index_ext and not is_middle_ext and not is_ring_ext:
        return "I", 0.95
    if is_thumb_ext and is_index_ext and is_pinky_ext and not is_middle_ext and not is_ring_ext:
        return "I", 0.96

    # -------------------------------------------------------------
    # 3. NO
    # A) ASL NO: Thumb, Index, and Middle tips snapping together (pinched) with Ring/Pinky curled
    # B) Thumb pointing down (Thumbs down)
    # -------------------------------------------------------------
    if is_thumb_pointing_down and not is_index_ext and not is_middle_ext and not is_ring_ext and not is_pinky_ext:
        return "NO", 0.94
    if pinch_thumb_index < 0.25 and pinch_thumb_middle < 0.32 and not is_ring_ext and not is_pinky_ext:
        return "NO", 0.93

    # -------------------------------------------------------------
    # 4. YES
    # A) Thumbs Up (Thumb extended pointing up, 4 fingers curled)
    # B) Closed Fist (All 5 fingers curled)
    # C) Victory / 'V' sign (Index & Middle extended, Ring & Pinky curled)
    # -------------------------------------------------------------
    if not is_index_ext and not is_middle_ext and not is_ring_ext and not is_pinky_ext:
        if is_thumb_ext and is_thumb_pointing_up:
            return "YES", 0.96
        else:
            return "YES", 0.92
    if is_index_ext and is_middle_ext and not is_ring_ext and not is_pinky_ext:
        return "YES", 0.93

    # -------------------------------------------------------------
    # 5. WANT (Claw posture: fingers bent forward like grasping)
    # -------------------------------------------------------------
    claw_angles = [angle_index, angle_middle, angle_ring, angle_pinky]
    if all(95 <= a <= 150 for a in claw_angles) and all(0.85 <= math.dist(wrist, pts[tip]) / palm_size <= 1.45 for tip in [8, 12, 16, 20]):
        # Neither fully flat open nor tight fist
        if not (is_index_ext and is_middle_ext and is_ring_ext and is_pinky_ext and finger_spread > 1.2):
            return "WANT", 0.91

    # -------------------------------------------------------------
    # 6. THANK YOU / PLEASE / HELLO / GOODBYE (All 4 main fingers extended)
    # -------------------------------------------------------------
    if is_index_ext and is_middle_ext and is_ring_ext and is_pinky_ext:
        # Fingers held close together (flat hand) -> THANK YOU or PLEASE
        inter_finger_distance = (math.dist(pts[8], pts[12]) + math.dist(pts[12], pts[16]) + math.dist(pts[16], pts[20])) / palm_size
        
        if inter_finger_distance < 0.55:
            # Flat hand with fingers together
            if not is_thumb_ext or pinch_thumb_index < 0.35:
                return "PLEASE", 0.90
            else:
                return "THANK YOU", 0.92
        else:
            # Fingers spread wide -> HELLO / GOODBYE
            return "HELLO", 0.95

    # -------------------------------------------------------------
    # 7. HELP (Thumb up resting near palm or fist)
    # -------------------------------------------------------------
    if is_thumb_ext and is_thumb_pointing_up and not is_middle_ext and not is_ring_ext:
        return "HELP", 0.89

    return None, 0.0
