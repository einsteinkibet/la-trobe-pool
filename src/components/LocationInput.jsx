import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { LOCATIONS } from '../utils/constants';
import { geocodeApi } from '../utils/api';
import '../index.css';

const iconFor = (type) =>
  type === 'campus' ? '🎓'
    : type === 'station' ? '🚉'
      : type === 'city' ? '🏙️'
        : '📍';

// Always-available anchors (campus, key stations/suburbs) shown instantly and
// merged above the live geocoder results — so La Trobe etc. never depend on the
// network.
const staticMatches = (q) =>
  LOCATIONS
    .filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
    .map((l) => ({ name: l.name, suburb: l.name, lat: l.lat, lng: l.lng, type: l.type }));

/**
 * Address input with real Australian autocomplete. As the user types we hit the
 * backend geocoder (OSM/Nominatim) and surface real places; selecting one calls
 * onSelect({ name, suburb, lat, lng }) so the parent gets coordinates without
 * the user ever having to know them.
 */
const LocationInput = ({ label, value, onChange, onSelect, placeholder, icon = '📍' }) => {
  const inputRef = useRef(null);
  const suppressRef = useRef(false); // skip a search right after a select / programmatic set
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (suppressRef.current) { suppressRef.current = false; return; }
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); setLoading(false); return; }

    // Instant local hits while we wait for the debounced network call.
    setSuggestions(staticMatches(q));
    if (q.length < 3) return undefined;

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const remote = await geocodeApi.search(q);
        if (cancelled) return;
        const locals = staticMatches(q);
        const seen = new Set(locals.map((l) => l.name.toLowerCase()));
        setSuggestions([...locals, ...remote.filter((r) => !seen.has(r.name.toLowerCase()))]);
      } catch {
        /* keep the local matches on geocoder failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [value]);

  const handleSelect = (place) => {
    suppressRef.current = true;
    onChange(place.name);
    onSelect?.(place);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          e.preventDefault();
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="location-input-wrapper">
      {label && <label className="form-label">{label}</label>}
      <div className="search-input-group">
        <span className="icon">{icon}</span>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onSelect?.(null); // typing invalidates a previously-selected place
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>

      {showSuggestions && (suggestions.length > 0 || loading) && (
        <ul className="location-suggestions">
          {suggestions.map((loc, index) => (
            <li
              key={`${loc.name}-${loc.lat}-${loc.lng}`}
              className={`suggestion-item ${index === highlightedIndex ? 'highlighted' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(loc)}
            >
              <span className="suggestion-icon">{iconFor(loc.type)}</span>
              <div className="suggestion-details">
                <div className="suggestion-name">{loc.name}</div>
                {loc.type && <div className="suggestion-type">{loc.type}</div>}
              </div>
            </li>
          ))}
          {loading && (
            <li className="suggestion-item" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              <span className="suggestion-icon">🔎</span>
              <div className="suggestion-details">Searching addresses…</div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

LocationInput.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSelect: PropTypes.func,
  placeholder: PropTypes.string,
  icon: PropTypes.string,
};

export default LocationInput;
