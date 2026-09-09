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
  { id: 'messages', icon: '💬', label: 'Chat' },
  { id: 'rides', icon: '📋', label: 'Rides' },
];

const BottomNav = ({ currentTab, onTabChange, unreadMessages = 0 }) => {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
          onClick={() => onTabChange(item.id)}
          style={{ position: 'relative' }}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span className="nav-item-label">{item.label}</span>
          {item.id === 'messages' && unreadMessages > 0 && (
            <span className="badge">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
          )}
        </button>
      ))}
    </nav>
  );
};

BottomNav.propTypes = {
  currentTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  unreadMessages: PropTypes.number,
};

export default BottomNav;
