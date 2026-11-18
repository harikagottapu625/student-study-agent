import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getAnalysisPayload, saveAnalysisResult } from '../utils/analysisStore.js';

const roles = ['Data Scientist','AI Engineer','Software Developer','IoT Engineer'];

const demoSkills = [
  { name: 'Python', yours: 80, required: 90 },
  { name: 'Machine Learning', yours: 60, required: 85 },
  { name: 'Statistics', yours: 30, required: 80 },
  { name: 'Deep Learning', yours: 10, required: 70 },
];

const readiness = [
  { label: 'Overall Readiness', sub: 'Data Scientist', pct: 70, color: '#22d3ee', grad: ['#6A5ACD','#00C6FF'], id: 'rg1' },
  { label: 'Tech Skills', sub: 'Above Average', pct: 50, color: '#a78bfa', grad: ['#8B5CF6','#EC4899'], id: 'rg2' },
  { label: 'Python', sub: 'Strong', pct: 80, color: '#4ade80', grad: ['#10B981','#3B82F6'], id: 'rg3' },
  { label: 'Statistics', sub: 'Needs Work', pct: 30, color: '#fbbf24', grad: ['#F59E0B','#EF4444'], id: 'rg4' },
];

function gapLabel(gap) {
  if (gap <= 10) return { text: `Gap: ${gap}% - Almost there! 🎯`, color: '#4ade80' };
  if (gap <= 30) return { text: `Gap: ${gap}% - Needs improvement 📚`, color: '#fbbf24' };
  return { text: `Gap: ${gap}% - Focus area! 🔥`, color: '#f87171' };
}

export default function AnalysisDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [activeRole, setActiveRole] = useState('Data Scientist');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [skillData, setSkillData] = useState(demoSkills);

  useEffect(() => {
    const els = pageRef.current?.querySelectorAll('.scroll-animate') ?? [];
    setTimeout(() => els.forEach((el) => el.classList.add('visible')), 100);

    const payload = location.state || getAnalysisPayload();
    if (payload) {
      setLoading(true);
      api.post('/api/analyze', payload)
        .then((r) => {
          setAnalysis(r.data);
          saveAnalysisResult(r.data);
          if (r.data?.skillScores?.length) {
            setSkillData(r.data.skillScores.map((s) => ({
              name: s.skill,
              yours: Math.round((s.studentLevel / 5) * 100),
              required: Math.round((s.requiredLevel / 5) * 100),
            })));
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [location.state]);

  const circleOffset = (pct) => Math.round(264 * (1 - pct / 100));

  return (
    <div ref={pageRef} className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 scroll-animate">
          <h2 className="text-4xl font-black mb-4 glow-text">Skill Gap Detection</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Compare your skills with industry requirements</p>
        </div>

        {/* Role selector */}
        <div className="glass-card rounded-2xl p-4 mb-8 scroll-animate">
          <div className="flex flex-wrap justify-center gap-4">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setActiveRole(r)}
                className="px-6 py-3 rounded-xl font-medium transition-all"
                style={{
                  background: activeRole === r ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.05)',
                  color: activeRole === r ? '#22d3ee' : 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Skill bars */}
          <div className="glass-card rounded-3xl p-6 scroll-animate">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span style={{ color: '#22d3ee' }}>📊</span> Skill Comparison
              {loading && <span className="text-xs ml-2 text-yellow-400 animate-pulse">Analyzing…</span>}
            </h3>
            <div className="space-y-6">
              {skillData.map((s) => {
                const gap = Math.max(0, s.required - s.yours);
                const { text, color } = gapLabel(gap);
                return (
                  <div key={s.name}>
                    <div className="flex justify-between mb-2">
                      <span>{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Your: {s.yours}%</span>
                        <span className="text-sm" style={{ color: '#22d3ee' }}>Required: {s.required}%</span>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="progress-bar h-4 rounded-full">
                        <div className="progress-fill h-full rounded-full" style={{ width: `${s.yours}%` }} />
                      </div>
                      <div className="absolute top-0 h-4 w-0.5 bg-white/50" style={{ left: `${s.required}%` }} />
                    </div>
                    <div className="text-xs mt-1" style={{ color }}>{text}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Radar chart */}
          <div className="glass-card rounded-3xl p-6 scroll-animate">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span style={{ color: '#a78bfa' }}>🎯</span> Skills Radar
            </h3>
            <div className="flex justify-center">
              <svg className="radar-chart" width="280" height="280" viewBox="0 0 280 280">
                <g stroke="rgba(255,255,255,0.1)" fill="none">
                  <polygon points="140,40 232,95 232,185 140,240 48,185 48,95"/>
                  <polygon points="140,60 212,103 212,177 140,220 68,177 68,103"/>
                  <polygon points="140,80 192,111 192,169 140,200 88,169 88,111"/>
                  <polygon points="140,100 172,119 172,161 140,180 108,161 108,119"/>
                  <polygon points="140,120 152,127 152,153 140,160 128,153 128,127"/>
                </g>
                <g stroke="rgba(255,255,255,0.2)">
                  <line x1="140" y1="140" x2="140" y2="40"/>
                  <line x1="140" y1="140" x2="232" y2="95"/>
                  <line x1="140" y1="140" x2="232" y2="185"/>
                  <line x1="140" y1="140" x2="140" y2="240"/>
                  <line x1="140" y1="140" x2="48" y2="185"/>
                  <line x1="140" y1="140" x2="48" y2="95"/>
                </g>
                <polygon points="140,56 200,106 188,175 140,200 80,165 80,106" fill="rgba(123,104,238,0.3)" stroke="#7B68EE" strokeWidth="2"/>
                <polygon points="140,50 220,99 210,178 140,215 60,178 60,99" fill="none" stroke="#00C6FF" strokeWidth="2" strokeDasharray="5,5"/>
                <g fill="white" fontSize="11" textAnchor="middle">
                  <text x="140" y="30">Python</text>
                  <text x="248" y="95">ML</text>
                  <text x="248" y="195">Stats</text>
                  <text x="140" y="260">Deep Learning</text>
                  <text x="32" y="195">SQL</text>
                  <text x="32" y="95">Visualization</text>
                </g>
              </svg>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ background:'rgba(123,104,238,0.5)', border:'2px solid #7B68EE' }}/>
                <span className="text-sm" style={{ color:'rgba(255,255,255,0.5)' }}>Your Skills</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ border:'2px dashed #22d3ee' }}/>
                <span className="text-sm" style={{ color:'rgba(255,255,255,0.5)' }}>Required</span>
              </div>
            </div>
          </div>
        </div>

        {/* Circular readiness */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
          {readiness.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-6 text-center scroll-animate">
              <div className="circular-progress relative mx-auto mb-4" style={{ width:100, height:100 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id={r.id}>
                      <stop offset="0%" stopColor={r.grad[0]}/>
                      <stop offset="100%" stopColor={r.grad[1]}/>
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="42" stroke={`url(#${r.id})`} strokeWidth="8" strokeDasharray="264" strokeDashoffset={circleOffset(r.pct)}/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold" style={{ color: r.color }}>{r.pct}%</span>
                </div>
              </div>
              <h4 className="font-semibold text-sm">{r.label}</h4>
              <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,0.5)' }}>{r.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button className="btn-primary px-8 py-4 rounded-xl font-semibold text-white" onClick={() => navigate('/roadmap')}>
            <span className="relative z-10 flex items-center gap-2">🗺️ Generate Learning Roadmap</span>
          </button>
        </div>
      </div>
    </div>
  );
}
