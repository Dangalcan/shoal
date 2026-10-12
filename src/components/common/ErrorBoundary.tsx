import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Home, Bug } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { electronService } from '../../services/electronService';
import { isSuccess } from '../../types/result';
import { buildIssueUrl, reportRendererError } from '../../lib/error-reporting';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isReloading: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isReloading: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isReloading: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    reportRendererError(
      error,
      'error-boundary',
      errorInfo.componentStack ?? undefined
    );
  }

  private handleReset = () => {
    this.setState({ isReloading: true });
    // Give a tiny bit of time for the animation to start before the hard reload
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    // HashRouter: changing href to "/" would load file:/// in packaged builds.
    window.location.hash = '#/';
  };

  private handleReport = async () => {
    const info = await electronService.getAppInfo().catch(() => null);
    const url = buildIssueUrl(
      info && isSuccess(info) ? info.data : null,
      this.state.error?.toString()
    );
    await electronService.openExternal(url).catch(() => undefined);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <Card className="error-boundary-content">
            <div className="error-icon-wrapper">
              <div className="error-icon-bg">
                <AlertCircle size={48} />
              </div>
            </div>
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
              The application encountered an unexpected error. It was written to
              the log file; you can report it on GitHub.
            </p>
            <div className="error-actions">
              <Button
                variant="primary"
                onClick={this.handleReset}
                loading={this.state.isReloading}
                icon={<RefreshCcw size={18} />}
              >
                Reload Application
              </Button>
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                icon={<Home size={18} />}
              >
                Back to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={this.handleReport}
                icon={<Bug size={18} />}
              >
                Report a problem
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="error-details">{this.state.error.toString()}</div>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
