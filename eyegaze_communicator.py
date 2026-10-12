"""
GazeBridge AI - Standalone Real-Time Eye Gaze & Blink Communication App
Tracks true eye gaze direction (iris/pupil) and deliberate blinks to navigate and type on an
accessible on-screen communication grid with Text-to-Speech speech synthesis.

Run:
  python eyegaze_communicator.py
"""

import cv2
import time
import math
import pyttsx3
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL_PATH = "models/face_landmarker.task"

# Communication Cards Grid
GRID_ITEMS = [
    ["FOOD", "EMERGENCY", "THANK YOU", "HELP"],
    ["WATER", "YES", "NO", "PLEASE"],
    ["PAIN", "MEDICINE", "REST", "FAMILY"]
]

def init_landmarker():
    base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
    options = mp_vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=True,
        num_faces=1
    )
    return mp_vision.FaceLandmarker.create_from_options(options)

def main():
    print("=" * 60)
    print(" 👁️ GazeBridge AI: Pure Eye Gaze & Blink Communicator")
    print("=" * 60)
    print("Controls (Pure Eyeball Movement):")
    print(" - Look with eyes LEFT / RIGHT / UP / DOWN to move the focus cursor")
    print(" - BLINK deliberately (both eyes) to select and type the focused card")
    print(" - Press 'S' on keyboard to Speak sentence aloud")
    print(" - Press 'C' to Clear message")
    print(" - Press 'Q' or ESC to Quit\n")

    # Speech engine
    try:
        engine = pyttsx3.init()
        engine.setProperty("rate", 160)
    except Exception:
        engine = None

    landmarker = init_landmarker()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Could not open webcam. Make sure your browser camera is stopped!")
        return

    selected_row = 0
    selected_col = 0
    last_nav_time = 0.0
    last_blink_time = 0.0
    last_selected_item = None
    prev_gaze_dir = "CENTER"
    composed_sentence = []
    blink_frames = 0

    fps = 0.0
    prev_time = time.time()

    # Dwell timer
    dwell_start = 0.0
    last_focus = (0, 0)

    while True:
        ret, frame = cap.read()
        if not ret: break
        # Do NOT flip before inference so anatomical landmarks stay canonical, or flip and handle correctly
        # Flipped mirror view for user display:
        display_frame = cv2.flip(frame, 1)
        h, w, _ = display_frame.shape

        now = time.time()
        fps = 0.9 * fps + 0.1 * (1.0 / (now - prev_time + 1e-6))
        prev_time = now

        # Run inference on natural frame
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        t_infer = time.perf_counter()
        res = landmarker.detect(mp_img)
        lat_ms = (time.perf_counter() - t_infer) * 1000

        gaze_dir = "CENTER"
        is_blink = False
        blink_score = 0.0

        has_landmarks = res.face_landmarks and len(res.face_landmarks) > 0 and len(res.face_landmarks[0]) >= 478
        has_blendshapes = res.face_blendshapes and len(res.face_blendshapes) > 0

        if has_landmarks:
            lms = res.face_landmarks[0]

            # Right eye: Iris=468, Inner=133, Outer=33, Top=159, Bottom=145
            r_iris = lms[468]
            r_outer = lms[33]
            r_inner = lms[133]
            r_top = lms[159]
            r_bottom = lms[145]

            # Left eye: Iris=473, Inner=362, Outer=263, Top=386, Bottom=374
            l_iris = lms[473]
            l_inner = lms[362]
            l_outer = lms[263]
            l_top = lms[386]
            l_bottom = lms[374]

            # Pupil horizontal ratio (relative to eye corners)
            r_w = abs(r_inner.x - r_outer.x)
            l_w = abs(l_outer.x - l_inner.x)

            h_ratio = 0.50
            if r_w > 1e-4 and l_w > 1e-4:
                r_ratio_x = (r_iris.x - r_outer.x) / r_w
                l_ratio_x = (l_iris.x - l_inner.x) / l_w
                h_ratio = (r_ratio_x + l_ratio_x) / 2.0

            # Pupil vertical ratio (relative to eyelids)
            r_h = abs(r_bottom.y - r_top.y)
            l_h = abs(l_bottom.y - l_top.y)

            v_ratio = 0.50
            if r_h > 1e-4 and l_h > 1e-4:
                r_ratio_y = (r_iris.y - r_top.y) / r_h
                l_ratio_y = (l_iris.y - l_top.y) / l_h
                v_ratio = (r_ratio_y + l_ratio_y) / 2.0

            # Eye aspect ratio (EAR)
            ear_r = r_h / (r_w + 1e-6)
            ear_l = l_h / (l_w + 1e-6)
            ear = (ear_r + ear_l) / 2.0

            # Blendshape blink check
            blink_bs = 0.0
            if has_blendshapes:
                scores = {b.category_name: float(b.score) for b in res.face_blendshapes[0]}
                blink_bs = max(scores.get("eyeBlinkLeft", 0.0), scores.get("eyeBlinkRight", 0.0))

            blink_score = max(blink_bs, float(np.clip((0.22 - ear) / 0.15, 0.0, 1.0)) if ear < 0.22 else 0.0)
            is_blink = bool(blink_score >= 0.42 or ear < 0.16)

            # Draw iris tracking points on mirrored preview
            # Note: in display_frame, x is mirrored (w - 1 - int(x * w))
            rx_d = int((1.0 - r_iris.x) * w)
            ry_d = int(r_iris.y * h)
            lx_d = int((1.0 - l_iris.x) * w)
            ly_d = int(l_iris.y * h)
            cv2.circle(display_frame, (rx_d, ry_d), 5, (0, 255, 0) if not is_blink else (0, 0, 255), -1)
            cv2.circle(display_frame, (lx_d, ly_d), 5, (0, 255, 0) if not is_blink else (0, 0, 255), -1)

            # Deviations:
            # dev_x: Positive when looking RIGHT on screen, Negative when looking LEFT
            dev_x = 0.50 - h_ratio
            # dev_y: Positive when looking DOWN on screen, Negative when looking UP
            dev_y = v_ratio - 0.50

            threshold = 0.038
            if not is_blink:
                abs_x = abs(dev_x)
                abs_y = abs(dev_y)
                if max(abs_x, abs_y) >= threshold:
                    if abs_x >= abs_y:
                        gaze_dir = "RIGHT" if dev_x > 0 else "LEFT"
                    else:
                        gaze_dir = "DOWN" if dev_y > 0 else "UP"
                else:
                    gaze_dir = "CENTER"

            # 1. Directional Navigation with step-lock and hold-step
            if gaze_dir != "CENTER":
                is_new_dir = gaze_dir != prev_gaze_dir
                if (is_new_dir and (now - last_nav_time > 0.35)) or (now - last_nav_time > 0.85):
                    last_nav_time = now
                    prev_gaze_dir = gaze_dir
                    last_selected_item = None # Moving focus unlocks selecting new card

                    if gaze_dir == "RIGHT":
                        selected_col = (selected_col + 1) % 4
                    elif gaze_dir == "LEFT":
                        selected_col = (selected_col - 1 + 4) % 4
                    elif gaze_dir == "DOWN":
                        selected_row = (selected_row + 1) % 3
                    elif gaze_dir == "UP":
                        selected_row = (selected_row - 1 + 3) % 3
            else:
                prev_gaze_dir = "CENTER"

            # 2. Deliberate Blink to select (prevents repeating same word)
            if is_blink:
                blink_frames += 1
                if blink_frames == 20: # ~0.9-1.2s deliberate hold for EMERGENCY
                    item = "EMERGENCY"
                    if last_selected_item != item and (not composed_sentence or composed_sentence[-1] != item):
                        last_selected_item = item
                        composed_sentence.append(item)
                        print(f"👉 [Hold Blink 1s] Selected: EMERGENCY")
                        if engine:
                            try:
                                engine.say("Emergency assistance needed")
                                engine.runAndWait()
                            except Exception: pass
                elif blink_frames == 3 and (now - last_blink_time > 1.2):
                    last_blink_time = now
                    item = GRID_ITEMS[selected_row][selected_col]

                    # Strict check: Never repeat the same word consecutively
                    if last_selected_item != item and (not composed_sentence or composed_sentence[-1] != item):
                        last_selected_item = item
                        composed_sentence.append(item)
                        print(f"👉 [Blink OK] Selected: {item}")
                        if engine:
                            try:
                                engine.say(item.lower())
                                engine.runAndWait()
                            except Exception: pass
            else:
                blink_frames = 0

        # Create Interface Overlay
        ui = np.zeros((700, 960, 3), dtype=np.uint8)
        ui[:] = (20, 24, 33) # Dark modern theme

        # Embed camera preview in top-right
        cam_small = cv2.resize(display_frame, (280, 210))
        ui[20:230, 660:940] = cam_small
        cv2.rectangle(ui, (660, 20), (940, 230), (79, 70, 229), 2)

        # Draw Diagnostics Header
        cv2.putText(ui, "GazeBridge AI - Pure Eye Gaze & Blink Board", (30, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
        cv2.putText(ui, f"Eye Gaze: {gaze_dir}", (30, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 128) if gaze_dir != "CENTER" else (200, 200, 200), 2)
        
        blink_color = (0, 255, 0) if is_blink else (120, 120, 120)
        cv2.putText(ui, f"Blink (OK): {'TRIGGERED!' if is_blink else f'{int(blink_score*100)}%'}", (30, 125), cv2.FONT_HERSHEY_SIMPLEX, 0.75, blink_color, 2)
        cv2.putText(ui, f"Latency: {lat_ms:.1f} ms  |  FPS: {fps:.0f}", (30, 165), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (160, 160, 160), 1)

        # Draw Communication Grid
        grid_start_y = 260
        card_w = 215
        card_h = 105
        spacing = 15

        for r in range(3):
            for c in range(4):
                item = GRID_ITEMS[r][c]
                x1 = 30 + c * (card_w + spacing)
                y1 = grid_start_y + r * (card_h + spacing)
                x2 = x1 + card_w
                y2 = y1 + card_h

                is_sel = (r == selected_row and c == selected_col)

                if is_sel:
                    # Glowing border for selected card
                    cv2.rectangle(ui, (x1-3, y1-3), (x2+3, y2+3), (79, 229, 70), -1 if is_blink else 3)
                    card_bg = (45, 55, 72)
                else:
                    card_bg = (30, 36, 49)

                cv2.rectangle(ui, (x1, y1), (x2, y2), card_bg, -1)
                cv2.rectangle(ui, (x1, y1), (x2, y2), (60, 68, 85), 1)

                # Card Text
                text_size = cv2.getTextSize(item, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
                tx = x1 + (card_w - text_size[0]) // 2
                ty = y1 + (card_h + text_size[1]) // 2
                text_col = (79, 229, 70) if is_sel else (255, 255, 255)
                cv2.putText(ui, item, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.7, text_col, 2)

                if is_sel:
                    cv2.putText(ui, "[BLINK = SELECT]", (x1 + 35, y2 - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 0), 1)

        # Draw Composed Message Box at bottom
        sentence_str = ", ".join(w.lower() for w in composed_sentence) if composed_sentence else "[Look to navigate, Blink to select words]"
        cv2.rectangle(ui, (30, 625), (930, 680), (35, 42, 58), -1)
        cv2.rectangle(ui, (30, 625), (930, 680), (79, 70, 229), 2)
        cv2.putText(ui, f"Message: {sentence_str}", (45, 660), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        cv2.imshow("GazeBridge AI Communicator", ui)

        key = cv2.waitKey(1) & 0xFF
        if key == 27 or key == ord('q'):
            break
        elif key == ord('s'):
            # Speak aloud
            if composed_sentence and engine:
                engine.say(" ".join(composed_sentence))
                engine.runAndWait()
        elif key == ord('c'):
            composed_sentence.clear()

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
