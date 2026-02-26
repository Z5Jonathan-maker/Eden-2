import React from 'react';
import { captureError } from '../lib/sentry';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.label || 'Route'}]`, error, info?.componentStack);
    captureError(error, {
      componentStack: info?.componentStack,
      route: this.props.label,
      url: window.location.href,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-base font-tactical font-bold text-white mb-1 uppercase">
              {this.props.label || 'Module'} Error
            </h2>
            <p className="text-zinc-500 text-sm font-mono mb-5">
              {this.state.error?.message || 'Something went wrong loading this module.'}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 text-sm flex items-center gap-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <button
                onClick={this.handleRetry}
                className="btn-tactical px-4 py-2 text-sm flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
