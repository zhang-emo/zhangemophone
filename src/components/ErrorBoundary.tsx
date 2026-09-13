import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center rounded-2xl border border-slate-800 space-y-3 font-sans">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1 max-w-xs">
            <h3 className="text-xs font-bold text-slate-100">
              {this.props.fallbackTitle || '视图加载遇到异常'}
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed font-mono break-all">
              {this.state.error?.message || '渲染数据时遇到未知格式错误，页面已安全捕获。'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
          >
            <RefreshCw size={12} />
            <span>重试加载</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

