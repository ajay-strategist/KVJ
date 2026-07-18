import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function Features() {
  const features = [
    {
      title: "Task Management",
      desc: "Kanban boards, priority lists, and calendar views to keep your team aligned.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: "blue"
    },
    {
      title: "Project Tracking",
      desc: "Monitor progress, track deadlines, and deliver client work on time.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      color: "purple"
    },
    {
      title: "GPS Attendance",
      desc: "Verified clock-ins and real-time activity tracking for your entire workforce.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: "emerald"
    },
    {
      title: "Team Chat",
      desc: "Channels, direct messages, threads, and file sharing built right in.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      color: "amber"
    },
    {
      title: "Timesheet & Cost Tracking",
      desc: "Log hours directly on tasks and calculate true project costs automatically.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "rose"
    },
    {
      title: "HR & Leave Management",
      desc: "Manage balances, approve requests, and view team availability calendars.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: "indigo"
    }
  ];

  const colorMap = {
    blue: "text-blue-600 bg-blue-50 border-blue-500",
    purple: "text-purple-600 bg-purple-50 border-purple-500",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-500",
    amber: "text-amber-600 bg-amber-50 border-amber-500",
    rose: "text-rose-600 bg-rose-50 border-rose-500",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-500"
  };

  return (
    <section id="features" className="py-24 bg-soft-grey">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Everything your agency needs</h2>
            <p className="text-lg text-slate-600">A unified platform to manage work, people, and communication without switching contexts.</p>
          </div>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <FadeInSection key={idx}>
              <div className={`bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100 hover:border-t-2 hover:-translate-y-1 ${colorMap[feature.color].replace('bg-', 'hover:border-')}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${colorMap[feature.color].split(' ').slice(0, 2).join(' ')}`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}
