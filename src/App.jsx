import { useState, useEffect } from 'react';
import './index.css';

// Pages
import SplashPage from './pages/SplashPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import FindRidePage from './pages/FindRidePage';
import RoutesPage from './pages/RoutesPage';
import MyRidesPage from './pages/MyRidesPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';
import LoginPage from './pages/LoginPage';
import BookingsPage from './pages/BookingsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import MapPage from './pages/MapPage';
import WalletPage from './pages/WalletPage';
import SchedulePage from './pages/SchedulePage';
import SettingsPage from './pages/SettingsPage';
import VerificationPage from './pages/VerificationPage';
import AdminPage from './pages/AdminPage';
import { userApi, paymentsApi } from './utils/api';

// Shared components
import BottomNav from './components/BottomNav';
import Loading from './components/Loading';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Main App component
 * Manages navigation state and authentication
 */
function App() {
  // Screen state: 'splash' | 'onboarding' | 'main' | 'login'
  const [screen, setScreen] = useState('splash');
  
  // Tab state for main screen: 'home' | 'find' | 'offer' | 'rides' | 'profile' | 'messages'
  const [activeTab, setActiveTab] = useState('home');
  
  // Auth state
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(true);
  
  // Navigation params (e.g., initial search params)
  const [navParams, setNavParams] = useState({});
  
  // Toast notifications
  const [toast, setToast] = useState(null);
  
  // UI state
  const [initialParams, setInitialParams] = useState({});

  // ========== Effects ==========

  // Load saved auth on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (savedUser && token) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsGuest(false);
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Handle return from Stripe Checkout (top-up) / Connect onboarding. The redirect
  // is a full page load, so React state resets to splash — we restore the app to
  // the wallet tab and confirm the top-up. Query params come from payments.js URLs.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topup = params.get('topup');
    const onboard = params.get('onboard');
    if (!topup && !onboard) return;
    const clean = () => window.history.replaceState({}, '', window.location.pathname);
    (async () => {
      if (topup === 'success' && params.get('session_id') && localStorage.getItem('token')) {
        try {
          const res = await paymentsApi.confirmTopup(params.get('session_id'));
          showToast(res.credited ? 'Wallet topped up ✅' : (res.paid ? 'Top-up already applied.' : 'Payment not completed.'));
        } catch { showToast('Could not confirm top-up.'); }
        await refreshUser();
        setScreen('main'); setActiveTab('wallet');
      } else if (topup === 'cancel') {
        showToast('Top-up cancelled.');
        setScreen('main'); setActiveTab('wallet');
      } else if (onboard === 'done' || onboard === 'refresh') {
        showToast(onboard === 'done' ? 'Payout setup updated ✅' : 'Payout setup incomplete — please finish it.');
        setScreen('main'); setActiveTab('wallet');
      }
      clean();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== Handlers ==========

  /**
   * Show toast notification
   */
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * Navigate to a tab/screen
   */
  const navigate = (targetTab, params = {}) => {
    if (targetTab === 'login') {
      setScreen('login');
    } else if (targetTab === 'logout') {
      handleLogout();
    } else if (targetTab === 'find' && params.from) {
      setInitialParams(params);
      setActiveTab('find');
    } else {
      setActiveTab(targetTab);
    }
  };

  /**
   * Handle successful login
   */
  const handleLogin = (userData) => {
    setUser(userData);
    setIsGuest(false);
    setActiveTab('home');
    setScreen('main');
  };

  /**
   * Persist an updated user object (e.g. after becoming a driver).
   */
  const applyUser = (updated) => {
    if (!updated) return;
    setUser((prev) => {
      const merged = { ...prev, ...updated };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };

  /**
   * Re-fetch the user from the server so balance/earnings/rating stay fresh
   * after wallet, booking, or ride actions.
   */
  const refreshUser = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      // GET /users/me returns a FLAT user object (not { user }); tolerate both.
      const res = await userApi.getProfile();
      applyUser(res?.user || res);
    } catch { /* token may be stale; ignore */ }
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    setUser(null);
    setIsGuest(true);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showToast('Logged out successfully');
    setActiveTab('home');
  };

  // ========== Render Helpers ==========

  /**
   * Render the current tab content
   */
  const renderContent = () => {
    const pageProps = {
      onBack: () => setActiveTab('home'),
      onNavigate: navigate,
      showToast,
      user,
    };

    switch (activeTab) {
      case 'home':
        return <HomePage key="home" onNavigate={navigate} />;
      
      case 'find':
        return <FindRidePage key="find" {...pageProps} initialParams={initialParams} />;
      
      case 'offer': // legacy alias — the manual offer flow is replaced by Routes
      case 'routes':
        return <RoutesPage key="routes" {...pageProps} />;
      
      case 'map':
        return <MapPage key="map" {...pageProps} />;
      
      case 'rides':
        return <MyRidesPage key="rides" {...pageProps} guest={isGuest} onBalanceChange={refreshUser} />;

      case 'bookings':
        return <BookingsPage key="bookings" {...pageProps} onBalanceChange={refreshUser} />;

      case 'connections':
        return <ConnectionsPage key="connections" {...pageProps} />;

      case 'wallet':
        return <WalletPage key="wallet" {...pageProps} onBalanceChange={refreshUser} />;

      case 'schedule':
        return <SchedulePage key="schedule" {...pageProps} />;

      case 'settings':
        return <SettingsPage key="settings" {...pageProps} onUserUpdate={applyUser} onLogout={handleLogout} />;

      case 'verification':
        return <VerificationPage key="verification" {...pageProps} onUserUpdate={applyUser} />;

      case 'admin':
        return <AdminPage key="admin" {...pageProps} />;

      case 'messages':
        return <MessagesPage key="messages" {...pageProps} />;

      case 'profile':
        return (
          <ProfilePage
            key="profile"
            {...pageProps}
            guest={isGuest}
            onLogout={handleLogout}
            setScreen={setScreen}
            onUserUpdate={applyUser}
          />
        );
      
      default:
        return <HomePage key="home" onNavigate={navigate} />;
    }
  };

  // ========== Conditional Renders ==========

  // Splash screen
  if (screen === 'splash') {
    return <SplashPage onComplete={() => setScreen('onboarding')} />;
  }

  // Onboarding screen
  if (screen === 'onboarding') {
    return <OnboardingPage onComplete={() => setScreen('main')} />;
  }

  // Login screen (modal-like)
  if (screen === 'login') {
    return (
      <>
        <LoginPage
          onBack={() => setScreen('main')}
          onLogin={handleLogin}
          showToast={showToast}
        />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  // Main screen with bottom navigation
  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Top header with auth entry point */}
        <header className="app-header">
          <div className="app-header-brand" onClick={() => setActiveTab('home')}>
            🎓 UniPool
          </div>
          {isGuest ? (
            <button className="btn-login" onClick={() => setScreen('login')}>
              Log in / Sign up
            </button>
          ) : (
            <button className="app-header-user" onClick={() => setActiveTab('profile')}>
              <span className="app-header-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
              <span className="app-header-name">{user?.name?.split(' ')[0] || 'Account'}</span>
            </button>
          )}
        </header>

        {/* Content area */}
        <main className="main-content">
          {renderContent()}
        </main>

        {/* Bottom navigation */}
        <BottomNav currentTab={activeTab} onTabChange={setActiveTab} />

        {/* Toast notification */}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </ErrorBoundary>
  );
}

export default App;