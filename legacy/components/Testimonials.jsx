import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function Testimonials() {
  const testimonials = [
    {
      quote: "FlowDesk completely transformed how our agency operates. We replaced three different tools with just one.",
      name: "Sarah Jenkins",
      role: "Operations Manager",
      company: "TechNova Solutions",
      initials: "SJ",
      color: "bg-blue-500"
    },
    {
      quote: "The built-in chat tied directly to our projects means context is never lost. It's exactly what we needed.",
      name: "Marcus Thorne",
      role: "CEO",
      company: "Digital Horizon",
      initials: "MT",
      color: "bg-purple-500"
    },
    {
      quote: "GPS attendance and automated timesheets have saved us hours of administrative work every week.",
      name: "Elena Rodriguez",
      role: "HR Director",
      company: "CloudSync Partners",
      initials: "ER",
      color: "bg-emerald-500"
    }
  ];

  return (
    <section className="py-24 bg-soft-grey">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Trusted by IT leaders</h2>
          </div>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testi, idx) => (
            <FadeInSection key={idx}>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
                <div className="flex gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-700 italic mb-8 flex-1 text-lg leading-relaxed">"{testi.quote}"</p>
                <div className="flex items-center gap-4 mt-auto pt-6 border-t border-slate-100">
                  <div className={`w-12 h-12 rounded-full ${testi.color} text-white flex items-center justify-center font-bold text-lg`}>
                    {testi.initials}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{testi.name}</div>
                    <div className="text-sm text-slate-500">{testi.role}, {testi.company}</div>
                  </div>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}
