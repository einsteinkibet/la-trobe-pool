import { useState } from 'react';
import PropTypes from 'prop-types';
import { authApi } from '../utils/api';
import '../index.css';

/**
 * Login/Register page
 */
const LoginPage = ({ onBack, onLogin, showToast, initialReferral = '' }) => {
  const [isRegister, setIsRegister] = useState(!!initialReferral);
  const [referral, setReferral] = useState(initialReferral || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('rider'); // 'rider' | 'driver'
  const [vehicleType, setVehicleType] = useState('sedan');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // UniPool is La Trobe-only. Students use their student-ID address
  // (e.g. 12345678@students.ltu.edu.au); staff/legacy latrobe.edu.au addresses
  // are also accepted.
  const isLaTrobeEmail = (e) =>
    /@([\w-]+\.)*(ltu|latrobe)\.edu(\.au)?$/i.test(e);

  const validate = () => {
    const newErrors = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Invalid email format';
    } else if (isRegister && !isLaTrobeEmail(email)) {
      newErrors.email = 'Use your La Trobe student email (…@students.ltu.edu.au)';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (isRegister && !name) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    
    try {
      const endpoint = isRegister ? 'register' : 'login';
      const body = isRegister
        ? {
            email, password, name, university: 'La Trobe University',
            hasVehicle: role === 'driver',
            ...(phone.trim() && { phone: phone.trim() }),
            ...(referral.trim() && { referralCode: referral.trim() }),
            ...(role === 'driver' && { vehicleType }),
          }
        : { email, password };
      
      const result = await authApi[endpoint](body);

      // Never enter a half-logged-in state: if the response is missing a token or
      // user, treat it as a failure instead of storing undefined and flipping the
      // UI to "logged in" (which then dead-ends on pages that need `user`).
      if (!result?.token || !result?.user) {
        throw new Error('Unexpected response from server. Please try again.');
      }

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));

      onLogin?.(result.user);
      showToast?.(isRegister ? 'Welcome! Account created!' : 'Login successful!');
    } catch (err) {
      showToast?.(err.message || 'Authentication failed');
    }
    
    setLoading(false);
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setErrors({});
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
          {isRegister ? '📝 Register' : '🔑 Login'}
        </h2>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
          )}

          {isRegister && (
            <div className="form-group">
              <label className="form-label">Phone <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="form-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0400 123 456"
              />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                You&apos;ll chat in-app; a phone is just an optional backup for trip day. Not shared publicly.
              </span>
            </div>
          )}

          {isRegister && (
            <div className="form-group">
              <label className="form-label">Invite code <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="form-input"
                type="text"
                value={referral}
                onChange={(e) => setReferral(e.target.value.toUpperCase())}
                placeholder="e.g. AASS6N"
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
              />
              {initialReferral && (
                <span style={{ fontSize: '0.72rem', color: 'var(--primary-dark)' }}>🎁 Invite applied — you&apos;re joining a friend on UniPool.</span>
              )}
            </div>
          )}

          {isRegister && (
            <div className="form-group">
              <label className="form-label">I want to join as</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { v: 'rider', label: '🎒 Rider', hint: 'Find a lift' },
                  { v: 'driver', label: '🚗 Driver', hint: 'Offer rides' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRole(opt.v)}
                    style={{
                      flex: 1, padding: '0.6rem', borderRadius: '8px', cursor: 'pointer',
                      border: role === opt.v ? '2px solid var(--primary)' : '1px solid #ccc',
                      background: role === opt.v ? 'var(--primary-tint)' : '#fff',
                      fontWeight: role === opt.v ? 600 : 400,
                    }}
                  >
                    <div>{opt.label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isRegister && role === 'driver' && (
            <div className="form-group">
              <label className="form-label">Vehicle</label>
              <select className="form-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="sedan">Sedan</option>
                <option value="hatchback">Hatchback</option>
                <option value="suv">SUV</option>
                <option value="van">Van</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.35rem', display: 'block' }}>
                UniPool is a solo-ride service — you carry one rider per trip.
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="12345678@students.ltu.edu.au"
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>
          
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Login')}
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button type="button" className="btn-link" onClick={toggleMode}>
            {isRegister 
              ? 'Already have an account? Login' 
              : "Don't have an account? Register"}
          </button>
        </div>

        {import.meta.env.DEV && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: '600' }}>Demo accounts (dev only · password123):</p>
            <p style={{ fontSize: '0.75rem', margin: 0 }}>aisha.rahman@students.latrobe.edu.au</p>
            <p style={{ fontSize: '0.75rem', margin: 0 }}>liam.nguyen@students.latrobe.edu.au</p>
          </div>
        )}
      </div>
    </>
  );
};

LoginPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  onLogin: PropTypes.func,
  showToast: PropTypes.func,
  initialReferral: PropTypes.string,
};

export default LoginPage;