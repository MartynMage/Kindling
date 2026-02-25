import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <AlertTriangle className="h-10 w-10 text-red-400/60 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-foreground-secondary text-center max-w-md mb-4">
            {this.props.fallbackMessage || "An unexpected error occurred. Try reloading this section."}
          </p>
          {this.state.error && (
            <p className="text-xs text-foreground-muted text-center max-w-md mb-4 font-mono">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
