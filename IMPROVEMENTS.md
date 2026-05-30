# UniPool - Current State & Improvements

## ✅ Current Properties

### Frontend (React)
- Basic ride search & offer forms
- Mock data for rides
- Tab navigation (Find Ride, Offer Ride, My Rides, Route Match)
- Chat modal with driver
- Driver profiles with ratings/reviews
- Basic styling with CSS

### Backend (Node.js + SQLite)
- User authentication (register/login)
- CRUD for rides, bookings, messages, reviews
- JWT-based security
- Input validation & sanitization
- Rate limiting
- Basic route matching algorithm

---

## 🔧 Improvements Needed

### High Priority
| Issue | Solution |
|-------|----------|
| No real maps | Integrate Google Maps API |
| Generic "university" | Focus on La Trobe University |
| Mock data only | Connect to backend API |
| No real-time updates | Add WebSocket/Polling |
| No push notifications | Add notification system |

### Features to Add
| Feature | Benefit |
|---------|---------|
| Google Maps integration | Show routes, pickup points |
| La Trobe University branding | Target specific student market |
| Real-time seat availability | Prevents overbooking |
| Ride reminders | Notification 1hr before |
| Student verification | .edu email only |
| Emergency contact | Safety feature |
| In-app payments (later) | Revenue stream |

### Technical Improvements
- Connect frontend to backend API
- Add environment variables for API keys
- Add loading states
- Add error handling
- Mobile-responsive polish

---

## 🎯 La Trobe University Features

### Popular Routes
- Bundoora → Melbourne CBD
- Bundoora → Footscray
- Bundoora → Doreen/Whittlesea
- Bundoora → Craigieburn

### Campus Spots
- Main Campus (Bundoora)
- City Campus (Melbourne)
- Shepparton Campus
- Mildura Campus
- Bendigo Campus

### Integration Points
- La Trobe library locations
- Student parking zones
- Public transport hubs near campus

---

## 🗺️ Google Maps Features

### To Implement
1. **Place Autocomplete** - Search locations with suggestions
2. **Directions API** - Show route on map
3. **Geocoding** - Convert addresses to coords
4. **Distance Matrix** - Calculate fare estimates
5. **Static Maps** - Show ride route

### API Key Needed
Get free API key from: https://console.cloud.google.com/

---

*Document updated: March 2026*
