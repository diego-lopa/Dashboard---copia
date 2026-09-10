import React from 'react';

/**
 * Red de seguridad de la interfaz: si cualquier componente hijo lanza una
 * excepción durante el renderizado (p. ej. un dato inesperado del backend),
 * se muestra un panel de recuperación en vez de dejar la pantalla en negro.
 */
interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Visible en DevTools (F12 → Consola) para diagnóstico
    console.error('[CORNEA] Error capturado por ErrorBoundary:', error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
          <div className="w-full max-w-md rounded-3xl p-8 bg-white border border-slate-200 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 mx-auto flex items-center justify-center text-white text-2xl font-extrabold mb-4">
              !
            </div>
            <h1 className="text-lg font-bold text-slate-900">Algo no salió bien</h1>
            <p className="text-xs text-slate-500 mt-1">
              Something went wrong. La vista se ha protegido para no perder la sesión.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-xs shadow-lg"
              >
                Reintentar
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs"
              >
                Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
