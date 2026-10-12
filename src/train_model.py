"""
Gesture Model Training Script (FR-04)
Generates augmented landmark dataset for target sign vocabulary,
trains a scikit-learn Random Forest Classifier, evaluates precision,
and saves the trained model to models/gesture_classifier.joblib.
"""

import os
import json
import time
import math
import random
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score

from feature_extractor import extract_features

# Target vocabulary from PRD Section 2 (FR-04)
VOCABULARY = [
    "HELLO",
    "THANK YOU",
    "YES",
    "NO",
    "I",
    "WANT",
    "WATER",
    "GOODBYE",
    "PLEASE",
    "HELP"
]

def rotate_3d(x, y, z, roll=0, pitch=0, yaw=0):
    """Applies 3D rotation matrix around x, y, z axes."""
    cr, sr = math.cos(roll), math.sin(roll)
    cp, sp = math.cos(pitch), math.sin(pitch)
    cy, sy = math.cos(yaw), math.sin(yaw)

    # Roll (X)
    y1 = y * cr - z * sr
    z1 = y * sr + z * cr
    # Pitch (Y)
    x2 = x * cp + z1 * sp
    z2 = -x * sp + z1 * cp
    # Yaw (Z)
    x3 = x2 * cy - y1 * sy
    y3 = x2 * sy + y1 * cy

    return x3, y3, z2

