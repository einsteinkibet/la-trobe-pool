import { useState } from 'react';
import PropTypes from 'prop-types';
import { ONBOARDING_SLIDES } from '../utils/constants';
import '../index.css';

/**
 * Onboarding page - first-time user intro
 */
const OnboardingPage = ({ onComplete }) => {
  const [slide, setSlide] = useState(0);
  const currentSlide = ONBOARDING_SLIDES[slide];

  const handleNext = () => {
    if (slide < ONBOARDING_SLIDES.length - 1) {
      setSlide(slide + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="onboarding">
      <div className="onboarding-header">
        <button className="onboarding-skip" onClick={handleSkip}>
          Skip →
        </button>
      </div>

      <div className="onboarding-content" key={slide}>
        <div className="onboarding-icon">{currentSlide.icon}</div>
        <h2 className="onboarding-title">{currentSlide.title}</h2>
        <p className="onboarding-desc">{currentSlide.desc}</p>
      </div>

      <div className="onboarding-dots">
        {ONBOARDING_SLIDES.map((_, index) => (
          <div 
            key={index} 
            className={`onboarding-dot ${index === slide ? 'active' : ''}`}
          />
        ))}
      </div>

      <button 
        className="btn btn-primary" 
        style={{ maxWidth: '320px', margin: '0 auto' }}
        onClick={handleNext}
      >
        {slide === ONBOARDING_SLIDES.length - 1 ? 'Get Started' : 'Next'}
      </button>
    </div>
  );
};

OnboardingPage.propTypes = {
  onComplete: PropTypes.func.isRequired,
};

export default OnboardingPage;