import { useState } from 'react';
import PropTypes from 'prop-types';
import LocationInput from '../components/LocationInput';
import MatchedRiders from '../components/MatchedRiders';
import { LOCATIONS, VEHICLE_TYPES } from '../utils/constants';
import { ridesApi } from '../utils/api';
import '../index.css';

/**
 * Offer Ride page - create a new ride offer
 */
const OfferRidePage = ({ onBack, showToast, user, onNavigate }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('La Trobe University (Bundoora)');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('08:00');
  const [seats, setSeats] = useState(3);
  const [vehicleType, setVehicleType] = useState('sedan');
  const [loading, setLoading] = useState(false);
  const [routePolyline, setRoutePolyline] = useState(null);

  const handleCreateRide = async () => {
    if (!user) {
      showToast?.('Log in to offer a ride — any account can both ride and drive');
      onNavigate?.('login');
      return;
    }
    if (!from) {
      showToast?.('Enter your pickup location');
      return;
    }
    setLoading(true);

    try {
      // Fares are computed per-rider at $0.50/km on booking, so no price is set here.
      await ridesApi.create({
        from: from,
        to: to,
        date,
        time,
        seats: parseInt(seats),
        price: 0,
        vehicle: vehicleType,
        route_polyline: routePolyline,
      });

      showToast?.('Ride created! 🎉 Riders along your route can now be matched.');
      onNavigate ? onNavigate('rides') : onBack?.();
    } catch (err) {
      if (err.code === 'NOT_VERIFIED') {
        showToast?.('Verify your student ID first to offer rides');
        onNavigate?.('verification');
      } else {
        showToast?.(err.message || 'Failed to create ride');
      }
    }

    setLoading(false);
  };

  const vehicleOptions = Object.entries(VEHICLE_TYPES).map(([key, val]) => ({
    value: key,
    label: `${val.icon} ${val.label}`,
  }));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>🚗 Offer a Ride</h2>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <LocationInput
          label="From (Pickup)"
          value={from}
          onChange={setFrom}
          placeholder=" pickup location"
          icon="📍"
        />
        
        <LocationInput
          label="To (Destination)"
          value={to}
          onChange={setTo}
          placeholder=" destination"
          icon="🎯"
        />

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Time</label>
            <input
              className="form-input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Seats Available</label>
          <select
            className="form-input"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Vehicle Type</label>
          <select
            className="form-input"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          >
            {vehicleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-success"
          style={{ marginTop: '0.5rem', width: '100%' }}
          onClick={handleCreateRide}
          disabled={loading || !from}
        >
          {loading ? 'Creating...' : 'Create Ride'}
        </button>
      </div>

      {/* Auto-matched riders along the driver's route */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>🎯 Riders Along Your Route</h4>
        <p style={{ fontSize: '0.78rem', color: '#888', margin: '0 0 0.5rem' }}>
          Preview only. Create the ride, then invite riders from <strong>My Rides → As Driver</strong>.
        </p>
        <MatchedRiders from={from} to={to} />
      </div>

      {/* How earnings work */}
      <div className="card" style={{ padding: '1rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>💰 How you earn</h4>
        <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
          Each rider pays <strong>$0.50/km</strong> for their trip, held securely in escrow.
          You keep <strong>90%</strong>; UniPool takes a 10% service fee. Earnings are released
          to your wallet when you mark the ride complete.
        </p>
      </div>
    </>
  );
};

OfferRidePage.propTypes = {
  onBack: PropTypes.func.isRequired,
  showToast: PropTypes.func,
  user: PropTypes.object,
  onNavigate: PropTypes.func,
};

export default OfferRidePage;