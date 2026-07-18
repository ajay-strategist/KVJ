import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function HowItWorks() {
  const steps = [
    {
      num: 1,
      title: "Set up your team",
      desc: "Invite members, assign roles, define grades, and organize into specific departments.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    },
    {
      num: 2,
      title: "Assign projects and tasks",
      desc: "Create projects, setup kanban boards, and assign work with clear deadlines.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      num: 3,
      title: "Track everything live",
      desc: "Monitor GPS attendance, view timesheets, and communicate in real-time.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Up and running in minutes</h2>
            <p className="text-lg text-slate-600">Zero complex configuration. Get your entire agency onboarded today.</p>
          </div>
        </FadeInSection>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[2px] border-t-2 border-dashed border-slate-200 z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
            {steps.map((step, idx) => (
              <FadeInSection key={idx}>
                <div className="flex flex-col items-center text-center bg-white p-4">
                  <div className="w-24 h-24 rounded-full bg-white border border-slate-100 shadow-lg flex items-center justify-center mb-6 relative group transition-transform duration-300 hover:-translate-y-2">
                    <div className="absolute inset-0 bg-primary/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300"></div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm shadow-sm z-10">
                      {step.num}
                    </div>
                    <div className="text-primary z-10">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
