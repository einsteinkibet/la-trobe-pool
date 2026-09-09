import PropTypes from 'prop-types';
import '../index.css';

/**
 * Bottom navigation component
 */
const NAV_ITEMS = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'find', icon: '🔍', label: 'Search' },
  { id: 'routes', icon: '🛣️', label: 'Routes' },
  { id: 'connections', icon: '🤝', label: 'Requests' },
  { id: 'rides', icon: '📋', label: 'My Rides' },
];

const BottomNav = ({ currentTab, onTabChange }) => {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
          onClick={() => onTabChange(item.id)}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span className="nav-item-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

BottomNav.propTypes = {
  currentTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
};

export default BottomNav;