def generate_base_hand(gesture: str):
    """
    Constructs canonical 21-landmark 3D coordinate geometry for each target sign.
    Coordinates centered around wrist (0.5, 0.8, 0.0).
    """
    lm = [{'x': 0.5, 'y': 0.8, 'z': 0.0} for _ in range(21)]
    
    # Base MCP joints relative to wrist
    lm[1] = {'x': 0.45, 'y': 0.72, 'z': -0.01} # Thumb CMC
    lm[2] = {'x': 0.40, 'y': 0.65, 'z': -0.02} # Thumb MCP
    lm[5] = {'x': 0.45, 'y': 0.55, 'z': 0.0}   # Index MCP
    lm[9] = {'x': 0.50, 'y': 0.53, 'z': 0.0}   # Middle MCP
    lm[13] = {'x': 0.55, 'y': 0.55, 'z': 0.0}  # Ring MCP
    lm[17] = {'x': 0.60, 'y': 0.58, 'z': 0.0}  # Pinky MCP

    if gesture == "HELLO" or gesture == "GOODBYE":
        # Open upright palm facing forward
        # Index UP
        lm[6] = {'x': 0.45, 'y': 0.42, 'z': 0.0}; lm[7] = {'x': 0.45, 'y': 0.32, 'z': 0.0}; lm[8] = {'x': 0.45, 'y': 0.22, 'z': 0.0}
        # Middle UP
        lm[10] = {'x': 0.50, 'y': 0.40, 'z': 0.0}; lm[11] = {'x': 0.50, 'y': 0.30, 'z': 0.0}; lm[12] = {'x': 0.50, 'y': 0.20, 'z': 0.0}
        # Ring UP
        lm[14] = {'x': 0.55, 'y': 0.42, 'z': 0.0}; lm[15] = {'x': 0.55, 'y': 0.32, 'z': 0.0}; lm[16] = {'x': 0.55, 'y': 0.22, 'z': 0.0}
        # Pinky UP
        lm[18] = {'x': 0.60, 'y': 0.45, 'z': 0.0}; lm[19] = {'x': 0.60, 'y': 0.36, 'z': 0.0}; lm[20] = {'x': 0.60, 'y': 0.26, 'z': 0.0}
        # Thumb extended out
        lm[3] = {'x': 0.36, 'y': 0.60, 'z': 0.0}; lm[4] = {'x': 0.32, 'y': 0.55, 'z': 0.0}
        if gesture == "GOODBYE":
            # Slight wave / lateral tilt
            for idx in [8, 12, 16, 20]:
                lm[idx]['x'] += 0.05

    elif gesture == "THANK YOU":
        # Flat hand oriented forward/upward, fingers together
        lm[6] = {'x': 0.46, 'y': 0.43, 'z': -0.05}; lm[7] = {'x': 0.46, 'y': 0.34, 'z': -0.10}; lm[8] = {'x': 0.46, 'y': 0.25, 'z': -0.15}
        lm[10] = {'x': 0.50, 'y': 0.41, 'z': -0.05}; lm[11] = {'x': 0.50, 'y': 0.32, 'z': -0.10}; lm[12] = {'x': 0.50, 'y': 0.23, 'z': -0.15}
        lm[14] = {'x': 0.54, 'y': 0.43, 'z': -0.05}; lm[15] = {'x': 0.54, 'y': 0.34, 'z': -0.10}; lm[16] = {'x': 0.54, 'y': 0.25, 'z': -0.15}
        lm[18] = {'x': 0.58, 'y': 0.46, 'z': -0.05}; lm[19] = {'x': 0.58, 'y': 0.38, 'z': -0.10}; lm[20] = {'x': 0.58, 'y': 0.29, 'z': -0.15}
        lm[3] = {'x': 0.42, 'y': 0.58, 'z': -0.02}; lm[4] = {'x': 0.43, 'y': 0.52, 'z': -0.04}

    elif gesture == "YES":
        # Closed fist (ASL S / Thumbs-up nodding fist)
        lm[6] = {'x': 0.46, 'y': 0.55, 'z': -0.05}; lm[7] = {'x': 0.46, 'y': 0.60, 'z': -0.03}; lm[8] = {'x': 0.46, 'y': 0.63, 'z': 0.0}
        lm[10] = {'x': 0.50, 'y': 0.53, 'z': -0.05}; lm[11] = {'x': 0.50, 'y': 0.59, 'z': -0.03}; lm[12] = {'x': 0.50, 'y': 0.63, 'z': 0.0}
        lm[14] = {'x': 0.54, 'y': 0.55, 'z': -0.05}; lm[15] = {'x': 0.54, 'y': 0.60, 'z': -0.03}; lm[16] = {'x': 0.54, 'y': 0.64, 'z': 0.0}
        lm[18] = {'x': 0.58, 'y': 0.57, 'z': -0.05}; lm[19] = {'x': 0.58, 'y': 0.62, 'z': -0.03}; lm[20] = {'x': 0.58, 'y': 0.65, 'z': 0.0}
        # Thumb resting firmly upright over curled fingers
        lm[3] = {'x': 0.40, 'y': 0.55, 'z': -0.04}; lm[4] = {'x': 0.40, 'y': 0.45, 'z': -0.05}

    elif gesture == "NO":
        # ASL 'NO': Index and Middle fingers straight forward tapping onto Thumb tip, Ring and Pinky curled
        lm[6] = {'x': 0.46, 'y': 0.45, 'z': -0.05}; lm[7] = {'x': 0.46, 'y': 0.40, 'z': -0.08}; lm[8] = {'x': 0.44, 'y': 0.48, 'z': -0.05}
        lm[10] = {'x': 0.50, 'y': 0.43, 'z': -0.05}; lm[11] = {'x': 0.50, 'y': 0.38, 'z': -0.08}; lm[12] = {'x': 0.46, 'y': 0.48, 'z': -0.05}
        # Thumb meets index and middle fingertips
        lm[3] = {'x': 0.42, 'y': 0.54, 'z': -0.03}; lm[4] = {'x': 0.45, 'y': 0.48, 'z': -0.05}
        # Ring and pinky curled
        lm[14] = {'x': 0.55, 'y': 0.58, 'z': 0.0}; lm[15] = {'x': 0.55, 'y': 0.64, 'z': 0.0}; lm[16] = {'x': 0.55, 'y': 0.68, 'z': 0.0}
        lm[18] = {'x': 0.60, 'y': 0.60, 'z': 0.0}; lm[19] = {'x': 0.60, 'y': 0.65, 'z': 0.0}; lm[20] = {'x': 0.60, 'y': 0.70, 'z': 0.0}

    elif gesture == "I":
        # ASL letter 'I': Only Pinky extended upright, other 3 curled, thumb over fingers
        # Index curled
        lm[6] = {'x': 0.46, 'y': 0.58, 'z': 0.0}; lm[7] = {'x': 0.46, 'y': 0.64, 'z': 0.0}; lm[8] = {'x': 0.46, 'y': 0.68, 'z': 0.0}
        # Middle curled
        lm[10] = {'x': 0.50, 'y': 0.56, 'z': 0.0}; lm[11] = {'x': 0.50, 'y': 0.62, 'z': 0.0}; lm[12] = {'x': 0.50, 'y': 0.68, 'z': 0.0}
        # Ring curled
        lm[14] = {'x': 0.55, 'y': 0.58, 'z': 0.0}; lm[15] = {'x': 0.55, 'y': 0.64, 'z': 0.0}; lm[16] = {'x': 0.55, 'y': 0.68, 'z': 0.0}
        # Pinky straight UP
        lm[18] = {'x': 0.60, 'y': 0.45, 'z': 0.0}; lm[19] = {'x': 0.60, 'y': 0.35, 'z': 0.0}; lm[20] = {'x': 0.60, 'y': 0.24, 'z': 0.0}
        # Thumb tucked across index/middle
        lm[3] = {'x': 0.44, 'y': 0.62, 'z': -0.02}; lm[4] = {'x': 0.47, 'y': 0.62, 'z': -0.03}

    elif gesture == "WANT":
        # Claw handshape: All 5 fingers curved/bent like claws
        for base_idx, mcp_idx, tip_idx in [(5, 6, 8), (9, 10, 12), (13, 14, 16), (17, 18, 20)]:
            x_mcp = lm[base_idx]['x']
            lm[mcp_idx] = {'x': x_mcp, 'y': 0.46, 'z': -0.08}
            lm[mcp_idx + 1] = {'x': x_mcp, 'y': 0.42, 'z': -0.14}
            lm[tip_idx] = {'x': x_mcp, 'y': 0.48, 'z': -0.16}
        lm[3] = {'x': 0.38, 'y': 0.62, 'z': -0.08}; lm[4] = {'x': 0.40, 'y': 0.54, 'z': -0.12}

    elif gesture == "WATER":
        # ASL 'W' handshape (Index, Middle, Ring extended straight UP in a W, Pinky curled, Thumb over Pinky)
        lm[6] = {'x': 0.44, 'y': 0.42, 'z': 0.0}; lm[7] = {'x': 0.43, 'y': 0.32, 'z': 0.0}; lm[8] = {'x': 0.42, 'y': 0.22, 'z': 0.0}
        lm[10] = {'x': 0.50, 'y': 0.40, 'z': 0.0}; lm[11] = {'x': 0.50, 'y': 0.30, 'z': 0.0}; lm[12] = {'x': 0.50, 'y': 0.20, 'z': 0.0}
        lm[14] = {'x': 0.56, 'y': 0.42, 'z': 0.0}; lm[15] = {'x': 0.57, 'y': 0.32, 'z': 0.0}; lm[16] = {'x': 0.58, 'y': 0.22, 'z': 0.0}
        # Pinky curled
        lm[18] = {'x': 0.60, 'y': 0.60, 'z': 0.0}; lm[19] = {'x': 0.60, 'y': 0.65, 'z': 0.0}; lm[20] = {'x': 0.60, 'y': 0.70, 'z': 0.0}
        # Thumb resting over curled pinky
        lm[3] = {'x': 0.46, 'y': 0.64, 'z': -0.02}; lm[4] = {'x': 0.52, 'y': 0.64, 'z': -0.02}

    elif gesture == "PLEASE":
        # Flat B hand rubbing chest (flat palm circular orientation)
        for base_idx, mcp_idx, tip_idx in [(5, 6, 8), (9, 10, 12), (13, 14, 16), (17, 18, 20)]:
            x_mcp = lm[base_idx]['x']
            lm[mcp_idx] = {'x': x_mcp - 0.03, 'y': 0.43, 'z': 0.0}
            lm[mcp_idx + 1] = {'x': x_mcp - 0.05, 'y': 0.33, 'z': 0.0}
            lm[tip_idx] = {'x': x_mcp - 0.07, 'y': 0.23, 'z': 0.0}
        lm[3] = {'x': 0.38, 'y': 0.64, 'z': 0.0}; lm[4] = {'x': 0.42, 'y': 0.62, 'z': 0.0}

    elif gesture == "HELP":
        # Thumb pointing up on flat base (closed fist with thumb up facing upward)
        # 4 fingers curled
        for base_idx, mcp_idx, tip_idx in [(5, 6, 8), (9, 10, 12), (13, 14, 16), (17, 18, 20)]:
            x_mcp = lm[base_idx]['x']
            lm[mcp_idx] = {'x': x_mcp, 'y': 0.56, 'z': -0.05}
            lm[mcp_idx + 1] = {'x': x_mcp, 'y': 0.61, 'z': -0.03}
            lm[tip_idx] = {'x': x_mcp, 'y': 0.64, 'z': 0.0}
        # Thumb pointing straight UP
        lm[3] = {'x': 0.38, 'y': 0.52, 'z': 0.0}; lm[4] = {'x': 0.38, 'y': 0.42, 'z': 0.0}

    return lm

