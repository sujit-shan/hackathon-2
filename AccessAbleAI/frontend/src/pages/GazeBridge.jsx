import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Eye, 
  Camera, 
  Square, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Sliders, 
  Grid, 
  Type, 
  ShieldAlert,
  Zap,
  Target,
  Compass,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { predictEyeGaze, translateSignTokens, checkEyeGazeStatus } from '../services/api';

const QUICK_CARDS = [
  { id: 'food', label: 'FOOD', icon: '🍲', category: 'needs' },
  { id: 'emergency', label: 'EMERGENCY', icon: '🚨', category: 'emergency' },
  { id: 'thank_you', label: 'THANK YOU', icon: '🙏', category: 'polite' },
  { id: 'help', label: 'HELP', icon: '🆘', category: 'emergency' },
  { id: 'water', label: 'WATER', icon: '💧', category: 'needs' },
  { id: 'yes', label: 'YES', icon: '👍', category: 'action' },
  { id: 'no', label: 'NO', icon: '👎', category: 'action' },
  { id: 'please', label: 'PLEASE', icon: '✨', category: 'polite' },
  { id: 'medicine', label: 'MEDICINE', icon: '💊', category: 'needs' },
  { id: 'pain', label: 'PAIN', icon: '🩹', category: 'emergency' },
  { id: 'rest', label: 'REST', icon: '😴', category: 'needs' },
  { id: 'family', label: 'FAMILY', icon: '👨‍👩‍👧', category: 'social' }
];

const ALPHABET_KEYS = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['G', 'H', 'I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V', 'W', 'X'],
  ['Y', 'Z', 'SPACE', 'BACKSPACE', 'CLEAR']
];

// Exponential Moving Average filter for smooth gaze tracking
const EMA_ALPHA = 0.28;

