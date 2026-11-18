import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { saveAnalysisPayload } from '../utils/analysisStore.js';

const defaultSkills = [
  { id: 'python', label: 'Python', value: 50, color: '#22d3ee' },
  { id: 'ml', label: 'Machine Learning', value: 30, color: '#a78bfa' },
  { id: 'stats', label: 'Statistics', value: 40, color: '#f472b6' },
  { id: 'dl', label: 'Deep Learning', value: 20, color: '#4ade80' },
  { id: 'sql', label: 'SQL / Databases', value: 60, color: '#fbbf24' },
];

const interests = [
  { id: 'ai', label: '🤖 AI/ML' },
  { id: 'data', label: '📊 Data Science' },
  { id: 'web', label: '🌐 Web Dev' },
  { id: 'iot', label: '📡 IoT' },
  { id: 'cloud', label: '☁️ Cloud' },
  { id: 'security', label: '🔐 Security' },
];

export default function StudentProfile() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [targetRole, setTargetRole] = useState('Data Scientist');
  const [skills, setSkills] = useState(defaultSkills);
  const [courses, setCourses] = useState('');
  const [projects, setProjects] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    api.get('/api/roles').then((r) => setRoles(r.data || [])).catch(() => {});
    const els = pageRef.current?.querySelectorAll('.scroll-animate') ?? [];
    setTimeout(() => els.forEach((el) => el.classList.add('visible')), 100);
  }, []);

  const roleOptions = useMemo(() => roles.length ? roles.map((r) => r.roleName) : ['Data Scientist','AI Engineer','Software Developer','IoT Engineer'], [roles]);

  const toggleInterest = (id) => setSelectedInterests((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const skillMap = {};
    skills.forEach((s) => { skillMap[s.label] = Math.round(s.value / 20); });
    const payload = {
      studentId: `HACK-${Date.now().toString().slice(-6)}`,
      studentName: name.trim() || 'Hackathon Student',
      targetRole,
      completedCourses: courses.split(',').map((x) => x.trim()).filter(Boolean),
      projects: projects.split(',').map((x) => x.trim()).filter(Boolean),
      careerInterests: selectedInterests,
      studentSkills: skillMap,
    };
    saveAnalysisPayload(payload);
    navigate('/skill-gap', { state: payload });
  };

  return (
    <div ref={pageRef} className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 scroll-animate">
          <h2 className="text-4xl font-black mb-4 glow-text">Build Your Skill Profile</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Tell us about your technical skills, projects, and interests</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 scroll-animate">
          {/* Personal Info */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span style={{ color: '#22d3ee' }}>👤</span> Personal Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field w-full px-4 py-3 rounded-xl" placeholder="Enter your name" />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full px-4 py-3 rounded-xl" placeholder="your@email.com" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Target Role</label>
              <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="input-field w-full px-4 py-3 rounded-xl">
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Skills */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span style={{ color: '#a78bfa' }}>💻</span> Technical Skills
            </h3>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>Rate your proficiency in these skills</p>
            <div className="space-y-6">
              {skills.map((skill) => (
                <div key={skill.id}>
                  <div className="flex justify-between mb-2">
                    <span>{skill.label}</span>
                    <span style={{ color: skill.color }}>{skill.value}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={skill.value}
                    onChange={(e) => setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, value: Number(e.target.value) } : s))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Courses */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span style={{ color: '#22d3ee' }}>🎓</span> Completed Courses
            </h3>
            <textarea value={courses} onChange={(e) => setCourses(e.target.value)} className="input-field w-full px-4 py-3 rounded-xl min-h-24" placeholder="List courses you've completed (e.g., CS50, Machine Learning by Stanford...)" />
          </div>

          {/* Projects */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span style={{ color: '#a78bfa' }}>📁</span> Projects
            </h3>
            <textarea value={projects} onChange={(e) => setProjects(e.target.value)} className="input-field w-full px-4 py-3 rounded-xl min-h-24" placeholder="Describe your projects (e.g., Built a sentiment analysis tool using BERT...)" />
          </div>

          {/* Interests */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span style={{ color: '#f472b6' }}>❤️</span> Career Interests
            </h3>
            <div className="flex flex-wrap gap-3">
              {interests.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggleInterest(i.id)}
                  className={`skill-tag px-4 py-2 rounded-full glass text-sm${selectedInterests.includes(i.id) ? ' selected' : ''}`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-4 rounded-xl font-semibold text-white">
            <span className="relative z-10 flex items-center justify-center gap-2">✨ Analyze My Skills</span>
          </button>
        </form>
      </div>
    </div>
  );
}