def augment_landmarks(base_lm):
    """Generates a randomized, realistic augmented sample."""
    # Random 3D rotation angles
    roll = random.uniform(-0.35, 0.35)   # ~±20 degrees
    pitch = random.uniform(-0.30, 0.30)
    yaw = random.uniform(-0.35, 0.35)

    # Global scale factor
    scale = random.uniform(0.75, 1.25)
    
    # Global translation shift
    shift_x = random.uniform(-0.15, 0.15)
    shift_y = random.uniform(-0.15, 0.15)
    shift_z = random.uniform(-0.10, 0.10)

    # Wrist anchor
    wx, wy, wz = base_lm[0]['x'], base_lm[0]['y'], base_lm[0]['z']

    augmented = []
    for pt in base_lm:
        # Translate to wrist local
        rx = (pt['x'] - wx) * scale
        ry = (pt['y'] - wy) * scale
        rz = (pt['z'] - wz) * scale

        # Add joint-specific small random jitter
        rx += random.gauss(0, 0.008)
        ry += random.gauss(0, 0.008)
        rz += random.gauss(0, 0.008)

        # 3D Rotate
        x_rot, y_rot, z_rot = rotate_3d(rx, ry, rz, roll, pitch, yaw)

        # Re-anchor with global shift
        augmented.append({
            'x': wx + x_rot + shift_x,
            'y': wy + y_rot + shift_y,
            'z': wz + z_rot + shift_z
        })

    return augmented

