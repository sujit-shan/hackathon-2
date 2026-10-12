import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Eye, 
  MapPin, 
  ShieldAlert, 
  Video, 
  Captions, 
  Sliders, 
  Info, 
  Bot, 
  Contrast, 
  Sparkles 
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import VisionMate from './pages/VisionMate';
import AccessRoute from './pages/AccessRoute';
import SafeReach from './pages/SafeReach';
import SignBridge from './pages/SignBridge';
import GazeBridge from './pages/GazeBridge';
import LiveCaptions from './pages/LiveCaptions';
import Settings from './pages/Settings';
import About from './pages/About';
import AIAssistant from './components/AIAssistant';
import EyeWebsiteController from './components/EyeWebsiteController';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('accessable_theme') || 'default');
  const [fontScale, setFontScale] = useState(() => localStorage.getItem('accessable_font_scale') || '1rem');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isEyeControlActive, setIsEyeControlActive] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--font-scale', fontScale);
  }, [theme, fontScale]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'gazebridge', label: 'GazeBridge AI (Eye Typing)', icon: Eye },
    { id: 'signbridge', label: 'SignBridge AI', icon: Video },
    { id: 'visionmate', label: 'VisionMate', icon: Sparkles },
    { id: 'accessroute', label: 'AccessRoute', icon: MapPin },
    { id: 'safereach', label: 'SafeReach SOS', icon: ShieldAlert },
    { id: 'livecaptions', label: 'Live Captions', icon: Captions },
    { id: 'settings', label: 'Settings', icon: Sliders },
    { id: 'about', label: 'About & Safety', icon: Info },
  ];

  return (
    <div className="app-container">
      {/* Accessible skip link for keyboard users */}
      <a 
        href="#main-content" 
        style={{
          position: 'absolute',
          top: '-40px',
          left: '10px',
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-text)',
          padding: '8px 16px',
          zIndex: 10000,
          fontWeight: 700,
          borderRadius: '4px',
          textDecoration: 'none'
        }}
        onFocus={(e) => e.target.style.top = '10px'}
        onBlur={(e) => e.target.style.top = '-40px'}
      >
        Skip to main content
      </a>

      {/* Main Navigation Header */}
      <header className="app-header" role="banner">
        <a 
          href="#dashboard" 
          className="brand"
          onClick={(e) => { e.preventDefault(); setCurrentPage('dashboard'); }}
          aria-label="AccessAble AI Home Dashboard"
        >
          <div className="brand-logo" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <span className="brand-name">AccessAble AI</span>
        </a>

        <nav className="nav-links" role="navigation" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => setCurrentPage(item.id)}
                aria-current={currentPage === item.id ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quick Actions: Eye Control Toggle, Contrast Switcher, Copilot Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            className={`btn ${isEyeControlActive ? 'btn-primary' : 'btn-outline'}`}
            style={{
              minHeight: '38px',
              padding: '0.35rem 0.85rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: isEyeControlActive ? '2px solid #16A34A' : '1.5px solid var(--border-color)',
              backgroundColor: isEyeControlActive ? 'rgba(22, 163, 74, 0.15)' : 'transparent',
              color: isEyeControlActive ? '#16A34A' : 'var(--text-color)',
              fontWeight: 700,
              boxShadow: isEyeControlActive ? '0 0 12px rgba(22, 163, 74, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setIsEyeControlActive(prev => !prev)}
            aria-label="Toggle Full Website Eye Movement Control"
            aria-pressed={isEyeControlActive}
            title="Control entire website hands-free using eye movement & blinks"
          >
            <Eye size={17} color={isEyeControlActive ? '#16A34A' : 'currentColor'} aria-hidden="true" />
            <span>{isEyeControlActive ? 'Eye Control: ON' : 'Eye Control'}</span>
          </button>

          <button 
            className="btn btn-outline" 
            style={{ minHeight: '38px', padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setTheme(t => t === 'high-contrast' ? 'default' : 'high-contrast')}
            aria-label="Toggle High-Contrast Mode"
          >
            <Contrast size={16} aria-hidden="true" />
            <span>{theme === 'high-contrast' ? 'Standard' : 'High Contrast'}</span>
          </button>
          
          <button
            className="btn btn-primary"
            style={{ minHeight: '38px', padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setIsAIOpen(true)}
            aria-label="Open AI Assistant"
          >
            <Bot size={16} aria-hidden="true" />
            <span>AI Copilot</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="main-content" role="main" tabIndex="-1">
        {currentPage === 'dashboard' && <Dashboard navigateTo={setCurrentPage} />}
        {currentPage === 'gazebridge' && <GazeBridge />}
        {currentPage === 'visionmate' && <VisionMate />}
        {currentPage === 'accessroute' && <AccessRoute />}
        {currentPage === 'safereach' && <SafeReach />}
        {currentPage === 'signbridge' && <SignBridge />}
        {currentPage === 'livecaptions' && <LiveCaptions />}
        {currentPage === 'settings' && (
          <Settings 
            theme={theme} 
            setTheme={setTheme} 
            fontScale={fontScale} 
            setFontScale={setFontScale} 
          />
        )}
        {currentPage === 'about' && <About />}
      </main>

      {/* Persistent Floating AI Assistant Launcher Button */}
      <button 
        className="ai-fab" 
        onClick={() => setIsAIOpen(prev => !prev)}
        aria-label="Open AccessAble AI Assistant"
        title="Ask AccessAble AI Assistant"
      >
        <Bot size={22} aria-hidden="true" />
        <span>Ask AccessAble</span>
      </button>

      {/* Conversational AI Assistant Modal / Drawer */}
      <AIAssistant 
        isOpen={isAIOpen} 
        onClose={() => setIsAIOpen(false)} 
        onNavigate={(page) => {
          setCurrentPage(page);
          setIsAIOpen(false);
        }} 
      />

      {/* Full-Website Eye Movement Controller */}
      <EyeWebsiteController 
        isActive={isEyeControlActive} 
        onToggle={() => setIsEyeControlActive(prev => !prev)} 
        onNavigate={setCurrentPage} 
      />

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'auto' }} role="contentinfo">
        <p>
          <strong>AccessAble AI</strong> &mdash; Inclusive Digital Accessibility Platform | Built for Hackathon MVP
        </p>
        <p style={{ marginTop: '0.25rem' }}>
          Open-Source & Local-First &bull; No Mandatory Cloud Keys &bull; Privacy Preserved
        </p>
      </footer>
    </div>
  );
}
