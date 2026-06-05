const MOCK_FILES = [
  { name: 'src', children: ['engine/', 'components/', 'hooks/', 'main.tsx'] },
  { name: 'package.json', children: [] },
  { name: 'tsconfig.json', children: [] },
];

export function FileTree() {
  return (
    <div className="p-3 text-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-editor-muted">
        Explorer
      </p>
      <ul className="space-y-1">
        {MOCK_FILES.map((entry) => (
          <li key={entry.name}>
            <span className="text-editor-text">{entry.name}</span>
            {entry.children.length > 0 && (
              <ul className="ml-4 mt-1 space-y-0.5 text-editor-muted">
                {entry.children.map((child) => (
                  <li key={child}>{child}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
