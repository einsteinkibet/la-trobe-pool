# UniPool Figma Prototype Specification

## 🎨 Design System

### Colors
- **Primary:** #4F46E5 (Indigo)
- **Primary Dark:** #4338CA
- **Secondary:** #10B981 (Emerald Green)
- **Accent:** #F59E0B (Amber)
- **Background:** #F9FAFB
- **Surface:** #FFFFFF
- **Text Primary:** #1F2937
- **Text Secondary:** #6B7280
- **Error:** #EF4444
- **Success:** #10B981

### Typography
- **Headings:** Inter Bold
  - H1: 32px
  - H2: 24px
  - H3: 20px
- **Body:** Inter Regular, 16px
- **Caption:** Inter Regular, 14px

### Spacing System
- Base unit: 4px
- xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px

### Border Radius
- Small: 8px
- Medium: 12px
- Large: 16px
- Full: 9999px

---

## 📱 Screens / Frames

### 1. Splash Screen (375x812)
- App logo centered
- Tagline below
- "Get Started" button at bottom
- Background: Primary gradient

### 2. Onboarding (3 frames)
- Frame 1: "Save Money" - Illustration of coin/student
- Frame 2: "Make Friends" - Illustration of students together
- Frame 3: "Go Green" - Illustration of earth/leaf
- Skip button top-right
- Page indicators at bottom

### 3. Login Screen (375x812)
- Logo at top
- Email input field
- Password input field with show/hide toggle
- "Forgot Password?" link
- "Login" primary button
- "Don't have an account? Sign up" link
- Social login options (Google, Apple) - optional

### 4. Register Screen (375x812)
- Logo at top
- Name input
- Email input
- Password input (with strength indicator)
- University dropdown
- Student ID input (optional)
- "Create Account" button
- Terms & Privacy checkbox

### 5. Home Screen (Main) (375x812)
- Top: Search bar
- Tab bar at bottom: Home, Search, My Rides, Messages, Profile
- Hero banner with stats (800+ students, $12 avg, etc.)
- "Find a Ride" card (large)
- "Offer a Ride" card (large)
- Recent rides section (horizontal scroll)

### 6. Find Ride Screen (375x812)
- Search form at top:
  - From input with location icon
  - To input with location icon
  - Date picker
  - Passengers selector (1-4)
- "Search" button
- Results list below:
  - Each result: Driver avatar, name, rating
  - Route: From → To
  - Date, Time
  - Seats available (badges)
  - Price
  - "Book" button

### 7. Ride Details Screen (375x812)
- Map placeholder at top (gray)
- Driver info card:
  - Large avatar
  - Name, rating stars, verified badge
  - "View Reviews" link
- Ride details:
  - Route with direction arrow
  - Date, Time
  - Seats, Price
- Route details (waypoints)
- Notes from driver
- "Book Ride" button (fixed bottom)
- Message driver icon (top right)

### 8. Driver Profile Modal (375x400 overlay)
- Large avatar
- Name, Verified badge
- Rating with stars
- Total rides count
- Reviews list:
  - Reviewer name, date
  - Rating stars
  - Comment

### 9. Offer Ride Screen (375x812)
- Form:
  - From input
  - To input
  - Add waypoints button
  - Date picker
  - Time picker
  - Seats selector
  - Price input
  - Notes textarea
- "Create Ride" button

### 10. My Rides Screen (375x812)
- Segmented control: As Driver | As Passenger
- Ride cards:
  - Route
  - Date, Time
  - Status badge (Confirmed, Pending, Completed)
  - Chat button

### 11. Chat Screen (375x812)
- Conversation list (left) or Chat view (right on tablet)
- Each conversation shows:
  - Driver/Passenger avatar
  - Name
  - Last message preview
  - Time
  - Unread count badge
- Chat view:
  - Header: Back button, Name, Ride info
  - Messages: Bubbles (left=other, right=user)
  - Input: Text field, Send button

### 12. Route Match Screen (375x812)
- Toggle: Find Passengers | Find Drivers
- Route input:
  - From
  - To
- "Find Matches" button
- Results with match percentage:
  - 90-100% = Green border
  - 70-89% = Amber border
  - <70% = Gray border

