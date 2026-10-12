# BREAKING BARIERS — Next-Gen Multimodal Assistive Technology & Communication Platform

BREAKING BARIERS empowers individuals with severe speech and motor impairments (including ALS, stroke, cerebral palsy, and non-verbal paralysis) to communicate with zero latency using **pure eye gaze tracking**, **deliberate blinks**, and **sign language recognition**.

---

## 🌟 Key Capabilities

### 👁️ 1. GazeBridge (Eye Gaze & Blink Communicator)
- **Pure Eyeball Pupil / Iris Tracking:** Uses Google MediaPipe's 478 face mesh landmarks with sub-pixel iris geometry (`landmarks 468 & 473`), making gaze navigation 100% independent of head movement.
- **Natural Directional Navigation:** 
  - Look **Right** ➡️ moves cursor Right
  - Look **Left** ⬅️ moves cursor Left
  - Look **Down** ⬇️ moves cursor Down
  - Look **Up** ⬆️ moves cursor Up
- **Dual Selection Triggers:**
  - **Deliberate Blink:** Geometric Eye Aspect Ratio (EAR) + Blendshape detection filters out involuntary micro-blinks and triggers instant item selection.
  - **Dwell to Select:** Fixate your gaze on any card for 1.4 seconds to auto-select without blinking.
- **Text-to-Speech & Auto-Translate:** Staged keyword selection with real-time text-to-speech voice output and fluent sentence synthesis.

### 🤟 2. Hand Sign Detection & Translation System (SignBridge)
- **FR-01 & FR-02:** Real-time webcam video pipeline (>=30 FPS) with Google MediaPipe 21-point 3D spatial hand landmark joint extraction.
- **FR-03:** Wrist-relative positional normalization and scale vector invariance (60-element 1D feature vector).
- **FR-04:** Low-latency ML Classifier (Random Forest + 3D Kinematics + Google Gesture Recognizer) achieving <5.0ms inference latency across 10+ core signs (`HELLO`, `THANK YOU`, `YES`, `NO`, `I`, `WANT`, `WATER`, `GOODBYE`, `PLEASE`, `HELP`).
- **FR-05:** Signal Jitter Hysteresis Rolling Buffer (N=10 window, >=70% consensus threshold, cooldown de-duplication) preventing jitter and accidental word repeats.
- **FR-06:** Silence Trigger Linguistic Engine: automatically triggers full sentence translation when no hand is detected for ~2.4s (lowering hand), synthesizing fluent spoken English (`"I would like some water, please."`) with voice read-out via Web Speech API.
- **Dual Execution Modes:** Fully embedded in the web platform with neon skeleton HUD overlay, PLUS a 1-click launcher for the native standalone OpenCV application (`realtime_sign_translator.py`).

### 🛡️ 3. Accessibility & Civic Barrier Reporter
- Report physical and civic accessibility barriers with photo attachments and status tracking.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Lucide Icons, Modern CSS Design System
- **Backend:** FastAPI, Python 3, Uvicorn, SQLite
- **Computer Vision & Machine Learning:** Google MediaPipe (FaceLandmarker & HandLandmarker), OpenCV, NumPy, Scikit-Learn (Random Forest)

---

## 🚀 Quickstart

### 1. Unified Master Launcher (Recommended)
```bash
python AccessAbleAI/AccessAbleAI.py
```

### 2. Standalone Real-Time Hand Sign Translator (Native OpenCV 30+ FPS)
```bash
python realtime_sign_translator.py
```

### 3. Standalone Python Eye Gaze Communicator
```bash
python eyegaze_communicator.py
```

### 4. Manual Web App & Backend Launch
```bash
# Terminal 1: Backend
cd AccessAbleAI/backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2: Frontend
cd AccessAbleAI/frontend
npm run dev
```
