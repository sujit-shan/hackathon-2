import React, { useState } from 'react';
import { Sliders, Volume2, Sun, Type, Check, RefreshCw, Eye } from 'lucide-react';

export default function Settings({ theme, setTheme, fontScale, setFontScale }) {
  const [motion, setMotion] = useState(() => localStorage.getItem('accessable_motion') || 'standard');
  const [speechRate, setSpeechRate] = useState(() => localStorage.getItem('accessable_speech_rate') || '1.0');
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSave = () => {
    localStorage.setItem('accessable_theme', theme);
    localStorage.setItem('accessable_font_scale', fontScale);
    localStorage.setItem('accessable_motion', motion);
    localStorage.setItem('accessable_speech_rate', speechRate);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleTestSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('BREAKING BARIERS speech settings verified successfully.');
      u.rate = parseFloat(speechRate);
      window.speechSynthesis.speak(u);
    }
  };

  const handleResetDefaults = () => {
    setTheme('default');
    setFontScale('1rem');
    setMotion('standard');
    setSpeechRate('1.0');
    localStorage.removeItem('accessable_theme');
    localStorage.removeItem('accessable_font_scale');
    localStorage.removeItem('accessable_motion');
    localStorage.removeItem('accessable_speech_rate');
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="settings-page">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Sliders className="text-primary" size={28} aria-hidden="true" />
          <span>Accessibility Preferences & Settings</span>
        </h1>
        <p className="page-subtitle">
          Customize high-contrast themes, typography size scaling, motion effects, and speech synthesis to suit your individual needs.
        </p>
      </header>

      <div className="card" style={{ maxWidth: '720px' }}>
        
        {/* Theme Preference */}
        <div className="form-group">
          <label htmlFor="theme-select" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Sun size={18} className="text-primary" aria-hidden="true" />
            <span>Visual Contrast Theme</span>
          </label>
          <select 
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="default">Standard Light Mode (Clean #1E3A8A / High Legibility)</option>
            <option value="high-contrast">High Contrast Mode (Yellow #FACC15 on Black / WCAG AAA)</option>
            <option value="dark">Dark Mode (Deep Slate / Reduced Glare)</option>
          </select>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            High-contrast mode maximizes readability for users with low vision, cataract, or photophobia.
          </span>
        </div>

        {/* Font Scale Preference */}
        <div className="form-group">
          <label htmlFor="font-scale-select" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Type size={18} className="text-primary" aria-hidden="true" />
            <span>Text Size Scale</span>
          </label>
          <select 
            id="font-scale-select"
            value={fontScale}
            onChange={(e) => setFontScale(e.target.value)}
          >
            <option value="1rem">Standard (100% / 16px)</option>
            <option value="1.15rem">Large (115% / ~18.5px)</option>
            <option value="1.3rem">Extra Large (130% / ~21px)</option>
            <option value="1.45rem">Maximum (145% / ~23px)</option>
          </select>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Scales all body, card, button, and navigation typography globally across every module.
          </span>
        </div>

        {/* Reduced Motion */}
        <div className="form-group">
          <label htmlFor="motion-select" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Eye size={18} className="text-primary" aria-hidden="true" />
            <span>Animation & Motion</span>
          </label>
          <select 
            id="motion-select"
            value={motion}
            onChange={(e) => setMotion(e.target.value)}
          >
            <option value="standard">Standard Smooth Transitions</option>
            <option value="reduced">Reduced Motion (Disable decorative animations)</option>
          </select>
        </div>

        {/* Speech Rate */}
        <div className="form-group">
          <label htmlFor="speech-rate-slider" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Volume2 size={18} className="text-primary" aria-hidden="true" />
            <span>Text-to-Speech Speed Rate ({speechRate}x)</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input 
              id="speech-rate-slider"
              type="range"
              min="0.6"
              max="1.5"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(e.target.value)}
              style={{ flex: 1 }}
              aria-label="Speech rate speed"
            />
            <button 
              className="btn btn-outline" 
              type="button" 
              onClick={handleTestSpeech} 
              style={{ minHeight: '38px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Volume2 size={15} aria-hidden="true" />
              <span>Test Voice</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={18} aria-hidden="true" />
            <span>Save Preferences</span>
          </button>
          
          <button className="btn btn-outline" onClick={handleResetDefaults} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>Reset Defaults</span>
          </button>

          {savedFeedback && (
            <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }} role="status">
              <Check size={18} />
              <span>Preferences saved successfully!</span>
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
