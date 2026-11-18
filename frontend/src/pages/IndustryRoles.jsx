import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const roleCards = [
  {
    id: 'data-scientist',
    title: 'Data Scientist',
    desc: 'Extract insights from complex data',
    gradient: 'linear-gradient(135deg,#22d3ee,#3b82f6)',
    icon: '📊',
    skills: [{ l:'Python',c:'rgba(34,211,238,0.2)',tc:'#22d3ee'},{ l:'Statistics',c:'rgba(167,139,250,0.2)',tc:'#a78bfa'},{ l:'ML',c:'rgba(244,114,182,0.2)',tc:'#f472b6'},{ l:'SQL',c:'rgba(74,222,128,0.2)',tc:'#4ade80'}],
    tools: ['TensorFlow','Pandas','Scikit-learn','Jupyter'],
    salary: '$120K',
    btnColor: 'rgba(34,211,238,0.2)',
    btnText: '#22d3ee',
  },
  {
    id: 'ai-engineer',
    title: 'AI Engineer',
    desc: 'Build intelligent systems & models',
    gradient: 'linear-gradient(135deg,#a78bfa,#f472b6)',
    icon: '🧠',
    skills: [{ l:'Deep Learning',c:'rgba(167,139,250,0.2)',tc:'#a78bfa'},{ l:'Python',c:'rgba(34,211,238,0.2)',tc:'#22d3ee'},{ l:'NLP',c:'rgba(244,114,182,0.2)',tc:'#f472b6'},{ l:'MLOps',c:'rgba(251,191,36,0.2)',tc:'#fbbf24'}],
    tools: ['PyTorch','Transformers','AWS/GCP','Docker'],
    salary: '$140K',
    btnColor: 'rgba(167,139,250,0.2)',
    btnText: '#a78bfa',
  },
  {
    id: 'software-dev',
    title: 'Software Developer',
    desc: 'Create robust applications & systems',
    gradient: 'linear-gradient(135deg,#4ade80,#10b981)',
    icon: '💻',
    skills: [{ l:'JavaScript',c:'rgba(74,222,128,0.2)',tc:'#4ade80'},{ l:'React',c:'rgba(96,165,250,0.2)',tc:'#60a5fa'},{ l:'Node.js',c:'rgba(251,191,36,0.2)',tc:'#fbbf24'},{ l:'Git',c:'rgba(167,139,250,0.2)',tc:'#a78bfa'}],
    tools: ['VS Code','MongoDB','REST APIs','CI/CD'],
    salary: '$110K',
    btnColor: 'rgba(74,222,128,0.2)',
    btnText: '#4ade80',
  },
  {
    id: 'iot-engineer',
    title: 'IoT Engineer',
    desc: 'Connect devices & build smart systems',
    gradient: 'linear-gradient(135deg,#fb923c,#ef4444)',
    icon: '📡',
    skills: [{ l:'Embedded C',c:'rgba(251,146,60,0.2)',tc:'#fb923c'},{ l:'Python',c:'rgba(34,211,238,0.2)',tc:'#22d3ee'},{ l:'MQTT',c:'rgba(96,165,250,0.2)',tc:'#60a5fa'},{ l:'Electronics',c:'rgba(74,222,128,0.2)',tc:'#4ade80'}],
    tools: ['Arduino','Raspberry Pi','AWS IoT','Sensors'],
    salary: '$105K',
    btnColor: 'rgba(251,146,60,0.2)',
    btnText: '#fb923c',
  },
];

export default function IndustryRoles() {
  const navigate = useNavigate();
  const pageRef = useRef(null);

  useEffect(() => {
    const els = pageRef.current?.querySelectorAll('.scroll-animate') ?? [];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    els.forEach((el) => obs.observe(el));
    setTimeout(() => els.forEach((el) => el.classList.add('visible')), 100);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={pageRef} className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 scroll-animate">
          <h2 className="text-4xl font-black mb-4 glow-text">Industry Role Explorer</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Discover career paths and their skill requirements</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {roleCards.map((role) => (
            <div key={role.id} className="glass-card rounded-3xl p-6 scroll-animate">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl" style={{ background: role.gradient }}>
                  {role.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{role.title}</h3>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{role.desc}</p>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Required Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {role.skills.map((s) => (
                    <span key={s.l} className="px-3 py-1 rounded-full text-xs" style={{ background: s.c, color: s.tc }}>{s.l}</span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Tools & Technologies</h4>
                <div className="flex flex-wrap gap-2">
                  {role.tools.map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full glass text-xs">{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="text-sm">
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Avg Salary:</span>
                  <span className="font-semibold ml-1" style={{ color: '#4ade80' }}>{role.salary}</span>
                </div>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: role.btnColor, color: role.btnText }}
                  onClick={() => navigate('/skill-gap')}
                >
                  Check Match →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
