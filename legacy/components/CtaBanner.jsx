import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function CtaBanner() {
  return (
    <section className="py-20 bg-primary overflow-hidden relative">
      {/* Decorative background shapes */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-accent opacity-20 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-400 opacity-10 blur-3xl"></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <FadeInSection>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">Ready to bring your team together?</h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join 200+ IT service companies running their operations on FlowDesk.
          </p>
          <button className="bg-white hover:bg-slate-50 text-primary font-bold py-4 px-10 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 text-lg">
            Get Started Free — it's free forever
          </button>
        </FadeInSection>
      </div>
    </section>
  );
}
