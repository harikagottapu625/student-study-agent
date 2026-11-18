import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Brain,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileSearch,
  FileText,
  GraduationCap,
  LogIn,
  Mic,
  Smile,
} from 'lucide-react';

const agentCards = [
  { page: 'agent', group: 'plan', title: 'Hub', desc: 'One chat for everything. It sends your request to the right agents and shows each step.', icon: Bot, image: '/agents/hub.jpg' },
  { page: 'planner', group: 'plan', title: 'Study Planner', desc: 'Daily, weekly or monthly plans built around your deadlines, exams and mood.', icon: CalendarDays, image: '/agents/planner.jpg' },
  { page: 'assignments', group: 'plan', title: 'Deadline Tracker', desc: 'Finds due dates in messages and files, then reminds you before they slip.', icon: Clock, image: '/agents/assignments.jpg' },
  { page: 'notes', group: 'learn', title: 'Notes Summarizer', desc: 'Key points, flashcards and revision notes from your PDFs, slides and photos.', icon: FileText, image: '/agents/notes.jpg' },
  { page: 'retrieval', group: 'learn', title: 'Helper', desc: 'Ask questions about your own material and get answers with page references.', icon: FileSearch, image: '/agents/retrieval.jpg' },
  { page: 'tutor', group: 'learn', title: 'Concept Tutor', desc: 'Simple explanations, analogies and step-by-step solutions for hard topics.', icon: GraduationCap, image: '/agents/tutor.jpg' },
  { page: 'quiz', group: 'revise', title: 'Revision Quiz', desc: 'MCQ and written quizzes that grade your answers and track weak topics.', icon: ClipboardCheck, image: '/agents/quiz.jpg' },
];

const agentTabs = [
  { id: 'all', label: 'All agents' },
  { id: 'plan', label: 'Plan' },
  { id: 'learn', label: 'Learn' },
  { id: 'revise', label: 'Revise' },
];

const companionFeatures = [
  { label: 'Remembers your progress', icon: Brain },
  { label: 'Mood-based study plans', icon: Smile },
  { label: 'Voice questions and replies', icon: Mic },
];

