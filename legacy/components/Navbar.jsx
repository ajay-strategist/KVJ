import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 60) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-sm py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
              <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.8"/>
              <rect x="12" y="12" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.8"/>
              <rect x="12" y="2" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.4"/>
              <rect x="2" y="12" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.4"/>
            </svg>
            <span className="font-bold text-xl text-primary tracking-tight">FlowDesk</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex space-x-8 items-center">
            <a href="#features" className="text-slate-600 hover:text-primary font-medium transition-colors duration-250">Features</a>
            <a href="#how-it-works" className="text-slate-600 hover:text-primary font-medium transition-colors duration-250">How it works</a>
            <a href="#pricing" className="text-slate-600 hover:text-primary font-medium transition-colors duration-250">Pricing</a>
            <a href="#chat" className="text-slate-600 hover:text-primary font-medium transition-colors duration-250">Chat</a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex space-x-4 items-center">
            <Link to="/login" className="text-slate-600 hover:text-primary font-medium transition-colors duration-250 px-4 py-2 cursor-pointer">Login</Link>
            <Link to="/signup" className="bg-primary hover:bg-opacity-90 text-white font-medium py-2 px-5 rounded-lg transition-all duration-250 shadow-sm hover:shadow cursor-pointer">Get Started Free</Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-600 hover:text-primary focus:outline-none cursor-pointer">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden absolute w-full bg-white shadow-md transition-all duration-300 origin-top ${mobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} style={{ top: '100%' }}>
        <div className="px-4 pt-2 pb-6 space-y-1">
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-primary rounded-md font-medium">Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-primary rounded-md font-medium">How it works</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-primary rounded-md font-medium">Pricing</a>
          <a href="#chat" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-primary rounded-md font-medium">Chat</a>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col space-y-3 px-3">
            <Link to="/login" className="w-full text-center text-slate-600 font-medium py-2 border border-slate-200 rounded-lg block">Login</Link>
            <Link to="/signup" className="w-full text-center bg-primary text-white font-medium py-2 rounded-lg block">Get Started Free</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
