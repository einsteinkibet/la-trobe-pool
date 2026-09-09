import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { verificationApi } from '../utils/api';
import '../index.css';

const STATUS_UI = {
  unverified: { icon: '🪪', color: '#ca8a04', title: 'Not verified', text: 'Upload your La Trobe student ID to start offering and booking rides.' },
  pending:    { icon: '⏳', color: '#2563eb', title: 'Under review', text: 'Your student ID has been submitted. An admin will review it shortly.' },
  approved:   { icon: '✅', color: '#15803d', title: 'Verified student', text: "You're a verified La Trobe student — full access unlocked." },
  rejected:   { icon: '❌', color: '#b91c1c', title: 'Verification rejected', text: 'Your submission was not accepted. Please re-upload a clearer document.' },
};

/**
 * Verification — upload a student ID and track review status.
 */
const VerificationPage = ({ onBack, user, showToast, onUserUpdate }) => {
  const [status, setStatus] = useState(null);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      // GET /verification/me returns a flat { status, note, document }.
      // Backend uses 'verified'; the UI keys that state as 'approved'.
      const res = await verificationApi.status();
      setStatus(res.status === 'verified' ? 'approved' : (res.status || 'unverified'));
      setNote(res.note ?? null);
    } catch (err) {
      showToast?.(err.message || 'Failed to load status');
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

  const submit = async () => {
    if (!file) return showToast?.('Choose a file first');
    setUploading(true);
    try {
      await verificationApi.upload(file);
      showToast?.('Student ID submitted for review');
      setFile(null);
      onUserUpdate?.({ verification_status: 'pending' });
      await load();
    } catch (err) {
      showToast?.(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  if (!user) {
    return <div className="empty-state"><div className="empty-icon">🪪</div><h3>Log in to verify your student status</h3></div>;
  }

  const ui = STATUS_UI[status] || STATUS_UI.unverified;
  const canUpload = status === 'unverified' || status === 'rejected';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>🪪 Student Verification</h2>
      </div>

      {loading ? (
        <Loading text="Loading status..." />
      ) : (
        <>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', borderLeft: `4px solid ${ui.color}` }}>
            <div style={{ fontSize: '1.6rem' }}>{ui.icon}</div>
            <h3 style={{ margin: '0.25rem 0', color: ui.color }}>{ui.title}</h3>
            <p style={{ fontSize: '0.88rem', color: '#555', margin: 0 }}>{ui.text}</p>
            {status === 'rejected' && note && (
              <p style={{ fontSize: '0.82rem', color: '#b91c1c', marginTop: '0.5rem' }}>Reason: {note}</p>
            )}
          </div>

          {canUpload && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginTop: 0 }}>Upload student ID</h4>
              <p style={{ fontSize: '0.82rem', color: '#777' }}>
                A photo of your La Trobe student card or enrolment confirmation. JPG, PNG, WEBP or PDF, up to 5&nbsp;MB.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}
              />
              {file && <p style={{ fontSize: '0.8rem', color: '#15803d' }}>Selected: {file.name}</p>}
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={uploading || !file} onClick={submit}>
                {uploading ? 'Uploading...' : 'Submit for review'}
              </button>
            </div>
          )}

          {status === 'pending' && (
            <p style={{ fontSize: '0.82rem', color: '#777', textAlign: 'center' }}>
              You can still browse rides while we review your ID.
            </p>
          )}
        </>
      )}
    </>
  );
};

VerificationPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  user: PropTypes.object,
  showToast: PropTypes.func,
  onUserUpdate: PropTypes.func,
};

export default VerificationPage;
