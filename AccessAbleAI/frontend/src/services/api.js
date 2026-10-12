const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:8000' : 'http://localhost:8000');

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      status: 'offline',
      service: 'AccessAble AI Unified Backend',
      database: 'disconnected',
      reports_count: 0,
      active_barriers_count: 0,
      sos_records_count: 0,
      isl_service_reachable: false,
      isl_service_details: { error: err.message },
      ai_provider: 'Offline',
      ai_configured: false
    };
  }
}

export async function fetchReports(category = '', status = '', severity = '', includeResolved = true) {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.append('category', category);
  if (status) params.append('status', status);
  if (severity && severity !== 'all') params.append('severity', severity);
  if (!includeResolved) params.append('include_resolved', 'false');

  const url = `${API_BASE}/reports${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch accessibility reports');
  return await res.json();
}

export async function fetchNearbyBarriers(lat, lng, radiusKm = 2.0) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    radius_km: radiusKm.toString(),
    only_active_barriers: 'true'
  });
  const res = await fetch(`${API_BASE}/reports/nearby?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch nearby barrier reports');
  return await res.json();
}

export async function submitReport(reportData) {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to submit report');
  }
  return await res.json();
}

export async function confirmBarrier(reportId) {
  const res = await fetch(`${API_BASE}/reports/${reportId}/confirm`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to confirm report');
  return await res.json();
}

export async function resolveBarrier(reportId) {
  const res = await fetch(`${API_BASE}/reports/${reportId}/resolve`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to mark report as resolved');
  return await res.json();
}

export async function flagBarrier(reportId) {
  const res = await fetch(`${API_BASE}/reports/${reportId}/flag`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to flag report');
  return await res.json();
}

export async function fetchSOSRecords() {
  const res = await fetch(`${API_BASE}/sos`);
  if (!res.ok) throw new Error('Failed to fetch emergency records');
  return await res.json();
}

export async function submitSOSRecord(sosData) {
  const res = await fetch(`${API_BASE}/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sosData)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to save emergency record');
  }
  return await res.json();
}

export async function checkSignBridgeStatus() {
  try {
    const res = await fetch(`${API_BASE}/signbridge/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { online: false, error: err.message };
  }
}

export async function predictSign(imageData) {
  const res = await fetch(`${API_BASE}/signbridge/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_data: imageData })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'SignBridge prediction failed');
  }
  return await res.json();
}

export async function translateSignTokens(tokens) {
  const res = await fetch(`${API_BASE}/signbridge/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokens })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'AI translation failed');
  }
  return await res.json();
}

export async function translateTextToSign(text, signLanguage = 'ASL') {
  try {
    const res = await fetch(`${API_BASE}/signbridge/text-to-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sign_language: signLanguage })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Client-side fallback tokenization
    const words = (text || '').trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    return {
      spoken_text: text,
      sign_language: signLanguage,
      gloss_tokens: words,
      tokens_meta: words.map(w => ({ word: w, gloss: w, is_fingerspell: false }))
    };
  }
}

export async function fetchSignDictionary() {
  try {
    const res = await fetch(`${API_BASE}/signbridge/dictionary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      signs: {},
      supported_languages: [
        { code: 'ASL', name: 'American Sign Language', flag: '🇺🇸' },
        { code: 'ISL', name: 'Indian Sign Language', flag: '🇮🇳' },
        { code: 'BSL', name: 'British Sign Language', flag: '🇬🇧' },
        { code: 'IS', name: 'International Sign', flag: '🌐' }
      ]
    };
  }
}

export async function sendAIChat(messages, context = {}) {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'AI Assistant request failed');
  }
  return await res.json();
}

export async function checkEyeGazeStatus() {
  try {
    const res = await fetch(`${API_BASE}/eyegaze/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { online: false, error: err.message };
  }
}

export async function predictEyeGaze(imageData) {
  const res = await fetch(`${API_BASE}/eyegaze/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Eye gaze prediction failed');
  }
  return await res.json();
}

