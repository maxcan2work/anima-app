import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crashed inside ErrorBoundary', error, errorInfo);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className={styles.fallback}>
        <section className={styles.panel}>
          <h1>Приложение упало</h1>
          <pre className={styles.details}>{this.state.error.message}</pre>
          <div className={styles.actions}>
            <button className={styles.reload} type="button" onClick={() => window.location.reload()}>
              Перезагрузить
            </button>
          </div>
        </section>
      </main>
    );
  }
}
