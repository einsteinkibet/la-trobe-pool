import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { adminApi } from '../utils/api';
import '../index.css';

// 'users' = full directory; 'settings' = payment config; the rest filter the
// student-ID review queue.
const TABS = ['users', 'pending', 'approved', 'rejected', 'settings'];
const TAB_LABELS = { users: 'Users', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', settings: 'Payments' };

// Admin form to enter the Stripe keys (stored encrypted server-side; the full
// key is never sent back — only a masked status).
const StripeSettings = ({ showToast }) => {
  const [cfg, setCfg] = useState(null);
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.getSettings().then(setCfg).catch((e) => showToast?.(e.message));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.setStripe(secretKey || undefined, webhookSecret || undefined);
      setCfg({ stripe: res.status ? { configured: res.status.enabled, last4: res.status.secretLast4, fromEnv: res.status.fromEnv, hasWebhookSecret: res.status.hasWebhookSecret } : cfg?.stripe, secretsEncrypted: cfg?.secretsEncrypted });
      setSecretKey(''); setWebhookSecret('');
      showToast?.('Payment settings saved ✅');
      load();
    } catch (err) {
      showToast?.(err.message || 'Could not save settings');
    }
    setSaving(false);
  };

  if (!cfg) return <Loading text="Loading settings..." />;
  const s = cfg.stripe || {};
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h4 style={{ marginTop: 0 }}>💳 Stripe payments</h4>
      <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
        Status:{' '}
        {s.configured
          ? <span style={{ color: '#166534', fontWeight: 600 }}>● Live (key ····{s.last4})</span>
          : <span style={{ color: '#b91c1c', fontWeight: 600 }}>● Not configured</span>}
        {s.hasWebhookSecret ? <span style={{ color: '#64748b' }}> · webhook set</span> : null}
      </div>

      {s.fromEnv ? (
        <p style={{ fontSize: '0.82rem', color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.4rem', padding: '0.6rem' }}>
          🔒 The Stripe key is set via an environment variable, so it can’t be changed here. Update it in your host’s env config.
        </p>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">Stripe secret key</label>
            <input className="form-input" type="password" autoComplete="off" placeholder="sk_test_… (paste to set/replace)"
              value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Webhook signing secret (optional)</label>
            <input className="form-input" type="password" autoComplete="off" placeholder="whsec_…"
              value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving || (!secretKey && !webhookSecret)} onClick={save}>
            {saving ? 'Saving…' : 'Save payment settings'}
          </button>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.6rem 0 0' }}>
            Use a TEST key (sk_test_…) while trialing. Stored {cfg.secretsEncrypted ? 'encrypted' : 'obfuscated — set SETTINGS_SECRET on the server to encrypt'} and never shown again.
            The key is never sent back to the browser.
          </p>
        </>
      )}
    </div>
  );
};
StripeSettings.propTypes = { showToast: PropTypes.func };

const STATUS_STYLE = {
  verified: { bg: '#dcfce7', color: '#166534', label: '✅ Verified' },
  approved: { bg: '#dcfce7', color: '#166534', label: '✅ Verified' },
  pending: { bg: '#dbeafe', color: '#1e40af', label: '⏳ Pending' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rejected' },
  unverified: { bg: '#f1f5f9', color: '#64748b', label: '🪪 Unverified' },
};

const StatusPill = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.unverified;
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: '999px', background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};
StatusPill.propTypes = { status: PropTypes.string };

/**
 * Admin — user directory + student-ID verification review queue. Admins only.
 */
