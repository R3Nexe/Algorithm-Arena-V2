import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiMail, FiMapPin, FiMessageSquare, FiCopy } from "react-icons/fi";
import Logo from "../components/Logo";
import Card from "../components/Card";
import { useAuth } from "../context/useAuth";
import toast from "react-hot-toast";

const Contact = () => {
  const { isAuthenticated } = useAuth();

  const email = "gdsciter@gmail.com";
  const subject = "Algorithm Arena Contact";
  const gmailWebLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(subject)}`;
  // Android intent to force open the native Gmail app
  const androidGmailIntent = `intent://compose?to=${email}&subject=${encodeURIComponent(subject)}#Intent;package=com.google.android.gm;scheme=mailto;end;`;
  // iOS/iPadOS URL scheme to force open the native Gmail app
  const iosGmailLink = `googlegmail:///co?to=${email}&subject=${encodeURIComponent(subject)}`;

  const getDeviceOS = () => {
    if (typeof window === 'undefined') return 'Unknown';
    const ua = window.navigator.userAgent;
    // This accurately catches iPhones, older iPads, and modern iPadOS devices
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iOS';
    if (/Mac OS X/.test(ua)) return 'Mac';
    if (/Android/.test(ua)) return 'Android';
    if (/Win/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Other';
  };

  const getMailLink = () => {
    const os = getDeviceOS();
    
    // Force open native Gmail App on Android
    if (os === 'Android') {
      return androidGmailIntent;
    }
    // Force open native Gmail App on iOS & iPadOS
    if (os === 'iOS') {
      return iosGmailLink;
    }
    // Redirect directly to Gmail Web for Desktop (Mac, Windows, Linux, etc.)
    return gmailWebLink;
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-app text-primary font-sans">
      {/* ── Navigation ── */}
      <nav className="relative z-10 flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 w-full overflow-hidden">
        <Link to="/" className="group flex items-center shrink-0 min-w-0 mr-1 sm:mr-4">
          <Logo variant="arena" showText={true} size="sm" className="scale-90 origin-left sm:scale-100" />
        </Link>

        <div className="flex gap-1 sm:gap-2 items-center shrink-0">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-5 py-2 rounded-full font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, rgba(var(--accent-rgb), 1), rgba(var(--accent-rgb), 0.7))`,
                boxShadow: `0 4px 16px rgba(var(--accent-rgb), 0.3)`,
              }}
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-2 sm:px-4 py-1.5 text-secondary hover:text-primary rounded-full font-semibold text-xs sm:text-sm transition-all hover:bg-white/5 whitespace-nowrap"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-white font-bold text-xs sm:text-sm transition-all hover:-translate-y-0.5 active:scale-95 whitespace-nowrap"
                style={{
                  background: `linear-gradient(135deg, rgba(var(--accent-rgb), 1) 0%, #a855f7 100%)`,
                  boxShadow: `0 4px 12px rgba(var(--accent-rgb), 0.25)`,
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="footer-page flex-1 w-full max-w-6xl mx-auto px-6 py-16 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black mb-4">Contact Us</h1>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              We're building the best coding platform on campus, and we need your voice to make it perfect.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-center mb-12">
            
            {/* Left Side: Description */}
            <div className="space-y-6 lg:col-span-3">
              <h2 className="text-3xl md:text-4xl font-bold">Why reach out?</h2>
              <p className="text-secondary leading-relaxed">
                Algorithm Arena thrives on community feedback. Whether you've spotted a critical glitch or have a brilliant idea for a new feature, your insights directly shape the platform.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: `rgba(var(--accent-rgb), 0.1)` }}>
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <strong className="text-primary block">Bug Reports & Glitches</strong>
                    <span className="text-secondary text-sm">Help us squash bugs! If a test case is broken or the compiler acts up, let us know immediately.</span>
                  </div>
                </li>
                
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: `rgba(var(--accent-rgb), 0.1)` }}>
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <strong className="text-primary block">Feature Requests & Improvements</strong>
                    <span className="text-secondary text-sm">Got an idea for a new leaderboard format or a better code editor experience? We are actively developing based on what you want.</span>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ background: `rgba(var(--accent-rgb), 0.1)` }}>
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <strong className="text-primary block">Support & Collaboration</strong>
                    <span className="text-secondary text-sm">If you need any help/assistance on Algorithm Arena, or integrate your ideas, drop us a line.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Right Side: Email Card */}
            <div className="flex justify-center lg:justify-end lg:col-span-2">
              <Card className="p-10 text-center flex flex-col items-center justify-center w-full max-w-md shadow-2xl shadow-black/10 dark:shadow-black/50 border border-glass-border">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto" style={{ background: `rgba(var(--accent-rgb), 0.1)` }}>
                  <FiMail size={32} className="text-accent" />
                </div>
                <h2 className="text-3xl font-bold mb-3">Email Us</h2>
                <p className="text-secondary mb-6 text-base">
                  For general inquiries, support, or partnership opportunities, drop us a direct email and we'll get back to you promptly.
                </p>

                <p className="text-primary font-mono text-sm mb-4">
                  Mail us at : <span className="text-accent font-bold">gdsciter@gmail.com</span>
                </p>
                
                {/* Dynamic Mail Button (Apple Mail or Gmail Web) */}
                <a
                  href={getMailLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    navigator.clipboard.writeText(email);
                    toast.success("Opening Mail... (Email copied just in case!)");
                  }}
                  className="group relative px-8 py-4 rounded-2xl text-white font-black text-base transition-all hover:-translate-y-1 flex items-center justify-center gap-3 overflow-hidden w-full"
                  style={{
                    background: `linear-gradient(135deg, rgb(var(--accent-rgb)), #7c3aed)`,
                    boxShadow: `0 8px 32px rgba(var(--accent-rgb), 0.35), 0 2px 8px rgba(0,0,0,0.2)`,
                  }}
                >
                  <span className="relative z-10">Send an Email</span>
                  <FiMessageSquare className="relative z-10 group-hover:scale-110 transition-transform" />
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </a>
              </Card>
            </div>
          </div>
        </motion.div>
      </main>

    </div>
  );
};

export default Contact;
