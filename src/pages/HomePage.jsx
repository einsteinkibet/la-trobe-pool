import PropTypes from 'prop-types';
import HomeMap from '../components/HomeMap';
import { LA_TROBE_CAMPUS } from '../utils/constants';
import '../index.css';

/**
 * Homepage — the entry dashboard. This app is a route-based, one-rider-per-trip
 * carpool matcher (NOT a marketplace of many multi-seat rides). Students set a
 * commute route; the app matches a driver with a single rider and suggests a
 * pickup point. So the home screen points to Routes + the commuter map, with no
 * manual ride listings.
 */
const HomePage = ({ onNavigate, user }) => {
  const loggedIn = !!user;
  return (
    <>
      {/* Hero Banner — personalised once logged in, marketing pitch for guests. */}
      <div className="hero">
        {loggedIn ? (
          <>
            <h2>Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</h2>
            <p>Ready for your next trip to campus? Set or check your route below.</p>
          </>
        ) : (
          <>
            <h2>Your ride to campus, matched for you.</h2>
            <p>One student, one ride — we pair you with someone already going your way.</p>
          </>
        )}
        <div className="hero-chips">
          <span className="hero-chip">🏫 La Trobe Bundoora</span>
          <span className="hero-chip">🤝 One rider per trip</span>
          <span className="hero-chip">⏱️ On time, every time</span>
        </div>
      </div>

      {/* Why UniPool — customer pullers. Marketing only: hidden once logged in. */}
      {!loggedIn && (
        <>
          <div className="section-eyebrow">Why students ride with us</div>
          <div className="pullers">
            <div className="puller-card">
              <div className="puller-icon">🤝</div>
              <div className="puller-title">Make friends</div>
              <div className="puller-desc">Meet La Trobe students heading exactly your way.</div>
            </div>
            <div className="puller-card">
              <div className="puller-icon">🛣️</div>
              <div className="puller-title">On the way</div>
              <div className="puller-desc">Matched with a driver already on your route — no big detours.</div>
            </div>
            <div className="puller-card">
              <div className="puller-icon">⏱️</div>
              <div className="puller-title">Skip the waiting bays</div>
              <div className="puller-desc">Stop standing around for late buses and trams.</div>
            </div>
            <div className="puller-card">
              <div className="puller-icon">🎓</div>
              <div className="puller-title">Get to class early</div>
              <div className="puller-desc">Reliable door-to-campus commutes, every single day.</div>
            </div>
          </div>
        </>
      )}

      {/* Primary actions — set a route or browse the map */}
      <div className="quick-actions">
        <div className="quick-card find" onClick={() => onNavigate('routes')}>
          <div className="quick-card-icon">🛣️</div>
          <h3>Set Your Route</h3>
          <p>Tell us your suburb &amp; days — we match &amp; suggest a pickup</p>
        </div>
        <div className="quick-card map" onClick={() => onNavigate('map')}>
          <div className="quick-card-icon">🗺️</div>
          <h3>Map View</h3>
          <p>See student demand near you</p>
        </div>
      </div>

      {/* How it works */}
      <div className="search-section">
        <h3>✨ How UniPool works</h3>
        <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', color: '#555', fontSize: '0.9rem', lineHeight: 1.7 }}>
          <li>Add your <strong>home suburb</strong> and the <strong>days/times</strong> you travel to campus.</li>
          <li>The app <strong>matches</strong> you with one driver or rider going your way.</li>
          <li>We <strong>suggest the best pickup point</strong> along the route — or agree your own.</li>
        </ol>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => onNavigate('routes')}>
          Set up my route
        </button>
      </div>

      {/* Commuter map — student demand + corridors to campus */}
      <div className="search-section">
        <h3>🗺️ Student Commuter Map — La Trobe Bundoora</h3>
        <p style={{ fontSize: '0.8rem', color: '#6d6d6d', margin: '0 0 0.75rem' }}>
          Lines show commuter routes to campus; bigger circles = more students. Tap a suburb to explore.
        </p>
        <HomeMap
          height="280px"
          onSuburbClick={(s) =>
            onNavigate('find', { from: s.name, to: LA_TROBE_CAMPUS.name })
          }
        />
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-chip">
          <div className="stat-chip-value">800+</div>
          <div className="stat-chip-label">Students</div>
        </div>
        <div className="stat-chip">
          <div className="stat-chip-value">$0.50</div>
          <div className="stat-chip-label">Per km</div>
        </div>
        <div className="stat-chip">
          <div className="stat-chip-value">1</div>
          <div className="stat-chip-label">Rider / trip</div>
        </div>
      </div>
    </>
  );
};

HomePage.propTypes = {
  onNavigate: PropTypes.func.isRequired,
  user: PropTypes.object,
};

export default HomePage;
