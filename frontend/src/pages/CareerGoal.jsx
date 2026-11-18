import { ArrowRight, Compass } from 'lucide-react';

export default function CareerGoal({ navigate, roleCards, selectedRole, setSelectedRole }) {
  const selected = roleCards.find((role) => role.name === selectedRole);

  return (
    <div className="native-green min-h-screen px-6 py-12 text-slate-800">
      <div className="mx-auto max-w-7xl">
        <header className="page-header mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
              <Compass className="h-4 w-4" /> Choose your path
            </p>
            <h2 className="text-4xl font-black">Set a Career Goal (Optional)</h2>
            <p className="mt-3 max-w-3xl">
              Pick a direction and the analysis, roadmap, certifications and dashboard are tailored to it.
            </p>
          </div>
          <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm">
            Current selection: <span className="font-bold">{selected?.displayName || selectedRole}</span>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {roleCards.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.name;
            return (
              <div
                key={role.name}
                className={`home-card rounded-2xl border bg-white p-6 shadow-sm ${isSelected ? 'border-[#157a4a] ring-2 ring-[#157a4a]/20' : 'border-slate-100'}`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#14532d] to-[#1f9d5c] text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-[#0f3d2b]">{role.displayName || role.name}</h3>
                      <p className="text-sm text-slate-500">{role.subtitle}</p>
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-[#e3f4ea] px-2.5 py-1 text-xs font-semibold text-[#157a4a]">{role.salary}</span>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-slate-600">{role.description}</p>
                <div className="mb-5 flex flex-wrap gap-2">
                  {role.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                      {skill}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(role.name)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      isSelected ? 'bg-[#157a4a] text-white' : 'border border-[#157a4a] text-[#157a4a] hover:bg-[#e3f4ea]'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select Role'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole(role.name);
                      navigate('profile');
                    }}
                    className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 transition hover:text-[#157a4a]"
                  >
                    Start With This Role <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