const AdminPage = ({ onBack, user, showToast }) => {
  const [tab, setTab] = useState('users');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docUrl, setDocUrl] = useState(null);
  const [busy, setBusy] = useState(null);

  const isAdmin = !!user?.isAdmin;

  const load = async () => {
    if (tab === 'settings') { setLoading(false); return; } // settings has its own component
    setLoading(true);
    try {
      // Both endpoints return bare arrays.
      const res = tab === 'users' ? await adminApi.users() : await adminApi.list(tab);
      setRows(Array.isArray(res) ? res : []);
    } catch (err) {
      showToast?.(err.message || 'Failed to load');
    }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [tab, isAdmin]);

  // Fetch the ID document with the auth token, show as an object URL.
  const viewDoc = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(adminApi.documentUrl(userId), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Could not load document');
      const blob = await res.blob();
      setDocUrl({ url: URL.createObjectURL(blob), type: blob.type });
    } catch (err) {
      showToast?.(err.message || 'Could not load document');
    }
  };

  // Verification-queue approve/reject (writes a review note).
  const decide = async (userId, action) => {
    const note = action === 'reject' ? (prompt('Reason for rejection (shown to the student):', 'Document unclear') || '') : '';
    setBusy(userId);
    try {
      await adminApi.decide(userId, action, note);
      showToast?.(`Applicant ${action}d`);
      await load();
    } catch (err) {
      showToast?.(err.message || 'Action failed');
    }
    setBusy(null);
  };

  // Directory quick toggle (no document needed).
  const setVerified = async (userId, verified) => {
    setBusy(userId);
    try {
      await adminApi.setVerified(userId, verified);
      showToast?.(verified ? 'User verified' : 'Verification removed');
      await load();
    } catch (err) {
      showToast?.(err.message || 'Action failed');
    }
    setBusy(null);
  };

  if (!isAdmin) {
    return <div className="empty-state"><div className="empty-icon">🔒</div><h3>Admins only</h3></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>🛡️ Admin</h2>
      </div>

      <div className="segmented">
        {TABS.map((t) => (
          <div key={t} className={`segment-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </div>
        ))}
      </div>

      {tab === 'settings' ? (
        <StripeSettings showToast={showToast} />
      ) : loading ? (
        <Loading text="Loading..." />
      ) : rows.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📭</div><h3>Nothing here</h3></div>
      ) : tab === 'users' ? (
        /* ---- User directory ---- */
        <div>
          {rows.map((u) => (
            <div key={u.id} className="card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>
                  {u.name} {u.isAdmin && <span title="Admin">🛡️</span>}
                </div>
                <StatusPill status={u.status} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#777' }}>{u.email}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                {u.hasVehicle ? '🚗 Driver' : '🎒 Rider'} · ⭐ {Number(u.rating ?? 0).toFixed(1)} · ${Number(u.walletBalance ?? 0).toFixed(0)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                {u.hasDocument && (
                  <button className="btn btn-secondary btn-sm" onClick={() => viewDoc(u.id)}>View ID</button>
                )}
                {u.verified ? (
                  <button className="btn btn-outline btn-sm" disabled={busy === u.id || u.isAdmin} onClick={() => setVerified(u.id, false)}>
                    Un-verify
                  </button>
                ) : (
                  <button className="btn btn-success btn-sm" disabled={busy === u.id} onClick={() => setVerified(u.id, true)}>
                    ✅ Verify
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ---- Verification review queue ---- */
        <div>
          {rows.map((r) => (
            <div key={r.userId} className="card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <StatusPill status={r.status} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#777' }}>{r.email}</div>
              <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                submitted {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {r.hasDocument ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => viewDoc(r.userId)}>View ID</button>
                ) : <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>No document</span>}
                {tab === 'pending' && (
                  <>
                    <button className="btn btn-success btn-sm" disabled={busy === r.userId} onClick={() => decide(r.userId, 'approve')}>Approve</button>
                    <button className="btn btn-danger btn-sm" disabled={busy === r.userId} onClick={() => decide(r.userId, 'reject')}>Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document viewer modal */}
      {docUrl && (
        <div onClick={() => { URL.revokeObjectURL(docUrl.url); setDocUrl(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          {docUrl.type === 'application/pdf'
            ? <iframe title="id" src={docUrl.url} style={{ width: '90%', height: '80%', border: 0, background: '#fff' }} />
            : <img alt="Student ID" src={docUrl.url} style={{ maxWidth: '95%', maxHeight: '85%', borderRadius: 8 }} />}
        </div>
      )}
    </>
  );
};

AdminPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  user: PropTypes.object,
  showToast: PropTypes.func,
};

export default AdminPage;
