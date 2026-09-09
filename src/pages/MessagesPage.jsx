import PropTypes from 'prop-types';
import '../index.css';

/**
 * Messages page - conversations
 */
const MessagesPage = ({ onBack }) => {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>💬 Messages</h2>
      </div>
      
      <div className="empty-state">
        <div className="empty-icon">💬</div>
        <h3>No messages yet</h3>
        <p>Book a ride to start chatting with drivers</p>
      </div>
    </>
  );
};

MessagesPage.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default MessagesPage;