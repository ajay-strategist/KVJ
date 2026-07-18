import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function SocialProof() {
  return (
    <section className="py-10 border-b border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 text-sm sm:text-base text-slate-500 font-medium">
            <span className="flex items-center gap-2">200+ agencies</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="flex items-center gap-2">50,000 tasks completed</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="flex items-center gap-2">99.5% uptime</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="flex items-center gap-2">Zero cost to start</span>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
