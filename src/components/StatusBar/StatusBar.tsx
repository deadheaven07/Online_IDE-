interface StatusBarProps {
  row?: number;
  col?: number;
  renderTimeMs?: number;
}

export function StatusBar({ row = 1, col = 1, renderTimeMs = 0 }: StatusBarProps) {
  const perfLabel = renderTimeMs < 16 ? `${renderTimeMs.toFixed(1)}ms` : `${renderTimeMs.toFixed(1)}ms`;

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-editor-line bg-editor-accent px-3 text-xs text-white">
      <span>
        Ln {row}, Col {col}
      </span>
      <span>Render Time: {perfLabel}</span>
    </footer>
  );
}
