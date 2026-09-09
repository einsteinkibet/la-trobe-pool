import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { referralsApi } from '../utils/api';
import '../index.css';

/**
 * Invite friends — every student has a referral code + shareable link. Growth
 * loop: more La Trobe students → more matches for everyone. The link is built
 * from the current site origin so it always points at wherever the app is hosted.
 */
const ReferralPage = ({ onBack, user, showToast }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    referralsApi.me()
      .then(setData)
      .catch((e) => showToast?.(e.message || 'Could not load your invite code'))
      .finally(() => setLoading(false));
  }, [user, showToast]);

  const code = data?.code || user?.referralCode || '';
  // Prefer the live site origin over whatever the API guessed.
  const link = code ? `${window.location.origin}/?ref=${code}` : '';
  const shareText = `Join me on UniPool — get matched with a La Trobe student going your way. Sign up with my code ${code}: ${link}`;

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast?.(`${label} copied ✅`);
    } catch {
      showToast?.('Could not copy — long-press to copy manually');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'UniPool', text: shareText, url: link }); }
      catch { /* user cancelled */ }
    } else {
      copy(shareText, 'Invite');
    }
  };

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🎁</div>
        <h3>Log in to get your invite code</h3>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>🎁 Invite friends</h2>
      </div>

      {loading ? (
        <Loading text="Loading your invite code…" />
      ) : (
        <>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', textAlign: 'center', background: 'var(--brand-gradient)', color: '#fff' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🚗🤝</div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>More students = more matches</div>
            <p style={{ opacity: 0.9, fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
              The more La Trobe friends on UniPool, the better everyone&apos;s chance of a ride on their route.
            </p>
          </div>

          <div className="card" style={{ padding: '1.1rem', marginBottom: '1rem' }}>
            <label className="form-label">Your invite code</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                flex: 1, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.15em',
                textAlign: 'center', padding: '0.6rem', background: 'var(--primary-tint)',
                color: 'var(--primary-dark)', borderRadius: 'var(--radius-sm)',
              }}>
                {code}
              </div>
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => copy(code, 'Code')}>Copy</button>
            </div>

            <label className="form-label" style={{ marginTop: '1rem' }}>Your invite link</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="form-input" readOnly value={link} onFocus={(e) => e.target.select()} style={{ fontSize: '0.8rem' }} />
              <button className="btn btn-outline" style={{ width: 'auto' }} onClick={() => copy(link, 'Link')}>Copy</button>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={share}>
              📤 Share invite
            </button>
          </div>

          <div className="card" style={{ padding: '1.1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Friends you&apos;ve invited ({data?.count || 0})</h4>
            {data?.invited?.length ? (
              data.invited.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.88rem' }}>
                  <span>🎓 {f.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    {f.joinedAt ? new Date(f.joinedAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#888', margin: 0 }}>
                No one yet — share your code and it&apos;ll show up here when a friend signs up.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
};

ReferralPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  user: PropTypes.object,
  showToast: PropTypes.func,
};

export default ReferralPage;
