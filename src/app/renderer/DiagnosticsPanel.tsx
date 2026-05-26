export function DiagnosticsPanel({ text, onClose }: { text: string; onClose(): void }) {
  if (!text) return null;
  return <aside className="diagnostics"><button onClick={onClose}>×</button><pre>{text}</pre></aside>;
}