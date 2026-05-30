import { useState, useEffect } from 'react'
import './index.css'

// ==================== CONSTANTS ====================
// Use proxy in dev (Vite proxies /api to backend)
const API_URL = '/api'

const LOCATIONS = [
  'La Trobe University (Bundoora)', 'La Trobe City Campus (Melbourne)',
  'Melbourne CBD', 'Richmond Station', 'Footscray Station',
  'Doreen', 'Whittlesea', 'Craigieburn', 'Reservoir', 'Preston',
  'Glen Waverley', 'Doncaster', 'South Morang',
  'University of Melbourne', 'RMIT University'
]

// ==================== SPLASH ====================
function SplashScreen({ onComplete }) {
  return (
    <div className="splash">
      <div className="splash-logo">🎓</div>
      <h1>UniPool</h1>
      <p>Ride together. Save money.</p>
      <button className="btn btn-primary" style={{maxWidth: '280px'}} onClick={onComplete}>Get Started</button>
    </div>
  )
}

// ==================== ONBOARDING ====================
const SLIDES = [
  { icon: '💰', title: 'Save Money', desc: 'Split ride costs with other students going your way' },
  { icon: '👥', title: 'Make Friends', desc: 'Meet other students traveling the same route' },
  { icon: '🌍', title: 'Go Green', desc: 'Reduce your carbon footprint together' }
]

function Onboarding({ onComplete }) {
  const [slide, setSlide] = useState(0)
  return (
    <div className="onboarding">
      <div className="onboarding-header">
        <button className="onboarding-skip" onClick={onComplete}>Skip →</button>
      </div>
      <div className="onboarding-content">
        <div className="onboarding-icon">{SLIDES[slide].icon}</div>
        <h2 className="onboarding-title">{SLIDES[slide].title}</h2>
        <p className="onboarding-desc">{SLIDES[slide].desc}</p>
      </div>
      <div className="onboarding-dots">
        {[0,1,2].map(i => <div key={i} className={`onboarding-dot ${i === slide ? 'active' : ''}`} />)}
      </div>
      <button className="btn btn-primary" style={{maxWidth: '320px', margin: '0 auto'}} onClick={() => slide < 2 ? setSlide(slide+1) : onComplete()}>
        {slide === 2 ? 'Get Started' : 'Next'}
      </button>
    </div>
  )
}

