import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('DRISHTI App Caught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#1e293b', background: '#f8fafc', height: '100vh' }}>
          <h2 style={{ color: '#dc2626' }}>Application Rendering Error</h2>
          <pre style={{ background: '#fee2e2', padding: '1rem', borderRadius: '8px', overflowX: 'auto', marginTop: '1rem' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', overflowX: 'auto', marginTop: '1rem', fontSize: '12px' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('Root element #root not found in document!');
}