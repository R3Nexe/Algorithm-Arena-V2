import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../components/Logo";
import { useAuth } from "../context/useAuth";

const Terms = () => {
  const { isAuthenticated } = useAuth();

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
      <main className="footer-page flex-1 w-full max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-12"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-4">Terms & Conditions</h1>
            <p className="text-secondary text-lg">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-8 text-secondary leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">1. Agreement to Terms</h2>
              <p>
                By accessing or using Algorithm Arena, you agree to be bound by these Terms and Conditions.
                If you disagree with any part of the terms, then you may not access the service. These terms
                apply to all visitors, users, and others who access or use the platform.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">2. Account Registration & Security</h2>
              <p>
                When you create an account with us, you must provide accurate, complete, and current information.
                You are responsible for safeguarding the password that you use to access the service and for any activities
                or actions under your password. You agree not to disclose your password to any third party.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">3. Acceptable Use & Academic Integrity</h2>
              <p>
                Algorithm Arena is designed to help students improve their DSA skills. By participating, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Submit code that you have written yourself.</li>
                <li>Not use automated scripts, bots, or third-party AI tools to solve competitive challenges on your behalf.</li>
                <li>Not maliciously attempt to exploit or overload the platform's code execution environment.</li>
              </ul>
              <p>
                Accounts found violating these academic integrity standards may have their leaderboard rankings wiped
                or access permanently revoked.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">4. Intellectual Property</h2>
              <p>
                The platform, its original content (excluding user-submitted code), features, and functionality
                are and will remain the exclusive property of GDG On Campus SOA ITER. You retain ownership of
                the code you write and submit to the platform.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">5. Termination</h2>
              <p>
                We may terminate or suspend your account immediately, without prior notice or liability, for any
                reason whatsoever, including without limitation if you breach the Terms. Upon termination, your
                right to use the platform will immediately cease.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">6. Changes to Terms</h2>
              <p>
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time.
                By continuing to access or use our Service after those revisions become effective, you agree
                to be bound by the revised terms.
              </p>
            </section>
          </div>
        </motion.div>
      </main>

    </div>
  );
};

export default Terms;
