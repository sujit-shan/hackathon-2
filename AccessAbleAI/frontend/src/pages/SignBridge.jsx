import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Play, Pause, Plus, RotateCcw, Volume2, Square, 
  Copy, Check, AlertCircle, CheckCircle, RefreshCw, Sparkles, Cpu
} from 'lucide-react';
import { checkSignBridgeStatus, predictSign, translateSignTokens } from '../services/api';

export default function SignBridge() {
  const [modelStatus, setModelStatus] = useState({ online: false, checking: true, qwenOnline: false });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [confidence, setConfidence] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Transcript states
  const [transcriptWords, setTranscriptWords] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [directWords, setDirectWords] = useState('');
  const [improvedMessage, setImprovedMessage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const lastAddedRef = useRef({ word: '', time: 0 });

  const checkService = async () => {
    setModelStatus({ online: false, checking: true, qwenOnline: false });
    const res = await checkSignBridgeStatus();
    setModelStatus({ 
      online: res.online, 
      checking: false, 
      qwenOnline: res.qwen_ai_online,
      numClasses: res.num_classes,
      classes: res.classes || [],
      details: res.details 
    });
  };

  useEffect(() => {
    checkService();
    return () => {
      stopCamera();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Fallback grammar synthesis (guarantees translation never fails)
  const generateGrammarFallback = (words) => {
    if (!words || words.length === 0) return '';
    const u = words.map(w => w.toUpperCase());
    if (u.includes("EMERGENCY") && u.includes("HELP")) {
      return "Emergency, I need immediate help!";
    }
    if (u.includes("FOOD") && u.includes("HELP")) {
      return "Please help me get some food.";
    }
    if (u.includes("FOOD")) {
      return "I would like some food, please.";
    }
    if (u.includes("EMERGENCY")) {
      return "Emergency assistance needed!";
    }
    if (u.includes("WATER") && (u.includes("WANT") || u.includes("I"))) {
      return "I would like some water, please.";
    }
    if (u.includes("HELP") && u.includes("I")) {
      return "Please help me.";
    }
    if (u.includes("HELP")) {
      return "Please help me.";
    }
    if (u.includes("THANK YOU") && u.length === 1) {
      return "Thank you very much.";
    }
    if (u.includes("HELLO") && u.length === 1) {
      return "Hello! Nice to meet you.";
    }
    if (u.includes("GOODBYE")) {
      return "Goodbye, have a great day!";
    }
    if (u.includes("YES") && u.includes("PLEASE")) {
      return "Yes, please.";
    }
    if (u.includes("NO") && u.includes("THANK YOU")) {
      return "No, thank you.";
    }
    const clean = words.map(w => w.toLowerCase()).join(', ');
    return clean.charAt(0).toUpperCase() + clean.slice(1) + '.';
  };

  // Intelligent translation of confirmed tokens (FR-06)
  const triggerQwenTranslation = async (words = transcriptWords) => {
    if (!words || words.length === 0) {
      setDirectWords('');
      setImprovedMessage('');
      return;
    }
    const cleanFormatted = words.map(w => w.toLowerCase()).join(', ');
    setDirectWords(cleanFormatted);

    setIsTranslating(true);
    try {
      const res = await translateSignTokens(words);
      if (res && res.direct_words) {
        setDirectWords(res.direct_words);
      }
      if (res && res.translated_sentence) {
        setImprovedMessage(res.translated_sentence);
      } else {
        setImprovedMessage(generateGrammarFallback(words));
      }
    } catch (err) {
      console.warn('[Translation Fallback]', err);
      setImprovedMessage(generateGrammarFallback(words));
    } finally {
      setIsTranslating(false);
    }
  };

  // Auto-translate when transcript tokens update (debounced)
  useEffect(() => {
    if (transcriptWords.length > 0) {
      const timer = setTimeout(() => {
        triggerQwenTranslation(transcriptWords);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setDirectWords('');
      setImprovedMessage('');
    }
  }, [transcriptWords]);

  const startCamera = async () => {
    setCameraError('');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        // Automatically start recognition loop
        setIsRecognizing(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(captureAndPredictFrame, 500);
      }
    } catch (err) {
      setCameraError('Camera access denied or unavailable. You can use manual sign token entry below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    stopRecognitionLoop();
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureAndPredictFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (isPredicting) return;

    const video = videoRef.current;
    if (video.readyState !== 4) return;

    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);

    setIsPredicting(true);
    try {
      const data = await predictSign(base64Data);
      if (data.prediction) {
        setCurrentWord(data.prediction);
        if (data.confidence !== undefined) {
          setConfidence(data.confidence);
        }
        setErrorMsg('');

        // Auto-add word to sentence if confidence is solid (>=65%)
        // Strictly add ONLY when a new different sign is formed (never repeat spam e.g. "YES, YES, YES")
        if (data.confidence >= 0.65) {
          if (lastAddedRef.current.word !== data.prediction) {
            handleAddWord(data.prediction);
          }
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Model inference error.');
    } finally {
      setIsPredicting(false);
    }
  };

  const startRecognitionLoop = () => {
    if (!cameraActive) {
      alert('Please start the webcam first.');
      return;
    }
    setIsRecognizing(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(captureAndPredictFrame, 500);
  };

  const stopRecognitionLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecognizing(false);
  };

  const handleAddWord = (word = currentWord) => {
    if (!word || !word.trim()) return;
    const cleaned = word.trim().toUpperCase();
    setTranscriptWords(prev => {
      // Prevent consecutive duplicates
      if (prev.length > 0 && prev[prev.length - 1] === cleaned) return prev;
      return [...prev, cleaned];
    });
    lastAddedRef.current = { word: cleaned, time: Date.now() };
    setCurrentWord('');
    setConfidence(null);
  };

  const handleUndoWord = () => {
    setTranscriptWords(prev => prev.slice(0, -1));
  };

  const handleClearTranscript = () => {
    setTranscriptWords([]);
    setImprovedMessage('');
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleAddWord(manualInput);
    setManualInput('');
  };

  const speakMessage = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const copyTranscript = async (text) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="signbridge-page">
      <header className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">
          <Camera className="text-primary" size={36} aria-hidden="true" />
          SignBridge AI — Real-Time Sign Detection & Translation
        </h1>
        <p className="page-subtitle">
          Real-time hand sign recognition and intelligent sentence synthesis for accessible, fluid communication.
        </p>
      </header>

      {/* Eye Tracking Switch Banner */}
      <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1.25rem', backgroundColor: 'rgba(79, 70, 229, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>👁️</span>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>Prefer Hands-Free Eye Tracking & Blink Typing?</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Look at cards and blink to type words like <strong>"THANK YOU"</strong> without using your hands!</div>
          </div>
        </div>
        <a 
          href="#gazebridge"
          className="btn btn-primary"
          style={{ minHeight: '36px', padding: '0.3rem 0.85rem', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          onClick={(e) => {
            e.preventDefault();
            // Click GazeBridge nav button
            const navBtn = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('GazeBridge'));
            if (navBtn) navBtn.click();
          }}
        >
          Open GazeBridge AI (Eye Typing) ➡️
        </a>
      </div>

      {/* Target Vocabulary Chips & Gesture Cheatsheet */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Supported Gesture Guide & Quick Add:
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
            Click any chip to add or perform the hand posture for the camera
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.65rem' }}>
          {[
            { sign: "FOOD", posture: "🍲 Flat-O (Fingertips touching thumb)" },
            { sign: "EMERGENCY", posture: "🚨 Thumb & Pinky Up (Call / Alert)" },
            { sign: "THANK YOU", posture: "🙏 Flat Hand (fingers together)" },
            { sign: "HELP", posture: "🆘 Thumbs Up over flat palm" },
            { sign: "WATER", posture: "💧 'W' Sign (Index, Middle, Ring UP)" },
            { sign: "HELLO", posture: "🖐️ Open Palm (all 5 fingers up)" },
            { sign: "YES", posture: "👍 Thumbs Up or ✊ Fist" },
            { sign: "NO", posture: "🤏 3-Finger Pinch or 👎 Thumb Down" },
            { sign: "I", posture: "☝️ Point Up or 🤙 Pinky Up" },
            { sign: "PLEASE", posture: "✨ Flat Hand on chest" },
            { sign: "GOODBYE", posture: "👋 Wave open palm" },
          ].map((item) => (
            <button
              key={item.sign}
              onClick={() => handleAddWord(item.sign)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-main)',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem'
              }}
              title={`Click to add ${item.sign} or make this posture`}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>+ {item.sign}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.posture}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Card: Camera & Recognition */}
        <div className="card">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={22} className="text-primary" /> 1. Webcam Sign Capture
          </h2>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {!cameraActive ? (
              <button className="btn btn-primary" onClick={startCamera}>
                <Camera size={18} aria-hidden="true" /> Start Camera
              </button>
            ) : (
              <button className="btn btn-outline" onClick={stopCamera}>
                <Square size={18} aria-hidden="true" /> Stop Camera
              </button>
            )}

            {cameraActive && (
              !isRecognizing ? (
                <button className="btn btn-primary" onClick={startRecognitionLoop}>
                  <Play size={18} aria-hidden="true" /> Start Real-Time Tracking
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stopRecognitionLoop}>
                  <Pause size={18} aria-hidden="true" /> Pause Tracking
                </button>
              )
            )}

            {cameraActive && !isRecognizing && (
              <button className="btn btn-outline" onClick={captureAndPredictFrame} disabled={isPredicting}>
                Recognize Single Frame
              </button>
            )}
          </div>

          {cameraError && (
            <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontWeight: 600 }}>{cameraError}</div>
          )}

          {/* Video Preview */}
          <div style={{ position: 'relative', backgroundColor: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', maxWidth: '440px', display: cameraActive ? 'block' : 'none' }} 
            />

            {!cameraActive && (
              <p style={{ color: '#9CA3AF' }}>Camera is inactive. Click "Start Camera" to begin.</p>
            )}
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Prediction Output & Confirmation Card */}
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '2px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Latest Detected Sign:</span>
              {isPredicting && <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>Inferencing (&lt;5ms)...</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                {currentWord ? currentWord : <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>[No sign detected]</span>}
              </span>
              {confidence !== null && (
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: confidence >= 0.75 ? '#16A34A' : '#CA8A04' }}>
                  ({Math.round(confidence * 100)}% Confidence)
                </span>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={() => handleAddWord(currentWord)} disabled={!currentWord}>
                <Plus size={18} aria-hidden="true" /> Add Sign to Sentence
              </button>
              <button className="btn btn-outline" onClick={() => { setCurrentWord(''); setConfidence(null); }} disabled={!currentWord}>
                Dismiss
              </button>
            </div>
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--danger)', marginTop: '0.75rem', fontSize: '0.9rem' }}>{errorMsg}</div>
          )}
        </div>

        {/* Right Card: Staged Transcript & Clean Word Output */}
        <div className="card">
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={22} className="text-primary" /> 2. Communicated Output & Speech
          </h2>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <input 
              type="text" 
              value={manualInput} 
              onChange={(e) => setManualInput(e.target.value)} 
              placeholder="Add sign token (e.g. FOOD, EMERGENCY, HELP, WATER)..." 
            />
            <button type="submit" className="btn btn-outline" style={{ minWidth: '80px' }}>
              Add
            </button>
          </form>

          {/* Staged Words List */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Captured Sign Sequence ({transcriptWords.length}):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline" style={{ minHeight: '32px', padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} onClick={handleUndoWord} disabled={transcriptWords.length === 0}>
                  <RotateCcw size={12} aria-hidden="true" /> Undo Last
                </button>
                <button className="btn btn-outline" style={{ minHeight: '32px', padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} onClick={handleClearTranscript} disabled={transcriptWords.length === 0}>
                  Clear All
                </button>
              </div>
            </div>

            <div style={{ minHeight: '52px', padding: '0.75rem', backgroundColor: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              {transcriptWords.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Recognized signs appear here in sequence.</span>
              ) : (
                transcriptWords.map((w, idx) => (
                  <span key={idx} style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 700 }}>
                    {w}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Communicated Message Output (Clean Words, No Stuttering) */}
          <div style={{ 
            padding: '1.25rem', 
            backgroundColor: 'var(--bg-surface-hover)', 
            borderRadius: 'var(--radius-md)', 
            border: '2px solid var(--primary)',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={14} /> Communicated Message (Clean Words):
              </div>
              <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 700 }}>
                ✓ Clean &amp; Deduplicated
              </span>
            </div>

            {/* Direct comma-separated keywords: e.g. "food, emergency, thank you, help" */}
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', minHeight: '40px', letterSpacing: '0.01em' }}>
              {directWords ? (
                directWords
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                  Signs translate to clean words (e.g. food, emergency, thank you, help)...
                </span>
              )}
            </div>

            {/* Optional Fluent Sentence */}
            {improvedMessage && improvedMessage.toLowerCase() !== directWords.toLowerCase() && (
              <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 600 }}>Fluent Synthesis:</span> "{improvedMessage}"
              </div>
            )}
          </div>

          {/* Speech Synthesis & Copy Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => speakMessage(directWords || improvedMessage || transcriptWords.map(w => w.toLowerCase()).join(', '))} disabled={!directWords && transcriptWords.length === 0} style={{ flex: 1, minHeight: '44px' }}>
              <Volume2 size={18} aria-hidden="true" /> Read Aloud (Speak)
            </button>
            <button className="btn btn-outline" onClick={stopSpeech}>
              <Square size={18} aria-hidden="true" /> Stop
            </button>
            <button className="btn btn-outline" onClick={() => copyTranscript(directWords || improvedMessage || transcriptWords.map(w => w.toLowerCase()).join(', '))} disabled={!directWords && transcriptWords.length === 0}>
              {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />} {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
