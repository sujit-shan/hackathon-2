import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { Eye, Upload, Trash2, Volume2, Square, RotateCcw, Copy, Check, Info } from 'lucide-react';

export default function VisionMate() {
  const [imageSrc, setImageSrc] = useState(null);
  const [text, setText] = useState('');
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(1.15);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setText('');
      runOCR(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const runOCR = async (imageSource) => {
    setIsProcessing(true);
    setProgress(0);
    setStatusText('Initializing OCR engine...');
    setErrorMsg('');

    try {
      const worker = await Tesseract.createWorker('eng');
      
      setStatusText('Processing image & analyzing text...');
      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const extracted = ret.data.text.trim();
      if (!extracted) {
        setErrorMsg('No readable text detected in this image. Please upload an image with clearer or larger text.');
        setStatusText('Recognition complete (0 words found).');
      } else {
        setText(extracted);
        setStatusText('Recognition complete. Review text below.');
      }
    } catch (err) {
      setErrorMsg('Failed to process image. Please try an image with clearer lighting and higher contrast.');
      setStatusText('Recognition failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const copyText = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const clearAll = () => {
    stopSpeech();
    setImageSrc(null);
    setText('');
    setProgress(0);
    setStatusText('');
    setErrorMsg('');
  };

  return (
    <div className="visionmate-page">
      <header className="page-header">
        <h1 className="page-title">
          <Eye className="text-primary" size={36} aria-hidden="true" />
          VisionMate — Visual OCR & Document Reader
        </h1>
        <p className="page-subtitle">
          Extract text from photos, documents, prescription labels, and signs using client-side OCR. Review the extracted words and hear them spoken aloud with speech synthesis.
        </p>
      </header>

      {/* Input controls card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>1. Choose Document Image</h2>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Upload size={18} aria-hidden="true" /> Upload Image File
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }}
              aria-label="Upload image from computer"
            />
          </label>

          {(imageSrc || text) && (
            <button className="btn btn-outline" onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trash2 size={18} aria-hidden="true" /> Clear All
            </button>
          )}
        </div>

        {imageSrc && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <img 
              src={imageSrc} 
              alt="Selected document for OCR extraction" 
              style={{ maxHeight: '240px', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}
            />
            {isProcessing && (
              <div style={{ flex: 1, minWidth: '220px' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{statusText}</p>
                <div style={{ width: '100%', height: '14px', backgroundColor: 'var(--border-color)', borderRadius: '7px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.2s ease' }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progress: {progress}%</span>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ color: 'var(--danger)', marginTop: '1rem', fontWeight: 600 }}>{errorMsg}</div>
        )}
      </div>

      {/* Extracted Text & Speech Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>2. Extracted Text & Speech Controls</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label htmlFor="ocr-font-size" style={{ fontSize: '0.9rem' }}>Text Size:</label>
            <input 
              id="ocr-font-size"
              type="range" 
              min="0.9" 
              max="2.0" 
              step="0.1" 
              value={fontSize} 
              onChange={(e) => setFontSize(parseFloat(e.target.value))}
              style={{ width: '120px' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{Math.round(fontSize * 100)}%</span>
          </div>
        </div>

        {/* Notice disclaimer */}
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#FEF9C3', color: '#713F12', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={18} aria-hidden="true" />
          <span><strong>Machine Output Notice:</strong> This is machine-extracted text. Please review and correct any inaccuracies in the box below before speaking.</span>
        </div>

        <div className="form-group">
          <textarea
            id="ocr-result-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Extracted text will appear here. You can also paste or type text here to listen..."
            style={{ fontSize: `${fontSize}rem`, lineHeight: '1.8', minHeight: '190px' }}
          />
        </div>

        {/* Speech buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={speakText} disabled={!text.trim()}>
            <Volume2 size={18} aria-hidden="true" /> Speak Aloud
          </button>
          <button className="btn btn-outline" onClick={stopSpeech}>
            <Square size={18} aria-hidden="true" /> Stop Speech
          </button>
          <button className="btn btn-outline" onClick={speakText} disabled={!text.trim()}>
            <RotateCcw size={18} aria-hidden="true" /> Repeat
          </button>
          <button className="btn btn-outline" onClick={copyText} disabled={!text.trim()}>
            {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
        </div>
      </div>
    </div>
  );
}
