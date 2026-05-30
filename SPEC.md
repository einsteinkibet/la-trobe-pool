# LaTrobePool - Carpool App Specification

## 🎯 Project Overview
**LaTrobePool** - A carpooling app for La Trobe University students

---

## 🗺️ Real Routes & Locations

### Supported Locations (with Coordinates)
| Location | Coordinates | Type |
|----------|-------------|------|
| La Trobe University (Bundoora) | -37.7217, 145.0463 | Campus |
| La Trobe City Campus | -37.8136, 144.9631 | Campus |
| Melbourne CBD | -37.8136, 144.9631 | City |
| Richmond Station | -37.8182, 144.9858 | Station |
| Footscray Station | -37.8044, 144.9078 | Station |
| Doreen | -37.6512, 145.0866 | Suburb |
| Whittlesea | -37.5140, 145.1219 | Suburb |
| Craigieburn | -37.6029, 144.9281 | Suburb |
| Reservoir | -37.7154, 145.0421 | Suburb |
| Preston | -37.7406, 145.0172 | Suburb |
| Glen Waverley | -37.8797, 145.1636 | Suburb |
| Doncaster | -37.8236, 145.1245 | Suburb |
| South Morang | -37.6389, 145.0741 | Station |
| University of Melbourne | -37.7964, 144.9612 | Campus |
| RMIT University | -37.8082, 144.9636 | Campus |

---

## 💰 Cost Calculation System

### Formula
```
Total Trip Cost = (Distance / 100) × Fuel Consumption × Fuel Price × 1.30 (overhead)

Passenger Fare = max($5, Total Cost × 0.8) / 3 passengers

Driver Earnings = Passenger Fare × 0.90
Platform Fee = Passenger Fare × 0.10
```

### Vehicle Types
| Vehicle | Consumption (L/100km) | Icon |
|---------|----------------------|------|
| Sedan | 7.5 | 🚗 |
| SUV | 10.5 | 🚙 |
| Luxury | 9.0 | 🏎️ |
| Hybrid | 4.5 | 🔋 |
| Electric | 0 (8c/km) | ⚡ |
| Ute | 12.0 | 🛻 |

### Current Fuel Prices (Melbourne)
- Unleaded: $1.85/L
- Diesel: $1.95/L
- Premium: $2.10/L
- Electric: $0.35/kWh

### Example Routes
| Route | Distance | Sedan Cost | Per Person |
|-------|----------|------------|------------|
| CBD → La Trobe | 18.5km | $4.45 | $5 (min) |
| Doreen → La Trobe | 8.5km | $2.04 | $5 |
| Richmond → La Trobe | 16.2km | $3.89 | $5 |

---

## 💳 Payment System

### Supported Methods
1. **Credit/Debit Card** - Visa, Mastercard, Amex
2. **Bank Transfer** - Direct debit
3. **PayPal** - PayPal balance

### Payment Flow
1. User adds payment method (stored securely)
2. When booking → Payment authorized
3. After ride completed → Payment captured
4. Driver paid within 24-48 hours

### Revenue Model
| Component | Amount |
|-----------|--------|
| Platform Fee | 10% |
| Driver Earnings | 90% |
| Booking Fee | $0.50 |
| Minimum Fare | $5.00 |

---

## 💵 Ways to Earn Money

### 1. Drive Students
- Set own schedule
- Earn $200-800/month potential
- 90% of fare goes to driver

### 2. Referral Program
- $10 credit per referral
- Unlimited referrals
- Both parties get credits

### 3. Future Revenue Streams
- **University Partnerships**: Unis pay to reduce parking
- **In-app Advertising**: Local businesses
- **Route Data**: Sold to transport planners (anonymized)
- **Premium Verification**: $5 one-time fee
- **Scheduled Ride Priority**: $1 extra fee

---

## 🔧 Google Maps Integration

### APIs Required
1. **Routes API** - Route calculation
2. **Distance Matrix API** - Travel times
3. **Places API** - Location autocomplete
4. **Geocoding API** - Address to coords

### API Setup
1. Go to Google Cloud Console
2. Create project
3. Enable above APIs
4. Get API key
5. Add to .env:
```
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

---

## 📱 Technical Stack

### Frontend
- React + Vite
- CSS Modules
- Google Maps JavaScript API

### Backend (for production)
- Node.js + Express
- PostgreSQL
- JWT Auth
- Stripe (payments)

---

## ✅ Features Completed

- [x] Real location coordinates
- [x] Distance calculation (Haversine)
- [x] Cost estimation by vehicle type
- [x] Fuel price integration
- [x] Multiple payment methods UI
- [x] Driver earnings display
- [x] Revenue model display

---

*Updated: March 2026*
