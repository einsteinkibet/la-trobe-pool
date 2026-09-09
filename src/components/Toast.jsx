import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import '../index.css';

/**
 * Toast notification component
 */
const Toast = ({ message, type = 'info', onClose }) => {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onClose?.();
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
};

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['info', 'success', 'error', 'warning']),
  onClose: PropTypes.func,
};

/**
 * Toast container manager
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const ToastContainer = () => (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );

  return { showToast, ToastContainer };
};

export default Toast;