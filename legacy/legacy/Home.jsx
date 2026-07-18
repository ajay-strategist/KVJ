import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import SocialProof from '../components/SocialProof';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import ChatHighlight from '../components/ChatHighlight';
import Testimonials from '../components/Testimonials';
import Pricing from '../components/Pricing';
import CtaBanner from '../components/CtaBanner';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-accent/20 selection:text-primary">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <ChatHighlight />
        <Testimonials />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
