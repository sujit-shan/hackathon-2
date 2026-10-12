import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, AlertTriangle, Navigation, Volume2, Square, RotateCcw, 
  CheckCircle, Flag, ShieldCheck, Plus, RefreshCw, SlidersHorizontal, 
  ArrowRight, ShieldAlert, Compass, Check, Info, Construction, Ban
} from 'lucide-react';
import { fetchReports, submitReport, confirmBarrier, resolveBarrier, flagBarrier, fetchNearbyBarriers } from '../services/api';

const CATEGORIES = [
  { id: 'all', label: 'All Items' },
  { id: 'broken_lift', label: 'Broken Elevators' },
  { id: 'blocked_pathway', label: 'Blocked Footpaths' },
  { id: 'missing_ramp', label: 'Missing / Blocked Ramps' },
  { id: 'road_construction', label: 'Road Construction' },
  { id: 'steps_barrier', label: 'Unexpected Steps' },
  { id: 'obstructed_tactile', label: 'Obstructed Tactile Paving' },
  { id: 'broken_pavement', label: 'Broken Pavement / Potholes' },
  { id: 'ramp', label: 'Accessible Ramps' },
  { id: 'lift', label: 'Working Lifts' },
  { id: 'accessible_toilet', label: 'Accessible Restrooms' },
];

