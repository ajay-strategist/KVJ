import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-gradient-to-br from-white to-[#F0F5FF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">

          {/* Text Content */}
          <div className="lg:col-span-5 text-center lg:text-left mb-16 lg:mb-0">
            <FadeInSection>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100/50 text-accent text-sm font-semibold mb-6 border border-blue-200/50">
                <span className="flex h-2 w-2 rounded-full bg-accent mr-2"></span>
                Now in public beta
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6">
                Run your entire agency from <span className="text-primary">one place.</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Projects, tasks, attendance, timesheets, HR, and team chat — built for IT service companies.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button className="bg-primary hover:bg-opacity-90 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-250 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 cursor-pointer">
                  Start Free Trial
                </button>
                <button className="bg-white border-2 border-slate-200 hover:border-primary/30 text-slate-700 font-semibold py-3 px-8 rounded-xl transition-all duration-250 shadow-sm hover:bg-slate-50 cursor-pointer">
                  See a demo
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-500">Zero cost to start. No credit card required.</p>
            </FadeInSection>
          </div>

          {/* Dashboard Mockup */}
          <div className="lg:col-span-7 relative">
            <FadeInSection className="delay-200">
              <div className="relative rounded-2xl bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-200 overflow-hidden transform lg:rotate-[-1deg] transition-transform duration-500 hover:rotate-0">
                {/* Browser Chrome */}
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <div className="ml-4 flex-1 bg-white rounded-md h-5 border border-slate-200"></div>
                </div>

                {/* App UI Mockup */}
                <div className="flex h-[400px] bg-soft-grey text-left">
                  {/* Sidebar */}
                  <div className="w-16 sm:w-48 bg-white border-r border-slate-200 p-4 hidden sm:flex flex-col gap-4">
                    <div className="h-6 w-24 bg-slate-200 rounded animate-pulse mb-4"></div>
                    <div className="h-4 w-full bg-slate-100 rounded"></div>
                    <div className="h-4 w-3/4 bg-blue-100 rounded text-accent flex items-center px-2 text-xs font-medium border border-blue-200/50">Tasks</div>
                    <div className="h-4 w-5/6 bg-slate-100 rounded"></div>
                    <div className="h-4 w-full bg-slate-100 rounded"></div>
                    <div className="mt-auto h-8 w-8 rounded-full bg-slate-200"></div>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 p-6 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <div className="h-6 w-32 bg-slate-800 rounded mb-2"></div>
                        <div className="h-3 w-48 bg-slate-300 rounded"></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white -mr-3 relative z-10"></div>
                        <div className="w-8 h-8 rounded-full bg-slate-300 border-2 border-white relative z-20"></div>
                        <div className="h-8 px-3 rounded-md bg-primary text-white text-xs font-medium flex items-center ml-4">New Task</div>
                      </div>
                    </div>

                    {/* Kanban Board */}
                    <div className="flex-1 flex gap-4 overflow-hidden">
                      {/* Column 1 */}
                      <div className="flex-1 bg-slate-100 rounded-xl p-3 flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">To Do</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200/60">
                          <div className="h-3 w-3/4 bg-slate-700 rounded mb-2"></div>
                          <div className="h-2 w-full bg-slate-200 rounded mb-1"></div>
                          <div className="h-2 w-5/6 bg-slate-200 rounded mb-3"></div>
                          <div className="flex justify-between items-center">
                            <div className="h-4 w-12 bg-red-100 rounded text-red-600 text-[10px] flex items-center justify-center font-medium">High</div>
                            <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200/60">
                          <div className="h-3 w-4/5 bg-slate-700 rounded mb-2"></div>
                          <div className="flex justify-between items-center mt-4">
                            <div className="h-4 w-12 bg-blue-100 rounded text-blue-600 text-[10px] flex items-center justify-center font-medium">Medium</div>
                            <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                          </div>
                        </div>
                      </div>

                      {/* Column 2 */}
                      <div className="flex-1 bg-slate-100 rounded-xl p-3 flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-accent"></div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">In Progress</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200/60 border-l-2 border-l-accent">
                          <div className="h-3 w-full bg-slate-700 rounded mb-2"></div>
                          <div className="h-2 w-full bg-slate-200 rounded mb-1"></div>
                          <div className="h-2 w-2/3 bg-slate-200 rounded mb-3"></div>
                          <div className="flex justify-between items-center">
                            <div className="h-4 w-12 bg-amber-100 rounded text-amber-600 text-[10px] flex items-center justify-center font-medium">Urgent</div>
                            <div className="w-5 h-5 rounded-full bg-slate-300"></div>
                          </div>
                        </div>
                      </div>

                      {/* Column 3 */}
                      <div className="flex-1 bg-slate-100 rounded-xl p-3 hidden md:flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Done</span>
                        </div>
                        <div className="bg-white/60 p-3 rounded-lg shadow-sm border border-slate-200/60">
                          <div className="h-3 w-2/3 bg-slate-400 rounded mb-2 line-through"></div>
                          <div className="flex justify-between items-center mt-4">
                            <div className="h-4 w-12 bg-slate-200 rounded"></div>
                            <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>

            {/* Floating decorative elements */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-accent/10 rounded-full blur-2xl"></div>
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
          </div>

        </div>
      </div>
    </section>
  );
}
