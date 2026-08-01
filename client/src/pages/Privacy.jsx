import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../components/Logo";
import { useAuth } from "../context/useAuth";

const Privacy = () => {
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
            <h1 className="text-4xl md:text-5xl font-black mb-4">Privacy Policy</h1>
            <p className="text-secondary text-lg">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-8 text-secondary leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">1. Information We Collect</h2>
              <p>
                When you register for Algorithm Arena, we collect your name, email address, and the username you choose.
                As you use the platform, we also collect the code submissions you make, your scores, and your activity history
                in order to populate the leaderboards and provide you with detailed analytics on your progress.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">2. How We Use Your Information</h2>
              <p>
                The information we collect is strictly used to provide, maintain, and improve the Algorithm Arena platform.
                Specifically, your code submissions are evaluated to determine challenge completion and update your ranking.
                Your profile information is used to display your achievements and connect you with your Clan and peers.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">3. Data Security</h2>
              <p>
                We implement a variety of security measures to maintain the safety of your personal information.
                Your credentials are encrypted, and we use secure server connections. While we strive to protect
                your data, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">4. Cookies and Tracking</h2>
              <p>
                Algorithm Arena utilizes essential cookies to keep you securely logged into your account and to save
                your session preferences (such as dark mode). We do not use third-party tracking cookies for targeted advertising.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">5. Code Privacy</h2>
              <p>
                While your public profile and rank are visible to other users, your specific code submissions are private
                to you and the platform administrators. We will not share your source code with other users or third parties
                unless explicitly granted permission by you.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-primary">6. Contact Us</h2>
              <p>
                If you have any questions or concerns regarding this Privacy Policy or your data, please reach out to the
                GDG On Campus SOA ITER team.
              </p>
            </section>
          </div>
        </motion.div>
      </main>

    </div>
  );
};

export default Privacy;