export default function AccessRoute() {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('both'); // 'both', 'map', 'list', 'nav'

  // Barrier Reporting Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [formCategory, setFormCategory] = useState('broken_lift');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formLat, setFormLat] = useState('28.6139');
  const [formLng, setFormLng] = useState('77.2090');
  const [formSeverity, setFormSeverity] = useState('moderate');
  const [formAffected, setFormAffected] = useState('wheelchair');
  const [formAltRoute, setFormAltRoute] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState('');

  // Turn-by-Turn Navigation States
  const [navStart, setNavStart] = useState('28.6139, 77.2090');
  const [navDest, setNavDest] = useState('28.6162, 77.2075');
  const [navRoute, setNavRoute] = useState(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navWarnings, setNavWarnings] = useState([]);
  const [navLoading, setNavLoading] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routePolylineRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchReports();
      setReports(data);
    } catch (err) {
      setErrorMsg('Failed to load barrier reports from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter reports
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredReports(reports);
    } else {
      setFilteredReports(reports.filter(r => r.category === selectedCategory));
    }
  }, [reports, selectedCategory]);

  // Leaflet initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView([28.6145, 77.2100], 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    map.on('click', (e) => {
      setFormLat(e.latlng.lat.toFixed(6));
      setFormLng(e.latlng.lng.toFixed(6));
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Map markers
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();

    filteredReports.forEach((item) => {
      const isBarrier = item.category.includes('broken') || item.category.includes('blocked') || item.category.includes('missing') || item.category.includes('steps') || item.category.includes('construction');
      const pinColor = isBarrier ? (item.severity === 'high' ? '#DC2626' : '#EAB308') : '#1E3A8A';

      const customIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: ${pinColor}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 14px; font-weight: bold;">!</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const popupHtml = `
        <div style="font-family: inherit; min-width: 200px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700;">${item.title}</h4>
          <span style="font-size: 11px; font-weight: 700; color: ${item.severity === 'high' ? '#DC2626' : '#854D0E'};">
            Severity: ${item.severity.toUpperCase()}
          </span>
          <p style="margin: 4px 0; font-size: 12px; color: #475569;">${item.location_name}</p>
          <p style="margin: 0; font-size: 12px; line-height: 1.4;">${item.description}</p>
          ${item.alternative_route_note ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #166534; font-weight: 600;">Alt Route: ${item.alternative_route_note}</p>` : ''}
        </div>
      `;

      L.marker([item.latitude, item.longitude], { icon: customIcon })
        .bindPopup(popupHtml)
        .addTo(markersLayerRef.current);
    });
  }, [filteredReports]);

  // Handle Barrier Confirm
  const handleConfirm = async (id) => {
    try {
      const updated = await confirmBarrier(id);
      setReports(prev => prev.map(r => r.id === id ? updated : r));
    } catch {
      alert('Could not record confirmation.');
    }
  };

  // Handle Barrier Resolve
  const handleResolve = async (id) => {
    try {
      const updated = await resolveBarrier(id);
      setReports(prev => prev.map(r => r.id === id ? updated : r));
    } catch {
      alert('Could not update status.');
    }
  };

  // Handle Barrier Flag
  const handleFlag = async (id) => {
    try {
      const updated = await flagBarrier(id);
      setReports(prev => prev.map(r => r.id === id ? updated : r));
      alert('Report flagged for community review.');
    } catch {
      alert('Could not flag report.');
    }
  };

  // Turn-by-Turn Route Calculation via OSRM
  const calculateRoute = async () => {
    setNavLoading(true);
    setErrorMsg('');
    try {
      const [startLat, startLng] = navStart.split(',').map(s => parseFloat(s.trim()));
      const [destLat, destLng] = navDest.split(',').map(s => parseFloat(s.trim()));

      if (isNaN(startLat) || isNaN(startLng) || isNaN(destLat) || isNaN(destLng)) {
        alert('Please enter valid latitude and longitude coordinates.');
        setNavLoading(false);
        return;
      }

      // Query public walking route
      const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(osrmUrl);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No walking route found between these points.');
      }

      const route = data.routes[0];
      setNavRoute(route);

      // Extract steps
      const steps = [];
      route.legs.forEach(leg => {
        leg.steps.forEach(st => {
          steps.push({
            instruction: st.maneuver.type === 'depart' ? 'Start walking on path' : `${st.maneuver.modifier || 'continue'} on ${st.name || 'path'}`,
            distance: Math.round(st.distance),
            duration: Math.round(st.duration),
            location: st.maneuver.location
          });
        });
      });
      setRouteSteps(steps);
      setActiveStepIndex(0);

      // Render polyline on map
      if (mapInstanceRef.current) {
        if (routePolylineRef.current) {
          mapInstanceRef.current.removeLayer(routePolylineRef.current);
        }
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        const polyline = L.polyline(coords, { color: '#1E3A8A', weight: 6, opacity: 0.85 }).addTo(mapInstanceRef.current);
        routePolylineRef.current = polyline;
        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      }

      // Check nearby barriers on this route
      const nearby = await fetchNearbyBarriers(startLat, startLng, 3.0);
      setNavWarnings(nearby);

    } catch (err) {
      setErrorMsg(`Navigation error: ${err.message}`);
    } finally {
      setNavLoading(false);
    }
  };

  // Spoken directions
  const speakStep = (stepText) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stepText);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const startNavigationVoice = () => {
    setIsNavigating(true);
    if (routeSteps.length > 0) {
      speakStep(`Starting navigation. ${routeSteps[0].instruction} for ${routeSteps[0].distance} metres.`);
    }
  };

  const nextStep = () => {
    if (activeStepIndex < routeSteps.length - 1) {
      const nextIdx = activeStepIndex + 1;
      setActiveStepIndex(nextIdx);
      speakStep(`${routeSteps[nextIdx].instruction} for ${routeSteps[nextIdx].distance} metres.`);
    } else {
      speakStep('You have arrived at your destination.');
      setIsNavigating(false);
    }
  };

  const stopNavigation = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsNavigating(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback('');
    try {
      const newReport = await submitReport({
        category: formCategory,
        title: formTitle.trim(),
        description: formDesc.trim(),
        location_name: formLocation.trim(),
        latitude: parseFloat(formLat),
        longitude: parseFloat(formLng),
        severity: formSeverity,
        affected_groups: formAffected,
        alternative_route_note: formAltRoute.trim() || null
      });

      setReports(prev => [newReport, ...prev]);
      setShowReportModal(false);
      setFormTitle('');
      setFormDesc('');
      setFormLocation('');
      setFormAltRoute('');
      alert('Community barrier report published successfully! Fellow pedestrians on this route will now be alerted.');
    } catch (err) {
      setFormFeedback(err.message || 'Error saving report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="accessroute-page">
      <header className="page-header">
        <h1 className="page-title">
          <MapPin className="text-primary" size={36} aria-hidden="true" />
          AccessRoute — Accessible Maps, Navigation & Barrier Reporting
        </h1>
        <p className="page-subtitle">
          Discover accessible paths, report real-time barriers (broken lifts, construction, missing ramps) to protect fellow citizens, and follow turn-by-turn spoken guidance.
        </p>
      </header>

      {/* Main Action Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-large" onClick={() => setShowReportModal(true)}>
            <Plus size={20} aria-hidden="true" /> Report a Barrier
          </button>
          <button className={`btn ${viewMode === 'nav' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode(v => v === 'nav' ? 'both' : 'nav')}>
            <Navigation size={18} aria-hidden="true" /> Turn-by-Turn Navigation
          </button>
          <button className="btn btn-outline" onClick={loadData}>
            <RefreshCw size={18} aria-hidden="true" /> Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${viewMode === 'both' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('both')}>
            Map + List
          </button>
          <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('list')}>
            List Only
          </button>
        </div>
      </div>

      {/* Navigation Mode Drawer */}
      {viewMode === 'nav' && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--primary)', backgroundColor: 'var(--bg-surface-hover)' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={22} className="text-primary" aria-hidden="true" /> Spoken Turn-by-Turn Route Navigation
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Starting Point (Lat, Lng):</label>
              <input type="text" value={navStart} onChange={(e) => setNavStart(e.target.value)} placeholder="28.6139, 77.2090" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Destination Point (Lat, Lng):</label>
              <input type="text" value={navDest} onChange={(e) => setNavDest(e.target.value)} placeholder="28.6162, 77.2075" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={calculateRoute} disabled={navLoading}>
              <Navigation size={18} aria-hidden="true" /> {navLoading ? 'Calculating Path...' : 'Calculate Route'}
            </button>
            {routeSteps.length > 0 && !isNavigating && (
              <button className="btn btn-accent" onClick={startNavigationVoice}>
                <Volume2 size={18} aria-hidden="true" /> Start Spoken Navigation
              </button>
            )}
            {isNavigating && (
              <>
                <button className="btn btn-outline" onClick={nextStep}>
                  Next Step <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button className="btn btn-danger" onClick={stopNavigation}>
                  <Square size={16} aria-hidden="true" /> Stop Guidance
                </button>
              </>
            )}
          </div>

          {/* Active Navigation Banner */}
          {routeSteps.length > 0 && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '2px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  Step {activeStepIndex + 1} of {routeSteps.length}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Route: {Math.round(navRoute.distance)} metres (~{Math.round(navRoute.duration / 60)} min walk)
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {routeSteps[activeStepIndex]?.instruction}
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                Distance for this maneuver: <strong>{routeSteps[activeStepIndex]?.distance}m</strong>
              </div>
            </div>
          )}

          {/* Real Nearby Barrier Warnings Along Path */}
          {navWarnings.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#FEF9C3', border: '2px solid #EAB308', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ color: '#854D0E', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
                <AlertTriangle size={20} aria-hidden="true" /> Community Obstacle Warnings on this Route ({navWarnings.length}):
              </h4>
              <ul style={{ paddingLeft: '1.25rem', color: '#713F12', fontSize: '0.9rem' }}>
                {navWarnings.map(w => (
                  <li key={w.id} style={{ marginBottom: '0.35rem' }}>
                    <strong>{w.title}</strong> ({w.severity.toUpperCase()} severity, ~{w.distance_km}km away at {w.location_name}).
                    {w.alternative_route_note && <span> <em>Advice: {w.alternative_route_note}</em></span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Category Pills */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`btn ${selectedCategory === cat.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ minHeight: '40px', padding: '0.4rem 0.9rem', fontSize: '0.9rem' }}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}

      {/* Map & List Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'both' ? '1fr 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Interactive Map */}
        {(viewMode === 'both' || viewMode === 'nav') && (
          <div className="card" style={{ padding: '0.5rem' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '560px', borderRadius: 'var(--radius-md)' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0.5rem 0 0.5rem', textAlign: 'right' }}>
              Leaflet &copy; OpenStreetMap contributors. Click anywhere to select coordinates.
            </p>
          </div>
        )}

        {/* Accessible Barrier List */}
        {(viewMode === 'both' || viewMode === 'list') && (
          <div className="card" style={{ maxHeight: '620px', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Reported Obstacles & Assets ({filteredReports.length})</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Community Verified</span>
            </h2>

            {loading ? (
              <p>Loading database records...</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {filteredReports.map(item => {
                  const isHigh = item.severity === 'high';
                  return (
                    <li key={item.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                          {item.title}
                        </h3>
                        <span className={`badge badge-severity-${item.severity || 'moderate'}`}>
                          {item.severity ? item.severity.toUpperCase() : 'REPORT'}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        <strong>Location:</strong> {item.location_name} (Coordinates: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)})
                      </p>

                      <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        {item.description}
                      </p>

                      {item.alternative_route_note && (
                        <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                          <strong>Recommended Alternative:</strong> {item.alternative_route_note}
                        </div>
                      )}

                      {/* Community Actions (Confirm, Resolve, Flag) */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                        <button className="btn btn-outline" style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleConfirm(item.id)}>
                          <CheckCircle size={14} aria-hidden="true" /> Confirm Barrier ({item.confirmations_count || 0})
                        </button>
                        <button className="btn btn-outline" style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleResolve(item.id)}>
                          <Check size={14} aria-hidden="true" /> Mark Resolved
                        </button>
                        <button className="btn btn-outline" style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleFlag(item.id)}>
                          <Flag size={14} aria-hidden="true" /> Flag
                        </button>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {item.status} • {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Report a Barrier Modal */}
      {showReportModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="barrier-modal-title">
          <div className="modal-card">
            <h2 id="barrier-modal-title" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Report a Barrier to Warn the Community
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Help the next person know about obstacles before they arrive. Your report immediately updates the map and navigation warnings.
            </p>

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label htmlFor="b-category">Barrier Category</label>
                <select id="b-category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                  <option value="broken_lift">Broken or Unavailable Elevator</option>
                  <option value="blocked_pathway">Blocked Footpath / Construction</option>
                  <option value="missing_ramp">Missing or Inaccessible Ramp</option>
                  <option value="steps_barrier">Steps or Level Change (No Ramp)</option>
                  <option value="road_construction">Road Construction Trench</option>
                  <option value="obstructed_tactile">Obstructed Tactile Paving</option>
                  <option value="broken_pavement">Broken Pavement / Pothole</option>
                  <option value="flooding">Flooding or Standing Water</option>
                  <option value="inaccessible_entrance">Inaccessible Entrance</option>
                  <option value="other">Other Barrier</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="b-title">Barrier Title</label>
                <input id="b-title" type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Broken Elevator at Platform 2" required />
              </div>

              <div className="form-group">
                <label htmlFor="b-location">Location Name / Landmark</label>
                <input id="b-location" type="text" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="e.g. Central Metro West Gate" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="b-severity">Severity Level</label>
                  <select id="b-severity" value={formSeverity} onChange={(e) => setFormSeverity(e.target.value)}>
                    <option value="high">High (Completely Impassable)</option>
                    <option value="moderate">Moderate (Difficult / Delayed)</option>
                    <option value="low">Low (Minor Caution)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="b-affected">Who Is Affected?</label>
                  <select id="b-affected" value={formAffected} onChange={(e) => setFormAffected(e.target.value)}>
                    <option value="wheelchair">Wheelchair & Scooter Users</option>
                    <option value="low_vision">Blind & Low Vision</option>
                    <option value="elderly">Elderly & Mobility Impaired</option>
                    <option value="all">All Pedestrians</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="b-desc">Description of Obstacle</label>
                <textarea id="b-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Explain the obstacle and exact situation..." required />
              </div>

              <div className="form-group">
                <label htmlFor="b-alt">Suggested Alternative Route (Optional)</label>
                <input id="b-alt" type="text" value={formAltRoute} onChange={(e) => setFormAltRoute(e.target.value)} placeholder="e.g. Use the North overbridge ramp 50m behind the building" />
              </div>

              {formFeedback && (
                <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontWeight: 600 }}>{formFeedback}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowReportModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Publishing...' : 'Publish Barrier Warning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
