import { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * Error Boundary - catches React errors
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#fee2e2',
          borderRadius: '12px',
          margin: '1rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😵</div>
          <h2 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '1rem' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="btn btn-primary"
            style={{ maxWidth: '200px' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;