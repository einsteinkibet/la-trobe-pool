import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Loading from '../components/Loading';
import { walletApi, paymentsApi } from '../utils/api';
import '../index.css';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const LEDGER_LABEL = {
  topup: '⬆️ Top-up', spend: '🔒 Trip fare', earning: '💰 Ride earnings',
  refund: '↩️ Refund', withdraw: '🏦 Withdrawal', fee: 'Service fee',
};

/**
 * Wallet — real money in via Stripe Checkout (top-up) and out via Stripe Connect
 * (driver payout). The per-trip escrow between rider and driver moves internally
 * (see ConnectionsPage). Shows balance, escrow, earnings and ledger history.
 */
const WalletPage = ({ onBack, user, showToast, onBalanceChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connect, setConnect] = useState(null); // driver payout account status

  const isDriver = !!user?.hasVehicle;
  const paymentsEnabled = !!data?.paymentsEnabled;

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const res = await walletApi.get();
      setData(res);
      onBalanceChange?.(res.balance);
    } catch (err) {
      showToast?.(err.message || 'Failed to load wallet');
    }
    setLoading(false);
  }, [user, showToast, onBalanceChange]);

  useEffect(() => { load(); }, [load]);

  // Drivers: check whether their Stripe payout account is ready — but only once we
  // know payments are switched on, so we don't fire a /payments/* call that 503s.
  useEffect(() => {
    if (!isDriver || !paymentsEnabled) { setConnect(null); return; }
    paymentsApi.connectStatus().then(setConnect).catch(() => setConnect(null));
  }, [isDriver, paymentsEnabled]);

  // Top-up → redirect to hosted Stripe Checkout.
  const topUp = async (amount) => {
    setBusy(true);
    try {
      const { url } = await paymentsApi.topupCheckout(amount);
      window.location.assign(url);
    } catch (err) {
      showToast?.(err.code === 'PAYMENTS_DISABLED'
        ? 'Payments aren’t switched on yet — add Stripe keys to enable top-ups.'
        : (err.message || 'Could not start top-up'));
      setBusy(false);
    }
  };

  const setupPayouts = async () => {
    setBusy(true);
    try {
      const { url } = await paymentsApi.connectOnboard();
      window.location.assign(url);
    } catch (err) {
      showToast?.(err.code === 'PAYMENTS_DISABLED'
        ? 'Payments aren’t switched on yet.'
        : (err.message || 'Could not start payout setup'));
      setBusy(false);
    }
  };

  const withdraw = async () => {
    const max = data?.balance || 0;
    const input = prompt(`Withdraw how much to your bank? (available ${money(max)})`, max.toFixed(2));
    if (input == null) return;
    const amount = Number(input);
    if (!(amount > 0)) return showToast?.('Enter a positive amount');
    setBusy(true);
    try {
      await paymentsApi.payout(amount);
      showToast?.(`Withdrew ${money(amount)} to your bank`);
      await load();
    } catch (err) {
      showToast?.(err.message || 'Withdrawal failed');
    }
    setBusy(false);
  };

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-icon">💳</div>
        <h3>Log in to view your wallet</h3>
      </div>
    );
  }

  const payoutsReady = connect?.payoutsEnabled;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>💳 Wallet</h2>
      </div>

      {loading ? (
        <Loading text="Loading wallet..." />
      ) : (
        <>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>Available balance</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{money(data?.balance)}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
              <span>🔒 In escrow: <strong>{money(data?.in_escrow)}</strong></span>
              <span>📈 Earned: <strong>{money(data?.total_earnings)}</strong></span>
            </div>
          </div>

          {paymentsEnabled ? (
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Top up with card / Apple Pay / Google Pay</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[10, 20, 50].map((amt) => (
                  <button key={amt} className="btn btn-primary btn-sm" style={{ flex: 1 }}
                    disabled={busy} onClick={() => topUp(amt)}>
                    +${amt}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
                You’ll be taken to Stripe’s secure checkout, then back here.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <h4 style={{ marginBottom: '0.35rem', color: '#92400e' }}>💳 In-app payments coming soon</h4>
              <p style={{ fontSize: '0.82rem', color: '#92400e', margin: 0 }}>
                Card top-ups and driver payouts switch on once Stripe is connected. For now, riders
                and drivers arrange payment directly after a match is accepted.
              </p>
            </div>
          )}

          {isDriver && paymentsEnabled && (
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.35rem' }}>💸 Driver payouts</h4>
              {payoutsReady ? (
                <>
                  <p style={{ fontSize: '0.8rem', color: '#15803d', margin: '0 0 0.6rem' }}>✓ Payouts enabled — withdraw your earnings to your bank.</p>
                  <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}
                    disabled={busy || !(data?.balance > 0)} onClick={withdraw}>
                    Withdraw to bank
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 0.6rem' }}>
                    {connect?.hasAccount ? 'Finish setting up your payout account to withdraw earnings.' : 'Set up payouts to receive your ride earnings in your bank account.'}
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={busy} onClick={setupPayouts}>
                    {connect?.hasAccount ? 'Continue payout setup' : 'Set up payouts (Stripe)'}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="card" style={{ padding: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Recent activity</h4>
            {data?.ledger?.length ? data.ledger.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem' }}>
                <span>{LEDGER_LABEL[e.type] || e.type}<br /><span style={{ fontSize: '0.7rem', color: '#aaa' }}>{e.note}</span></span>
                <span style={{ color: e.amount >= 0 ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                  {e.amount >= 0 ? '+' : ''}{money(e.amount)}
                </span>
              </div>
            )) : <p style={{ fontSize: '0.85rem', color: '#888', margin: 0 }}>No activity yet.</p>}
          </div>
        </>
      )}
    </>
  );
};

WalletPage.propTypes = {
  onBack: PropTypes.func.isRequired,
  user: PropTypes.object,
  showToast: PropTypes.func,
  onBalanceChange: PropTypes.func,
};

export default WalletPage;
