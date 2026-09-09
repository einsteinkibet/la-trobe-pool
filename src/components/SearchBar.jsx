import PropTypes from 'prop-types';
import LocationInput from './LocationInput';
import '../index.css';

/**
 * Search bar component for finding rides
 */
const SearchBar = ({
  from,
  setFrom,
  to,
  setTo,
  date,
  setDate,
  onSearch,
  loading = false,
}) => {
  return (
    <div className="search-section">
      <LocationInput
        label="From"
        value={from}
        onChange={setFrom}
        placeholder="Pickup location"
        icon="📍"
      />
      
      <LocationInput
        label="To"
        value={to}
        onChange={setTo}
        placeholder="Dropoff location"
        icon="🎯"
      />
      
      <div className="form-group">
        <label className="form-label">Date</label>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <button 
        className="btn btn-primary" 
        style={{ marginTop: '1rem', width: '100%' }}
        onClick={onSearch}
        disabled={loading}
      >
        {loading ? 'Searching...' : '🔍 Search Rides'}
      </button>
    </div>
  );
};

SearchBar.propTypes = {
  from: PropTypes.string.isRequired,
  setFrom: PropTypes.func.isRequired,
  to: PropTypes.string.isRequired,
  setTo: PropTypes.func.isRequired,
  date: PropTypes.string.isRequired,
  setDate: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default SearchBar;