export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="text-accent text-sm font-medium tracking-widest uppercase">Scaffold</p>
      <h1 className="text-4xl font-semibold text-balance">AI Restaurant Marketing</h1>
      <p className="text-slate-400">
        The workspace is wired up and nothing is implemented yet. Feature code belongs in{' '}
        <code className="bg-surface-muted rounded px-1.5 py-0.5 text-slate-200">src/modules</code>.
      </p>
    </main>
  );
}
