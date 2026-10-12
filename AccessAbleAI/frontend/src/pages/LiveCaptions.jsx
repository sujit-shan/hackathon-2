import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Pause, Play, Copy, Trash2, Volume2, Square, Sparkles, Check, AlertCircle } from 'lucide-react';

export default function LiveCaptions() {
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(1.3);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setErrorMessage('Speech recognition is not natively supported in this browser. Try Google Chrome or Microsoft Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let newlyFinalized = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newlyFinalized += transcriptPart + ' ';
        } else {
          interim += transcriptPart;
        }
      }

      if (newlyFinalized) {
        setFinalTranscript((prev) => prev + newlyFinalized);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access denied. Please click the lock/camera icon in your browser address bar to allow microphone access.');
      } else if (event.error !== 'no-speech') {
        setErrorMessage(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if user still wants it active and not paused
      if (isListening && !isPaused) {
        try {
          recognition.start();
        } catch {
          // ignore already started
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isListening, isPaused]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    setErrorMessage('');

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsPaused(false);
      setInterimTranscript('');
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setIsPaused(false);
      } catch (err) {
        setErrorMessage('Could not start microphone. Check browser permissions.');
      }
    }
  };

  const togglePause = () => {
    if (!recognitionRef.current) return;
    if (isPaused) {
      try {
        recognitionRef.current.start();
        setIsPaused(false);
        setIsListening(true);
      } catch {}
    } else {
      try {
        recognitionRef.current.stop();
        setIsPaused(true);
      } catch {}
    }
  };

  const handleCopy = async () => {
    const textToCopy = (finalTranscript + ' ' + interimTranscript).trim();
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Failed to copy to clipboard.');
    }
  };

  const handleClear = () => {
    setFinalTranscript('');
    setInterimTranscript('');
  };

  const speakTranscript = () => {
    const textToSpeak = finalTranscript.trim();
    if (!textToSpeak) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(textToSpeak);
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <div className="live-captions-page">
      <header className="page-header">
        <h1 className="page-title">
          <Mic className="text-primary" size={36} aria-hidden="true" />
          Live Captions & Speech-to-Text
        </h1>
        <p className="page-subtitle">
          Real-time spoken conversation transcription designed for deaf, hard-of-hearing, and speech-impaired individuals. Large text, instant review, and export.
        </p>
      </header>

      {/* Main Control Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'} btn-large`}
            onClick={toggleListening}
            disabled={!speechSupported}
            aria-label={isListening ? 'Stop listening to microphone' : 'Start listening to microphone'}
          >
            {isListening ? (
              <>
                <MicOff size={22} aria-hidden="true" /> Stop Captions
              </>
            ) : (
              <>
                <Mic size={22} aria-hidden="true" /> Start Listening
              </>
            )}
          </button>

          {isListening && (
            <button
              className="btn btn-outline"
              onClick={togglePause}
              aria-label={isPaused ? 'Resume transcription' : 'Pause transcription'}
            >
              {isPaused ? (
                <>
                  <Play size={18} aria-hidden="true" /> Resume
                </>
              ) : (
                <>
                  <Pause size={18} aria-hidden="true" /> Pause
                </>
              )}
            </button>
          )}

          <button
            className="btn btn-outline"
            onClick={handleCopy}
            disabled={!finalTranscript.trim() && !interimTranscript.trim()}
            aria-label="Copy caption transcript to clipboard"
          >
            {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            className="btn btn-outline"
            onClick={handleClear}
            disabled={!finalTranscript && !interimTranscript}
            aria-label="Clear all captions"
          >
            <Trash2 size={18} aria-hidden="true" /> Clear
          </button>
        </div>

        {/* Text Scaling Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label htmlFor="caption-size-slider" style={{ fontSize: '0.9rem' }}>Caption Size:</label>
          <input
            id="caption-size-slider"
            type="range"
            min="1.0"
            max="2.2"
            step="0.1"
            value={fontSize}
            onChange={(e) => setFontSize(parseFloat(e.target.value))}
            style={{ width: '130px' }}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{Math.round(fontSize * 100)}%</span>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div 
          style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--danger-bg)', 
            color: 'var(--danger-text)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 600
          }}
          role="alert"
        >
          <AlertCircle size={20} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Live Listening Status Banner */}
      {isListening && (
        <div 
          style={{ 
            padding: '0.75rem 1.25rem', 
            backgroundColor: isPaused ? 'var(--warning-bg)' : 'var(--success-bg)', 
            color: isPaused ? 'var(--warning-text)' : 'var(--success-text)', 
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 700
          }}
          role="status"
          aria-live="polite"
        >
          <span 
            style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: isPaused ? '#EAB308' : '#22C55E',
              display: 'inline-block' 
            }} 
          />
          <span>{isPaused ? 'Captions Paused' : 'Listening for voices... Speak clearly into your microphone.'}</span>
        </div>
      )}

      {/* Main High-Legibility Captions Board */}
      <div className="card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '2px solid var(--border-color)' }}>
        <div>
          <label htmlFor="editable-caption-area" style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
            Live Caption Stream (Editable):
          </label>
          <textarea
            id="editable-caption-area"
            value={finalTranscript}
            onChange={(e) => setFinalTranscript(e.target.value)}
            placeholder="Press 'Start Listening' and speak into your microphone. Words spoken around you will appear here in real time with high visibility..."
            style={{ 
              fontSize: `${fontSize}rem`, 
              lineHeight: '1.8', 
              minHeight: '260px', 
              border: 'none', 
              outline: 'none',
              padding: '0.5rem',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              width: '100%'
            }}
          />

          {interimTranscript && (
            <div 
              style={{ 
                padding: '0.5rem', 
                fontSize: `${fontSize}rem`, 
                color: 'var(--color-teal)', 
                fontStyle: 'italic',
                borderTop: '1px dashed var(--border-color)',
                marginTop: '0.5rem'
              }}
              aria-live="polite"
            >
              <Sparkles size={16} style={{ display: 'inline', marginRight: '6px' }} />
              {interimTranscript}...
            </div>
          )}
        </div>

        {/* Read Aloud / Review footer */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-outline"
            onClick={speakTranscript}
            disabled={!finalTranscript.trim()}
            aria-label="Read captured captions aloud"
          >
            <Volume2 size={18} aria-hidden="true" /> Read Aloud
          </button>
          <button
            className="btn btn-outline"
            onClick={stopSpeech}
            aria-label="Stop speech playback"
          >
            <Square size={18} aria-hidden="true" /> Stop
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {finalTranscript.trim() ? `${finalTranscript.trim().split(/\s+/).length} words transcribed` : 'Ready to capture'}
          </span>
        </div>
      </div>
    </div>
  );
}
