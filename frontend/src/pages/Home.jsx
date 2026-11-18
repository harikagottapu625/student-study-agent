import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function useScrollAnimate(ref) {
  useEffect(() => {
    const els = ref.current?.querySelectorAll('.scroll-animate') ?? [];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    els.forEach((el) => obs.observe(el));
    setTimeout(() => els.forEach((el) => el.classList.add('visible')), 100);
    return () => obs.disconnect();
  }, []);
}

export default function Home() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  useScrollAnimate(pageRef);

  return (
    <div ref={pageRef} className="min-h-screen flex items-center px-6 py-12">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center w-full">

        {/* Left text */}
        <div className="scroll-animate">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>AI-Powered Analysis</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            <span className="glow-text">Bridge the Gap Between</span><br />
            <span style={{ background: 'linear-gradient(90deg,#a78bfa,#f472b6,#22d3ee)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Skills & Industry
            </span>
          </h1>

          <p className="text-lg mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            AI-powered platform that analyzes your skills, detects gaps, and creates a personalized roadmap to your dream job.
          </p>

          <div className="flex flex-wrap gap-4">
            <button className="btn-primary px-8 py-4 rounded-xl font-semibold" onClick={() => navigate('/profile')}>
              <span className="relative z-10 flex items-center gap-2">✨ Start Skill Analysis</span>
            </button>
            <button className="btn-secondary px-8 py-4 rounded-xl font-semibold" onClick={() => navigate('/roles')}>
              <span className="relative z-10 flex items-center gap-2">🧭 Explore Industry Roles</span>
            </button>
          </div>

          <div className="flex items-center gap-8 mt-10">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: '#22d3ee' }}>10K+</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Skills Analyzed</div>
            </div>
            <div className="w-px h-12" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: '#a78bfa' }}>95%</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Accuracy Rate</div>
            </div>
            <div className="w-px h-12" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: '#f472b6' }}>500+</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Career Paths</div>
            </div>
          </div>
        </div>

        {/* Right – Dashboard Card */}
        <div className="scroll-animate relative">
          <div className="relative w-full aspect-square max-w-lg mx-auto">
            <div className="absolute inset-0 rounded-full blur-3xl animate-pulse" style={{ background:'linear-gradient(135deg,rgba(139,92,246,0.3),rgba(6,182,212,0.3))' }} />

            <div className="absolute inset-8 glass-card rounded-3xl p-6 glow-border">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>

              <div className="space-y-4 mb-6">
                {[{l:'Python',p:85,c:'#22d3ee'},{l:'Machine Learning',p:70,c:'#a78bfa'},{l:'Deep Learning',p:45,c:'#f472b6'}].map((s)=>(
                  <div key={s.l}>
                    <div className="flex justify-between text-sm mb-1"><span>{s.l}</span><span style={{color:s.c}}>{s.p}%</span></div>
                    <div className="progress-bar h-2 rounded-full"><div className="progress-fill h-full rounded-full" style={{width:`${s.p}%`}} /></div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-6">
                <div className="circular-progress relative" style={{width:80,height:80}}>
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <defs><linearGradient id="hg"><stop offset="0%" stopColor="#6A5ACD"/><stop offset="100%" stopColor="#00C6FF"/></linearGradient></defs>
                    <circle cx="40" cy="40" r="35" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                    <circle cx="40" cy="40" r="35" stroke="url(#hg)" strokeWidth="6" strokeDasharray="220" strokeDashoffset="66"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">70%</div>
                </div>
                <div className="text-sm">
                  <div className="font-semibold">Career Match</div>
                  <div style={{color:'rgba(255,255,255,0.5)'}}>Data Scientist</div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 right-0 glass-card p-4 rounded-2xl" style={{animation:'float 3s ease-in-out infinite'}}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#4ade80,#10b981)'}}>📈</div>
                <div><div className="text-xs" style={{color:'rgba(255,255,255,0.5)'}}>Skill Growth</div><div className="font-bold" style={{color:'#4ade80'}}>+24%</div></div>
              </div>
            </div>

            <div className="absolute -bottom-4 left-0 glass-card p-4 rounded-2xl" style={{animation:'float 4s ease-in-out infinite',animationDelay:'0.5s'}}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#a78bfa,#f472b6)'}}>🏆</div>
                <div><div className="text-xs" style={{color:'rgba(255,255,255,0.5)'}}>Readiness</div><div className="font-bold" style={{color:'#a78bfa'}}>High</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