function Eyebrow({ children, light = false }) {
  return (
    <p className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${light ? 'text-[#a7e8c3]' : 'text-[#157a4a]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${light ? 'bg-[#a7e8c3]' : 'bg-[#157a4a]'}`} />
      {children}
    </p>
  );
}

export default function HomeLanding({
  navigate,
  onSignIn,
  journeySteps,
  pageLabels,
  studyPages,
  careerPages,
}) {
  const [agentTab, setAgentTab] = useState('all');
  const visibleAgents = agentCards.filter((card) => agentTab === 'all' || card.group === agentTab);

  return (
    <div className="native-green home-landing bg-[#f6faf7] text-slate-800">
      {/* Hero */}
      <section className="home-hero relative overflow-hidden px-6 pb-20 pt-32 text-white md:pt-40">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#a7e8c3]">Learn · Plan · Revise · Grow</p>
            <h1 className="text-4xl font-extrabold leading-[1.1] md:text-6xl">
              Your Smarter Study Journey Starts{' '}
              <span className="home-script text-6xl text-[#8ee4b2] md:text-8xl">Here</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-emerald-50/85 md:text-lg">
              Student Study Agent gives you a team of AI agents that plan your study time, summarize your notes, track deadlines, explain hard topics and quiz you before exams.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-[#1f9d5c] px-6 py-3.5 font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-[#23b068]"
                onClick={() => navigate('agent')}
              >
                <Bot className="h-5 w-5" /> Talk to the Hub
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3.5 font-semibold text-white transition hover:bg-white/10"
                onClick={() => navigate('retrieval')}
              >
                <FileSearch className="h-5 w-5" /> Ask Your Notes
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-4 rounded-[2rem] border border-white/15" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-3xl border-4 border-white/90 shadow-2xl shadow-black/40">
              <video src="/hero-video.mp4" autoPlay loop muted playsInline className="block w-full object-cover" />
            </div>
            <p className="home-script absolute -right-8 -top-8 hidden rotate-[8deg] text-3xl leading-none text-[#d8f5e3] lg:block">
              More than
              <br />
              just notes
            </p>
          </div>
        </div>
      </section>

      {/* Agents */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <Eyebrow>Our study agents</Eyebrow>
              <h2 className="text-3xl font-extrabold text-[#0f3d2b] md:text-4xl">Find the Right Agent for Every Task</h2>
              <p className="mt-3 text-slate-600">
                From planning your week to the night before the exam, each agent handles one part of studying and shares what it learns with the others.
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-[#157a4a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#11653d]"
              onClick={() => navigate('agent')}
            >
              Open the Hub <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter agents">
            {agentTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={agentTab === tab.id}
                onClick={() => setAgentTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  agentTab === tab.id ? 'bg-[#157a4a] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-[#157a4a] hover:text-[#157a4a]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleAgents.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.page}
                  type="button"
                  onClick={() => navigate(card.page)}
                  className="home-card group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm"
                >
                  <div className="home-card-art relative h-44 w-full shrink-0 overflow-hidden bg-[#e3f4ea]">
                    <img
                      src={card.image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="relative p-5 pt-8">
                    <span className="absolute -top-6 left-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#e3f4ea] text-[#157a4a]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-lg font-bold text-[#0f3d2b]">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.desc}</p>
                    <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#157a4a]">
                      Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works + companion panel */}
      <section className="px-6 pb-20">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-3xl shadow-xl shadow-emerald-950/10 lg:grid-cols-2">
          <div className="bg-white p-8 md:p-12">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="text-3xl font-extrabold text-[#0f3d2b]">From Scattered Material to Exam-Ready</h2>
            <div className="mt-8 space-y-6">
              {journeySteps.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="flex gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e3f4ea] text-[#157a4a]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1f9d5c]">Step {item.step}</p>
                      <h3 className="mt-1 font-bold text-slate-800">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="home-panel relative p-8 text-white md:p-12">
            <Eyebrow light>Your study partner</Eyebrow>
            <h2 className="text-3xl font-extrabold">A Place to Learn, Grow and Improve</h2>
            <p className="mt-4 leading-relaxed text-emerald-50/85">
              Student Study Agent is more than a set of tools. It remembers your subjects, weak topics and mood, so every plan, explanation and quiz is shaped around you.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {companionFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.label} className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <Icon className="mb-3 h-6 w-6 text-[#8ee4b2]" />
                    <p className="text-sm font-semibold">{feature.label}</p>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-8 flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#0f3d2b] transition hover:bg-[#e3f4ea]"
              onClick={() => navigate('planner')}
            >
              Build My Study Plan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="px-6 pb-20">
        <div className="home-cta mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 rounded-3xl p-8 text-white md:p-12">
          <div className="max-w-xl">
            <h2 className="text-2xl font-extrabold md:text-3xl">Ready to Start Your Study Journey?</h2>
            <p className="mt-2 text-emerald-50/85">Upload your first notes or ask the Hub anything. It takes less than a minute.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-[#1f9d5c] px-6 py-3 font-semibold text-white transition hover:bg-[#23b068]"
              onClick={() => navigate('notes')}
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              onClick={onSignIn}
            >
              <LogIn className="h-4 w-4" /> Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a2e22] px-6 pb-8 pt-14 text-emerald-50/80">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-3 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f9d5c]">
                <Brain className="h-6 w-6" />
              </span>
              <span className="text-lg font-bold">Student Study Agent</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed">An agentic AI personal study assistant that plans, explains and quizzes, so you can focus on learning.</p>
          </div>
          <div>
            <p className="mb-4 text-sm font-semibold text-white">Study agents</p>
            <ul className="space-y-2 text-sm">
              {studyPages.filter((page) => page !== 'home').map((page) => (
                <li key={page}>
                  <button type="button" className="transition hover:text-white" onClick={() => navigate(page)}>{pageLabels[page]}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-sm font-semibold text-white">Career</p>
            <ul className="space-y-2 text-sm">
              {careerPages.map((page) => (
                <li key={page}>
                  <button type="button" className="transition hover:text-white" onClick={() => navigate(page)}>{pageLabels[page]}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-sm font-semibold text-white">Powered by</p>
            <ul className="space-y-2 text-sm">
              <li>Google Gemini AI</li>
              <li>Retrieval-augmented answers</li>
              <li>MongoDB Atlas</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-7xl border-t border-white/10 pt-6 text-xs text-emerald-50/60">
          © {new Date().getFullYear()} Student Study Agent. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
