import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAnalysisResult } from '../utils/analysisStore.js';

const steps = [
  {
    num: 1, week: 'Week 1-4', level: 'Beginner', levelColor: '#22d3ee',
    title: 'Learn Python Fundamentals',
    desc: 'Master Python basics, data structures, and essential libraries for data manipulation.',
    tags: ['Python Basics','NumPy','Pandas'],
    dotColor: '#22d3ee',
    gradient: 'linear-gradient(135deg,#22d3ee,#3b82f6)',
  },
  {
    num: 2, week: 'Week 5-8', level: 'Intermediate', levelColor: '#a78bfa',
    title: 'Study Statistics for ML',
    desc: 'Build a strong foundation in statistical concepts essential for machine learning.',
    tags: ['Probability','Hypothesis Testing','Distributions'],
    dotColor: '#a78bfa',
    gradient: 'linear-gradient(135deg,#a78bfa,#f472b6)',
  },
  {
    num: 3, week: 'Week 9-14', level: 'Intermediate', levelColor: '#f472b6',
    title: 'Build Machine Learning Projects',
    desc: 'Apply ML algorithms to real-world datasets and build portfolio projects.',
    tags: ['Scikit-learn','Classification','Regression'],
    dotColor: '#f472b6',
    gradient: 'linear-gradient(135deg,#f472b6,#ef4444)',
  },
  {
    num: 4, week: 'Week 15-20', level: 'Advanced', levelColor: '#4ade80',
    title: 'Practice Deep Learning Models',
    desc: 'Master neural networks, CNNs, RNNs, and modern deep learning frameworks.',
    tags: ['TensorFlow','PyTorch','Neural Networks'],
    dotColor: '#4ade80',
    gradient: 'linear-gradient(135deg,#4ade80,#10b981)',
  },
  {
    num: 5, week: 'Week 21-24', level: 'Expert', levelColor: '#fbbf24',
    title: 'Deploy & Portfolio Building',
    desc: 'Learn MLOps, build a portfolio, and prepare for interviews.',
    tags: ['Docker','AWS/GCP','GitHub'],
    dotColor: '#fbbf24',
    gradient: 'linear-gradient(135deg,#fbbf24,#f97316)',
  },
];

export default function LearningRoadmap() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageRef = useRef(null);
  const analysis = location.state?.analysis || getAnalysisResult();

  useEffect(() => {
    const els = pageRef.current?.querySelectorAll('.scroll-animate') ?? [];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    els.forEach((el) => obs.observe(el));
    setTimeout(() => els.forEach((el) => el.classList.add('visible')), 100);
    return () => obs.disconnect();
  }, []);

  const roadmap = analysis?.roadmap?.length
    ? analysis.roadmap.map((s, i) => ({
        ...steps[i] ?? steps[0],
        title: s.title || steps[i]?.title,
        desc: s.description || steps[i]?.desc,
        tags: s.learningTopics || steps[i]?.tags,
        week: s.timeframe || steps[i]?.week,
      }))
    : steps;

  return (
    <div ref={pageRef} className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 scroll-animate">
          <h2 className="text-4xl font-black mb-4 glow-text">Your Learning Roadmap</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Personalized path to becoming a {analysis?.targetRole || 'Data Scientist'}</p>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(to bottom, #22d3ee, #a78bfa, #f472b6)' }} />

          <div className="space-y-8">
            {roadmap.map((step, i) => (
              <div key={step.num} className="timeline-item relative pl-20" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
                <div className="absolute left-6 w-5 h-5 rounded-full border-4 z-10" style={{ background: step.dotColor, borderColor: '#0f0c29', top: '1.5rem' }} />
                <div className="glass-card rounded-2xl p-6 hover:scale-[1.02] transition-transform">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg" style={{ background: step.gradient }}>
                      {step.num}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80' }}>{step.week}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(34,211,238,0.15)', color: step.levelColor }}>{step.level}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                      <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>{step.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {(step.tags || []).map((t) => (
                          <span key={t} className="px-3 py-1 rounded-full glass text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="glass-card rounded-3xl p-8 mt-12 scroll-animate">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-4xl font-bold mb-2" style={{ color: '#22d3ee' }}>24</div>
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>Weeks to Complete</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2" style={{ color: '#a78bfa' }}>15+</div>
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>Skills to Learn</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2" style={{ color: '#f472b6' }}>5</div>
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>Portfolio Projects</div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button className="btn-primary px-8 py-4 rounded-xl font-semibold text-white" onClick={() => navigate('/visualization')}>
            <span className="relative z-10 flex items-center gap-2">📈 View Analytics Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
