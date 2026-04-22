import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyDetails = async () => {
    const stack = this.state.error?.stack || this.state.error?.message || "Unknown error";
    try {
      await navigator.clipboard.writeText(stack);
    } catch {
      console.error("[ErrorBoundary] failed to copy error details");
    }
  };

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-zinc-900 text-zinc-100 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-red-400">Что-то пошло не так</h1>
          <p className="mt-4 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-300 truncate">
            {this.state.error.message}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
            >
              Перезагрузить страницу
            </button>
            <button
              type="button"
              onClick={() => {
                void this.handleCopyDetails();
              }}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Скопировать детали
            </button>
          </div>
        </div>
      </div>
    );
  }
}
