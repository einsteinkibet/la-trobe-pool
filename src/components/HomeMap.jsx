import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LA_TROBE_CAMPUS, SUBURB_DEMAND } from '../utils/constants';

/**
 * HomeMap — La Trobe commuter map (Leaflet / OpenStreetMap, no API key needed).
 *
 * Shows:
 *  - Commuter CORRIDORS: a line from each suburb to La Trobe Bundoora, whose
 *    thickness + colour is weighted by how many students commute that route.
 *  - POPULATION DENSITY: a circle per suburb, sized by student count.
 */

// Demand → colour ramp (low → high student density)
const demandColor = (students) => {
  if (students >= 350) return '#b91c1c'; // high  - red
  if (students >= 250) return '#ea580c'; // med-hi- orange
  if (students >= 150) return '#ca8a04'; // medium- amber
  return '#15803d';                      // low   - green
};

const HomeMap = ({ height = '260px', onSuburbClick }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const maxStudents = Math.max(...SUBURB_DEMAND.map((s) => s.students));

    const map = L.map(containerRef.current, {
      center: [LA_TROBE_CAMPUS.lat, LA_TROBE_CAMPUS.lng],
      zoom: 11,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const campus = [LA_TROBE_CAMPUS.lat, LA_TROBE_CAMPUS.lng];

    // Draw corridors first (so density circles sit on top)
    SUBURB_DEMAND.forEach((s) => {
      const weight = 1 + (s.students / maxStudents) * 7; // 1–8px by demand
      L.polyline([[s.lat, s.lng], campus], {
        color: demandColor(s.students),
        weight,
        opacity: 0.55,
      }).addTo(map);
    });

    // Density circles per suburb (radius ∝ √students so area ≈ population)
    SUBURB_DEMAND.forEach((s) => {
      const radius = 6 + Math.sqrt(s.students) * 1.1;
      const circle = L.circleMarker([s.lat, s.lng], {
        radius,
        color: demandColor(s.students),
        fillColor: demandColor(s.students),
        fillOpacity: 0.45,
        weight: 1.5,
      }).addTo(map);
      circle.bindPopup(
        `<strong>${s.name}</strong><br/>${s.students} students commuting<br/><em>Tap to find rides</em>`
      );
      if (onSuburbClick) circle.on('click', () => onSuburbClick(s));
    });

    // Campus marker (use a divIcon to avoid Leaflet's broken default-icon path under bundlers)
    const campusIcon = L.divIcon({
      className: 'campus-pin',
      html: '<div style="font-size:24px;line-height:1">🎓</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker(campus, { icon: campusIcon })
      .addTo(map)
      .bindPopup('<strong>La Trobe University</strong><br/>Bundoora Campus');

    // Fit to show all suburbs + campus
    const bounds = L.latLngBounds([
      campus,
      ...SUBURB_DEMAND.map((s) => [s.lat, s.lng]),
    ]);
    map.fitBounds(bounds, { padding: [24, 24] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onSuburbClick]);

  return (
    <div className="home-map-wrap">
      <div ref={containerRef} style={{ height, width: '100%', borderRadius: '12px', zIndex: 0 }} />
      <div className="map-legend">
        <span><i style={{ background: '#b91c1c' }} /> High</span>
        <span><i style={{ background: '#ea580c' }} /> Med-High</span>
        <span><i style={{ background: '#ca8a04' }} /> Medium</span>
        <span><i style={{ background: '#15803d' }} /> Low</span>
      </div>
    </div>
  );
};

HomeMap.propTypes = {
  height: PropTypes.string,
  onSuburbClick: PropTypes.func,
};

export default HomeMap;