def build_dataset(samples_per_class=600):
    """Builds normalized feature matrix X and target array y."""
    X = []
    y = []

    print(f"Generating synthetic augmented dataset ({samples_per_class} samples/class)...")
    for label_id, gesture in enumerate(VOCABULARY):
        base_lm = generate_base_hand(gesture)
        for _ in range(samples_per_class):
            aug_lm = augment_landmarks(base_lm)
            feat = extract_features(aug_lm)
            if feat and len(feat) == 60:
                X.append(feat)
                y.append(label_id)

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)
    print(f"Dataset generated: {X.shape[0]} samples, {X.shape[1]} features, {len(VOCABULARY)} classes.")
    return X, y

def main():
    start_time = time.time()
    os.makedirs("models", exist_ok=True)

    X, y = build_dataset(samples_per_class=700)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("\nTraining scikit-learn Random Forest Classifier...")
    clf = RandomForestClassifier(
        n_estimators=35,
        max_depth=14,
        min_samples_split=3,
        random_state=42,
        n_jobs=1
    )
    clf.fit(X_train, y_train)

    # Evaluation
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n=======================================================")
    print(f"  MODEL VALIDATION ACCURACY: {acc * 100:.2f}% (Target: >= 94%)")
    print(f"=======================================================\n")
    print(classification_report(y_test, y_pred, target_names=VOCABULARY))

    # Benchmark Latency (FR-04: < 5.0ms)
    test_sample = X_test[0:1]
    latencies = []
    for _ in range(500):
        t0 = time.perf_counter()
        _ = clf.predict_proba(test_sample)
        latencies.append((time.perf_counter() - t0) * 1000)
    avg_latency = np.mean(latencies)
    p95_latency = np.percentile(latencies, 95)
    print(f"[Latency Benchmark] Avg: {avg_latency:.3f} ms | P95: {p95_latency:.3f} ms (Must be < 5.0 ms)")

    # Save artifacts
    model_path = os.path.join("models", "gesture_classifier.joblib")
    joblib.dump(clf, model_path)
    print(f"[Artifact] Saved model to: {model_path}")

    class_names_path = os.path.join("models", "class_names.json")
    with open(class_names_path, "w", encoding="utf-8") as f:
        json.dump(VOCABULARY, f, indent=2)
    print(f"[Artifact] Saved class labels to: {class_names_path}")

    print(f"\nTraining pipeline completed in {time.time() - start_time:.2f}s.")

if __name__ == "__main__":
    main()
