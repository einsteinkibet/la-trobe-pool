// API configuration.
// Local dev: leave VITE_API_URL unset — requests hit '/api' and Vite proxies
// them to the backend (see vite.config.js). Production: set VITE_API_URL to the
// deployed backend origin, e.g. VITE_API_URL="https://api.unipool.app/api".
export const API_URL = import.meta.env.VITE_API_URL || '/api';

// Predefined locations supported by the app
export const LOCATIONS = [
  { name: 'La Trobe University (Bundoora)', lat: -37.7217, lng: 145.0463, type: 'campus' },
  { name: 'La Trobe City Campus (Melbourne)', lat: -37.8136, lng: 144.9631, type: 'campus' },
  { name: 'Melbourne CBD', lat: -37.8136, lng: 144.9631, type: 'city' },
  { name: 'Richmond Station', lat: -37.8182, lng: 144.9858, type: 'station' },
  { name: 'Footscray Station', lat: -37.8044, lng: 144.9078, type: 'station' },
  { name: 'Doreen', lat: -37.6512, lng: 145.0866, type: 'suburb' },
  { name: 'Whittlesea', lat: -37.5140, lng: 145.1219, type: 'suburb' },
  { name: 'Craigieburn', lat: -37.6029, lng: 144.9281, type: 'suburb' },
  { name: 'Reservoir', lat: -37.7154, lng: 145.0421, type: 'suburb' },
  { name: 'Preston', lat: -37.7406, lng: 145.0172, type: 'suburb' },
  { name: 'Glen Waverley', lat: -37.8797, lng: 145.1636, type: 'suburb' },
  { name: 'Doncaster', lat: -37.8236, lng: 145.1245, type: 'suburb' },
  { name: 'South Morang', lat: -37.6389, lng: 145.0741, type: 'station' },
  { name: 'University of Melbourne', lat: -37.7964, lng: 144.9612, type: 'campus' },
  { name: 'RMIT University', lat: -37.8082, lng: 144.9636, type: 'campus' },
];

// Onboarding slides — lead with the customer "pullers"
export const ONBOARDING_SLIDES = [
  { icon: '🤝', title: 'Make Friends', desc: 'Meet La Trobe students heading exactly your way' },
  { icon: '🛣️', title: 'Always On The Way', desc: 'We match you with a driver already on your route' },
  { icon: '⏱️', title: 'Skip the Waiting Bays', desc: 'No more standing around for late buses and trams' },
  { icon: '🎓', title: 'Get to Class Early', desc: 'Reliable door-to-campus commutes, every time' },
];

// Vehicle types for cost calculation
export const VEHICLE_TYPES = {
  sedan: { consumption: 7.5, icon: '🚗', label: 'Sedan' },
  suv: { consumption: 10.5, icon: '🚙', label: 'SUV' },
  luxury: { consumption: 9.0, icon: '🏎️', label: 'Luxury' },
  hybrid: { consumption: 4.5, icon: '🔋', label: 'Hybrid' },
  electric: { consumption: 0, icon: '⚡', label: 'Electric' },
  ute: { consumption: 12.0, icon: '🛻', label: 'Ute' },
};

// Current fuel prices (Melbourne)
export const FUEL_PRICES = {
  unleaded: 1.85,
  diesel: 1.95,
  premium: 2.10,
  electric: 0.35,
};

// Pricing constants
export const PRICING = {
  MIN_FARE: 5,
  PLATFORM_FEE_PERCENT: 10,
  DRIVER_EARNINGS_PERCENT: 90,
  BOOKING_FEE: 0.50,
  OVERHEAD_MULTIPLIER: 1.30,
};

// Calculate trip cost
export const calculateTripCost = (distanceKm, vehicleType = 'sedan') => {
  const consumption = VEHICLE_TYPES[vehicleType]?.consumption || 7.5;
  const fuelPrice = vehicleType === 'electric' ? FUEL_PRICES.electric : FUEL_PRICES.unleaded;
  
  if (vehicleType === 'electric') {
    return (distanceKm / 100) * 8 * 100 + (distanceKm * fuelPrice);
  }
  
  const fuelUsed = (distanceKm / 100) * consumption;
  const fuelCost = fuelUsed * fuelPrice;
  return fuelCost * PRICING.OVERHEAD_MULTIPLIER;
};

// Calculate passenger fare
export const calculatePassengerFare = (tripCost, numPassengers = 3) => {
  const passengerShare = tripCost / numPassengers;
  return Math.max(PRICING.MIN_FARE, passengerShare * 0.8);
};

// Calculate driver earnings
export const calculateDriverEarnings = (passengerFare) => {
  return (passengerFare * PRICING.DRIVER_EARNINGS_PERCENT) / 100;
};

// Haversine distance calculation
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get location by name
export const getLocationByName = (name) => {
  return LOCATIONS.find(loc => loc.name === name);
};

// La Trobe Bundoora — the hub all corridors point to
export const LA_TROBE_CAMPUS = { name: 'La Trobe University (Bundoora)', lat: -37.7217, lng: 145.0463 };

/**
 * Student commuter demand by suburb (approx. La Trobe Bundoora catchment).
 * `students` = estimated La Trobe students commuting from that suburb — drives
 * both the density circles and the corridor line weight on the home map.
 */
export const SUBURB_DEMAND = [
  { name: 'Reservoir',     lat: -37.7154, lng: 145.0421, students: 420 },
  { name: 'Preston',       lat: -37.7406, lng: 145.0172, students: 310 },
  { name: 'Bundoora',      lat: -37.7000, lng: 145.0600, students: 380 },
  { name: 'Thomastown',    lat: -37.6830, lng: 145.0150, students: 260 },
  { name: 'Epping',        lat: -37.6400, lng: 145.0300, students: 290 },
  { name: 'South Morang',  lat: -37.6389, lng: 145.0741, students: 240 },
  { name: 'Doreen',        lat: -37.6512, lng: 145.0866, students: 180 },
  { name: 'Craigieburn',   lat: -37.6029, lng: 144.9281, students: 200 },
  { name: 'Whittlesea',    lat: -37.5140, lng: 145.1219, students: 90 },
  { name: 'Melbourne CBD', lat: -37.8136, lng: 144.9631, students: 350 },
  { name: 'Richmond',      lat: -37.8182, lng: 144.9858, students: 160 },
  { name: 'Footscray',     lat: -37.8044, lng: 144.9078, students: 140 },
  { name: 'Glen Waverley', lat: -37.8797, lng: 145.1636, students: 110 },
  { name: 'Doncaster',     lat: -37.8236, lng: 145.1245, students: 130 },
];