### 13. Profile Screen (375x812)
- User info section:
  - Avatar (editable)
  - Name
  - University
  - Rating
- Menu items:
  - Edit Profile
  - My Reviews
  - Payment Methods
  - Settings
  - Help & Support
  - Logout

### 14. Booking Confirmation Modal (overlay)
- Success icon
- "Booking Confirmed!"
- Ride details summary
- Driver contact button
- "Done" button

---

## 🧩 Components Library (Figma)

### Buttons
- Primary (filled, primary color)
- Secondary (outlined)
- Success (green)
- Danger (red)
- Disabled state

### Input Fields
- Text input
- Password input
- Date picker
- Time picker
- Dropdown/Select
- Search input

### Cards
- Ride card (horizontal)
- Driver card
- Booking card
- Stats card

### Badges
- Status badges (confirmed, pending, etc.)
- Rating stars
- Verified badge
- Seats available

### Navigation
- Tab bar
- Header
- Bottom sheet

### Feedback
- Toast notifications
- Loading spinners
- Empty states

---

## 🔗 Figma Access

To create this prototype in Figma:

1. **Go to:** https://www.figma.com
2. **Create new file:** "UniPool Prototype"
3. **Use these tools:**
   - Frames (F): Create each screen
   - Components (Ctrl+Alt+K): Create reusable elements
   - Auto Layout (Shift+A): For responsive lists
   - Prototype (O): Connect screens with interactions

### Figma Credentials to Provide:
When ready, share your Figma credentials and I can help design directly in Figma.

---

## 📋 Documentation Locations

### Research Document
- **Path:** `/home/stainless/.openclaw/workspace/carpool-startup-research.md`

### Frontend Code
- **Path:** `/home/stainless/.openclaw/workspace/unipool/`
- **Package.json:** `/home/stainless/.openclaw/workspace/unipool/package.json`
- **Main App:** `/home/stainless/.openclaw/workspace/unipool/src/App.jsx`
- **Styles:** `/home/stainless/.openclaw/workspace/unipool/src/index.css`

### Backend Code
- **Path:** `/home/stainless/.openclaw/workspace/unipool-backend/`
- **Main Server:** `/home/stainless/.openclaw/workspace/unipool-backend/src/server.js`
- **Routes:** `/home/stainless/.openclaw/workspace/unipool-backend/src/routes/`
- **Controllers:** `/home/stainless/.openclaw/workspace/unipool-backend/src/controllers/`
- **Middleware:** `/home/stainless/.openclaw/workspace/unipool-backend/src/middleware/`

### User Requirements
- **Path:** `/home/stainless/.openclaw/workspace/needs.txt`

---

## 🔐 Security Features Implemented

### Backend Security
1. **Helmet.js** - HTTP security headers
2. **CORS** - Configured for frontend origin
3. **Rate Limiting** - Prevents abuse
4. **Input Validation** - Express-validator
5. **Input Sanitization** - XSS prevention
6. **Password Hashing** - bcrypt (12 rounds)
7. **JWT Authentication** - Secure token-based auth
8. **SQL Injection Prevention** - Parameterized queries
9. **Error Handling** - No stack traces leaked

### API Endpoints
```
POST   /api/auth/register     - Register new user
POST   /api/auth/login        - Login
GET    /api/auth/me           - Get current user
PUT    /api/auth/me           - Update profile
GET    /api/auth/users/:id    - Get user profile

GET    /api/rides             - Search rides
POST   /api/rides             - Create ride
GET    /api/rides/:id         - Get ride details
PUT    /api/rides/:id         - Update ride
DELETE /api/rides/:id         - Cancel ride
GET    /api/rides/match       - Route matching
GET    /api/rides/my/list     - My rides as driver

POST   /api/bookings/:rideId - Book a ride
GET    /api/bookings/my      - My bookings
GET    /api/bookings/driver   - Bookings for my rides
PUT    /api/bookings/:id      - Update booking status

POST   /api/chat/:rideId      - Send message
GET    /api/chat/:rideId      - Get messages
GET    /api/chat             - Get conversations

POST   /api/reviews/:rideId   - Create review
GET    /api/reviews/user/:id  - Get user reviews
GET    /api/reviews/my       - My reviews
```

### Running Both Servers
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