export default function GazeBridge() {
  const [cameraActive, setCameraActive] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [cameraError, setCameraError] = useState('');
  
  // Tracking metrics
  const [gazeDirection, setGazeDirection] = useState('CENTER');
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkScore, setBlinkScore] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [smoothGazePoint, setSmoothGazePoint] = useState({ x: 0.5, y: 0.5 });
  
  // Grid navigation state
  const [activeTab, setActiveTab] = useState('quick'); // 'quick' | 'keyboard'
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(true);
  const [blinkFeedbackText, setBlinkFeedbackText] = useState('');
  
  // Navigation mode: 'grid_pointing' (look directly at card) vs 'directional_step' (glance L/R/U/D to move box)
  const [navMode, setNavMode] = useState('directional_step'); // 'directional_step' | 'grid_pointing'
  const [gazeSelectionMode, setGazeSelectionMode] = useState('both'); // 'dwell' | 'blink' | 'both'
  
  // Dwell selection state
  const [dwellProgress, setDwellProgress] = useState(0);
  const [dwellTargetIndex, setDwellTargetIndex] = useState(-1);
  
  // Composed transcript
  const [transcriptWords, setTranscriptWords] = useState([]);
  const [directWords, setDirectWords] = useState('');
  const [composedText, setComposedText] = useState('');
  const [translatedSentence, setTranslatedSentence] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const autoScanIntervalRef = useRef(null);
  const lastBlinkTimeRef = useRef(0);
  const blinkHoldFramesRef = useRef(0);
  const lastDirectionRef = useRef('CENTER');
  const dirChangeTimeRef = useRef(0);
  const lastSelectedWordRef = useRef(null);
  const selectionLockoutUntilRef = useRef(0);
  
  // Smooth gaze EMA refs
  const smoothGazeRef = useRef({ x: 0.5, y: 0.5 });
  
  // Dwell selection refs
  const dwellStartTimeRef = useRef(0);
  const dwellIndexRef = useRef(-1);
  const DWELL_TIME_MS = 1400; // 1.4 seconds to dwell-select
  
  const gridContainerRef = useRef(null);

  // Audio click feedback
  const playClickSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  };

  const playDwellSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  };

  // Auto-Scan interval: cycles through cards every 1.5 seconds
  useEffect(() => {
    if (autoScanEnabled && cameraActive) {
      if (autoScanIntervalRef.current) clearInterval(autoScanIntervalRef.current);
      autoScanIntervalRef.current = setInterval(() => {
        setFocusedIndex(prev => {
          const total = activeTab === 'quick' ? QUICK_CARDS.length : ALPHABET_KEYS.flat().length;
          return (prev + 1) % total;
        });
      }, 1500);
    } else {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current);
        autoScanIntervalRef.current = null;
      }
    }
    return () => {
      if (autoScanIntervalRef.current) clearInterval(autoScanIntervalRef.current);
    };
  }, [autoScanEnabled, cameraActive, activeTab]);

  // Select currently focused item with STRICT LOCKOUT & NO REPEATS
  const handleSelectCurrent = useCallback((overrideWord = null) => {
    const now = Date.now();
    // Cooldown lockout: prevent accidental micro-blinks from re-triggering within 1.2s
    if (now < selectionLockoutUntilRef.current && !overrideWord) {
      return;
    }

    const wordToSelect = overrideWord || (activeTab === 'quick' ? QUICK_CARDS[focusedIndex]?.label : null);

    if (wordToSelect) {
      const cleaned = wordToSelect.toUpperCase();

      // STRICT PREVENT REPEATS: If user is still focused on the same word, DO NOT repeat it!
      if (lastSelectedWordRef.current === cleaned && !overrideWord) {
        return;
      }

      playClickSound();
      lastSelectedWordRef.current = cleaned;
      selectionLockoutUntilRef.current = now + 1200; // 1.2s cooldown

      setTranscriptWords(prev => {
        // Prevent consecutive duplicates (NEVER add "YES", "YES", "YES")
        if (prev.length > 0 && prev[prev.length - 1] === cleaned) {
          return prev;
        }
        return [...prev, cleaned];
      });

      setBlinkFeedbackText(`Selected: "${wordToSelect}"`);
      setTimeout(() => setBlinkFeedbackText(''), 1800);

      // Reset dwell state after selection
      setDwellProgress(0);
      setDwellTargetIndex(-1);
      dwellIndexRef.current = -1;
      dwellStartTimeRef.current = 0;

      // Only speak when a NEW word is actually selected
      if (autoSpeakEnabled) {
        speakText(wordToSelect.toLowerCase());
      }
      return;
    }

    if (activeTab === 'keyboard') {
      const flatKeys = ALPHABET_KEYS.flat();
      const key = flatKeys[focusedIndex];
      if (key === 'SPACE') {
        setComposedText(prev => prev + ' ');
      } else if (key === 'BACKSPACE') {
        setComposedText(prev => prev.slice(0, -1));
      } else if (key === 'CLEAR') {
        setComposedText('');
      } else if (key) {
        setComposedText(prev => prev + key);
        setBlinkFeedbackText(`Typed: "${key}"`);
        setTimeout(() => setBlinkFeedbackText(''), 1500);
      }
    }
  }, [activeTab, focusedIndex, autoSpeakEnabled]);

  // Map normalized gaze coordinates (0-1) to grid card index
  const gazeToGridIndex = useCallback((gazeX, gazeY) => {
    if (activeTab === 'quick') {
      const cols = 4;
      const rows = 3;
      const col = Math.min(Math.floor(gazeX * cols), cols - 1);
      const row = Math.min(Math.floor(gazeY * rows), rows - 1);
      const index = row * cols + col;
      return Math.min(Math.max(0, index), QUICK_CARDS.length - 1);
    } else {
      const cols = 6;
      const rows = ALPHABET_KEYS.length;
      const col = Math.min(Math.floor(gazeX * cols), cols - 1);
      const row = Math.min(Math.floor(gazeY * rows), rows - 1);
      
      const rowKeys = ALPHABET_KEYS[row] || ALPHABET_KEYS[0];
      const adjustedCol = Math.min(col, rowKeys.length - 1);
      
      let flatIndex = 0;
      for (let r = 0; r < row; r++) {
        flatIndex += ALPHABET_KEYS[r].length;
      }
      flatIndex += adjustedCol;
      
      const totalKeys = ALPHABET_KEYS.flat().length;
      return Math.min(Math.max(0, flatIndex), totalKeys - 1);
    }
  }, [activeTab]);

  // Dwell selection timer logic
  const updateDwell = useCallback((currentFocusIndex) => {
    const now = Date.now();
    
    if (currentFocusIndex !== dwellIndexRef.current) {
      dwellIndexRef.current = currentFocusIndex;
      dwellStartTimeRef.current = now;
      setDwellTargetIndex(currentFocusIndex);
      setDwellProgress(0);
    } else {
      const elapsed = now - dwellStartTimeRef.current;
      const progress = Math.min(elapsed / DWELL_TIME_MS, 1.0);
      setDwellProgress(progress);
      
      if (elapsed >= DWELL_TIME_MS && dwellStartTimeRef.current > 0) {
        dwellStartTimeRef.current = 0;
        playDwellSound();
        setFocusedIndex(currentFocusIndex);
        
        setTimeout(() => {
          if (activeTab === 'quick') {
            const word = QUICK_CARDS[currentFocusIndex]?.label;
            if (word) {
              handleSelectCurrent(word);
            }
          } else {
            handleSelectCurrent();
          }
        }, 50);
      }
    }
  }, [activeTab, handleSelectCurrent]);

  // Auto-translate transcript words into clean comma-separated direct output and fluent sentence
  useEffect(() => {
    if (transcriptWords.length > 0) {
      const formatted = transcriptWords.map(w => w.toLowerCase()).join(', ');
      setDirectWords(formatted);

      setIsTranslating(true);
      translateSignTokens(transcriptWords)
        .then(res => {
          if (res?.direct_words) {
            setDirectWords(res.direct_words);
          }
          if (res?.translated_sentence) {
            setTranslatedSentence(res.translated_sentence);
          } else {
            setTranslatedSentence(formatted.charAt(0).toUpperCase() + formatted.slice(1) + '.');
          }
        })
        .catch(() => {
          setTranslatedSentence(formatted.charAt(0).toUpperCase() + formatted.slice(1) + '.');
        })
        .finally(() => setIsTranslating(false));
    } else {
      setDirectWords('');
      setTranslatedSentence('');
    }
  }, [transcriptWords]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setIsTracking(true);
        if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = setInterval(captureAndTrackEyes, 200);
      }
    } catch (err) {
      setCameraError('Webcam access was denied. You can still test by clicking keys directly.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    setIsTracking(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDwellProgress(0);
    setDwellTargetIndex(-1);
    dwellIndexRef.current = -1;
  };

  const captureAndTrackEyes = async () => {
    const video = videoRef.current;
    if (!video || video.readyState !== 4 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);

    try {
      const data = await predictEyeGaze(base64Data);
      setFaceDetected(data.face_detected);
      setLatencyMs(data.latency_ms || 0);

      if (data.face_detected) {
        setGazeDirection(data.gaze_direction);
        setIsBlinking(data.is_blink);
        setBlinkScore(data.blink_score);

        // Apply EMA smoothing to gaze coordinates to eliminate jitter
        if (data.gaze_x !== undefined && data.gaze_y !== undefined) {
          const prev = smoothGazeRef.current;
          const smoothX = prev.x + EMA_ALPHA * (data.gaze_x - prev.x);
          const smoothY = prev.y + EMA_ALPHA * (data.gaze_y - prev.y);
          smoothGazeRef.current = { x: smoothX, y: smoothY };
          setSmoothGazePoint({ x: smoothX, y: smoothY });
          
          // MODE 1: Direct Grid Pointing (Eyes point directly to card position on screen)
          if (navMode === 'grid_pointing' && !autoScanEnabled && data.gaze_direction !== 'CENTER') {
            const gazeIdx = gazeToGridIndex(smoothX, smoothY);
            if (gazeIdx >= 0) {
              setFocusedIndex(gazeIdx);
              if (gazeSelectionMode === 'dwell' || gazeSelectionMode === 'both') {
                updateDwell(gazeIdx);
              }
            }
          }
        }

        const now = Date.now();

        // 1. DELIBERATE BLINK SELECTION
        if (gazeSelectionMode === 'blink' || gazeSelectionMode === 'both') {
          if (data.is_blink) {
            blinkHoldFramesRef.current += 1;
          } else {
            const framesHeld = blinkHoldFramesRef.current;
            blinkHoldFramesRef.current = 0;

            // Deliberate blink requires holding closed for >= 2 frames (~350ms - 800ms)
            if (framesHeld >= 2 && (now - lastBlinkTimeRef.current > 1100)) {
              lastBlinkTimeRef.current = now;

              // Long hold (>= 5 frames ~1.1s): Quick EMERGENCY shortcut
              if (framesHeld >= 5) {
                handleSelectCurrent("EMERGENCY");
              } 
              // Conscious selection blink (2 to 4 frames ~350-900ms): Select focused item
              else {
                handleSelectCurrent();
              }
            }
          }
        }

        // 2. DIRECTIONAL STEP NAVIGATION (Eye moves Left/Right/Up/Down -> step cursor)
        if (navMode === 'directional_step' || autoScanEnabled) {
          if (data.gaze_direction !== 'CENTER') {
            const isDirChanged = data.gaze_direction !== lastDirectionRef.current;
            const isHoldStep = !isDirChanged && (now - dirChangeTimeRef.current > 750);

            if ((isDirChanged && (now - dirChangeTimeRef.current > 280)) || isHoldStep) {
              dirChangeTimeRef.current = now;
              lastDirectionRef.current = data.gaze_direction;

              // Reset selected word lock so new card can be selected
              lastSelectedWordRef.current = null;

              const totalItems = activeTab === 'quick' ? QUICK_CARDS.length : ALPHABET_KEYS.flat().length;
              const cols = activeTab === 'quick' ? 4 : 6;

              setFocusedIndex(prev => {
                let next = prev;
                // CORRECT NATURAL ORIENTATION:
                // RIGHT eye movement -> moves RIGHT
                // LEFT eye movement -> moves LEFT
                // DOWN eye movement -> moves DOWN
                // UP eye movement -> moves UP
                if (data.gaze_direction === 'RIGHT') next = (prev + 1) % totalItems;
                else if (data.gaze_direction === 'LEFT') next = (prev - 1 + totalItems) % totalItems;
                else if (data.gaze_direction === 'DOWN') next = (prev + cols) % totalItems;
                else if (data.gaze_direction === 'UP') next = (prev - cols + totalItems) % totalItems;
                return next;
              });

              // Also trigger dwell on the new item if dwell mode enabled
              if (gazeSelectionMode === 'dwell' || gazeSelectionMode === 'both') {
                const totalItems = activeTab === 'quick' ? QUICK_CARDS.length : ALPHABET_KEYS.flat().length;
                const cols = activeTab === 'quick' ? 4 : 6;
                let next = focusedIndex;
                if (data.gaze_direction === 'RIGHT') next = (focusedIndex + 1) % totalItems;
                else if (data.gaze_direction === 'LEFT') next = (focusedIndex - 1 + totalItems) % totalItems;
                else if (data.gaze_direction === 'DOWN') next = (focusedIndex + cols) % totalItems;
                else if (data.gaze_direction === 'UP') next = (focusedIndex - cols + totalItems) % totalItems;
                updateDwell(next);
              }
            }
          } else {
            lastDirectionRef.current = 'CENTER';
            // In center position, if dwell mode is active, allow dwell to accumulate on currently focused card
            if (gazeSelectionMode === 'dwell' || gazeSelectionMode === 'both') {
              updateDwell(focusedIndex);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Eye Gaze Error]', err);
    }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const copyToClipboard = async (text) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Dwell progress ring component
  const DwellRing = ({ progress, size = 36 }) => {
    if (progress <= 0) return null;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - progress);
    
    return (
      <svg 
        width={size} 
        height={size} 
        style={{ 
          position: 'absolute', 
          top: '4px', 
          right: '4px', 
          transform: 'rotate(-90deg)',
          zIndex: 5
        }}
      >
        <circle
          cx={size/2}
          cy={size/2}
          r={radius}
          fill="none"
          stroke="rgba(79, 70, 229, 0.2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size/2}
          cy={size/2}
          r={radius}
          fill="none"
          stroke={progress >= 1 ? '#16A34A' : '#4F46E5'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.15s ease-out' }}
        />
      </svg>
    );
  };

  return (
    <div className="gazebridge-page" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      <header className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">
          <Eye className="text-primary" size={36} aria-hidden="true" />
          GazeBridge AI — Pure Eye Gaze & Blink Communicator
        </h1>
        <p className="page-subtitle">
          Operate entirely with <strong>EYE MOVEMENT</strong>: look left, right, up, down to move cursor, and <strong>BLINK</strong> or <strong>DWELL (1.4s)</strong> to select and speak.
        </p>
      </header>

      {/* Top Banner: Real-Time Gaze Diagnostics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            backgroundColor: isBlinking ? '#DC2626' : (cameraActive ? '#16A34A' : 'var(--bg-surface-hover)'), 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#FFF',
            fontSize: '1.25rem',
            transition: 'background-color 0.2s ease'
          }}>
            {isBlinking ? '😉' : (cameraActive ? '👁️' : '⚪')}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Eye Gaze Direction</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {gazeDirection === 'CENTER' && <span>Center 🎯</span>}
              {gazeDirection === 'LEFT' && <span>Left <ArrowLeft size={18} style={{ display: 'inline', color: '#16A34A' }} /></span>}
              {gazeDirection === 'RIGHT' && <span>Right <ArrowRight size={18} style={{ display: 'inline', color: '#16A34A' }} /></span>}
              {gazeDirection === 'UP' && <span>Up <ArrowUp size={18} style={{ display: 'inline', color: '#16A34A' }} /></span>}
              {gazeDirection === 'DOWN' && <span>Down <ArrowDown size={18} style={{ display: 'inline', color: '#16A34A' }} /></span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            backgroundColor: isBlinking ? '#16A34A' : 'var(--bg-surface-hover)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: isBlinking ? '#FFF' : 'var(--text-muted)',
            fontWeight: 800,
            transition: 'background-color 0.2s ease'
          }}>
            OK
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Blink Action (OK)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: isBlinking ? '#16A34A' : 'var(--text-muted)' }}>
              {isBlinking ? 'BLINK TRIGGERED!' : `Open (${Math.round(blinkScore * 100)}%)`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            backgroundColor: dwellProgress > 0 ? `rgba(79, 70, 229, ${0.15 + dwellProgress * 0.5})` : 'var(--bg-surface-hover)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: dwellProgress > 0 ? '#FFF' : 'var(--primary)',
            transition: 'all 0.2s ease'
          }}>
            <Target size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Dwell Progress</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: dwellProgress > 0.5 ? '#16A34A' : 'var(--text-main)' }}>
              {dwellProgress > 0 ? `${Math.round(dwellProgress * 100)}%` : 'Ready'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--bg-surface-hover)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Latency</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {latencyMs > 0 ? `${latencyMs} ms` : '< 5 ms'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Column: Camera Preview & Instructions */}
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Camera size={20} className="text-primary" /> Webcam Eye Tracker
            </h2>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              {!cameraActive ? (
                <button className="btn btn-primary" onClick={startCamera}>
                  <Camera size={18} /> Start Eye Tracker
                </button>
              ) : (
                <button className="btn btn-outline" onClick={stopCamera}>
                  <Square size={18} /> Stop Tracker
                </button>
              )}
            </div>

            {cameraError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                {cameraError}
              </div>
            )}

            {/* Video preview with STABILIZED eye gaze reticle */}
            <div style={{ 
              position: 'relative', 
              backgroundColor: '#000', 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden', 
              minHeight: '240px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ 
                  width: '100%', 
                  maxWidth: '380px', 
                  display: cameraActive ? 'block' : 'none',
                  transform: 'scaleX(-1)' // Mirror preview for natural user experience
                }} 
              />
              {!cameraActive && (
                <p style={{ color: '#9CA3AF', padding: '1rem', textAlign: 'center' }}>
                  Camera inactive. Click "Start Eye Tracker" above.
                </p>
              )}

              {/* Stabilized Eye Gaze Reticle Overlay */}
              {cameraActive && (
                <div style={{ 
                  position: 'absolute', 
                  top: `${Math.round(smoothGazePoint.y * 100)}%`, 
                  left: `${Math.round(smoothGazePoint.x * 100)}%`, 
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  border: isBlinking ? '3px solid #16A34A' : '2px solid rgba(79, 70, 229, 0.85)',
                  borderRadius: '50%',
                  width: '54px',
                  height: '36px',
                  transition: 'top 0.22s ease-out, left 0.22s ease-out, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
                  backgroundColor: isBlinking ? 'rgba(22, 163, 74, 0.4)' : 'rgba(79, 70, 229, 0.2)',
                  boxShadow: isBlinking ? '0 0 16px #16A34A' : '0 0 12px rgba(79, 70, 229, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isBlinking ? '#16A34A' : '#4F46E5' }} />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Eye Navigation Guide */}
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>💡 Eye Controls Guide:</div>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                <li><strong>Look Left ⬅️ / Right ➡️</strong>: Moves the selection highlight left or right.</li>
                <li><strong>Look Down ⬇️ / Up ⬆️</strong>: Moves the selection highlight down or up.</li>
                <li><strong>Blink Both Eyes 😉</strong>: Instantly selects the focused card.</li>
                <li><strong>Dwell (Keep Looking) 🎯</strong>: Holds on a card for 1.4s to auto-select.</li>
              </ul>
            </div>
          </div>

          {/* Controls: Navigation Mode & Selection Method */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Eye Tracking Mode:</h3>
            
            {/* Nav Mode: Directional Steps vs Pointing */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                className={`btn ${navMode === 'directional_step' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '0.5rem 0.35rem', fontSize: '0.8rem' }}
                onClick={() => setNavMode('directional_step')}
              >
                <Compass size={16} /> Eye Glance Steps
              </button>
              <button
                className={`btn ${navMode === 'grid_pointing' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '0.5rem 0.35rem', fontSize: '0.8rem' }}
                onClick={() => setNavMode('grid_pointing')}
              >
                <Target size={16} /> Direct Screen Pointing
              </button>
            </div>

            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Selection Trigger:</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[
                { value: 'both', label: '✨ Blink + Dwell (Both)' },
                { value: 'blink', label: '😉 Blink Only' },
                { value: 'dwell', label: '🎯 Dwell Only (1.4s)' }
              ].map(mode => (
                <button
                  key={mode.value}
                  className={`btn ${gazeSelectionMode === mode.value ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, padding: '0.4rem 0.25rem', fontSize: '0.75rem' }}
                  onClick={() => setGazeSelectionMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', marginTop: '0.5rem' }}>Board Layout:</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className={`btn ${activeTab === 'quick' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setActiveTab('quick'); setFocusedIndex(0); }}
                style={{ flex: 1 }}
              >
                <Grid size={16} /> Quick Cards
              </button>
              <button 
                className={`btn ${activeTab === 'keyboard' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setActiveTab('keyboard'); setFocusedIndex(0); }}
                style={{ flex: 1 }}
              >
                <Type size={16} /> Alphabet A-Z
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: High-Contrast Eye-Navigable Board */}
        <div>
          {/* Quick Blink Banner */}
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #FCD34D', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>✨ <strong>Emergency Shortcut:</strong> Hold eyes closed for 1 second to instantly trigger <strong>"EMERGENCY"</strong>!</span>
            <button 
              className="btn btn-primary" 
              style={{ minHeight: '30px', padding: '0.2rem 0.65rem', fontSize: '0.8rem' }}
              onClick={() => handleSelectCurrent("EMERGENCY")}
            >
              + Quick "EMERGENCY"
            </button>
          </div>

          {/* Blink Feedback Notification */}
          {blinkFeedbackText && (
            <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#DCFCE7', color: '#166534', borderRadius: '8px', marginBottom: '1rem', border: '2px solid #22C55E', fontWeight: 800, fontSize: '1.05rem', textAlign: 'center' }}>
              {blinkFeedbackText}
            </div>
          )}

          {/* TAB 1: QUICK AAC CARDS with Gaze Tracking + Dwell Ring */}
          {activeTab === 'quick' && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Grid size={20} className="text-primary" /> Communication Cards
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Focused: <strong style={{ color: 'var(--primary)' }}>{QUICK_CARDS[focusedIndex]?.label}</strong>
                </span>
              </div>

              <div ref={gridContainerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {QUICK_CARDS.map((card, idx) => {
                  const isFocused = focusedIndex === idx;
                  const isDwelling = dwellTargetIndex === idx && dwellProgress > 0;
                  return (
                    <button
                      key={card.id}
                      onClick={() => { setFocusedIndex(idx); handleSelectCurrent(card.label); }}
                      style={{
                        position: 'relative',
                        padding: '1.25rem 0.5rem',
                        borderRadius: '12px',
                        border: isFocused ? '3px solid #16A34A' : '1px solid var(--border-color)',
                        backgroundColor: isFocused 
                          ? (isDwelling ? `rgba(22, 163, 74, ${0.15 + dwellProgress * 0.25})` : 'rgba(22, 163, 74, 0.15)') 
                          : 'var(--bg-surface)',
                        transform: isFocused ? 'scale(1.05)' : 'scale(1.0)',
                        boxShadow: isFocused 
                          ? (isDwelling ? `0 0 ${16 + dwellProgress * 20}px rgba(22, 163, 74, ${0.4 + dwellProgress * 0.3})` : '0 0 16px rgba(22, 163, 74, 0.4)') 
                          : 'none',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.18s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.35rem',
                        overflow: 'hidden'
                      }}
                      title={`Click or look to select ${card.label}`}
                    >
                      {/* Dwell Progress Ring */}
                      {isFocused && isDwelling && <DwellRing progress={dwellProgress} />}
                      
                      <span style={{ fontSize: '2rem' }}>{card.icon}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isFocused ? '#16A34A' : 'var(--text-main)' }}>
                        {card.label}
                      </span>
                      {isFocused && (
                        <span style={{ fontSize: '0.65rem', color: '#16A34A', fontWeight: 800 }}>
                          {isDwelling ? `[${Math.round(dwellProgress * 100)}% DWELL]` : '[EYE FOCUSED]'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: ALPHABET VIRTUAL KEYBOARD */}
          {activeTab === 'keyboard' && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Type size={20} className="text-primary" /> Eye Gaze Keyboard
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Selected Key: <strong>{ALPHABET_KEYS.flat()[focusedIndex]}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ALPHABET_KEYS.map((row, rIdx) => (
                  <div key={rIdx} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    {row.map((k) => {
                      const flatIdx = ALPHABET_KEYS.flat().indexOf(k);
                      const isFocused = focusedIndex === flatIdx;
                      const isDwelling = dwellTargetIndex === flatIdx && dwellProgress > 0;
                      return (
                        <button
                          key={k}
                          onClick={() => { setFocusedIndex(flatIdx); handleSelectCurrent(); }}
                          style={{
                            position: 'relative',
                            flex: k.length > 1 ? 2 : 1,
                            padding: '0.75rem 0.25rem',
                            borderRadius: '8px',
                            border: isFocused ? '3px solid #16A34A' : '1px solid var(--border-color)',
                            backgroundColor: isFocused ? 'rgba(22, 163, 74, 0.18)' : 'var(--bg-surface)',
                            fontWeight: 800,
                            fontSize: k.length > 1 ? '0.8rem' : '1.15rem',
                            color: isFocused ? '#16A34A' : 'var(--text-main)',
                            transform: isFocused ? 'scale(1.08)' : 'scale(1.0)',
                            boxShadow: isFocused ? '0 0 12px rgba(22, 163, 74, 0.45)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            overflow: 'hidden'
                          }}
                        >
                          {isFocused && isDwelling && <DwellRing progress={dwellProgress} size={28} />}
                          {k}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sentence Builder & Speech Output */}
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Volume2 size={20} className="text-primary" /> Communicated Output & Speech
            </h2>

            {/* Quick cards sequence */}
            {activeTab === 'quick' && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Staged Words Sequence ({transcriptWords.length}):
                </div>
                <div style={{ minHeight: '44px', padding: '0.6rem 0.85rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                  {transcriptWords.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Look at cards above to construct a message...</span>
                  ) : (
                    transcriptWords.map((w, i) => (
                      <span key={i} style={{ backgroundColor: 'var(--primary)', color: '#FFF', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
                        {w}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Keyboard composed text */}
            {activeTab === 'keyboard' && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Typed Message:
                </div>
                <div style={{ minHeight: '44px', padding: '0.6rem 0.85rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '1.1rem', fontWeight: 700 }}>
                  {composedText || <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Type letters with eye blinks...</span>}
                </div>
              </div>
            )}

            {/* Communicated Message Output */}
            <div style={{ 
              padding: '1.25rem', 
              backgroundColor: 'var(--bg-surface-hover)', 
              borderRadius: 'var(--radius-md)', 
              border: '2px solid var(--primary)',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={14} /> Communicated Message (Clean Words):
                </div>
                <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 700 }}>
                  ✓ Clean &amp; Deduplicated
                </span>
              </div>

              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', minHeight: '38px', letterSpacing: '0.01em' }}>
                {activeTab === 'quick' ? (
                  directWords ? (
                    directWords
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                      Look at cards to select words (e.g. food, emergency, thank you, help)...
                    </span>
                  )
                ) : (
                  composedText || <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Type letters with eye blinks...</span>
                )}
              </div>

              {activeTab === 'quick' && translatedSentence && translatedSentence.toLowerCase() !== directWords.toLowerCase() && (
                <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600 }}>Fluent Synthesis:</span> "{translatedSentence}"
                </div>
              )}
            </div>

            {/* Audio & Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-primary"
                onClick={() => speakText(activeTab === 'quick' ? (directWords || transcriptWords.map(w => w.toLowerCase()).join(', ')) : composedText)}
                disabled={activeTab === 'quick' ? transcriptWords.length === 0 : !composedText}
                style={{ flex: 1, minHeight: '44px' }}
              >
                <Volume2 size={18} /> Read Aloud (Speak)
              </button>

              <button 
                className="btn btn-outline"
                onClick={() => copyToClipboard(activeTab === 'quick' ? (directWords || transcriptWords.map(w => w.toLowerCase()).join(', ')) : composedText)}
                disabled={activeTab === 'quick' ? transcriptWords.length === 0 : !composedText}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />} Copy
              </button>

              <button 
                className="btn btn-outline"
                onClick={() => { setTranscriptWords([]); setDirectWords(''); setComposedText(''); setTranslatedSentence(''); setDwellProgress(0); setDwellTargetIndex(-1); dwellIndexRef.current = -1; }}
              >
                <RotateCcw size={18} /> Clear All
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
