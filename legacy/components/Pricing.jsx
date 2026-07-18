import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600">Start for free, upgrade when you need more power.</p>
          </div>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
          
          {/* Free Tier */}
          <FadeInSection>
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Free</h3>
              <p className="text-slate-500 mb-6 min-h-[48px]">Perfect for small teams getting started.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900">$0</span>
                <span className="text-slate-500">/forever</span>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  "Up to 5 team members",
                  "Unlimited tasks",
                  "GPS attendance",
                  "Team chat",
                  "Basic timesheets"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 px-4 rounded-xl font-semibold bg-primary hover:bg-opacity-90 text-white transition-all shadow-sm">
                Get Started Free
              </button>
            </div>
          </FadeInSection>

          {/* Pro Tier */}
          <FadeInSection>
            <div className="bg-white rounded-2xl p-8 border-2 border-primary shadow-xl relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-bold tracking-wide">
                MOST POPULAR
              </div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-slate-900">Pro</h3>
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-semibold">Coming Soon</span>
              </div>
              <p className="text-slate-500 mb-6 min-h-[48px]">Advanced features for growing agencies.</p>
              <div className="mb-6 opacity-50">
                <span className="text-4xl font-extrabold text-slate-900">$12</span>
                <span className="text-slate-500">/user/mo</span>
              </div>
              <ul className="space-y-4 mb-8 opacity-50">
                {[
                  "Everything in Free",
                  "Unlimited team members",
                  "Advanced reporting",
                  "Client invoicing",
                  "Priority support"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <button disabled className="w-full py-3 px-4 rounded-xl font-semibold bg-slate-100 text-slate-400 cursor-not-allowed">
                Join Waitlist
              </button>
            </div>
          </FadeInSection>

          {/* Enterprise Tier */}
          <FadeInSection>
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm opacity-70">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-slate-900">Enterprise</h3>
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-semibold">Coming Soon</span>
              </div>
              <p className="text-slate-500 mb-6 min-h-[48px]">Custom solutions for large organizations.</p>
              <div className="mb-6">
                <span className="text-2xl font-bold text-slate-900">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  "Everything in Pro",
                  "Custom integrations",
                  "Dedicated account manager",
                  "SSO & advanced security",
                  "On-premise deployment options"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <button disabled className="w-full py-3 px-4 rounded-xl font-semibold border-2 border-slate-200 text-slate-400 cursor-not-allowed">
                Contact Sales
              </button>
            </div>
          </FadeInSection>

        </div>
      </div>
    </section>
  );
}
