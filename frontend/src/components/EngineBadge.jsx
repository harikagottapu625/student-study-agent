import { BookOpen, Cpu, Sparkles } from 'lucide-react';
import { engineLabel } from '../utils/studyApi.js';

export default function EngineBadge({ engine }) {
  if (!engine) return null;
  const isAi = engine === 'ai';
  const Icon = isAi ? Sparkles : engine === 'knowledge-base' ? BookOpen : Cpu;
  const tone = isAi ? 'bg-emerald-400/15 text-emerald-200' : engine === 'knowledge-base' ? 'bg-cyan-400/15 text-cyan-100' : 'bg-amber-400/15 text-amber-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
      <Icon className="h-3 w-3" /> {engineLabel(engine)}
    </span>
  );
}
