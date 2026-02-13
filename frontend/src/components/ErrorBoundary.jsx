import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: `eden-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  copyErrorDetails = async () => {
    const details = [
      `Error ID: ${this.state.errorId || 'unknown'}`,
      `Message: ${this.state.error?.message || 'Unknown error'}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(details);
    } catch (_err) {
      // Best effort only.
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="card-tactical p-8 max-w-md text-center shadow-tactical">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-tactical font-bold text-white mb-2">SYSTEM ERROR</h2>
            <p className="text-zinc-400 text-sm font-mono mb-4">
              {this.state.error?.message || 'Something went wrong'}
            </p>
            <p className="text-zinc-500 text-xs font-mono mb-4">
              Error ID: {this.state.errorId || 'unknown'}
            </p>
            <button
              onClick={this.copyErrorDetails}
              className="w-full mb-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-mono uppercase tracking-wide text-zinc-300 hover:bg-zinc-700"
              data-testid="error-boundary-copy"
            >
              Copy Error Details
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorId: null });
                window.location.reload();
              }}
              className="btn-tactical px-6 py-2.5 text-sm"
              data-testid="error-boundary-reload"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
