'use client';

import { BoardsProvider } from '@/contexts/BoardsContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/ui/Toast';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <BoardsProvider>
      <ToastProvider>
        {children}
        <ToastContainer />
      </ToastProvider>
    </BoardsProvider>
  );
}
