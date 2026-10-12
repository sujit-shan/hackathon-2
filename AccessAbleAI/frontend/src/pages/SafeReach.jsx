import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Share2, Copy, Check, MapPin, Phone, ShieldCheck, UserCheck, X } from 'lucide-react';
import { fetchSOSRecords, submitSOSRecord } from '../services/api';

const DEFAULT_TEMPLATES = [
  { id: 'medical', label: 'Medical Emergency', text: 'EMERGENCY: I need urgent medical assistance. Please contact emergency services and reach my location.' },
  { id: 'mobility', label: 'Wheelchair Mobility Barrier', text: 'ASSISTANCE NEEDED: I am facing a severe wheelchair access barrier and require immediate physical mobility assistance.' },
  { id: 'lost', label: 'Disorientation / Lost', text: 'ASSISTANCE NEEDED: I am disoriented and need assistance reaching my destination or a safe location.' },
  { id: 'custom', label: 'Custom Message', text: 'EMERGENCY: Urgent assistance needed.' },
];

export default function SafeReach() {
  const [selectedTemplate, setSelectedTemplate] = useState('medical');
  const [message, setMessage] = useState(DEFAULT_TEMPLATES[0].text);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [coords, setCoords] = useState(null);
  const [locationName, setLocationName] = useState('');
  
  const [contactName, setContactName] = useState('Primary Caregiver / Trusted Contact');
  const [contactPhone, setContactPhone] = useState('+91 98765 43210');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    try {
      const records = await fetchSOSRecords();
      setHistory(records);
    } catch {
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const tmpl = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) setMessage(tmpl.text);
  };

  const handleLocationToggle = (e) => {
    const checked = e.target.checked;
    setIncludeLocation(checked);
    if (checked && !coords) {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your device.');
        setIncludeLocation(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          setLocationName(`GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        },
        (err) => {
          alert(`Location permission denied: ${err.message}. Enter a landmark manually below.`);
          setIncludeLocation(false);
        }
      );
    }
  };

  const getFullCompiledMessage = () => {
    let compiled = `${message.trim()}\n\nContact: ${contactName} (${contactPhone})`;
    if (includeLocation) {
      if (coords) {
        compiled += `\nLocation: https://maps.google.com/?q=${coords.latitude},${coords.longitude} (${locationName})`;
      } else if (locationName) {
        compiled += `\nLocation: ${locationName}`;
      }
    }
    return compiled;
  };

  const handleConfirmAndShare = async () => {
    setShowConfirmModal(false);
    const fullMsg = getFullCompiledMessage();

    let finalStatus = 'SAVED';
    let shareMethod = 'none';

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SafeReach Emergency Alert',
          text: fullMsg
        });
        finalStatus = 'SHARED';
        shareMethod = 'web_share_api';
        setToastMessage('Emergency share sheet opened successfully.');
      } catch (err) {
        if (err.name !== 'AbortError') {
          await navigator.clipboard.writeText(fullMsg);
          shareMethod = 'clipboard_fallback';
          setToastMessage('Share sheet unavailable. Message copied to clipboard instead.');
        } else {
          setToastMessage('Share action cancelled by user.');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(fullMsg);
        finalStatus = 'SHARED';
        shareMethod = 'clipboard_copy';
        setToastMessage('Message copied to clipboard. Ready to paste into SMS or WhatsApp.');
      } catch {
        setToastMessage('Emergency record saved locally.');
      }
    }

    try {
      const savedRecord = await submitSOSRecord({
        message: fullMsg,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        location_text: locationName || null,
        contact_name: contactName,
        contact_phone: contactPhone,
        status: finalStatus,
        share_method: shareMethod
      });
      setHistory(prev => [savedRecord, ...prev]);
    } catch {}

    setTimeout(() => setToastMessage(''), 6000);
  };

  const handleCopyOnly = async () => {
    const fullMsg = getFullCompiledMessage();
    try {
      await navigator.clipboard.writeText(fullMsg);
      setToastMessage('Message copied to clipboard.');
      const savedRecord = await submitSOSRecord({
        message: fullMsg,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        location_text: locationName || null,
        contact_name: contactName,
        contact_phone: contactPhone,
        status: 'SAVED',
        share_method: 'clipboard_manual'
      });
      setHistory(prev => [savedRecord, ...prev]);
    } catch {
      alert('Unable to copy message.');
    }
    setTimeout(() => setToastMessage(''), 4000);
  };

  return (
    <div className="safereach-page">
      <header className="page-header">
        <h1 className="page-title">
          <ShieldAlert className="text-danger" size={36} aria-hidden="true" />
          SafeReach — Accessible Emergency Assistance
        </h1>
        <p className="page-subtitle">
          Prepare high-contrast, pre-formatted emergency requests, attach trusted contacts and location, and share safely.
        </p>

        {/* Safety Disclaimer Banner */}
        <div style={{ padding: '1rem', backgroundColor: '#FEE2E2', border: '2px solid #EF4444', borderRadius: 'var(--radius-md)', color: '#7F1D1D', fontSize: '0.95rem' }}>
          <strong>Safety Notice:</strong> SafeReach is an assistive communication aid to alert caregivers and contacts. It does <em>not</em> automatically dispatch police or ambulance services. For immediate life-threatening emergencies, dial <strong>112</strong> (India) or <strong>911</strong> directly.
        </div>
      </header>

      {/* Main SOS Button Card */}
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', marginBottom: '2rem', border: '3px solid #DC2626' }}>
        <h2 style={{ fontSize: '1.6rem', color: '#B91C1C', marginBottom: '0.5rem' }}>
          Prepared Emergency Request
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Pressing the SOS button triggers an explicit confirmation modal to safeguard against accidental activation.
        </p>

        <button 
          className="btn btn-danger"
          style={{ 
            fontSize: '1.75rem', 
            padding: '1.4rem 3.2rem', 
            borderRadius: '9999px', 
            boxShadow: '0 8px 25px rgba(220, 38, 38, 0.45)',
            letterSpacing: '0.04em'
          }}
          onClick={() => setShowConfirmModal(true)}
          aria-label="Trigger SOS Emergency Confirmation"
        >
          <ShieldAlert size={32} aria-hidden="true" /> TRIGGER SOS ALERT
        </button>

        {toastMessage && (
          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', display: 'inline-block', fontWeight: 700 }}>
            {toastMessage}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Template card */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>1. Emergency Message Template</h2>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {DEFAULT_TEMPLATES.map(t => (
              <button
                key={t.id}
                className={`btn ${selectedTemplate === t.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ minHeight: '38px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                onClick={() => handleTemplateChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="sos-msg">Editable Emergency Message</label>
            <textarea
              id="sos-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
            <input 
              id="loc-check"
              type="checkbox"
              checked={includeLocation}
              onChange={handleLocationToggle}
              style={{ width: '22px', height: '22px' }}
            />
            <label htmlFor="loc-check" style={{ cursor: 'pointer' }}>
              Include GPS coordinates (requires explicit permission)
            </label>
          </div>

          {includeLocation && (
            <div className="form-group">
              <label htmlFor="landmark-txt">Landmark / Note</label>
              <input 
                id="landmark-txt"
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Near Metro Gate 3 elevator"
              />
            </div>
          )}
        </div>

        {/* Contact and Preview Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>2. Trusted Contact & Preview</h2>

          <div className="form-group">
            <label htmlFor="c-name">Trusted Contact Name</label>
            <input id="c-name" type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="c-phone">Contact Phone / Emergency Line</label>
            <input id="c-phone" type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Message Preview:</label>
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {getFullCompiledMessage()}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-outline" onClick={handleCopyOnly}>
              <Copy size={16} aria-hidden="true" /> Copy Message Text
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Emergency Request History (SQLite Saved Records)</h2>
        {loadingHistory ? (
          <p>Loading history...</p>
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No emergency alerts recorded yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map(item => (
              <li key={item.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.contact_name} ({item.contact_phone})</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(item.created_at).toLocaleString()} • Method: {item.share_method || 'none'}
                  </div>
                </div>
                <span className={`badge ${item.status === 'SHARED' ? 'badge-online' : 'badge-severity-moderate'}`}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sos-confirm-title">
          <div className="modal-card" style={{ border: '3px solid #DC2626' }}>
            <h2 id="sos-confirm-title" style={{ fontSize: '1.5rem', color: '#B91C1C', marginBottom: '0.75rem' }}>
              Confirm Emergency SOS Action
            </h2>
            <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
              Are you sure you want to trigger this emergency request? This opens your device's native share/messaging sheet and saves a persistent audit record.
            </p>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
              {getFullCompiledMessage()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleConfirmAndShare}>
                Confirm & Share Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
