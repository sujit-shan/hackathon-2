import React, { useEffect, useState } from 'react';
import { 
  Globe, Eye, MapPin, ShieldAlert, Camera, Mic, Settings, 
  Sparkles, ArrowRight, CheckCircle, AlertCircle, Bot, AlertTriangle 
} from 'lucide-react';
import { fetchHealth } from '../services/api';

export default function Dashboard({ navigateTo, onOpenAI }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then(data => {
        setHealth(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <h1 className="page-title">
          <Globe className="text-primary" size={40} aria-hidden="true" />
          AccessAble AI — Inclusive Accessibility Platform
        </h1>
        <p className="page-subtitle">
          A unified digital accessibility suite supporting visual assistance, community barrier reporting, spoken navigation, real-time deaf captions, emergency preparation, and Indian Sign Language translation.
        </p>

        {/* Live Service Health Bar */}
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-surface-hover)', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 800 }}>Backend Status:</span>
            {loading ? (
              <span className="badge badge-severity-moderate">Checking connectivity...</span>
            ) : health?.status === 'healthy' ? (
              <span className="badge badge-online">
                <CheckCircle size={14} aria-hidden="true" /> FastAPI & SQLite Connected
              </span>
            ) : (
              <span className="badge badge-offline">
                <AlertCircle size={14} aria-hidden="true" /> Backend Offline
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>
              <strong>SignBridge Service: </strong>
              {health?.isl_service_reachable ? (
                <span className="badge badge-online">
                  <CheckCircle size={14} aria-hidden="true" /> Active & Ready
                </span>
              ) : (
                <span className="badge badge-offline">Standby</span>
              )}
            </span>
            <span>
              <strong>Active Community Barriers: </strong>
              <strong style={{ color: 'var(--danger)' }}>{health?.active_barriers_count ?? 0}</strong>
            </span>
            <span>
              <strong>AI Assistant: </strong>
              <span className="badge badge-online" style={{ backgroundColor: '#E0F2FE', color: '#0369A1', borderColor: '#BAE6FD' }}>
                <Sparkles size={12} aria-hidden="true" /> Online
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Emergency SafeReach Trigger Banner */}
      <div 
        style={{ 
          marginBottom: '2rem', 
          padding: '1.25rem 1.75rem', 
          backgroundColor: '#FEE2E2', 
          border: '2px solid #DC2626', 
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.3rem', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.25rem 0' }}>
            <ShieldAlert size={26} aria-hidden="true" /> SafeReach Emergency Preparedness
          </h2>
          <p style={{ color: '#7F1D1D', margin: 0, fontSize: '0.95rem' }}>
            Prepare high-contrast SOS alerts, attach optional GPS coordinates, and share with trusted caregivers.
          </p>
        </div>
        <button 
          className="btn btn-danger btn-large"
          onClick={() => navigateTo('safereach')}
          aria-label="Open SafeReach Emergency Module"
        >
          Open SafeReach SOS <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* 6 Core Accessibility Modules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Module 0: GazeBridge AI */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '5px solid #4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.03)' }}>
          <div>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: '#EDE9FE', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Eye size={28} aria-hidden="true" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>GazeBridge AI</h2>
              <span className="badge badge-online" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>Hands-Free</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              Eye gaze tracking & blink communication keyboard. Look at words to navigate, blink to select, and speak instantly without hands.
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.7' }}>
              <li>Sub-5ms Google MediaPipe blendshapes eye tracking</li>
              <li>Blink-to-type (Blink = OK) + Dwell timer options</li>
              <li>AAC essential needs board & full A-Z keyboard</li>
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => navigateTo('gazebridge')}>
            Launch GazeBridge AI <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Module 1: VisionMate */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '5px solid #1E3A8A' }}>
          <div>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: '#E0E7FF', color: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Sparkles size={28} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>VisionMate</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              Document reading and OCR visual assistance. Extracts text from camera photos or documents and reads them aloud.
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.7' }}>
              <li>Client-side Tesseract.js WASM engine</li>
              <li>Editable review box before speaking</li>
              <li>Adjustable low-vision font scaling</li>
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => navigateTo('visionmate')}>
            Launch VisionMate <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Module 2: AccessRoute */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '5px solid #14B8A6' }}>
          <div>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: '#CCFBF1', color: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <MapPin size={28} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>AccessRoute</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              Community barrier reporting & spoken turn-by-turn navigation. Report broken elevators, potholes, and construction to protect the next person.
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.7' }}>
              <li>Interactive Leaflet map & accessible list</li>
              <li>Report barriers with severity & alt routes</li>
              <li>Spoken walking navigation with hazard alerts</li>
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => navigateTo('accessroute')}>
            Launch AccessRoute <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Module 3: Live Captions (Deaf / Hard of Hearing) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '5px solid #FACC15' }}>
          <div>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: '#FEF9C3', color: '#854D0E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Mic size={28} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Live Captions</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              Real-time speech-to-text designed for deaf and hard-of-hearing users. Transcribes spoken conversations into large, clear captions.
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.7' }}>
              <li>Real-time speech recognition streaming</li>
              <li>Large high-contrast caption window</li>
              <li>Pause, edit, and copy transcript text</li>
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => navigateTo('captions')}>
            Launch Live Captions <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Module 4: SignBridge AI */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '5px solid #1E3A8A' }}>
          <div>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: '#E0E7FF', color: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Camera size={28} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>SignBridge AI</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              Indian Sign Language word recognition. Recognizes hand sign vocabulary with real-time video tracking and speech output.
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.7' }}>
              <li>Webcam alignment guide box with confidence</li>
              <li>Word-level staging with undo & clear</li>
              <li>Rule-based sentence structuring & TTS</li>
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => navigateTo('signbridge')}>
            Launch SignBridge AI <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

      </div>

      {/* AI Assistant Banner */}
      <div 
        className="card" 
        style={{ 
          background: 'linear-gradient(135deg, #1E3A8A 0%, #172554 100%)', 
          color: '#FFFFFF', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '1.5rem',
          padding: '2rem'
        }}
      >
        <div style={{ maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#FACC15', fontWeight: 800, marginBottom: '0.5rem' }}>
            <Sparkles size={20} aria-hidden="true" />
            <span>ACCESSIBILITY CO-PILOT</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem', color: '#FFFFFF' }}>
            Need Guidance? Ask AccessAble AI Assistant
          </h2>
          <p style={{ color: '#CBD5E1', fontSize: '1.05rem', margin: 0 }}>
            Have a question about reporting an obstacle, extracting text from an image, or navigating to your destination? The assistant operates the platform and answers questions with real data.
          </p>
        </div>
        <button 
          className="btn" 
          style={{ backgroundColor: '#FACC15', color: '#000000', fontWeight: 800, minHeight: '52px', padding: '0.85rem 1.8rem', fontSize: '1.05rem' }}
          onClick={onOpenAI}
        >
          <Bot size={22} aria-hidden="true" /> Ask AccessAble Assistant
        </button>
      </div>
    </div>
  );
}
