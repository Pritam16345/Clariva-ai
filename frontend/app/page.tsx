"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#08080d] text-[#f0f0ec] font-['Inter'] selection:bg-[#7c6af5]/30">
      {/* Navbar */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#08080d]/80 backdrop-blur-md border-b justify-center border-[#252535]" : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <img src="/clariva_logo.png" alt="Clariva" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span className="font-bold text-xl tracking-tight text-[#f0f0ec]">Clariva <span className="text-[#9d8df5] font-bold">AI</span></span>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#9a9a9a]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-sm font-medium text-[#f0f0ec] hover:text-[#7c6af5] transition-colors hidden sm:block">
              Sign In
            </Link>
            <Link href="/auth?tab=register" className="text-sm rounded-lg font-semibold tracking-[0.01em] transition-all duration-200 ease-in-out px-4 py-2 bg-[#7c6af5] text-white hover:bg-[#6d5ce6]">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ 
          paddingTop: "clamp(80px, 12vh, 140px)",
          paddingBottom: "80px",
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124, 106, 245, 0.07) 0%, transparent 70%)"
        }}
      >
        <div className="relative z-10 max-w-5xl mx-auto px-6 flex flex-col items-center text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <span 
              className="inline-block text-sm font-medium"
              style={{
                border: "1px solid rgba(124, 106, 245, 0.35)",
                background: "rgba(124, 106, 245, 0.07)",
                color: "#b8aef8",
                borderRadius: "999px",
                padding: "6px 16px"
              }}
            >
              AI-Powered Knowledge Intelligence
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[clamp(48px,7vw,80px)] tracking-[-0.02em] font-bold leading-[1.1] mb-[24px] font-['Playfair_Display']"
          >
            Your Knowledge,<br/>
            Intelligently <span className="text-[#9d8df5] italic">Amplified.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-[18px] text-[#9a9a9a] max-w-[560px] mx-auto mb-[40px] leading-[1.7]"
          >
            Feed Clariva a YouTube video, PDF, website, or audio file. Ask anything. Get answers that actually cite their source.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-[20px]"
          >
            <Link 
              href="/auth?tab=register"
              className="px-[28px] py-[14px] bg-[#7c6af5] text-white rounded-lg font-semibold tracking-[0.01em] hover:bg-[#6d5ce6] transition-all duration-200 ease-in-out w-full sm:w-auto text-center"
            >
              Start for Free &rarr;
            </Link>
            <a 
              href="#how-it-works"
              className="px-[28px] py-[14px] bg-transparent border border-[#252535] text-[#c8c8d0] rounded-lg font-semibold tracking-[0.01em] hover:bg-[#0e0e16] hover:border-[#9d8df5] transition-all duration-200 ease-in-out w-full sm:w-auto text-center"
            >
              See How It Works
            </a>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-[13px] text-[#6b7280]"
          >
            No credit card required &middot; Free forever
          </motion.p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-[#252535] bg-[#0e0e16] py-8 w-full z-10 relative">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 divide-x-0 md:divide-x divide-[#252535]">
          {[
            { value: "5", label: "Content Types" },
            { value: "Sub-50ms", label: "Retrieval" },
            { value: "Real-time", label: "Streaming" },
            { value: "100%", label: "Private" }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center justify-center text-center">
              <span className="text-[22px] font-[700] text-[#f0f0ec] mb-2 font-['Inter']">{stat.value}</span>
              <span className="text-[13px] text-[#6b7280]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 md:py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 font-['Playfair_Display']">Everything you need to build your knowledge base</h2>
            <p className="text-xl text-[#9a9a9a]">Five content types. One intelligent interface.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              {
                icon: "🎥",
                title: "YouTube & Video",
                desc: "Paste any YouTube URL. Get instant transcript insights and ask questions from hours of content."
              },
              {
                icon: "📄",
                title: "PDFs & Documents",
                desc: "Upload PDFs or text files. Extract knowledge and get cited answers from any document."
              },
              {
                icon: "🌐",
                title: "Websites",
                desc: "Paste any URL. Clariva scrapes and understands the full content of any webpage."
              },
              {
                icon: "🎙️",
                title: "Audio & Video Files",
                desc: "Upload MP3, MP4, WAV files. OpenAI Whisper transcribes speech into a searchable knowledge base."
              }
            ].map((feature, i) => (
              <div 
                key={i}
                className="bg-[#0e0e16] border border-[#252535] rounded-[12px] p-[28px] transition-all duration-300 hover:border-[rgba(124,106,245,0.3)] hover:shadow-[0_0_20px_rgba(124,106,245,0.06)]"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                <p className="text-[#9a9a9a] leading-relaxed text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-[#0e0e16]/50 border-t border-[#252535] relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold font-['Playfair_Display']">From source to insight in seconds</h2>
          </div>

          <div className="relative flex flex-col md:flex-row items-stretch justify-between gap-12 lg:gap-8">
            {/* Connecting dashed line (desktop) */}
            <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-[2px] border-t-2 border-dashed border-[#252535] z-0" />

            {[
              {
                step: "1",
                title: "Add Your Source",
                desc: "Paste a YouTube URL, website link, or upload a PDF, audio or video file."
              },
              {
                step: "2",
                title: "Ask Anything",
                desc: "Type your question in natural language. No special syntax needed."
              },
              {
                step: "3",
                title: "Get Cited Answers",
                desc: "Receive streaming AI answers with references back to the exact source."
              }
            ].map((item, i) => (
              <div key={i} className="flex-1 relative z-10 flex flex-col items-center text-center">
                <div className="w-[56px] h-[56px] rounded-full bg-[#08080d] border-2 border-[#7c6af5] flex items-center justify-center text-2xl font-bold text-white mb-6 shadow-[0_0_15px_rgba(124,106,245,0.22)]">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                <p className="text-[#9a9a9a] leading-relaxed px-4 max-w-[320px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-Source Section */}
      <section className="py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div 
            className="flex flex-col md:flex-row items-center gap-12 bg-[rgba(124,106,245,0.03)] border-l-4 border-[#7c6af5] rounded-[12px] p-[32px] md:p-[40px] border-y border-r border-y-[#252535] border-r-[#252535]"
          >
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-['Playfair_Display']">Chat across multiple sources</h2>
              <p className="text-lg text-[#9a9a9a] leading-[1.7]">
                Select multiple sources and ask questions that synthesize knowledge from all of them simultaneously. Discover connections you never knew existed.
              </p>
            </div>
            <div className="md:w-[360px] w-full shrink-0">
              <div className="bg-[#0e0e16] border border-[#252535] rounded-lg p-4 shadow-lg">
                <div className="flex gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-[rgba(124,106,245,0.06)] border border-[rgba(124,106,245,0.22)] p-2 rounded text-sm text-white">
                    <span className="text-lg">📄</span> Q3 Financial Report.pdf
                  </div>
                  <div className="flex items-center gap-3 bg-[rgba(124,106,245,0.06)] border border-[rgba(124,106,245,0.22)] p-2 rounded text-sm text-white">
                    <span className="text-lg">🎥</span> Earnings Call Q3
                  </div>
                  <div className="flex items-center gap-3 bg-[rgba(124,106,245,0.06)] border border-[rgba(124,106,245,0.22)] p-2 rounded text-sm text-white">
                    <span className="text-lg">🌐</span> Competitor Strategy Page
                  </div>
                  <div className="mt-4 p-3 bg-white/5 rounded-md text-sm text-[#f0f0ec]">
                    <span className="text-[#9d8df5] font-medium">Q:</span> How does our Q3 performance compare to the strategy outlined by competitors?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="about" className="py-24 relative z-10 px-6">
        <div className="max-w-4xl mx-auto">
          <div 
            className="text-center rounded-[16px] p-[60px] relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0e0e16 0%, #0a0a12 100%)",
              border: "1px solid rgba(124, 106, 245, 0.22)",
              boxShadow: "0 0 60px rgba(124, 106, 245, 0.06)"
            }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[rgba(124,106,245,0.12)] blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[rgba(124,106,245,0.12)] blur-[100px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 font-['Playfair_Display']">Ready to build your knowledge base?</h2>
              <p className="text-lg text-[#9a9a9a] mb-8 max-w-[500px] mx-auto leading-[1.7]">
                Join researchers, students, and professionals who use Clariva to unlock the knowledge inside their content.
              </p>
              <Link 
                href="/auth?tab=register"
                className="inline-block px-8 py-4 bg-[#7c6af5] text-white rounded-lg font-semibold tracking-[0.01em] transition-all duration-200 ease-in-out hover:bg-[#6d5ce6] shadow-[0_0_20px_rgba(124,106,245,0.22)] text-lg mb-4"
              >
                Get Started Free &rarr;
              </Link>
              <p className="text-[13px] text-[#6b7280]">No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#08080d] border-t border-[#252535] py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <img src="/clariva_logo.png" alt="Clariva" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <span className="font-bold text-xl tracking-tight text-[#f0f0ec]">Clariva <span className="text-[#9d8df5] font-bold">AI</span></span>
            </div>
            <p className="text-[#9a9a9a]">Your knowledge, amplified.</p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-[#f0f0ec] font-medium mb-10 w-full">
            <a href="#features" className="hover:text-[#7c6af5] transition-colors">Features</a>
            <span className="text-[#252535]">&middot;</span>
            <a href="#" className="hover:text-[#7c6af5] transition-colors">GitHub</a>
            <span className="text-[#252535]">&middot;</span>
            <a href="#" className="hover:text-[#7c6af5] transition-colors">Documentation</a>
            
            <div className="flex-1 min-w-full md:min-w-0 md:flex-none"></div>

            <div className="flex items-center gap-2 text-[#9a9a9a]">
              Built by <a href="https://github.com/Pritam16345" target="_blank" rel="noreferrer" className="text-white hover:text-[#7c6af5] transition-colors flex items-center gap-1.5 font-medium"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path></svg>Pritam Kundu</a>
            </div>
          </div>

          <div className="w-full border-t border-[#252535] pt-8 flex justify-center text-[13px] text-[#6b7280]">
            &copy; {new Date().getFullYear()} Clariva AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
