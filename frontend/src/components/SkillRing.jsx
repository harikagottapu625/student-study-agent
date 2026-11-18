export default function SkillRing({ label, value }) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="glass glow-border flex flex-col items-center gap-2 rounded-2xl p-4">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        style={{
          background: `conic-gradient(#1f9d5c ${pct * 3.6}deg, rgba(148,163,184,0.2) 0deg)`,
        }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-900/90 text-sm font-semibold text-cyan-200">
          {pct}%
        </div>
      </div>
      <p className="text-center text-xs text-slate-200">{label}</p>
    </div>
  );
}
