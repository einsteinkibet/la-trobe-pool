import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import '../index.css';

/**
 * Header component
 */
const Header = ({ logo = 'UniPool', showBack = false, onBack, rightElement }) => {
  return (
    <header className="header">
      <div className="header-left">
        {showBack && (
          <button className="btn-icon" onClick={onBack}>
            ←
          </button>
        )}
      </div>
      
      <div className="header-center">
        <Link to="/" className="header-logo">
          <span>🎓</span> {logo}
        </Link>
      </div>
      
      <div className="header-right">
        {rightElement}
      </div>
    </header>
  );
};

Header.propTypes = {
  logo: PropTypes.string,
  showBack: PropTypes.bool,
  onBack: PropTypes.func,
  rightElement: PropTypes.node,
};

/**
 * Simple header with title
 */
const PageHeader = ({ title, showBack = false, onBack, actions }) => {
  return (
    <div className="page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {showBack && (
          <button className="btn-icon" onClick={onBack}>
            ←
          </button>
        )}
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>{title}</h2>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  showBack: PropTypes.bool,
  onBack: PropTypes.func,
  actions: PropTypes.node,
};

export { Header, PageHeader };
export default Header;