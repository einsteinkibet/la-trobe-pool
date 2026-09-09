import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { connectionsApi, messagesApi } from '../utils/api';
import '../index.css';

/**
 * Messages — in-app chat so riders & drivers coordinate entirely in the app
 * (no phone/email is shared). One thread per ACCEPTED connection. Shows a
 * conversation list; opening one loads the thread and polls for new messages.
 */
const timeLabel = (iso) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const MessagesPage = ({ onBack, onNavigate, user, showToast, openConnectionId, onRead }) => {
  const [convs, setConvs] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeId, setActiveId] = useState(openConnectionId || null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadConvs = useCallback(async () => {
    try {
      const all = await connectionsApi.list();
      const accepted = (all || []).filter((c) => c.status === 'accepted');
      // Most recently active conversation first (fall back to connection order).
      accepted.sort((a, b) => (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || ''));
      setConvs(accepted);
    } catch (e) { showToast?.(e.message || 'Could not load chats'); }
    setLoadingConvs(false);
  }, [showToast]);

  useEffect(() => { if (user) loadConvs(); else setLoadingConvs(false); }, [user, loadConvs]);
  useEffect(() => { if (openConnectionId) setActiveId(openConnectionId); }, [openConnectionId]);

  const active = convs.find((c) => c.id === activeId);

  const loadThread = useCallback(async (id, spinner) => {
    if (!id) return;
    if (spinner) setLoadingThread(true);
    try {
      const res = await messagesApi.list(id);
      setMessages(res.messages || []);
      onRead?.(); // reading the thread clears my unread server-side → refresh badge
    } catch (e) {
      if (spinner) showToast?.(e.message || 'Could not load messages');
    }
    if (spinner) setLoadingThread(false);
  }, [onRead, showToast]);

  // Load + poll the open thread every 4s.
  useEffect(() => {
    if (!activeId) return undefined;
    loadThread(activeId, true);
    const t = setInterval(() => loadThread(activeId, false), 4000);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    try {
      const m = await messagesApi.send(activeId, body);
      setMessages((prev) => [...prev, m]);
      setDraft('');
      loadConvs();
    } catch (e) { showToast?.(e.message || 'Could not send message'); }
    setSending(false);
  };

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-icon">💬</div>
        <h3>Log in to chat with your matches</h3>
      </div>
    );
  }

  // ---- Thread view ----
  if (activeId && active) {
    const name = active.counterpart?.name || 'Student';
    return (
      <div className="chat-screen">
        <div className="chat-head">
          <button className="btn-icon" onClick={() => { setActiveId(null); setMessages([]); loadConvs(); }}>←</button>
          <div className="chat-avatar">{name[0]?.toUpperCase() || 'U'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {active.counterpart?.role === 'driver' ? '🚗' : '🧍'} {name}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {active.meetPoint?.name ? `📍 ${active.meetPoint.name}` : (active.counterpart?.suburb || '')}
            </div>
          </div>
          <button className="btn btn-sm btn-outline" style={{ width: 'auto' }} onClick={() => onNavigate?.('connections')}>Trips</button>
        </div>

        <div className="chat-body">
          {loadingThread ? (
            <Loading text="Loading…" />
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '2rem' }}>
              Say hi 👋 — arrange your pickup spot and time here.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.mine ? 'mine' : 'theirs'}`}>
                <div>{m.body}</div>
                <div className="chat-time">
                  {timeLabel(m.createdAt)}
                  {m.mine && (
                    <span className={`chat-tick ${m.read ? 'read' : ''}`} title={m.read ? 'Read' : 'Delivered'}>
                      {m.read ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-composer">
          <input
            className="form-input"
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            maxLength={2000}
          />
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={send} disabled={sending || !draft.trim()}>
            Send
          </button>
        </div>
      </div>
    );
  }

  // ---- Conversation list ----
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>💬 Messages</h2>
      </div>

      {loadingConvs ? (
        <Loading text="Loading chats…" />
      ) : convs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>No chats yet</h3>
          <p>Once you and a match accept a request, a chat opens here to arrange your ride.</p>
          <button className="btn btn-primary" style={{ maxWidth: 220, margin: '1rem auto 0' }} onClick={() => onNavigate?.('find')}>
            Find a match
          </button>
        </div>
      ) : (
        <div className="menu-list">
          {convs.map((c) => {
            const name = c.counterpart?.name || 'Student';
            return (
              <div key={c.id} className="menu-item" onClick={() => setActiveId(c.id)}>
                <div className="chat-avatar" style={{ width: 40, height: 40 }}>{name[0]?.toUpperCase() || 'U'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.counterpart?.role === 'driver' ? '🚗' : '🧍'} {name}
                    </span>
                    {c.lastMessage?.createdAt && (
                      <span style={{ flex: '0 0 auto', fontSize: '0.68rem', color: '#b0b8bf' }}>{timeLabel(c.lastMessage.createdAt)}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: c.unread > 0 ? 'var(--ink)' : '#94a3b8', fontWeight: c.unread > 0 ? 600 : 400,
                  }}>
                    {c.lastMessage
                      ? `${c.lastMessage.mine ? 'You: ' : ''}${c.lastMessage.body}`
                      : (c.meetPoint?.name ? `📍 ${c.meetPoint.name}` : 'Tap to say hi')}
                  </div>
                </div>
                {c.unread > 0 && (
                  <span style={{
                    flex: '0 0 auto', background: 'var(--danger)', color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                    borderRadius: 999, minWidth: 20, textAlign: 'center', padding: '0.1rem 0.4rem',
                  }}>{c.unread}</span>
                )}
                <span className="menu-arrow">›</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

MessagesPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNavigate: PropTypes.func,
  user: PropTypes.object,
  showToast: PropTypes.func,
  openConnectionId: PropTypes.number,
  onRead: PropTypes.func,
};

export default MessagesPage;
