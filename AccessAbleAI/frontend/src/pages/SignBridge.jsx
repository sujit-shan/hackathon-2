import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Square,
  RotateCcw,
  Volume2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Sparkles,
  ArrowLeftRight,
  Mic,
  MicOff,
  BookOpen,
  ExternalLink,
  HelpCircle,
  Activity,
  Layers,
  Terminal,
  Zap,
  Gauge,
  Clock,
  Play,
  VolumeX,
  Sliders
} from 'lucide-react';
import {
  checkSignBridgeStatus,
  predictSign,
  translateSignTokens,
  translateTextToSign,
  fetchSignDictionary,
  launchDesktopSignTranslator,
  checkDesktopSignTranslatorStatus
} from '../services/api';
import SignLanguageAvatar from '../components/SignLanguageAvatar';

// ---------------------------------------------------------------------------
// PRD Configuration & Skeleton Connections
// ---------------------------------------------------------------------------
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // Index
  [5, 9], [9, 10], [10, 11], [11, 12],   // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [0, 17],                               // Palm base
  [5, 9], [9, 13]                        // Cross palm
];

const FINGERTIPS = [4, 8, 12, 16, 20];

// PRD Section 2: Core Vocabulary from gesture_classifier.joblib
const CORE_VOCABULARY = [
  { sign: 'HELLO', desc: 'Open palm facing forward, gentle side-to-side wave', category: 'Greeting' },
  { sign: 'THANK YOU', desc: 'Flat fingertips touching chin then moving outward', category: 'Courtesy' },
  { sign: 'YES', desc: 'Closed fist or thumb up nodding up and down', category: 'Affirmation' },
  { sign: 'NO', desc: 'Index & middle fingers tapping thumb or thumb down', category: 'Negation' },
  { sign: 'I', desc: 'Index finger pointing upward or touching chest', category: 'Pronoun' },
  { sign: 'WANT', desc: 'Curved open fingers pulling inward towards body', category: 'Desire' },
  { sign: 'WATER', desc: 'Index, middle, and ring fingers up forming "W" shape', category: 'Need' },
  { sign: 'GOODBYE', desc: 'Open palm waving farewell outward', category: 'Greeting' },
  { sign: 'PLEASE', desc: 'Open flat palm rubbing chest in clockwise circle', category: 'Courtesy' },
  { sign: 'HELP', desc: 'Closed fist resting on flat palm lifting upward', category: 'Assistance' },
  { sign: 'FOOD', desc: 'Tapered fingertips brought to mouth repeatedly', category: 'Need' },
  { sign: 'EMERGENCY', desc: 'Hands waving side-to-side in urgent crossing motion', category: 'Urgent' }
];

const WINDOW_SIZE_N = 10;          // FR-05: Rolling history window
const CONSENSUS_THRESHOLD = 0.70;  // FR-05: 70% consensus required
const COOLDOWN_TICKS = 14;         // Debounce ticks before same token repeats
const SILENCE_TRIGGER_MS = 2400;   // FR-06: ~2.4s of no hand triggers translation

