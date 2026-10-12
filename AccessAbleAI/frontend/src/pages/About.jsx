import React from 'react';
import { 
  Info, 
  Eye, 
  MapPin, 
  ShieldAlert, 
  Video, 
  Captions, 
  Bot, 
  Sparkles, 
  Cpu, 
  Lock 
} from 'lucide-react';

export default function About() {
  return (
    <div className="about-page">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Info className="text-primary" size={28} aria-hidden="true" />
          <span>About AccessAble AI & Safety Protocols</span>
        </h1>
        <p className="page-subtitle">
          Architecture, accessibility design principles, local privacy safeguards, and transparent technical limitations.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* System Architecture Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} className="text-primary" />
            <span>Unified Platform Architecture</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            AccessAble AI brings together five assistive disciplines under a unified, accessible React and Python environment:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Eye size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>VisionMate</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                Client-side OCR with Tesseract.js WebAssembly worker. SpeechSynthesisUtterance for high-speed local text-to-speech without cloud latency.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <MapPin size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>AccessRoute & Barriers</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                Leaflet mapping engine with OpenStreetMap tiles. Real-time community barrier crowdsourcing, OSRM turn-by-turn routing, and spoken voice guidance.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <ShieldAlert size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>SafeReach SOS</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                High-contrast intentional confirmation modals, Web Share API, clipboard fallback, and persistent local SQLite request auditing.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Video size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>SignBridge AI</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                Real-time hand sign recognition and intelligent sentence synthesis for accessible, fluid communication.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Captions size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Live Captions</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                Real-time speech-to-text powered by the browser Web Speech API for deaf and hard-of-hearing users, with export and audio replay.
              </p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Bot size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>AI Assistant Copilot</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                Intelligent conversational assistant with platform navigation shortcuts, voice interaction, and accessibility guidance.
              </p>
            </div>
          </div>
        </div>

        {/* Core AI & Recognition Capabilities */}
        <div className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={20} className="text-primary" />
            <span>Core AI & Recognition Capabilities</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            AccessAble AI integrates purpose-built computer vision and machine learning pipelines designed for responsiveness and accessibility:
          </p>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <li><strong>SignBridge Vision:</strong> High-speed neural hand-sign recognition optimized for real-time video feeds with scale invariance.</li>
            <li><strong>Continuous Staging:</strong> Multi-frame sequence stabilization and debounced word assembly to prevent accidental repeat loops.</li>
            <li><strong>Linguistic Synthesis:</strong> Intelligent grammar alignment transforming raw sign tokens into complete, fluent conversational sentences.</li>
            <li><strong>Edge Latency:</strong> Lightweight in-memory inference pipeline operating with low latency for seamless, natural interaction.</li>
          </ul>
        </div>

        {/* Privacy & Safety Commitments */}
        <div className="card">
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={20} className="text-primary" />
            <span>Privacy & Data Trust Principles</span>
          </h2>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <li><strong>Zero Mandatory Cloud AI Keys:</strong> All core assistive workflows run free and local using browser capabilities and local Python services.</li>
            <li><strong>No Frame Storage:</strong> Camera frames captured for OCR or ISL prediction are evaluated strictly in memory and never written to disk.</li>
            <li><strong>Explicit Geolocation Consent:</strong> GPS coordinates are queried only after an intentional user click.</li>
            <li><strong>Honest Status Claims:</strong> Reports are marked strictly as <code>DEMO DATA</code>, <code>USER REPORTED / UNVERIFIED</code>, or <code>VERIFIED</code>. We do not falsify emergency dispatch or wheelchair safety certifications.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
