import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  editor: ReactNode;
  statusBar: ReactNode;
}

export function AppShell({ sidebar, editor, statusBar }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen flex-col bg-editor-bg text-editor-text">
      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 border-r border-editor-line bg-editor-gutter">
          {sidebar}
        </aside>
        <main className="relative min-w-0 flex-1 overflow-hidden">{editor}</main>
      </div>
      {statusBar}
    </div>
  );
}
