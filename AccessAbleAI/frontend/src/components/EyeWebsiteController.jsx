import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  LayoutDashboard, 
  Sliders, 
  X, 
  Check, 
  Target, 
  Zap, 
  Maximize2,
  Volume2
} from 'lucide-react';
import { predictEyeGaze } from '../services/api';

export default function EyeWebsiteController({ 
  isActive, 
  onToggle, 
  onNavigate 
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [gazeCoords, setGazeCoords] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [gazeDirection, setGazeDirection] = useState('CENTER');
  const [isBlinking, setIsBlinking] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [snappedElement, setSnappedElement] = useState(null);
  const [sensitivity, setSensitivity] = useState(1.0); // 0.7 = low, 1.0 = med, 1.4 = high
  const [isDockMinimized, setIsDockMinimized] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const smoothGazeRef = useRef({ x: 0.5, y: 0.5 });
  
  // Dwell state
  const dwellStartTimeRef = useRef(0);
  const dwellTargetElemRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const DWELL_TIME_MS = 1300; // 1.3 seconds to auto-click

  // Audio feedback
  const playClickSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  // Start webcam when active
  useEffect(() => {
    if (isActive) {
      startTracker();
    } else {
      stopTracker();
    }
    return () => stopTracker();
  }, [isActive]);

  const startTracker = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = setInterval(processEyeFrame, 180);
      }
    } catch (err) {
      console.warn('[EyeController Camera Error]', err);
    }
  };

  const stopTracker = () => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDwellProgress(0);
    dwellTargetElemRef.current = null;
  };

  // Magnetic snap to nearest clickable element
  const findNearestClickable = (screenX, screenY) => {
    const clickables = document.querySelectorAll('button:not(.eye-controller-ignore), a, [role="button"], input, select');
    let nearest = null;
    let minDistance = 75; // 75px snap radius

    clickables.forEach(el => {
      // Ignore hidden or zero-size elements
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(screenX - centerX, screenY - centerY);

      if (dist < minDistance) {
        minDistance = dist;
        nearest = { element: el, x: centerX, y: centerY, rect };
      }
    });

    return nearest;
  };

  const processEyeFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState !== 4 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);

    const base64Data = canvas.toDataURL('image/jpeg', 0.82);

    try {
      const data = await predictEyeGaze(base64Data);

      if (data.face_detected) {
        setGazeDirection(data.gaze_direction);
        setIsBlinking(data.is_blink);

        if (data.gaze_x !== undefined && data.gaze_y !== undefined) {
          // Calculate screen position with user sensitivity
          const rawNormX = 0.5 + (data.gaze_x - 0.5) * sensitivity;
          const rawNormY = 0.5 + (data.gaze_y - 0.5) * sensitivity;

          // Smooth EMA filtering
          const prev = smoothGazeRef.current;
          const alpha = 0.32;
          const sx = prev.x + alpha * (rawNormX - prev.x);
          const sy = prev.y + alpha * (rawNormY - prev.y);
          smoothGazeRef.current = { x: sx, y: sy };

          let targetScreenX = Math.max(20, Math.min(window.innerWidth - 20, sx * window.innerWidth));
          let targetScreenY = Math.max(20, Math.min(window.innerHeight - 20, sy * window.innerHeight));

          // Magnetic snapping to clickable buttons
          const snap = findNearestClickable(targetScreenX, targetScreenY);
          setSnappedElement(snap);

          if (snap) {
            targetScreenX = snap.x;
            targetScreenY = snap.y;
          }

          setGazeCoords({ x: targetScreenX, y: targetScreenY });

          // Dwell and Blink Auto-Click handling
          const now = Date.now();
          const targetElem = snap?.element || null;

          // 1. Deliberate Blink Click
          if (data.is_blink && targetElem && (now - lastClickTimeRef.current > 1100)) {
            lastClickTimeRef.current = now;
            playClickSound();
            targetElem.click();
            setFeedbackMessage(`Clicked: ${targetElem.innerText || targetElem.getAttribute('aria-label') || 'Element'}`);
            setTimeout(() => setFeedbackMessage(''), 1500);
            setDwellProgress(0);
            return;
          }

          // 2. Dwell Click (1.3s hold)
          if (targetElem) {
            if (targetElem !== dwellTargetElemRef.current) {
              dwellTargetElemRef.current = targetElem;
              dwellStartTimeRef.current = now;
              setDwellProgress(0);
            } else {
              const elapsed = now - dwellStartTimeRef.current;
              const progress = Math.min(elapsed / DWELL_TIME_MS, 1.0);
              setDwellProgress(progress);

              if (elapsed >= DWELL_TIME_MS && (now - lastClickTimeRef.current > 1100)) {
                lastClickTimeRef.current = now;
                dwellStartTimeRef.current = 0;
                setDwellProgress(0);
                playClickSound();
                targetElem.click();
                setFeedbackMessage(`Clicked: ${targetElem.innerText || targetElem.getAttribute('aria-label') || 'Element'}`);
                setTimeout(() => setFeedbackMessage(''), 1500);
              }
            }
          } else {
            dwellTargetElemRef.current = null;
            setDwellProgress(0);
          }
        }
      }
    } catch (err) {
      console.warn('[Eye Tracking Error]', err);
    }
  };

  // Scroll actions
  const scrollPage = (delta) => {
    window.scrollBy({ top: delta, behavior: 'smooth' });
  };

  if (!isActive) return null;

  return (
    <div className="eye-website-controller-root" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99999 }}>
      {/* Hidden Video & Canvas for Eye Processing */}
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Floating Eye Gaze Reticle / Cursor */}
      <div 
        style={{
          position: 'fixed',
          left: `${gazeCoords.x}px`,
          top: `${gazeCoords.y}px`,
          transform: 'translate(-50%, -50%)',
          width: snappedElement ? '54px' : '44px',
          height: snappedElement ? '54px' : '44px',
          borderRadius: '50%',
          border: isBlinking 
            ? '3px solid #DC2626' 
            : (snappedElement ? '3px solid #16A34A' : '2px solid #4F46E5'),
          backgroundColor: isBlinking 
            ? 'rgba(220, 38, 38, 0.4)' 
            : (snappedElement ? 'rgba(22, 163, 74, 0.25)' : 'rgba(79, 70, 229, 0.2)'),
          boxShadow: snappedElement 
            ? '0 0 22px rgba(22, 163, 74, 0.7)' 
            : '0 0 14px rgba(79, 70, 229, 0.5)',
          transition: 'width 0.15s ease, height 0.15s ease, border-color 0.15s ease',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000
        }}
      >
        {/* Center Target Dot */}
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: snappedElement ? '#16A34A' : '#4F46E5'
        }} />

        {/* Dwell Progress Ring */}
        {dwellProgress > 0 && (
          <svg 
            width={58} 
            height={58} 
            style={{ 
              position: 'absolute', 
              top: '-2px', 
              left: '-2px', 
              transform: 'rotate(-90deg)' 
            }}
          >
            <circle
              cx={29}
              cy={29}
              r={24}
              fill="none"
              stroke="#16A34A"
              strokeWidth={4}
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={2 * Math.PI * 24 * (1 - dwellProgress)}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Click Feedback Banner */}
      {feedbackMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#16A34A',
          color: '#FFF',
          padding: '0.5rem 1.25rem',
          borderRadius: '9999px',
          fontWeight: 800,
          fontSize: '0.9rem',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          zIndex: 100001,
          pointerEvents: 'none'
        }}>
          ✓ {feedbackMessage}
        </div>
      )}

      {/* Floating Eye Navigation Action Dock (Bottom-Left) */}
      <div 
        className="eye-action-dock eye-controller-ignore"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          pointerEvents: 'auto',
          backgroundColor: 'var(--bg-surface)',
          border: '2px solid var(--primary)',
          borderRadius: '16px',
          padding: isDockMinimized ? '0.5rem' : '0.85rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: '220px',
          zIndex: 100002
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary)' }}>
            <Eye size={18} />
            <span>Eye Control ON</span>
          </div>
          <button 
            className="eye-controller-ignore"
            onClick={() => setIsDockMinimized(!isDockMinimized)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            title={isDockMinimized ? 'Expand' : 'Minimize'}
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {!isDockMinimized && (
          <>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Direction: <strong>{gazeDirection}</strong> {isBlinking && '• 😉 BLINK'}
            </div>

            {/* Quick Eye Targets for Universal Navigation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <button
                className="btn btn-outline eye-controller-ignore"
                onClick={() => scrollPage(-350)}
                style={{ padding: '0.45rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                title="Look here to scroll page up"
              >
                <ArrowUp size={14} /> Up
              </button>
              <button
                className="btn btn-outline eye-controller-ignore"
                onClick={() => scrollPage(350)}
                style={{ padding: '0.45rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                title="Look here to scroll page down"
              >
                <ArrowDown size={14} /> Down
              </button>
            </div>

            <button
              className="btn btn-outline eye-controller-ignore"
              onClick={() => onNavigate('dashboard')}
              style={{ padding: '0.45rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <LayoutDashboard size={14} /> Dashboard
            </button>

            <button
              className="btn btn-outline eye-controller-ignore"
              onClick={() => onNavigate('gazebridge')}
              style={{ padding: '0.45rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <Eye size={14} /> GazeBridge Cards
            </button>

            {/* Sensitivity selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
              <span>Sensitivity:</span>
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                {[
                  { label: 'Low', val: 0.75 },
                  { label: 'Med', val: 1.0 },
                  { label: 'High', val: 1.35 }
                ].map(s => (
                  <button
                    key={s.label}
                    className="eye-controller-ignore"
                    onClick={() => setSensitivity(s.val)}
                    style={{
                      padding: '0.15rem 0.4rem',
                      fontSize: '0.65rem',
                      borderRadius: '4px',
                      border: sensitivity === s.val ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: sensitivity === s.val ? 'var(--primary)' : 'transparent',
                      color: sensitivity === s.val ? '#FFF' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-danger eye-controller-ignore"
              onClick={onToggle}
              style={{ padding: '0.4rem', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
            >
              <X size={14} /> Turn Off Eye Control
            </button>
          </>
        )}
      </div>
    </div>
  );
}
