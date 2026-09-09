import PropTypes from 'prop-types';
import '../index.css';

/**
 * Splash screen - app launch screen
 */
const SplashScreen = ({ onComplete }) => {
  return (
    <div className="splash">
      <div className="splash-logo">🎓</div>
      <h1>UniPool</h1>
      <p>Your solo ride to La Trobe — matched, on the way, on time.</p>
      <div className="hero-chips" style={{ justifyContent: 'center', marginBottom: '2.5rem' }}>
        <span className="hero-chip">🤝 Make friends</span>
        <span className="hero-chip">⏱️ Skip the waiting bays</span>
        <span className="hero-chip">🎓 Get to class early</span>
      </div>
      <button
        className="btn btn-primary"
        style={{ maxWidth: '280px' }}
        onClick={onComplete}
      >
        Get Started
      </button>
    </div>
  );
};

SplashScreen.propTypes = {
  onComplete: PropTypes.func.isRequired,
};

export default SplashScreen;