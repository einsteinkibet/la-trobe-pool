import PropTypes from 'prop-types';
import '../index.css';

/**
 * Ride card component for displaying rides in list
 */
const RideCard = ({ ride, onBook, onView, variant = 'default' }) => {
  if (!ride) return null;

  const {
    id,
    from_location: fromLoc,
    to_location: toLoc,
    date,
    time,
    seats,
    price,
    driver,
  } = ride;

  const driverName = driver?.name || ride.driver_name || 'Driver';
  const driverRating = driver?.rating || ride.driver_rating || 0;
  const driverVerified = driver?.verified || ride.driver_verified;
  // One rider per vehicle: a ride is either open or already taken — never "N seats".
  const seatsFree = ride.seatsAvailable ?? seats ?? 0;

  return (
    <div className="ride-card" onClick={() => onView?.(id)}>
      {/* Header with driver info */}
      <div className="ride-card-header">
        <div className="ride-avatar">
          {driverName.charAt(0).toUpperCase()}
        </div>
        <div className="ride-driver-info">
          <div className="ride-driver-name">
            {driverName} ⭐ {driverRating.toFixed(1)}
          </div>
          <div className="ride-rating">
            {driverVerified ? '✓ Verified' : 'Not verified'}
          </div>
        </div>
      </div>

      {/* Route */}
      <div className="ride-route">
        📍 {fromLoc} → 🎓 {toLoc}
      </div>

      {/* Meta info */}
      <div className="ride-meta">
        <span>📅 {date}</span>
        <span>🕐 {time}</span>
        <span>{seatsFree > 0 ? '🟢 Available' : '🔴 Taken'}</span>
      </div>

      {/* Footer with price and action */}
      <div className="ride-footer">
        <div>
          <div className="ride-price">${price}</div>
          <div className="ride-price-label">per ride</div>
        </div>
        
        <button 
          className="btn btn-success btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onBook?.(id);
          }}
        >
          Book
        </button>
      </div>
    </div>
  );
};

RideCard.propTypes = {
  ride: PropTypes.shape({
    id: PropTypes.string.isRequired,
    from_location: PropTypes.string,
    to_location: PropTypes.string,
    date: PropTypes.string,
    time: PropTypes.string,
    seats: PropTypes.number,
    price: PropTypes.number,
    driver: PropTypes.shape({
      name: PropTypes.string,
      rating: PropTypes.number,
      verified: PropTypes.bool,
    }),
  }).isRequired,
  onBook: PropTypes.func,
  onView: PropTypes.func,
  variant: PropTypes.oneOf(['default', 'compact', 'horizontal']),
};

export default RideCard;