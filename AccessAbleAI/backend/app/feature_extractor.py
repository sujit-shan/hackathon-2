"""
Positional and Scale Translation Normalization Module (FR-03)
Converts 21 raw 3D landmarks into a 60-element invariant feature vector.
"""

import math
from typing import List, Optional, Union

def extract_features(landmarks) -> Optional[List[float]]:
    """
    Extracts a 60-dimensional normalized feature vector from 21 MediaPipe hand landmarks.
    
    Operations:
    1. Wrist (index 0) acts as local origin (X0, Y0, Z0).
    2. Subtract (X0, Y0, Z0) from remaining 20 landmarks (indices 1 to 20).
    3. Flatten into 60 elements: [X1_rel, Y1_rel, Z1_rel, ..., X20_rel, Y20_rel, Z20_rel].
    4. Normalize by the maximum Euclidean distance to achieve scale invariance.
    
    Accepts:
    - MediaPipe NormalizedLandmarkList (has .landmark attribute)
    - List of dicts/objects with x, y, z attributes
    - List of [x, y, z] tuples/lists
    """
    if landmarks is None:
        return None

    # Handle MediaPipe NormalizedLandmarkList
    points = []
    if hasattr(landmarks, 'landmark'):
        points = [(lm.x, lm.y, getattr(lm, 'z', 0.0)) for lm in landmarks.landmark]
    elif isinstance(landmarks, (list, tuple)):
        for p in landmarks:
            if hasattr(p, 'x'):
                points.append((p.x, p.y, getattr(p, 'z', 0.0)))
            elif isinstance(p, dict):
                points.append((p['x'], p['y'], p.get('z', 0.0)))
            elif isinstance(p, (list, tuple)) and len(p) >= 2:
                z = p[2] if len(p) > 2 else 0.0
                points.append((p[0], p[1], z))

    if len(points) < 21:
        return None

    # 1. Wrist origin (index 0)
    x0, y0, z0 = points[0]

    # 2. Vector subtraction for indices 1 to 20
    rel_coords = []
    max_dist = 0.0

    for i in range(1, 21):
        xi, yi, zi = points[i]
        dx = xi - x0
        dy = yi - y0
        dz = zi - z0
        
        rel_coords.extend([dx, dy, dz])
        dist = math.hypot(dx, dy, dz)
        if dist > max_dist:
            max_dist = dist

    # Prevent division by zero
    if max_dist < 1e-6:
        max_dist = 1.0

    # 3. Scale normalization
    normalized_vector = [val / max_dist for val in rel_coords]
    return normalized_vector
