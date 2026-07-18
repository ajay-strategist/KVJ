import React from 'react';
import { FadeInSection } from '../hooks/useFadeIn';

export default function ChatHighlight() {
  return (
    <section id="chat" className="py-24 bg-primary text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          
          <div className="mb-16 lg:mb-0">
            <FadeInSection>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 tracking-tight">Your team chat, built right in.</h2>
              <p className="text-lg text-blue-100 mb-10 leading-relaxed">
                No Slack tab switching. Message your team, share files, reply in threads — all inside FlowDesk.
              </p>
              
              <ul className="space-y-5">
                {[
                  "Dedicated team channels & custom spaces",
                  "Direct messaging with @mentions",
                  "Organized threaded replies",
                  "Share images, PDFs, and documents"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-white font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeInSection>
          </div>

          <div className="relative">
            <FadeInSection>
              <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 max-w-lg mx-auto lg:ml-auto">
                {/* Header */}
                <div className="bg-slate-900 px-4 py-3 flex items-center gap-3 border-b border-slate-700">
                  <div className="text-slate-400">#</div>
                  <div className="font-semibold text-white">devops-team</div>
                </div>
                
                {/* Chat Area */}
                <div className="p-4 space-y-6 bg-slate-800 h-[320px] flex flex-col justify-end">
                  
                  {/* Message 1 */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">JD</div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm text-white">John Doe</span>
                        <span className="text-xs text-slate-400">10:42 AM</span>
                      </div>
                      <div className="text-sm text-slate-200 mt-1 bg-slate-700 p-3 rounded-lg rounded-tl-none inline-block shadow-sm">
                        Just deployed the latest API updates. Can someone test the endpoints?
                      </div>
                    </div>
                  </div>

                  {/* Message 2 */}
                  <div className="flex gap-3 flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">ME</div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-2 flex-row-reverse">
                        <span className="font-semibold text-sm text-white">You</span>
                        <span className="text-xs text-slate-400">10:45 AM</span>
                      </div>
                      <div className="text-sm text-white mt-1 bg-accent p-3 rounded-lg rounded-tr-none inline-block shadow-sm text-right">
                        Looking into it now. Give me 5 minutes.
                      </div>
                    </div>
                  </div>

                  {/* Message 3 */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AS</div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm text-white">Alice Smith</span>
                        <span className="text-xs text-slate-400">10:48 AM</span>
                      </div>
                      <div className="text-sm text-slate-200 mt-1 bg-slate-700 p-3 rounded-lg rounded-tl-none inline-block shadow-sm">
                        Everything looks good on my end! 
                      </div>
                    </div>
                  </div>
                  
                </div>
                
                {/* Input Area */}
                <div className="p-3 bg-slate-900 border-t border-slate-700">
                  <div className="bg-slate-800 rounded-lg flex items-center px-3 py-2 border border-slate-700">
                    <svg className="w-5 h-5 text-slate-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <div className="flex-1 text-sm text-slate-400">Message #devops-team...</div>
                    <div className="w-6 h-6 bg-accent rounded text-white flex items-center justify-center">
                      <svg className="w-3 h-3 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>
            
            {/* Decorative Elements */}
            <div className="absolute top-1/2 -right-10 w-40 h-40 bg-accent rounded-full blur-3xl opacity-20 transform -translate-y-1/2"></div>
          </div>

        </div>
      </div>
    </section>
  );
}
