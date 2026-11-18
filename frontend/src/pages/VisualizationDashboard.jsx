import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import SectionHeading from '../components/SectionHeading.jsx';
import GlassCard from '../components/GlassCard.jsx';
import { getAnalysisResult } from '../utils/analysisStore.js';

const colors = ['#00C6FF', '#7B68EE', '#6A5ACD', '#60A5FA'];

export default function VisualizationDashboard() {
  const location = useLocation();
  const analysis = location.state?.analysis || getAnalysisResult();

  const skillScoreData = useMemo(() => {
    if (analysis?.skillScores?.length) {
      return analysis.skillScores.map((s) => ({
        name: s.skill,
        readiness: Math.round(((s.studentLevel || 0) / (s.requiredLevel || 5)) * 100),
      }));
    }
    return [
      { name: 'Python', readiness: 80 },
      { name: 'Machine Learning', readiness: 60 },
      { name: 'Statistics', readiness: 30 },
      { name: 'Deep Learning', readiness: 10 },
    ];
  }, [analysis]);

  const careerMatch = analysis?.readinessScore || 65;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Visualization Dashboard"
        subtitle="Animated visual analytics for skill readiness score, career match percentage, and recommended skills."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <h3 className="mb-3 text-lg font-semibold text-white">Career Match Percentage</h3>
          <div className="mx-auto h-72 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Matched', value: careerMatch },
                    { name: 'Gap', value: 100 - careerMatch },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  dataKey="value"
                >
                  <Cell fill="#00C6FF" />
                  <Cell fill="rgba(148,163,184,0.25)" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <p className="-mt-36 text-center text-4xl font-bold text-cyan-100">{careerMatch}%</p>
            <p className="text-center text-sm text-slate-300">Career Match Score</p>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="mb-3 text-lg font-semibold text-white">Skill Readiness Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={skillScoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
              <XAxis dataKey="name" stroke="#cbd5e1" />
              <YAxis stroke="#cbd5e1" />
              <Tooltip />
              <Area type="monotone" dataKey="readiness" stroke="#7B68EE" fill="#7B68EE55" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-3 text-lg font-semibold text-white">Recommended Skills</h3>
        <div className="flex flex-wrap gap-2">
          {(analysis?.recommendedSkills?.length ? analysis.recommendedSkills : ['Deep Learning', 'MLOps', 'Data Storytelling', 'Model Deployment']).map((skill, index) => (
            <span key={skill} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: `${colors[index % colors.length]}66`, color: colors[index % colors.length], background: `${colors[index % colors.length]}1A` }}>
              {skill}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
