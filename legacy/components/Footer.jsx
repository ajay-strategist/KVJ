import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-soft-grey py-12 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center md:items-start mb-8">
          
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.8"/>
                <rect x="12" y="12" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.8"/>
                <rect x="12" y="2" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.4"/>
                <rect x="2" y="12" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.4"/>
              </svg>
              <span className="font-bold text-lg text-primary tracking-tight">FlowDesk</span>
            </div>
            <p className="text-slate-500 text-sm">Run your entire agency from one place.</p>
          </div>
          
          <div className="flex justify-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          </div>
          
          <div className="text-center md:text-right text-sm text-slate-500">
            &copy; {new Date().getFullYear()} FlowDesk Inc. All rights reserved.
          </div>
          
        </div>
      </div>
    </footer>
  );
}
