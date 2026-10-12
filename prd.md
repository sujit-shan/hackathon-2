# PRODUCT REQUIREMENT DOCUMENT (PRD)

## PROJECT IDENTIFICATION
* **Project Name:** Real-Time Hand Sign Detection and Translation System
* **Runtime Environment:** Python 3.10+
* **Primary Libraries:** OpenCV, MediaPipe (Hands), Scikit-Learn (Random Forest), Requests
* **External APIs:** Qwen LLM API (Inference Endpoint)

---

## 1. SYSTEM OVERVIEW & ARCHITECTURE
The system is a real-time, low-latency video pipeline that captures human hand gestures via webcam, extracts spatial structural keypoints, classifies the gestures locally using machine learning, and feeds the resulting token sequences into a Qwen language model to generate fluent textual translations.

### 1.1 Dataflow Pipeline
[Webcam Stream Video Capture (cv2)]
         │
         ▼ (Raw BGR Frame)
[MediaPipe Hands Engine]
         │
         ▼ (21 x Multi-Dimensional Landmarks)
[Coordinate Normalization Vector Subtraction]
         │
         ▼ (1D Flattened Feature Vector, Length 60)
[Local ML Classifier (Random Forest Inference)]
         │
         ▼ (Class Label ID & Probability String)
[Hysteresis Frame Buffer & Debouncer]
         │
         ▼ (Validated Word Tokens List)
[Qwen API Linguistic Translation Module]
         │
         ▼ (Completed Corrective Sentence String)
[Terminal Console UI Output]

---

## 2. FUNCTIONAL REQUIREMENTS

### FR-01: Real-Time Frame Capture and Context Initialization
* **Description:** The system must initialize and continuously capture frames from the primary hardware camera index.
* **Specifications:**
  * Use `cv2.VideoCapture(0)` to instantiate the video stream.
  * Target processing frame rate is >= 30 Frames Per Second (FPS).
  * Convert every incoming raw frame from BGR color space to RGB before passing it to the computer vision engine.

### FR-02: Spatial Hand Landmark Extraction
* **Description:** Isolate hand geometry from visual frames and map core structural joints.
* **Specifications:**
  * Use Google MediaPipe Hands API with `static_image_mode=False` and `max_num_hands=1`.
  * Extract 21 distinct standard 3D landmark points (X, Y, Z coordinates normalized between 0.0 and 1.0 based on image dimensions).
  * If `results.multi_hand_landmarks` is empty, skip classification operations for the frame to protect process efficiency.

### FR-03: Positional and Scale Translation Normalization
* **Description:** Translate spatial coordinates into a robust feature vector invariant to user proximity or screen framing position.
* **Mathematical Operations:**
  * Let the Wrist landmark (Landmark index `0`) act as the absolute local origin `(X0, Y0, Z0)`.
  * For each of the remaining 20 landmarks `i` (indices 1 to 20), calculate the relative vector coordinates: 
    \(X\_rel_i = X_i - X_0\)
    \(Y\_rel_i = Y_i - Y_0\)
    \(Z\_rel_i = Z_i - Z_0\)
  * Flatten these values sequentially into a 1D Python list containing exactly 60 elements (`[X_rel_1, Y_rel_1, Z_rel_1, ... X_rel_20, Y_rel_20, Z_rel_20]`).
  * Normalize the entire array vector by dividing each element by the calculated maximum geometric distance magnitude of the dataset to achieve scale invariance.

### FR-04: Low-Latency Classification Inference
* **Description:** Evaluate the 60-element array instantaneously to determine the active hand gesture symbol.
* **Specifications:**
  * Load a pre-trained `scikit-learn` Random Forest Classifier (`.joblib` or `.pkl`).
  * Target classification lookup dictionary mappings include specific word labels (e.g., `["HELLO", "THANK YOU", "YES", "NO", "I", "WANT", "WATER", "GOODBYE"]`).
  * Maximum allowed local inference latency duration is 5.0 milliseconds.

### FR-05: Signal Jitter Hysteresis and Debouncer Filter
* **Description:** Prevent predictive switching oscillations caused by noisy frames or transitioning hands.
* **Specifications:**
  * Implement an active rolling history frame buffer array of size `N=10`.
  * A gesture label is only committed to the global structural word token list if it represents the absolute majority (`>= 80%`) of the items inside the 10-frame window.
  * Enforce an index cooldown threshold of 30 frames before allowing the same sequential gesture token to append back-to-back to prevent unintended text multiplication.

### FR-06: Qwen LLM Text Correction Engine Integration
* **Description:** Send raw, fragmented keyword strings over an HTTP endpoint to Qwen to convert the isolated words into structured sentences.
* **Trigger Event:** 
  * A sequence is processed when a specialized "End-of-Sentence" gesture gesture token is detected, OR
  * The system registers an active state of 90 frames (approx. 3 seconds) where no hand landmarks are detected, signaling completion of the phrase.
* **API Payload Architecture:**
  * Construct a strict system text prompt directive:
    ```text
    SYSTEM: You are a high-fidelity sign language translation system. Convert the incoming sequential stream of disjointed raw sign tokens into a single, grammatically correct, coherent English sentence. Maintain semantics and emotional intent. Output only the final resolved string. Do not include introductory notes, markdown chatter, or technical annotations.
    USER: [Token Stream Array Data: {TOKEN_SEQUENCE}]
    ```
  * Send payload to Qwen inference server using `requests.post()`. Print the final string cleanly to standard output console (`stdout`). Clear token registers to prepare for the subsequent sentence.

---

## 3. NON-FUNCTIONAL REQUIREMENTS & BOUNDARY CONDITIONS

### NFR-01: Performance & Runtime Targets
* **End-to-End Pipeline Latency:** Execution loops (Capture -> MediaPipe -> Predict) must execute in under 33.3 milliseconds per loop iteration to support raw 30 FPS feeds.
* **Accuracy Metrics:** Core classifier model must score >= 94% categorical verification precision under standard internal lighting properties.

### NFR-02: Error Handling & System Defensiveness
* **Null Check Resiliency:** The script must handle instances where hands leave the video frame viewport abruptly without tracking memory leakage or system exceptions.
* **API Offline Fallback Mode:** If the internet connection drops or the Qwen endpoint returns an HTTP exception status code, the application must catch the error safely and output the unrefined comma-separated raw token text array directly to the console fallback block.
