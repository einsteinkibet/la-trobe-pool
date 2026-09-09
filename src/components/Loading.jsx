import PropTypes from 'prop-types';
import '../index.css';

/**
 * Loading spinner component
 */
const Loading = ({ size = 'medium', text = 'Loading...' }) => {
  const sizeClass = `loading-${size}`;
  
  return (
    <div className={`loading ${sizeClass}`}>
      <div className="loading-spinner"></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

Loading.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  text: PropTypes.string,
};

export default Loading;