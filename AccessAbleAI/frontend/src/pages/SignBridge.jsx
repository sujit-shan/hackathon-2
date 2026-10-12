import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Play, 
  Pause, 
  Plus, 
  RotateCcw, 
  Volume2, 
  Square, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Sparkles, 
  ArrowLeftRight, 
  Mic, 
  MicOff, 
  BookOpen, 
  Layers, 
  Activity, 
  ExternalLink 
} from 'lucide-react';
import { 
  checkSignBridgeStatus, 
  predictSign, 
  translateSignTokens, 
  translateTextToSign, 
  fetchSignDictionary 
} from '../services/api';
import SignLanguageAvatar from '../components/SignLanguageAvatar';

export default function SignBridge() {
  // Mode: 'spoken-to-signed' (Rylo text/voice to sign avatar) OR 'signed-to-spoken' (camera to speech)
  const [translationMode, setTranslationMode] = useState('spoken-to-signed');

  // Languages
  const [spokenLang, setSpokenLang] = useState('en');
  const [signLang, setSignLang] = useState('ASL');

  // Spoken-to-Signed state
  const [spokenInput, setSpokenInput] = useState('Hello, thank you for your help');
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [glossTokens, setGlossTokens] = useState(['HELLO', 'THANK YOU', 'HELP']);
  const [tokensMeta, setTokensMeta] = useState([]);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  // Signed-to-Spoken camera state
  const [modelStatus, setModelStatus] = useState({ online: false, checking: true, qwenOnline: false });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [confidence, setConfidence] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Transcript states (Signed-to-Spoken)
  const [transcriptWords, setTranscriptWords] = useState([]);
  const [directWords, setDirectWords] = useState('');
  const [improvedMessage, setImprovedMessage] = useState('');
  const [isTranslatingSigned, setIsTranslatingSigned] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dictionary drawer
  const [showDictionary, setShowDictionary] = useState(false);
  const [dictionaryData, setDictionaryData] = useState({});

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const lastAddedRef = useRef({ word: '', time: 0 });
  const recognitionRef = useRef(null);

  // Check backend service & dictionary
  useEffect(() => {
    checkService();
    loadDictionary();

    // Setup speech recognition if available
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

    return () => {
      stopCamera();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

  const loadDictionary = async () => {
    const data = await fetchSignDictionary();
    if (data.signs) {
      setDictionaryData(data.signs);
    }
  };

  // Toggle Microphone
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

  // Translate spoken text to sign language gloss sequence
  const handleTranslateText = async (textToTranslate = spokenInput) => {
    if (!textToTranslate.trim()) return;
    setIsTranslatingText(true);
    try {
      const res = await translateTextToSign(textToTranslate, signLang);
      if (res.gloss_tokens && res.gloss_tokens.length > 0) {
        setGlossTokens(res.gloss_tokens);
        setTokensMeta(res.tokens_meta || []);
      } else {
        const fallback = textToTranslate.trim().toUpperCase().split(/\s+/);
        setGlossTokens(fallback);
      }
    } catch {
      const fallback = textToTranslate.trim().toUpperCase().split(/\s+/);
      setGlossTokens(fallback);
    } finally {
      setIsTranslatingText(false);
    }
  };

  // Flip translation direction (⇄ Rylo swap)
  const handleSwapDirection = () => {
    if (translationMode === 'spoken-to-signed') {
      setTranslationMode('signed-to-spoken');
    } else {
      setTranslationMode('spoken-to-signed');
      stopCamera();
    }
  };

  // -------------------------------------------------------------
  // Signed-to-Spoken Camera Logic
  // -------------------------------------------------------------
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
        setIsRecognizing(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(captureAndPredictFrame, 500);
      }
    } catch {
      setCameraError('Camera access denied or unavailable. Please enable permissions.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecognizing(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureAndPredictFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isPredicting) return;
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
        if (data.confidence !== undefined) setConfidence(data.confidence);
        setErrorMsg('');

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

  const handleAddWord = (word = currentWord) => {
    if (!word || !word.trim()) return;
    const cleaned = word.trim().toUpperCase();
    setTranscriptWords(prev => {
      if (prev.length > 0 && prev[prev.length - 1] === cleaned) return prev;
      return [...prev, cleaned];
    });
    lastAddedRef.current = { word: cleaned, time: Date.now() };
    setCurrentWord('');
    setConfidence(null);
  };

  const handleUndoWord = () => setTranscriptWords(prev => prev.slice(0, -1));
  const handleClearTranscript = () => {
    setTranscriptWords([]);
    setImprovedMessage('');
  };

  // Synthesize transcript into fluent sentence
  const triggerTranslation = async (words = transcriptWords) => {
    if (!words || words.length === 0) {
      setImprovedMessage('');
      setDirectWords('');
      return;
    }
    setIsTranslatingSigned(true);
    try {
      const res = await translateSignTokens(words);
      setDirectWords(res.direct_words || words.join(', '));
      setImprovedMessage(res.translated_sentence || res.direct_words);
    } catch {
      setImprovedMessage(words.join(' '));
    } finally {
      setIsTranslatingSigned(false);
    }
  };

  useEffect(() => {
    if (transcriptWords.length > 0) {
      triggerTranslation(transcriptWords);
    } else {
      setImprovedMessage('');
      setDirectWords('');
    }
  }, [transcriptWords]);

  const speakMessage = (text) => {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
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
    <div className="signbridge-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <header className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <span style={{ fontSize: '1.8rem' }}>🤟</span>
              SignBridge Translator
            </h1>
            <p className="page-subtitle" style={{ margin: '0.25rem 0 0' }}>
              Bidirectional sign language translation inspired by Rylo Translate (sign.mt) research.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-outline"
              onClick={() => setShowDictionary(!showDictionary)}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <BookOpen size={16} />
              <span>{showDictionary ? 'Hide Sign Guide' : 'Sign Dictionary'}</span>
            </button>

            <a 
              href="https://rylo.com/sign/translate/" 
              target="_blank" 
              rel="noreferrer"
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}
              title="View original Rylo Translate / sign.mt research"
            >
              <span>Rylo Research</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </header>

      {/* Main Rylo-Style Translation Card Container */}
      <div 
        className="translation-card"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          marginBottom: '1.5rem'
        }}
      >
        {/* Card Header: Language Selectors and Swap Button */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            padding: '0.85rem 1.5rem',
            backgroundColor: 'var(--bg-surface-hover)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Left Language Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {translationMode === 'spoken-to-signed' ? 'Spoken Language:' : 'Sign Language:'}
            </span>

            {translationMode === 'spoken-to-signed' ? (
              <select
                value={spokenLang}
                onChange={(e) => setSpokenLang(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.35rem 0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Spanish</option>
                <option value="hi">🇮🇳 Hindi</option>
                <option value="fr">🇫🇷 French</option>
                <option value="de">🇩🇪 German</option>
              </select>
            ) : (
              <select
                value={signLang}
                onChange={(e) => setSignLang(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.35rem 0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="ASL">🇺🇸 American Sign Language (ASL)</option>
                <option value="ISL">🇮🇳 Indian Sign Language (ISL)</option>
                <option value="BSL">🇬🇧 British Sign Language (BSL)</option>
                <option value="IS">🌐 International Sign (IS)</option>
              </select>
            )}
          </div>

          {/* Central Swap Direction Button */}
          <button
            className="btn btn-outline"
            onClick={handleSwapDirection}
            style={{
              borderRadius: '9999px',
              padding: '0.45rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-surface)',
              border: '2px solid var(--primary)',
              color: 'var(--primary)',
              boxShadow: '0 2px 10px rgba(79, 70, 229, 0.15)'
            }}
            title="Swap translation direction (Spoken to Signed ⇄ Signed to Spoken)"
          >
            <ArrowLeftRight size={16} />
            <span>{translationMode === 'spoken-to-signed' ? 'Spoken ➔ Sign Avatar' : 'Webcam Sign ➔ Speech'}</span>
          </button>

          {/* Right Language Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {translationMode === 'spoken-to-signed' ? 'Sign Language Output:' : 'Spoken Speech Output:'}
            </span>

            {translationMode === 'spoken-to-signed' ? (
              <select
                value={signLang}
                onChange={(e) => setSignLang(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.35rem 0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="ASL">🇺🇸 American Sign Language (ASL)</option>
                <option value="ISL">🇮🇳 Indian Sign Language (ISL)</option>
                <option value="BSL">🇬🇧 British Sign Language (BSL)</option>
                <option value="IS">🌐 International Sign (IS)</option>
              </select>
            ) : (
              <select
                value={spokenLang}
                onChange={(e) => setSpokenLang(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.35rem 0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Spanish</option>
                <option value="hi">🇮🇳 Hindi</option>
              </select>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODE 1: Spoken to Signed (Rylo Text/Voice -> Avatar)       */}
        {/* ========================================================= */}
        {translationMode === 'spoken-to-signed' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', minHeight: '440px' }}>
            {/* Left Pane: Spoken Language Input */}
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

                {/* Microphone & Clear Actions */}
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
                        title={isListeningMic ? 'Listening... click to stop' : 'Click to speak using microphone'}
                      >
                        {isListeningMic ? <MicOff size={16} /> : <Mic size={16} />}
                        <span>{isListeningMic ? 'Listening...' : 'Voice Input'}</span>
                      </button>
                    )}

                    <button
                      className="btn btn-outline"
                      onClick={() => speakMessage(spokenInput)}
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
                    "I love you",
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
                        color: 'var(--text-color)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Sign Language Animated Avatar & Pose Output */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={16} className="text-primary" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {signLang} Sign Language Avatar
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {glossTokens.length} Sign Tokens
                </span>
              </div>

              {/* Real-time 60 FPS Canvas Avatar Player */}
              <SignLanguageAvatar
                tokens={glossTokens}
                signLanguage={signLang}
              />
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MODE 2: Signed to Spoken (Webcam Sign Recognition)        */
          /* ========================================================= */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', minHeight: '440px' }}>
            {/* Left Pane: Camera Capture */}
            <div style={{ padding: '1.5rem', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Webcam Sign Language Detection:
                </span>
                <span style={{ fontSize: '0.75rem', color: modelStatus.online ? '#16A34A' : 'var(--text-muted)', fontWeight: 700 }}>
                  ● {modelStatus.online ? 'Model Ready' : 'Initializing'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {!cameraActive ? (
                  <button className="btn btn-primary" onClick={startCamera}>
                    <Camera size={16} /> Start Webcam
                  </button>
                ) : (
                  <button className="btn btn-outline" onClick={stopCamera}>
                    <Square size={16} /> Stop Webcam
                  </button>
                )}
              </div>

              {/* Video & Hidden Canvas */}
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
                  border: '1px solid var(--border-color)'
                }}
              >
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {!cameraActive && (
                  <div style={{ position: 'absolute', textAlign: 'center', color: '#94A3B8', padding: '1rem' }}>
                    <Camera size={44} style={{ opacity: 0.4, margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Click 'Start Webcam' to recognize sign gestures</p>
                  </div>
                )}

                {/* Live Prediction Overlay */}
                {cameraActive && currentWord && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                      border: '1.5px solid #16A34A',
                      borderRadius: '8px',
                      padding: '0.4rem 0.85rem',
                      color: '#FFF',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      backdropFilter: 'blur(8px)'
                    }}
                  >
                    Detected: <span style={{ color: '#16A34A' }}>{currentWord}</span> {confidence && `(${(confidence * 100).toFixed(0)}%)`}
                  </div>
                )}
              </div>

              {/* Quick Sign Token Chips */}
              <div style={{ marginTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Quick Add Gestures:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                  {["HELLO", "THANK YOU", "HELP", "WATER", "FOOD", "YES", "NO", "PLEASE", "EMERGENCY"].map(w => (
                    <button
                      key={w}
                      onClick={() => handleAddWord(w)}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-surface)',
                        cursor: 'pointer'
                      }}
                    >
                      + {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Speech Synthesis Output */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Synthesized Spoken Sentence:
                </span>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => speakMessage(improvedMessage || directWords)}
                    disabled={!improvedMessage && !directWords}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  >
                    <Volume2 size={15} /> Listen
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => copyTranscript(improvedMessage || directWords)}
                    disabled={!improvedMessage && !directWords}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  >
                    {copied ? <Check size={15} color="#16A34A" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              {/* Main Sentence Output Box */}
              <div 
                style={{
                  flex: 1,
                  minHeight: '140px',
                  backgroundColor: 'var(--bg-surface-hover)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: (improvedMessage || directWords) ? 'var(--text-main)' : 'var(--text-muted)',
                  lineHeight: '1.6'
                }}
              >
                {(improvedMessage || directWords) || "Form sign gestures with your webcam to generate spoken sentences..."}
              </div>

              {/* Token Queue */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Recognized Sign Sequence:
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={handleUndoWord} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem' }}>Undo</button>
                    <button onClick={handleClearTranscript} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>Clear</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '36px' }}>
                  {transcriptWords.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No signs added yet.</span>
                  ) : (
                    transcriptWords.map((w, idx) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: 'rgba(79, 70, 229, 0.12)',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}
                      >
                        {w}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expandable Sign Dictionary Cheatsheet Drawer */}
      {showDictionary && (
        <section 
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={18} className="text-primary" />
              Sign Language Dictionary & Pose Glossary
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any sign to preview on the avatar
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(dictionaryData).map(([sign, info]) => (
              <button
                key={sign}
                onClick={() => {
                  setSpokenInput(sign);
                  setGlossTokens([sign]);
                  setTranslationMode('spoken-to-signed');
                  window.scrollTo({ top: 100, behavior: 'smooth' });
                }}
                style={{
                  backgroundColor: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>{sign}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {info.category || 'General'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{info.meaning || 'Sign gesture'}</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