// Realistic 3D Landmark Generator for Verified Working Signs (FR-01 to FR-05)
const GENERATE_VERIFIED_SIGN_LANDMARKS = (name) => {
  const wrist = { x: 0.50, y: 0.75, z: 0.0 };
  const makeFinger = (baseX, ext, curledY = 0.62, tipExtY = 0.28) => {
    if (ext) {
      return [
        { x: baseX, y: 0.58, z: -0.01 },
        { x: baseX, y: 0.48, z: -0.02 },
        { x: baseX, y: 0.40, z: -0.03 },
        { x: baseX, y: tipExtY, z: -0.04 }
      ];
    } else {
      return [
        { x: baseX, y: 0.58, z: -0.01 },
        { x: baseX, y: 0.52, z: 0.02 },
        { x: baseX, y: 0.56, z: 0.04 },
        { x: baseX, y: curledY, z: 0.03 }
      ];
    }
  };

  let thumb, index, middle, ring, pinky;

  if (name === 'HELLO') {
    thumb = [
      { x: 0.42, y: 0.68, z: 0.01 },
      { x: 0.38, y: 0.60, z: 0.02 },
      { x: 0.34, y: 0.52, z: 0.03 },
      { x: 0.30, y: 0.44, z: 0.04 }
    ];
    index = makeFinger(0.44, true, 0.62, 0.28);
    middle = makeFinger(0.50, true, 0.62, 0.26);
    ring = makeFinger(0.56, true, 0.62, 0.29);
    pinky = makeFinger(0.62, true, 0.62, 0.33);
  } else if (name === 'WATER') {
    // ASL 'W' gesture: Index, Middle, Ring EXTENDED; Pinky CURLED; Thumb folded over pinky
    thumb = [
      { x: 0.45, y: 0.68, z: 0.01 },
      { x: 0.48, y: 0.62, z: 0.02 },
      { x: 0.52, y: 0.58, z: 0.03 },
      { x: 0.55, y: 0.56, z: 0.02 }
    ];
    index = makeFinger(0.45, true, 0.62, 0.28);
    middle = makeFinger(0.50, true, 0.62, 0.26);
    ring = makeFinger(0.55, true, 0.62, 0.29);
    pinky = makeFinger(0.60, false, 0.64);
  } else if (name === 'I') {
    // Index pointing straight up
    thumb = [
      { x: 0.45, y: 0.68, z: 0.01 },
      { x: 0.44, y: 0.62, z: 0.02 },
      { x: 0.44, y: 0.58, z: 0.02 },
      { x: 0.45, y: 0.55, z: 0.01 }
    ];
    index = makeFinger(0.48, true, 0.62, 0.28);
    middle = makeFinger(0.51, false, 0.62);
    ring = makeFinger(0.54, false, 0.63);
    pinky = makeFinger(0.57, false, 0.64);
  } else if (name === 'YES') {
    // Thumbs Up
    thumb = [
      { x: 0.44, y: 0.68, z: -0.01 },
      { x: 0.42, y: 0.58, z: -0.02 },
      { x: 0.40, y: 0.48, z: -0.03 },
      { x: 0.39, y: 0.36, z: -0.04 }
    ];
    index = makeFinger(0.48, false, 0.62);
    middle = makeFinger(0.51, false, 0.63);
    ring = makeFinger(0.54, false, 0.64);
    pinky = makeFinger(0.57, false, 0.65);
  } else if (name === 'NO') {
    // Thumbs Down
    thumb = [
      { x: 0.44, y: 0.72, z: -0.01 },
      { x: 0.42, y: 0.78, z: -0.02 },
      { x: 0.40, y: 0.85, z: -0.03 },
      { x: 0.39, y: 0.92, z: -0.04 }
    ];
    index = makeFinger(0.48, false, 0.62);
    middle = makeFinger(0.51, false, 0.63);
    ring = makeFinger(0.54, false, 0.64);
    pinky = makeFinger(0.57, false, 0.65);
  } else if (name === 'FOOD') {
    // All 5 fingertips pinched together
    const pinch = { x: 0.50, y: 0.46 };
    thumb = [
      { x: 0.44, y: 0.68, z: 0.0 },
      { x: 0.46, y: 0.60, z: 0.01 },
      { x: 0.48, y: 0.52, z: 0.02 },
      { x: pinch.x - 0.01, y: pinch.y, z: 0.03 }
    ];
    index = [
      { x: 0.47, y: 0.60, z: 0.0 },
      { x: 0.48, y: 0.54, z: 0.01 },
      { x: 0.49, y: 0.50, z: 0.02 },
      { x: pinch.x + 0.01, y: pinch.y, z: 0.03 }
    ];
    middle = [
      { x: 0.50, y: 0.60, z: 0.0 },
      { x: 0.50, y: 0.54, z: 0.01 },
      { x: 0.50, y: 0.50, z: 0.02 },
      { x: pinch.x, y: pinch.y + 0.01, z: 0.03 }
    ];
    ring = [
      { x: 0.53, y: 0.60, z: 0.0 },
      { x: 0.52, y: 0.54, z: 0.01 },
      { x: 0.51, y: 0.50, z: 0.02 },
      { x: pinch.x - 0.01, y: pinch.y + 0.01, z: 0.03 }
    ];
    pinky = [
      { x: 0.56, y: 0.60, z: 0.0 },
      { x: 0.54, y: 0.54, z: 0.01 },
      { x: 0.52, y: 0.50, z: 0.02 },
      { x: pinch.x + 0.01, y: pinch.y + 0.02, z: 0.03 }
    ];
  } else if (name === 'EMERGENCY') {
    // 'Y' call gesture: Thumb & Pinky extended, middle 3 curled
    thumb = [
      { x: 0.42, y: 0.68, z: 0.01 },
      { x: 0.38, y: 0.60, z: 0.02 },
      { x: 0.34, y: 0.52, z: 0.03 },
      { x: 0.30, y: 0.44, z: 0.04 }
    ];
    index = makeFinger(0.48, false, 0.62);
    middle = makeFinger(0.51, false, 0.63);
    ring = makeFinger(0.54, false, 0.64);
    pinky = makeFinger(0.60, true, 0.62, 0.33);
  } else if (name === 'THANK YOU') {
    // Flat hand together, thumb slightly extended
    thumb = [
      { x: 0.42, y: 0.68, z: 0.01 },
      { x: 0.38, y: 0.62, z: 0.02 },
      { x: 0.34, y: 0.56, z: 0.03 },
      { x: 0.31, y: 0.50, z: 0.03 }
    ];
    index = makeFinger(0.47, true, 0.62, 0.28);
    middle = makeFinger(0.49, true, 0.62, 0.27);
    ring = makeFinger(0.51, true, 0.62, 0.28);
    pinky = makeFinger(0.53, true, 0.62, 0.30);
  } else if (name === 'PLEASE') {
    // Flat hand with thumb tucked in
    thumb = [
      { x: 0.46, y: 0.68, z: 0.01 },
      { x: 0.46, y: 0.60, z: 0.01 },
      { x: 0.47, y: 0.54, z: 0.02 },
      { x: 0.47, y: 0.48, z: 0.02 }
    ];
    index = makeFinger(0.47, true, 0.62, 0.28);
    middle = makeFinger(0.49, true, 0.62, 0.27);
    ring = makeFinger(0.51, true, 0.62, 0.28);
    pinky = makeFinger(0.53, true, 0.62, 0.30);
  } else if (name === 'WANT') {
    // Claw grasping
    const claw = (baseX, tipY) => [
      { x: baseX, y: 0.58, z: 0.0 },
      { x: baseX, y: 0.50, z: -0.04 },
      { x: baseX, y: 0.45, z: -0.07 },
      { x: baseX, y: tipY, z: -0.06 }
    ];
    thumb = [
      { x: 0.44, y: 0.68, z: 0.0 },
      { x: 0.42, y: 0.60, z: -0.03 },
      { x: 0.40, y: 0.53, z: -0.05 },
      { x: 0.39, y: 0.47, z: -0.04 }
    ];
    index = claw(0.45, 0.43);
    middle = claw(0.49, 0.42);
    ring = claw(0.53, 0.43);
    pinky = claw(0.57, 0.46);
  } else {
    // Default Open Palm (HELLO / GOODBYE)
    thumb = [
      { x: 0.42, y: 0.68, z: 0.01 },
      { x: 0.38, y: 0.60, z: 0.02 },
      { x: 0.34, y: 0.52, z: 0.03 },
      { x: 0.30, y: 0.44, z: 0.04 }
    ];
    index = makeFinger(0.44, true, 0.62, 0.28);
    middle = makeFinger(0.50, true, 0.62, 0.26);
    ring = makeFinger(0.56, true, 0.62, 0.29);
    pinky = makeFinger(0.62, true, 0.62, 0.33);
  }

  return [wrist, ...thumb, ...index, ...middle, ...ring, ...pinky];
};

