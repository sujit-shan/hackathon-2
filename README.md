# hackathon-2

# AccessAble AI — Next-Gen Multimodal Assistive Technology & Communication Platform

AccessAble AI empowers individuals with severe speech and motor impairments (including ALS, stroke, cerebral palsy, and non-verbal paralysis) to communicate with zero latency using **pure eye gaze tracking**, **deliberate blinks**, and **sign language recognition**.

---

## 🌟 Key Capabilities

### 👁️ 1. GazeBridge AI (Eye Gaze & Blink Communicator)
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

### 🤟 2. SignBridge AI (Real-Time Sign Language Translator)
- Fast kinematic hand landmarker model recognizing gestures with sub-5ms latency.
- Intelligent multi-token sentence assembly with fallback to local rule-based synthesizers.

### 🛡️ 3. Accessibility & Civic Barrier Reporter
- Report physical and civic accessibility barriers with photo attachments and status tracking.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Lucide Icons, Modern CSS Design System
- **Backend:** FastAPI, Python 3, Uvicorn, SQLite
- **Computer Vision & AI:** Google MediaPipe (FaceLandmarker & HandLandmarker), OpenCV, NumPy, Scikit-Learn

---

## 🚀 Quickstart

### 1. Backend Setup
```bash
cd AccessAbleAI/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
cd AccessAbleAI/frontend
npm install
npm run dev
```

### 3. Standalone Python Eye Communicator
```bash
python eyegaze_communicator.py
```