// ==================== HOMEPAGE (Main Screen) ====================
function HomeScreen({ onNavigate }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('2026-03-30')

  return (
    <>
      {/* Hero Banner */}
      <div className="hero">
        <h2>🎓 UniPool La Trobe</h2>
        <p>Find or offer rides to campus easily</p>
        <div style={{display:'flex', gap:'0.5rem', justifyContent:'center', flexWrap:'wrap'}}>
          <span style={{background:'rgba(255,255,255,0.2)', padding:'0.25rem 0.75rem', borderRadius:'9999px', fontSize:'0.8rem'}}>🏫 La Trobe Bundoora</span>
          <span style={{background:'rgba(255,255,255,0.2)', padding:'0.25rem 0.75rem', borderRadius:'9999px', fontSize:'0.8rem'}}>🏙️ City Campus</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="quick-card find" onClick={() => onNavigate('find')}>
          <div className="quick-card-icon">🔍</div>
          <h3>Find a Ride</h3>
          <p>Search for available rides</p>
        </div>
        <div className="quick-card offer" onClick={() => onNavigate('offer')}>
          <div className="quick-card-icon">🚗</div>
          <h3>Offer a Ride</h3>
          <p>Earn money driving</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-chip"><div className="stat-chip-value">800+</div><div className="stat-chip-label">Students</div></div>
        <div className="stat-chip"><div className="stat-chip-value">$12</div><div className="stat-chip-label">Avg Fare</div></div>
        <div className="stat-chip"><div className="stat-chip-value">10%</div><div className="stat-chip-label">Platform</div></div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <h3>🔍 Find a Ride</h3>
        <div className="search-input-wrap">
          <div className="search-input-group">
            <span className="icon">📍</span>
            <input list="locs" placeholder="From (e.g. Richmond Station)" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="search-input-group">
            <span className="icon">🎯</span>
            <input list="locs" placeholder="To (e.g. La Trobe Bundoora)" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <datalist id="locs">{LOCATIONS.map(l => <option key={l} value={l} />)}</datalist>
        <div className="search-row">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <select>
            <option>1 passenger</option>
            <option>2 passengers</option>
            <option>3 passengers</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{marginTop: '1rem'}} onClick={() => onNavigate('find')}>Search Rides</button>
      </div>

      {/* Recent Rides */}
      <div className="rides-section">
        <h3>🚗 Recent Rides</h3>
        {[1,2,3].map(i => (
          <div key={i} className="ride-card">
            <div className="ride-card-header">
              <div className="ride-avatar">A</div>
              <div className="ride-driver-info">
                <div className="ride-driver-name">Alex T. ⭐ 4.8</div>
                <div className="ride-rating">Verified Driver</div>
              </div>
            </div>
            <div className="ride-route">📍 Richmond Station → 🎓 La Trobe Bundoora</div>
            <div className="ride-meta">
              <span>📅 Mar 31</span>
              <span>🕐 8:30 AM</span>
              <span>👥 2 seats</span>
            </div>
            <div className="ride-footer">
              <div><div className="ride-price">$8</div><div className="ride-price-label">per person</div></div>
              <button className="btn btn-success btn-sm">Book</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ==================== FIND RIDE SCREEN ====================
function FindRideScreen({ onBack }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('2026-03-30')
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(false)

  const searchRides = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      const res = await fetch(`${API_URL}/rides?${params}`)
      const data = await res.json()
      setRides(data.rides || [])
    } catch (e) {
      // fallback mock data
      setRides([
        { id: 1, from_location: from || 'Richmond Station', to_location: to || 'La Trobe Bundoora', date: 'Mar 31', time: '8:30 AM', seats: 3, price: 8, driver: { name: 'Alex T.', rating: 4.8 } },
        { id: 2, from_location: from || 'Doreen', to_location: to || 'La Trobe Bundoora', date: 'Mar 31', time: '9:00 AM', seats: 2, price: 6, driver: { name: 'Maya K.', rating: 4.9 } },
        { id: 3, from_location: from || 'Melbourne CBD', to_location: to || 'La Trobe Bundoora', date: 'Mar 31', time: '7:45 AM', seats: 1, price: 10, driver: { name: 'Sam L.', rating: 4.6 } },
      ])
    }
    setLoading(false)
  }

  return (
    <>
      <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{fontSize:'1.1rem', fontWeight:'600'}}>🔍 Find a Ride</h2>
      </div>

      <div className="search-section">
        <div className="search-input-wrap">
          <div className="search-input-group">
            <span className="icon">📍</span>
            <input list="locs2" placeholder="From location" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="search-input-group">
            <span className="icon">🎯</span>
            <input list="locs2" placeholder="To location" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <datalist id="locs2">{LOCATIONS.map(l => <option key={l} value={l} />)}</datalist>
        <div className="search-row">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <select>
            <option>1 passenger</option><option>2 passengers</option><option>3 passengers</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{marginTop:'0.75rem'}} onClick={searchRides}>🔍 Search</button>
      </div>

      {loading ? (
        <div className="loading">Searching...</div>
      ) : (
        <div className="rides-section">
          {rides.map(r => (
            <div key={r.id} className="ride-card">
              <div className="ride-card-header">
                <div className="ride-avatar">{r.driver?.name?.[0] || '?'}</div>
                <div className="ride-driver-info">
                  <div className="ride-driver-name">{r.driver?.name || 'Driver'} ⭐ {r.driver?.rating?.toFixed(1) || '4.5'}</div>
                  <div className="ride-rating">✓ Verified</div>
                </div>
              </div>
              <div className="ride-route">📍 {r.from_location} → 🎓 {r.to_location}</div>
              <div className="ride-meta">
                <span>📅 {r.date}</span>
                <span>🕐 {r.time}</span>
                <span>👥 {r.seats} seats</span>
              </div>
              <div className="ride-footer">
                <div><div className="ride-price">${r.price}</div><div className="ride-price-label">per person</div></div>
                <button className="btn btn-success btn-sm">Book</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ==================== OFFER RIDE SCREEN ====================
function OfferRideScreen({ onBack, showToast }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('La Trobe University (Bundoora)')
  const [date, setDate] = useState('2026-03-30')
  const [time, setTime] = useState('08:00')
  const [seats, setSeats] = useState(3)
  const [price, setPrice] = useState(8)

  return (
    <>
      <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{fontSize:'1.1rem', fontWeight:'600'}}>🚗 Offer a Ride</h2>
      </div>

      <div className="card" style={{padding:'1.25rem', marginBottom:'1rem'}}>
        <div className="form-group">
          <label className="form-label">From</label>
          <input className="form-input" list="locs3" value={from} onChange={e=>setFrom(e.target.value)} placeholder="Pickup location" />
        </div>
        <datalist id="locs3">{LOCATIONS.map(l => <option key={l} value={l} />)}</datalist>
        <div className="form-group">
          <label className="form-label">To</label>
          <input className="form-input" list="locs3b" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <datalist id="locs3b">{LOCATIONS.map(l => <option key={l} value={l} />)}</datalist>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Time</label>
            <input className="form-input" type="time" value={time} onChange={e=>setTime(e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Seats</label>
            <select className="form-input" value={seats} onChange={e=>setSeats(e.target.value)}>
              {[1,2,3,4].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Price ($)</label>
            <input className="form-input" type="number" value={price} onChange={e=>setPrice(e.target.value)} />
          </div>
        </div>

        <button className="btn btn-success" style={{marginTop:'0.5rem'}} onClick={() => showToast('Ride created! 🎉')}>Create Ride</button>
      </div>
    </>
  )
}

// ==================== MY RIDES SCREEN ====================
function MyRidesScreen({ onBack, user, showToast }) {
  const [tab, setTab] = useState('passenger')
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchMyRides = async () => {
    if (!user) {
      showToast?.('Please login to view your rides')
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/rides/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setRides(data.rides || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'driver' && user) {
      fetchMyRides()
    }
  }, [tab, user])

  const handleDelete = async (rideId) => {
    if (!confirm('Are you sure you want to delete this ride?')) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/rides/${rideId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      showToast('Ride deleted')
      fetchMyRides()
    } catch (e) {
      showToast('Failed to delete ride')
    }
  }

  return (
    <>
      <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{fontSize:'1.1rem', fontWeight:'600'}}>📋 My Rides</h2>
      </div>

      <div className="segmented">
        <div className={`segment-item ${tab==='passenger'?'active':''}`} onClick={()=>setTab('passenger')}>As Passenger</div>
        <div className={`segment-item ${tab==='driver'?'active':''}`} onClick={()=>setTab('driver')}>As Driver</div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : tab === 'driver' ? (
        rides.length > 0 ? (
          <div className="rides-section">
            {rides.map(r => (
              <div key={r.id} className="ride-card">
                <div className="ride-card-header">
                  <div className="ride-avatar">🚗</div>
                  <div className="ride-driver-info">
                    <div className="ride-driver-name">{r.from_location} → {r.to_location}</div>
                    <div className="ride-rating">📅 {r.date} | 🕐 {r.time}</div>
                  </div>
                </div>
                <div className="ride-meta">
                  <span>👥 {r.seats} seats</span>
                  <span>💵 ${r.price}/person</span>
                </div>
                <div style={{display:'flex', gap:'0.5rem', marginTop:'0.5rem'}}>
                  <button className="btn btn-secondary btn-sm">Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🚗</div>
            <h3>No offered rides yet</h3>
            <p>Offer a ride to start earning</p>
            <button className="btn btn-primary" style={{marginTop:'1rem', maxWidth:'200px'}} onClick={onBack}>Offer a Ride</button>
          </div>
        )
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <h3>No bookings yet</h3>
          <p>Find a ride to get started</p>
          <button className="btn btn-primary" style={{marginTop:'1rem', maxWidth:'200px'}} onClick={onBack}>Find a Ride</button>
        </div>
      )}
    </>
  )
}

// ==================== PROFILE SCREEN ====================
function ProfileScreen({ onBack, onLogout, user, guest, showToast, setScreen }) {
  const menuItems = [
    { icon: '✏️', text: 'Edit Profile' },
    { icon: '⭐', text: 'My Reviews' },
    { icon: '💳', text: 'Payment Methods' },
    { icon: '⚙️', text: 'Settings' },
    { icon: '❓', text: 'Help & Support' },
    { icon: '📊', text: 'Earn with UniPool' },
  ]

  return (
    <>
      <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{fontSize:'1.1rem', fontWeight:'600'}}>👤 Profile</h2>
      </div>

      <div className="profile-header" style={{marginBottom:'0'}}>
        <div className="profile-avatar">{user?.name?.[0] || 'G'}</div>
        <div className="profile-name">{user?.name || (guest ? 'Guest User' : 'La Trobe Student')}</div>
        <div className="profile-info">{user?.email || 'Tap to login for full access'}</div>
        {!guest && <div className="profile-stats">
          <div><div className="profile-stat-value">4.8</div><div className="profile-stat-label">Rating</div></div>
          <div><div className="profile-stat-value">12</div><div className="profile-stat-label">Rides</div></div>
          <div><div className="profile-stat-value">100%</div><div className="profile-stat-label">Verified</div></div>
        </div>}
      </div>

      <div className="content" style={{padding:'0 1.25rem 1rem'}}>
        <div className="menu-list" style={{marginBottom:'1rem'}}>
          {menuItems.map((item, i) => (
            <div key={i} className="menu-item">
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-text">{item.text}</span>
              <span className="menu-arrow">›</span>
            </div>
          ))}
        </div>
        {guest ? (
          <button className="btn btn-primary" style={{marginBottom:'0.75rem'}} onClick={() => setScreen('login')}>Login / Register</button>
        ) : (
          <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
        )}
      </div>
    </>
  )
}

// ==================== MESSAGES SCREEN ====================
function MessagesScreen({ onBack }) {
  return (
    <>
      <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{fontSize:'1.1rem', fontWeight:'600'}}>💬 Messages</h2>
      </div>
      <div className="empty-state">
        <div className="empty-icon">💬</div>
        <h3>No messages yet</h3>
        <p>Book a ride to start chatting with drivers</p>
      </div>
    </>
  )
}

// ==================== LOGIN SCREEN ====================
function LoginScreen({ onBack, onLogin, showToast }) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login'
      const body = isRegister ? { email, password, name } : { email, password }
      
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong')
      }
      
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onLogin(data.user)
      showToast(isRegister ? 'Welcome! Account created!' : 'Login successful!')
    } catch (err) {
      showToast(err.message)
    }
    setLoading(false)
  }

  return (
    <>
      <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{fontSize:'1.1rem', fontWeight:'600'}}>{isRegister ? '📝 Register' : '🔑 Login'}</h2>
      </div>

      <div className="card" style={{padding:'1.25rem'}}>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Name</label>
              <input 
                className="form-input" 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required 
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input 
              className="form-input" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="student@latrobe.edu"
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              className="form-input" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required 
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{width:'100%', marginTop:'0.5rem'}}
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Login')}
          </button>
        </form>

        <div style={{marginTop:'1rem', textAlign:'center'}}>
          <button 
            type="button"
            className="btn-link" 
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
          </button>
        </div>

        <div style={{marginTop:'1.5rem', padding:'1rem', background:'#f5f5f5', borderRadius:'8px'}}>
          <p style={{fontSize:'0.8rem', marginBottom:'0.5rem', fontWeight:'600'}}>Demo accounts:</p>
          <p style={{fontSize:'0.75rem', margin:0}}>alex@latrobe.edu / password123</p>
          <p style={{fontSize:'0.75rem', margin:0}}>sarah@latrobe.edu / password123</p>
        </div>
      </div>
    </>
  )
}

// ==================== APP ROOT ====================
export default function App() {
  const [screen, setScreen] = useState('splash')  // splash | onboarding | main | login
  const [tab, setTab] = useState('home')           // home | find | rides | messages | profile
  const [user, setUser] = useState(null)
  const [guest, setGuest] = useState(true)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleNavigate = (targetTab) => setTab(targetTab)

  const handleLogin = (userData) => {
    setUser(userData)
    setGuest(false)
    setTab('home')
  }

  const handleLogout = () => {
    setUser(null)
    setGuest(true)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    showToast('Logged out successfully')
  }

  // Load user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser))
        setGuest(false)
      } catch (e) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
  }, [])

  // Screen routing
  if (screen === 'splash') return <SplashScreen onComplete={() => setScreen('onboarding')} />
  if (screen === 'onboarding') return <Onboarding onComplete={() => setScreen('main')} />
  if (screen === 'login') return <LoginScreen onBack={() => setScreen('main')} onLogin={handleLogin} showToast={showToast} />

  // Tab content
  let content = null
  if (tab === 'home') content = <HomeScreen onNavigate={handleNavigate} />
  else if (tab === 'find') content = <FindRideScreen onBack={() => setTab('home')} showToast={showToast} user={user} />
  else if (tab === 'offer') content = <OfferRideScreen onBack={() => setTab('home')} showToast={showToast} user={user} />
  else if (tab === 'rides') content = <MyRidesScreen onBack={() => setTab('home')} user={user} showToast={showToast} />
  else if (tab === 'messages') content = <MessagesScreen onBack={() => setTab('home')} />
  else if (tab === 'profile') content = <ProfileScreen onBack={() => setTab('home')} onLogout={handleLogout} user={user} guest={guest} showToast={showToast} setScreen={setScreen} />

  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'find', icon: '🔍', label: 'Search' },
    { id: 'offer', icon: '🚗', label: 'Offer' },
    { id: 'rides', icon: '📋', label: 'My Rides' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ]

  return (
    <div className="main-screen">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <span>🎓</span> UniPool
        </div>
        <div className="header-actions">
          {guest && <button className="btn btn-primary btn-sm" style={{width:'auto'}} onClick={() => setScreen('login')}>Login</button>}
        </div>
      </header>

      {/* Content */}
      <div className="content">
        {content}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span className="nav-item-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