export default function SignBridge() {
  // Mode: 'realtime-vision' (Webcam Hand Sign Translator) OR 'spoken-to-signed' (Rylo Avatar)
  const [activeTab, setActiveTab] = useState('realtime-vision');

  // Languages for avatar mode
  const [spokenLang, setSpokenLang] = useState('en');
  const [signLang, setSignLang] = useState('ASL');

  // -------------------------------------------------------------
  // Real-Time Hand Sign Translator State (PRD Specs)
  // -------------------------------------------------------------
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeSimSign, setActiveSimSign] = useState(null);
  const [modelStatus, setModelStatus] = useState({ online: false, checking: true, details: null });
  const [desktopStatus, setDesktopStatus] = useState({ available: false, launching: false, message: '' });

  // Live telemetry & detection
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [activeSign, setActiveSign] = useState(null);
  const [activeProb, setActiveProb] = useState(0);
  const [detectionTier, setDetectionTier] = useState(null);
  const [hasHand, setHasHand] = useState(false);
  const [consensusScore, setConsensusScore] = useState(0);
  const [silenceProgress, setSilenceProgress] = useState(0); // 0 to 100%
  const [isTranslating, setIsTranslating] = useState(false);

  // Token sequence & translation output
  const [committedTokens, setCommittedTokens] = useState([]);
  const [directWords, setDirectWords] = useState('');
  const [translatedSentence, setTranslatedSentence] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  // -------------------------------------------------------------
  // Spoken-to-Signed Avatar State
  // -------------------------------------------------------------
  const [spokenInput, setSpokenInput] = useState('Hello, thank you for your help');
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [glossTokens, setGlossTokens] = useState(['HELLO', 'THANK YOU', 'HELP']);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  // Dictionary drawer
  const [showDictionary, setShowDictionary] = useState(false);
  const [dictionaryData, setDictionaryData] = useState({});

  // Refs for real-time video loop & hysteresis
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const isPredictingRef = useRef(false);

  // FR-05 Hysteresis State Refs
  const historyBufferRef = useRef([]);
  const lastCommittedRef = useRef(null);
  const cooldownRef = useRef(0);
  const silenceStartRef = useRef(null);
  const fpsBufferRef = useRef([]);
  const lastFrameTimeRef = useRef(Date.now());
  const recognitionRef = useRef(null);
  const latestTokensRef = useRef([]);

  useEffect(() => {
    latestTokensRef.current = committedTokens;
  }, [committedTokens]);

  // Initial setup: status check & speech recognition
  useEffect(() => {
    checkService();
    checkDesktop();
    loadDictionary();

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      setMicSupported(true);
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setSpokenInput(transcript);
        handleTranslateText(transcript);
        setIsListeningMic(false);
      };
      rec.onerror = () => setIsListeningMic(false);
      rec.onend = () => setIsListeningMic(false);
      recognitionRef.current = rec;
    }

    // Keyboard Hotkeys: 'T' for force translate, 'C' for clear, 'U' for undo
    const handleKeyDown = (e) => {
      // Ignore if user is typing in a textarea or input
      if (['TEXTAREA', 'INPUT'].includes(e.target.tagName)) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        triggerSentenceTranslation();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClearAll();
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleUndoToken();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      stopCamera();
      window.removeEventListener('keydown', handleKeyDown);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Ensure video element plays and receives stream when cameraActive turns true
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => { });
    }
  }, [cameraActive]);

  const checkService = async () => {
    setModelStatus({ online: false, checking: true, details: null });
    const res = await checkSignBridgeStatus();
    setModelStatus({
      online: res.online,
      checking: false,
      details: res.details,
      numClasses: res.num_classes || 10,
      classes: res.classes || []
    });
  };

  const checkDesktop = async () => {
    const res = await checkDesktopSignTranslatorStatus();
    setDesktopStatus(prev => ({ ...prev, available: res.available, path: res.path }));
  };

  const loadDictionary = async () => {
    const data = await fetchSignDictionary();
    if (data.signs) {
      setDictionaryData(data.signs);
    }
  };

  // -------------------------------------------------------------
  // Launch Standalone OpenCV Desktop App
  // -------------------------------------------------------------
  const handleLaunchDesktop = async () => {
    setDesktopStatus(prev => ({ ...prev, launching: true, message: 'Launching native OpenCV window...' }));
    try {
      const res = await launchDesktopSignTranslator();
      setDesktopStatus(prev => ({
        ...prev,
        launching: false,
        message: `Success: ${res.message} (PID: ${res.pid})`
      }));
      // Clear message after 6s
      setTimeout(() => {
        setDesktopStatus(prev => ({ ...prev, message: '' }));
      }, 6000);
    } catch (err) {
      setDesktopStatus(prev => ({
        ...prev,
        launching: false,
        message: `Error: ${err.message}`
      }));
    }
  };

  // -------------------------------------------------------------
  // Camera & Video Capture (FR-01)
  // -------------------------------------------------------------
  const handleSwitchToLocalhost = () => {
    if (window.location.hostname === '127.0.0.1') {
      window.location.href = window.location.href.replace('127.0.0.1', 'localhost');
    } else {
      window.location.reload();
    }
  };

  const startCamera = async () => {
    setCameraError('');
    setShowCameraHelp(false);
    setIsSimulating(false);
    setActiveSimSign(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access not supported by your browser. Please open in Google Chrome or Microsoft Edge.');
      setCameraActive(false);
      return;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch { }
      streamRef.current = null;
    }

    let stream = null;
    let lastError = null;

    // Strategy 1: Ideal 640x480 user-facing
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
    } catch (err1) {
      lastError = err1;
      // Strategy 2: Without facingMode (Resolves Windows desktop USB/integrated webcams)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch (err2) {
        lastError = err2;
        // Strategy 3: Pure unconstrained video: true
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err3) {
          lastError = err3;
          // Strategy 4: High-res fallback (1280x720)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } }
            });
          } catch (err4) {
            lastError = err4;
            // Strategy 5: Probe enumerated video devices directly
            if (navigator.mediaDevices.enumerateDevices) {
              try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(d => d.kind === 'videoinput');
                for (const dev of videoInputs) {
                  try {
                    stream = await navigator.mediaDevices.getUserMedia({
                      video: { deviceId: { exact: dev.deviceId } }
                    });
                    if (stream) break;
                  } catch (devErr) {
                    lastError = devErr;
                  }
                }
              } catch { }
            }
          }
        }
      }
    }

    if (stream) {
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          videoRef.current.play().catch(() => { });
        } catch { }
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => { });
        };
      }
      setCameraError('');

      // Reset debouncer & silence state
      historyBufferRef.current = [];
      lastCommittedRef.current = null;
      cooldownRef.current = 0;
      silenceStartRef.current = null;

      // Start inference cycle every 160ms (~6 inferences/sec for responsive hysteresis)
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(captureAndProcessFrame, 160);
    } else {
      const name = lastError?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Camera access blocked. Click the lock/camera icon in your address bar and set Camera to Allow.');
        setShowCameraHelp(true);
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No webcam found on this device. Please connect a webcam or use Virtual Hand Simulation.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('Webcam is already in use by another app (e.g. Teams, Zoom, or Python OpenCV script). Please close it and retry.');
        setShowCameraHelp(true);
      } else {
        setCameraError(lastError?.message || 'Camera access denied or unavailable.');
      }
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch { }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setHasHand(false);
    setActiveSign(null);
    setActiveProb(0);
    setIsSimulating(false);
    setActiveSimSign(null);
    clearCanvas();
  };

  // -------------------------------------------------------------
  // Virtual Interactive Hand Simulation (FR-01 to FR-06 without camera)
  // -------------------------------------------------------------
  const simulateSignPose = async (signName) => {
    setActiveSimSign(signName);
    setIsSimulating(true);
    setCameraError('');

    // If real camera was active, pause it cleanly
    if (cameraActive) {
      stopCamera();
      setIsSimulating(true);
      setActiveSimSign(signName);
    }

    // Generate accurate 3D landmarks for this sign
    const lms = GENERATE_VERIFIED_SIGN_LANDMARKS(signName);

    // Render neon skeleton on canvas overlay
    if (canvasRef.current) {
      const c = canvasRef.current;
      const w = c.parentElement?.clientWidth || 640;
      const h = c.parentElement?.clientHeight || 480;
      c.width = w;
      c.height = h;
      drawSkeleton(lms, w, h);
    }

    setHasHand(true);
    setFps(30);

    try {
      const data = await predictSign(lms);
      setLatencyMs(data.latency_ms || 1.8);
      const predictedLabel = data.prediction || signName;
      setActiveSign(predictedLabel);
      setActiveProb(data.confidence || 0.95);
      setDetectionTier(data.tier || 'kinematics');
      setConsensusScore(100);

      // Reset silence countdown and commit token
      silenceStartRef.current = null;
      setSilenceProgress(0);
      commitToken(predictedLabel);
    } catch (err) {
      console.warn('Simulation predict error:', err);
      // Fallback direct commit
      setActiveSign(signName);
      setActiveProb(0.95);
      setDetectionTier('kinematics');
      setConsensusScore(100);
      commitToken(signName);
    }
  };

  const runPracticeStory = async (tokens) => {
    handleClearAll();
    setIsSimulating(true);
    for (let i = 0; i < tokens.length; i++) {
      await simulateSignPose(tokens[i]);
      await new Promise(r => setTimeout(r, 650));
    }
    // Then trigger translation
    setTimeout(() => {
      triggerSentenceTranslation();
    }, 350);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // -------------------------------------------------------------
  // Draw Neon Hand Skeleton & HUD on Overlay Canvas
  // -------------------------------------------------------------
  const drawSkeleton = (landmarks, width, height) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length < 21) return;

    // Map normalized coordinates (0.0 to 1.0) to canvas pixels
    const pts = landmarks.map(lm => ({
      x: lm.x * width,
      y: lm.y * height
    }));

    // 1. Draw Skeleton Bone Lines (Neon Cyan Glow)
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#0284C7';
    ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [i1, i2] of HAND_CONNECTIONS) {
      if (pts[i1] && pts[i2]) {
        ctx.beginPath();
        ctx.moveTo(pts[i1].x, pts[i1].y);
        ctx.lineTo(pts[i2].x, pts[i2].y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 2. Draw Landmark Joint Nodes
    pts.forEach((pt, idx) => {
      const isTip = FINGERTIPS.includes(idx);
      const isWrist = idx === 0;

      ctx.save();
      ctx.beginPath();
      const radius = isTip ? 6.5 : (isWrist ? 7 : 5);
      ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);

      if (isTip) {
        ctx.fillStyle = '#22C55E'; // Vibrant Green for fingertips
        ctx.shadowColor = '#15803D';
        ctx.shadowBlur = 8;
      } else if (isWrist) {
        ctx.fillStyle = '#FACC15'; // Accent Gold for Wrist Origin (FR-03)
        ctx.shadowColor = '#CA8A04';
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = '#0EA5E9'; // Electric Cyan for knuckles & joints
        ctx.shadowColor = '#0369A1';
        ctx.shadowBlur = 6;
      }
      ctx.fill();

      // Clean white inner dot for precision
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    });
  };

  // -------------------------------------------------------------
  // Frame Processing Pipeline (FR-01 to FR-06)
  // -------------------------------------------------------------
  const captureAndProcessFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isPredictingRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) {
      if (video.paused && streamRef.current) {
        video.play().catch(() => { });
      }
      return;
    }

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    // Downscale to 320x240 for rapid sub-5ms base64 transport
    const offscreen = document.createElement('canvas');
    offscreen.width = 320;
    offscreen.height = 240;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(video, 0, 0, 320, 240);

    const base64Data = offscreen.toDataURL('image/jpeg', 0.82);

    // Update FPS calculation
    const now = Date.now();
    const dt = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    if (dt > 0) {
      fpsBufferRef.current.push(1000 / dt);
      if (fpsBufferRef.current.length > 10) fpsBufferRef.current.shift();
      const avgFps = fpsBufferRef.current.reduce((a, b) => a + b, 0) / fpsBufferRef.current.length;
      setFps(Math.round(avgFps));
    }

    if (cooldownRef.current > 0) {
      cooldownRef.current -= 1;
    }

    isPredictingRef.current = true;
    try {
      const data = await predictSign(base64Data);
      setLatencyMs(data.latency_ms || 0);

      const landmarksDetected = data.landmarks && data.landmarks.length >= 21;
      setHasHand(landmarksDetected);

      // Render neon skeleton on canvas overlay
      if (landmarksDetected) {
        drawSkeleton(data.landmarks, w, h);
      } else {
        clearCanvas();
      }

      // Detection results
      const detectedLabel = data.prediction || null;
      const detectedProbVal = data.confidence || 0;
      setActiveSign(detectedLabel);
      setActiveProb(detectedProbVal);
      setDetectionTier(data.tier || null);

      // -----------------------------------------------------------
      // FR-05: Signal Jitter Hysteresis Buffer (N=10)
      // -----------------------------------------------------------
      const buffer = historyBufferRef.current;
      buffer.push(detectedLabel);
      if (buffer.length > WINDOW_SIZE_N) buffer.shift();

      // Compute majority consensus
      const counts = {};
      buffer.forEach(lbl => {
        if (lbl) counts[lbl] = (counts[lbl] || 0) + 1;
      });

      let topLabel = null;
      let topCount = 0;
      for (const [lbl, count] of Object.entries(counts)) {
        if (count > topCount) {
          topCount = count;
          topLabel = lbl;
        }
      }

      const consensus = topCount / WINDOW_SIZE_N;
      setConsensusScore(Math.round(consensus * 100));

      if (topLabel && consensus >= CONSENSUS_THRESHOLD) {
        // Hand is actively gesturing: reset silence timer
        silenceStartRef.current = null;
        setSilenceProgress(0);

        if (topLabel === lastCommittedRef.current) {
          // Same consecutive token requires cooldown to prevent multiplication
          if (cooldownRef.current === 0) {
            commitToken(topLabel);
            cooldownRef.current = COOLDOWN_TICKS;
          }
        } else {
          // Different token: commit immediately
          commitToken(topLabel);
          lastCommittedRef.current = topLabel;
          cooldownRef.current = COOLDOWN_TICKS;
        }
      }

      // -----------------------------------------------------------
      // FR-06: Silence Trigger (No hand for ~2.4s triggers sentence)
      // -----------------------------------------------------------
      if (!landmarksDetected) {
        const tokensSnapshot = latestTokensRef.current;
        if (tokensSnapshot.length > 0 && !isTranslating) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          }
          const elapsed = Date.now() - silenceStartRef.current;
          const progress = Math.min(100, Math.round((elapsed / SILENCE_TRIGGER_MS) * 100));
          setSilenceProgress(progress);

          if (elapsed >= SILENCE_TRIGGER_MS) {
            silenceStartRef.current = null;
            setSilenceProgress(0);
            triggerSentenceTranslation();
          }
        }
      } else {
        silenceStartRef.current = null;
        setSilenceProgress(0);
      }

    } catch (err) {
      console.warn('Inference error:', err);
    } finally {
      isPredictingRef.current = false;
    }
  };

  const commitToken = (word) => {
    if (!word) return;
    const cleaned = word.trim().toUpperCase();
    setCommittedTokens(prev => [...prev, cleaned]);
  };

  const handleUndoToken = () => {
    setCommittedTokens(prev => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setCommittedTokens([]);
    setDirectWords('');
    setTranslatedSentence('');
    silenceStartRef.current = null;
    setSilenceProgress(0);
    lastCommittedRef.current = null;
    cooldownRef.current = 0;
  };

  // -------------------------------------------------------------
  // FR-06: Qwen / Gemini Linguistic Translation Engine
  // -------------------------------------------------------------
  const triggerSentenceTranslation = async (tokensToTranslate = committedTokens) => {
    if (!tokensToTranslate || tokensToTranslate.length === 0 || isTranslating) return;

    setIsTranslating(true);
    try {
      const res = await translateSignTokens(tokensToTranslate);
      setDirectWords(res.direct_words || tokensToTranslate.join(', ').toLowerCase());
      const sentence = res.translated_sentence || tokensToTranslate.join(' ');
      setTranslatedSentence(sentence);

      if (autoSpeak && sentence) {
        speakAloud(sentence);
      }
    } catch {
      const fallback = tokensToTranslate.join(' ') + '.';
      setTranslatedSentence(fallback);
      if (autoSpeak) speakAloud(fallback);
    } finally {
      setIsTranslating(false);
    }
  };

  const speakAloud = (text) => {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const copyToClipboard = async (text) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  // -------------------------------------------------------------
  // Spoken-to-Signed Translation
  // -------------------------------------------------------------
  const handleTranslateText = async (text = spokenInput) => {
    if (!text.trim()) return;
    setIsTranslatingText(true);
    try {
      const res = await translateTextToSign(text, signLang);
      if (res.gloss_tokens && res.gloss_tokens.length > 0) {
        setGlossTokens(res.gloss_tokens);
      } else {
        setGlossTokens(text.trim().toUpperCase().split(/\s+/));
      }
    } catch {
      setGlossTokens(text.trim().toUpperCase().split(/\s+/));
    } finally {
      setIsTranslatingText(false);
    }
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListeningMic) {
      recognitionRef.current.stop();
      setIsListeningMic(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListeningMic(true);
      } catch {
        setIsListeningMic(false);
      }
    }
  };

  return (
    <div className="signbridge-page" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '3rem' }}>

      {/* Page Header Banner */}
      <header className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
              <span style={{ fontSize: '2rem' }}>🤟</span>
              Hand Sign Detection & Translation System
            </h1>
            <p className="page-subtitle" style={{ margin: '0.35rem 0 0' }}>
              Real-time computer vision sign translator with 3D MediaPipe hand landmarks, kinematic hysteresis, and Qwen/Gemini sentence synthesis.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Desktop App Launcher Button */}
            <button
              className="btn btn-primary"
              onClick={handleLaunchDesktop}
              disabled={desktopStatus.launching}
              style={{
                backgroundColor: '#1E3A8A',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)'
              }}
              title="Launch native Python realtime_sign_translator.py in standalone OpenCV window"
            >
              <Zap size={16} color="#FACC15" />
              <span>{desktopStatus.launching ? 'Launching...' : '⚡ Launch Native OpenCV App'}</span>
            </button>

            <button
              className="btn btn-outline"
              onClick={() => setShowDictionary(!showDictionary)}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <BookOpen size={16} />
              <span>{showDictionary ? 'Hide Guide' : 'Vocabulary Guide'}</span>
            </button>
          </div>
        </div>

        {/* Desktop Launcher Feedback Banner */}
        {desktopStatus.message && (
          <div
            style={{
              marginTop: '0.85rem',
              padding: '0.65rem 1rem',
              backgroundColor: desktopStatus.message.startsWith('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.12)',
              border: `1px solid ${desktopStatus.message.startsWith('Error') ? '#EF4444' : '#22C55E'}`,
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: desktopStatus.message.startsWith('Error') ? '#DC2626' : '#15803D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{desktopStatus.message}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tip: In Windows, stop browser webcam to avoid device lock</span>
          </div>
        )}
      </header>

      {/* Main Mode Switcher Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          marginBottom: '1.5rem'
        }}
      >
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--bg-surface-hover)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Left Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('realtime-vision')}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: activeTab === 'realtime-vision' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'realtime-vision' ? 'var(--primary-text)' : 'var(--text-color)',
                transition: 'all 0.15s ease'
              }}
            >
              <Camera size={17} />
              <span>🖐️ Hand Sign Translator (Vision)</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('spoken-to-signed');
                stopCamera();
              }}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: activeTab === 'spoken-to-signed' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'spoken-to-signed' ? 'var(--primary-text)' : 'var(--text-color)',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={17} />
              <span>🗣️ Spoken-to-Signed (3D Avatar)</span>
            </button>
          </div>

          {/* Engine Status Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: modelStatus.online ? '#22C55E' : '#EAB308',
                  display: 'inline-block'
                }}
              />
              <strong>Engine:</strong> {modelStatus.online ? 'Hybrid Kinematics + ML' : 'Checking...'}
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Gauge size={14} />
              <span>Latency Target: <strong>&lt;5.0ms</strong></span>
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: REAL-TIME HAND SIGN TRANSLATOR (PRD SPECS)          */}
        {/* ========================================================= */}
        {activeTab === 'realtime-vision' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', minHeight: '520px' }}>

            {/* LEFT PANE: Camera Capture & Live Skeleton HUD */}
            <div style={{ padding: '1.5rem', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>

              {/* Controls Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!cameraActive ? (
                    <button className="btn btn-primary" onClick={startCamera} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Camera size={16} /> Start Webcam
                    </button>
                  ) : (
                    <button className="btn btn-outline" onClick={stopCamera} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Square size={16} /> Pause Webcam
                    </button>
                  )}
                </div>

                {/* Hotkeys Prompt */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem' }}>
                  <span><kbd style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>T</kbd> Translate</span>
                  <span><kbd style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>C</kbd> Clear</span>
                  <span><kbd style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>U</kbd> Undo</span>
                </div>
              </div>

              {/* Camera Error Alert & Recovery Assistant */}
              {cameraError && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '1rem 1.25rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1.5px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                    <AlertCircle size={18} />
                    <span>{cameraError}</span>
                  </div>

                  {/* Immediate Action Buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <button className="btn btn-primary" onClick={startCamera} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <RotateCcw size={14} /> Retry Webcam
                    </button>

                    {window.location.hostname === '127.0.0.1' && (
                      <button
                        className="btn btn-outline"
                        onClick={handleSwitchToLocalhost}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: '#38BDF8', color: '#38BDF8' }}
                        title="Chrome treats localhost as a trusted secure origin and prompts fresh permission"
                      >
                        <ExternalLink size={14} /> Open on localhost:5173
                      </button>
                    )}

                    <button
                      className="btn btn-outline"
                      onClick={handleLaunchDesktop}
                      disabled={desktopStatus.launching}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: '#22C55E', color: '#22C55E' }}
                      title="Direct 30+ FPS OpenCV hardware camera window bypassing browser permissions"
                    >
                      <Zap size={14} /> {desktopStatus.launching ? 'Launching...' : '⚡ Launch Native OpenCV App'}
                    </button>

                    <button
                      className="btn btn-outline"
                      onClick={() => simulateSignPose('WATER')}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: '#A855F7', color: '#C084FC' }}
                      title="Test 3D hand skeleton & translation without camera"
                    >
                      <Sparkles size={14} /> 🎮 Use Virtual Hand Mode
                    </button>
                  </div>

                  {/* Step-by-Step Address Bar Unblock Guide */}
                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#CBD5E1', lineHeight: '1.5' }}>
                    <strong style={{ color: '#F8FAFC', display: 'block', marginBottom: '0.35rem' }}>
                      🛠️ How to Unblock Camera in Chrome / Edge (3 Quick Steps):
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <div style={{ padding: '0.45rem 0.6rem', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                        <span style={{ color: '#38BDF8', fontWeight: 700 }}>1. Click URL Icon</span>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>In the URL address bar next to <code>5173</code>, click the <strong>🔒 Lock</strong>, <strong>🎚️ Tune</strong>, or <strong>📹❌ Camera</strong> icon.</p>
                      </div>
                      <div style={{ padding: '0.45rem 0.6rem', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                        <span style={{ color: '#22C55E', fontWeight: 700 }}>2. Set to 'Allow'</span>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>Find <strong>Camera</strong> in the permissions dropdown and change it from <strong>Block</strong> to <strong>Allow</strong>.</p>
                      </div>
                      <div style={{ padding: '0.45rem 0.6rem', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                        <span style={{ color: '#FACC15', fontWeight: 700 }}>3. Reload Page</span>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>Press <kbd style={{ padding: '0.1rem 0.3rem', borderRadius: '3px', background: '#334155' }}>F5</kbd> or <kbd style={{ padding: '0.1rem 0.3rem', borderRadius: '3px', background: '#334155' }}>Ctrl+R</kbd>, then click <strong>Start Webcam</strong>.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIDEO VIEWPORT & HUD CANVAS OVERLAY */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backgroundColor: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isSimulating ? '2px solid #A855F7' : '1px solid var(--border-color)',
                  boxShadow: isSimulating ? '0 0 25px rgba(168, 85, 247, 0.25)' : 'inset 0 2px 10px rgba(0,0,0,0.5)'
                }}
              >
                {/* Mirror video for natural gesture view */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    display: 'block',
                    opacity: cameraActive ? 1 : 0,
                    pointerEvents: cameraActive ? 'auto' : 'none',
                    transition: 'opacity 0.2s ease'
                  }}
                />

                {/* Canvas Overlay for 21 Skeleton Landmarks (Mirrored) */}
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    transform: 'scaleX(-1)'
                  }}
                />

                {/* Simulation Mode Floating Tag */}
                {isSimulating && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      padding: '0.35rem 0.75rem',
                      backgroundColor: 'rgba(147, 51, 234, 0.9)',
                      color: '#FFF',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      backdropFilter: 'blur(8px)',
                      zIndex: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    }}
                  >
                    <Sparkles size={14} /> Virtual Hand Simulator Active ({activeSimSign || 'Ready'})
                  </div>
                )}

                {/* Standby Message */}
                {!cameraActive && !isSimulating && (
                  <div style={{ position: 'absolute', textAlign: 'center', color: '#94A3B8', padding: '1.5rem', zIndex: 5 }}>
                    <Camera size={48} style={{ opacity: 0.4, margin: '0 auto 0.75rem' }} />
                    <p style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 700, color: '#F8FAFC' }}>
                      Ready for Hand Sign Translation
                    </p>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94A3B8' }}>
                      Start your camera or use the virtual 3D hand simulator below to test signs that work.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" onClick={startCamera} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
                        <Camera size={15} style={{ marginRight: '0.35rem' }} /> Start Webcam
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => simulateSignPose('WATER')}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem', borderColor: '#A855F7', color: '#C084FC' }}
                      >
                        <Sparkles size={15} style={{ marginRight: '0.35rem' }} /> Test with Virtual Hand
                      </button>
                    </div>
                  </div>
                )}

                {/* TOP TELEMETRY HUD BAR (FR-01, FR-04) */}
                {(cameraActive || isSimulating) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      right: '10px',
                      padding: '0.4rem 0.85rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.82)',
                      borderRadius: '10px',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#F8FAFC',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      zIndex: 10
                    }}
                  >
                    <span style={{ color: '#38BDF8', fontWeight: 800 }}>
                      BREAKING BARIERS &mdash; {isSimulating ? 'Virtual Hand 3D Vision' : 'Live Sign Vision'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <span>FPS: <strong style={{ color: fps >= 25 ? '#22C55E' : '#FACC15' }}>{fps}</strong></span>
                      <span>Latency: <strong style={{ color: '#38BDF8' }}>{latencyMs}ms</strong></span>
                      <span>Consensus: <strong style={{ color: consensusScore >= 70 ? '#22C55E' : '#94A3B8' }}>{consensusScore}%</strong></span>
                    </div>
                  </div>
                )}

                {/* ACTIVE DETECTED SIGN CARD (HUD Bottom Left) */}
                {(cameraActive || isSimulating) && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.92)',
                      border: activeSign ? '1.5px solid #22C55E' : '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '10px',
                      padding: '0.5rem 0.9rem',
                      color: '#FFF',
                      backdropFilter: 'blur(8px)',
                      zIndex: 10,
                      minWidth: '180px'
                    }}
                  >
                    {hasHand ? (
                      activeSign ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                              Active Sign
                            </span>
                            {detectionTier && (
                              <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                {detectionTier}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#22C55E', margin: '0.1rem 0' }}>
                            {activeSign}
                          </div>
                          {/* Confidence Progress Bar */}
                          <div style={{ width: '100%', height: '5px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden', marginTop: '0.2rem' }}>
                            <div
                              style={{
                                width: `${Math.round(activeProb * 100)}%`,
                                height: '100%',
                                backgroundColor: activeProb >= 0.75 ? '#22C55E' : '#FACC15',
                                transition: 'width 0.15s ease'
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem', textAlign: 'right' }}>
                            {(activeProb * 100).toFixed(0)}% Confidence
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: '#E2E8F0', fontWeight: 600 }}>
                          ✋ Hand Detected (Hold sign steady)
                        </div>
                      )
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                        No Hand Detected
                      </div>
                    )}
                  </div>
                )}

                {/* SILENCE TRIGGER COUNTDOWN PROGRESS BAR (FR-06) */}
                {(cameraActive || isSimulating) && silenceProgress > 0 && committedTokens.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.92)',
                      border: '1.5px solid #F97316',
                      borderRadius: '10px',
                      padding: '0.45rem 0.85rem',
                      color: '#FFF',
                      backdropFilter: 'blur(8px)',
                      zIndex: 10,
                      maxWidth: '220px'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#F97316', fontWeight: 800 }}>
                      ⏳ SILENCE TRIGGER
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#E2E8F0', margin: '0.2rem 0' }}>
                      Auto-translating in {((SILENCE_TRIGGER_MS * (100 - silenceProgress)) / 100000).toFixed(1)}s
                    </div>
                    <div style={{ width: '100%', height: '4px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${silenceProgress}%`,
                          height: '100%',
                          backgroundColor: '#F97316',
                          transition: 'width 0.1s linear'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SIGNS THAT WORK (VERIFIED GESTURE SHOWCASE & PRACTICE DECK) */}
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} style={{ color: '#22C55E' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-color)' }}>
                      Signs That Work (10 Verified Real-Time Hand Signs)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Click '⚡ Test' to simulate 3D skeleton & translate instantly
                  </span>
                </div>

                {/* Quick Practice Story Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Sample Phrases:
                  </span>
                  <button
                    onClick={() => runPracticeStory(['I', 'WANT', 'WATER'])}
                    className="btn btn-outline"
                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', borderRadius: '6px', borderColor: '#38BDF8', color: '#38BDF8' }}
                  >
                    🗣️ "I Want Water"
                  </button>
                  <button
                    onClick={() => runPracticeStory(['HELLO', 'THANK YOU'])}
                    className="btn btn-outline"
                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', borderRadius: '6px', borderColor: '#22C55E', color: '#22C55E' }}
                  >
                    🗣️ "Hello, Thank You"
                  </button>
                  <button
                    onClick={() => runPracticeStory(['FOOD', 'HELP', 'EMERGENCY'])}
                    className="btn btn-outline"
                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', borderRadius: '6px', borderColor: '#F97316', color: '#F97316' }}
                  >
                    🗣️ "Food & Emergency"
                  </button>
                </div>

                {/* Verified Signs Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem' }}>
                  {CORE_VOCABULARY.map(v => (
                    <div
                      key={v.sign}
                      style={{
                        padding: '0.55rem 0.7rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: activeSign === v.sign ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: activeSign === v.sign ? '#22C55E' : 'var(--text-color)' }}>
                          {v.sign}
                        </span>
                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}>
                          {v.category}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                        {v.desc}
                      </p>
                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                        <button
                          onClick={() => simulateSignPose(v.sign)}
                          style={{
                            flex: 1,
                            padding: '0.25rem 0.45rem',
                            fontSize: '0.72rem',
                            borderRadius: '5px',
                            border: '1px solid #38BDF8',
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            color: '#38BDF8',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.2rem'
                          }}
                          title={`Test ${v.sign} with 3D landmark skeleton`}
                        >
                          ⚡ Test
                        </button>
                        <button
                          onClick={() => commitToken(v.sign)}
                          style={{
                            padding: '0.25rem 0.45rem',
                            fontSize: '0.72rem',
                            borderRadius: '5px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-surface-hover)',
                            color: 'var(--text-color)',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          title={`Direct insert ${v.sign}`}
                        >
                          + Insert
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANE: LINGUISTIC TRANSLATION OUTPUT & TOKENS (FR-06) */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)' }}>

              {/* Output Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} className="text-primary" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-color)' }}>
                    Translated Spoken Sentence:
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setAutoSpeak(p => !p)}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title={autoSpeak ? 'Disable auto voice readout' : 'Enable auto voice readout'}
                  >
                    {autoSpeak ? <Volume2 size={14} color="#16A34A" /> : <VolumeX size={14} />}
                    <span>{autoSpeak ? 'Voice: ON' : 'Voice: OFF'}</span>
                  </button>

                  <button
                    className="btn btn-outline"
                    onClick={() => speakAloud(translatedSentence || directWords)}
                    disabled={!translatedSentence && !directWords}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    title="Speak translated sentence aloud"
                  >
                    <Volume2 size={15} /> Listen
                  </button>

                  <button
                    className="btn btn-outline"
                    onClick={() => copyToClipboard(translatedSentence || directWords)}
                    disabled={!translatedSentence && !directWords}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={15} color="#16A34A" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              {/* Main Sentence Output Box */}
              <div
                style={{
                  minHeight: '140px',
                  backgroundColor: 'var(--bg-surface-hover)',
                  borderRadius: '16px',
                  border: '1.5px solid var(--border-color)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  position: 'relative'
                }}
              >
                {isTranslating ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)' }}>
                    <div style={{ width: '16px', height: '16px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      Linguistic Engine (Qwen / Gemini) translating phrase...
                    </span>
                  </div>
                ) : (translatedSentence || directWords) ? (
                  <div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-color)', lineHeight: '1.5' }}>
                      "{translatedSentence || directWords}"
                    </div>
                    {directWords && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Raw Tokens: <em>{directWords}</em>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontStyle: 'italic' }}>
                    Show hand signs in webcam, then lower your hand to auto-translate into a complete English sentence...
                  </div>
                )}
              </div>

              {/* COMMITTED SIGN TOKENS STREAM */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Recognized Sign Sequence ({committedTokens.length} tokens):
                  </span>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => triggerSentenceTranslation()}
                      disabled={committedTokens.length === 0 || isTranslating}
                      className="btn btn-primary"
                      style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Sparkles size={13} />
                      <span>Translate (T)</span>
                    </button>
                    <button
                      onClick={handleUndoToken}
                      disabled={committedTokens.length === 0}
                      className="btn btn-outline"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                    >
                      Undo (U)
                    </button>
                    <button
                      onClick={handleClearAll}
                      disabled={committedTokens.length === 0 && !translatedSentence}
                      className="btn btn-outline"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                    >
                      Clear (C)
                    </button>
                  </div>
                </div>

                {/* Token Chips Sequence Box */}
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    border: '1px dashed var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    minHeight: '68px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.45rem',
                    alignItems: 'center'
                  }}
                >
                  {committedTokens.length === 0 ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      No sign tokens captured yet. Perform gestures in camera view.
                    </span>
                  ) : (
                    committedTokens.map((token, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          backgroundColor: 'rgba(30, 58, 138, 0.1)',
                          color: '#1E3A8A',
                          border: '1.5px solid #1E3A8A',
                          padding: '0.3rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 800
                        }}
                      >
                        {token}
                        {idx < committedTokens.length - 1 && (
                          <span style={{ color: '#94A3B8', fontWeight: 400, marginLeft: '0.2rem' }}>➔</span>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {/* Feature Specs Callout */}
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-surface-hover)',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    lineHeight: '1.5',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <strong style={{ color: 'var(--text-color)' }}>PRD Architectural Highlights:</strong>
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                    <li><strong>FR-03 & FR-04:</strong> 60-element normalized 3D spatial vectors with Random Forest ML inference.</li>
                    <li><strong>FR-05:</strong> Jitter Hysteresis Rolling Buffer (N=10, &ge;70% consensus, cooldown de-duplication).</li>
                    <li><strong>FR-06:</strong> Silence trigger auto-detects lowered hand (&ge;2.4s) to initiate linguistic sentence completion.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* TAB 2: SPOKEN TO SIGNED (RYLO 3D AVATAR PLAYER)           */
          /* ========================================================= */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', minHeight: '440px' }}>
            {/* Left Pane: Text or Speech Input */}
            <div style={{ padding: '1.5rem', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Enter Spoken Words or Speak:
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {spokenInput.length} chars
                </span>
              </div>

              {/* Text Input Area */}
              <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea
                  value={spokenInput}
                  onChange={(e) => {
                    setSpokenInput(e.target.value);
                    handleTranslateText(e.target.value);
                  }}
                  placeholder="Type anything (e.g., 'Hello, thank you for your help', 'I need water please')..."
                  style={{
                    width: '100%',
                    flex: 1,
                    minHeight: '160px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    resize: 'none',
                    outline: 'none',
                    fontSize: '1.25rem',
                    lineHeight: '1.6',
                    color: 'var(--text-color)',
                    fontFamily: 'inherit'
                  }}
                />

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {micSupported && (
                      <button
                        className={`btn ${isListeningMic ? 'btn-danger' : 'btn-outline'}`}
                        onClick={toggleMic}
                        style={{
                          borderRadius: '9999px',
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        {isListeningMic ? <MicOff size={16} /> : <Mic size={16} />}
                        <span>{isListeningMic ? 'Listening...' : 'Voice Input'}</span>
                      </button>
                    )}

                    <button
                      className="btn btn-outline"
                      onClick={() => speakAloud(spokenInput)}
                      style={{ borderRadius: '9999px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                      title="Hear spoken text aloud"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>

                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setSpokenInput('');
                      setGlossTokens([]);
                    }}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Quick Sample Phrases */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Quick Suggested Phrases:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[
                    "Hello, nice to meet you",
                    "Thank you for your help",
                    "Please assist me",
                    "I would like some water",
                    "Emergency assistance needed",
                    "Goodbye, have a nice day"
                  ].map(phrase => (
                    <button
                      key={phrase}
                      onClick={() => {
                        setSpokenInput(phrase);
                        handleTranslateText(phrase);
                      }}
                      style={{
                        backgroundColor: 'var(--bg-surface-hover)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '9999px',
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        color: 'var(--text-color)'
                      }}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Animated Sign Avatar */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={16} className="text-primary" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-color)' }}>
                    {signLang} Sign Language Avatar
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {glossTokens.length} Sign Tokens
                </span>
              </div>

              <SignLanguageAvatar
                tokens={glossTokens}
                signLanguage={signLang}
              />
            </div>
          </div>
        )}
      </div>

      {/* EXPANDABLE SIGN DICTIONARY & VOCABULARY GUIDE */}
      {showDictionary && (
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} className="text-primary" />
                Hand Sign Vocabulary Guide (10 Core Signs)
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target gestures recognized by the Random Forest classifier, Google Recognizer & 3D kinematics engine.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
            {CORE_VOCABULARY.map(item => (
              <div
                key={item.sign}
                style={{
                  backgroundColor: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                    {item.sign}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                    {item.category}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {item.desc}
                </div>
                <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={() => commitToken(item.sign)}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      borderRadius: '6px',
                      border: '1px solid var(--primary)',
                      backgroundColor: 'rgba(30, 58, 138, 0.08)',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Add to Sequence
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
