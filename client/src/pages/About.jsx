import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../components/Logo";
import Card from "../components/Card";
import { useAuth } from "../context/useAuth";

const About = () => {
  const { isAuthenticated } = useAuth();

  const getAvatar = (name) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;

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
      <main className="footer-page flex-1 w-full max-w-4xl mx-auto px-6 py-16 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full space-y-12"
        >
          {/* Page Title */}
          <h1 className="text-4xl md:text-5xl font-black text-center mb-8">About Us</h1>

          {/* Our Mission Section */}
          <Card className="p-8 md:p-10 border border-glass-border bg-black/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                {/* Perfected GDG Logo SVG */}
                <svg viewBox="0 0 74 52" className="w-16 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Red Pill (Back) */}
                  <path d="M26 12L12 26" stroke="#EA4335" strokeWidth="10" strokeLinecap="round" />
                  {/* Blue Pill (Front) */}
                  <path d="M26 40L12 26" stroke="#4285F4" strokeWidth="10" strokeLinecap="round" />
                  
                  {/* Yellow Pill (Back) */}
                  <path d="M48 40L62 26" stroke="#FBBC05" strokeWidth="10" strokeLinecap="round" />
                  {/* Green Pill (Front) */}
                  <path d="M48 12L62 26" stroke="#34A853" strokeWidth="10" strokeLinecap="round" />
                </svg>
                <h2 className="text-3xl font-bold text-blue-500">Community Driven</h2>
              </div>
              <p className="text-secondary text-lg leading-relaxed mb-6 font-mono tracking-tight">
                Born out of the GDG On Campus SOA ITER community, Algorithm Arena was created with a single goal: to bridge the gap between learning data structures and actually enjoying the process of solving them.
              </p>
              <p className="text-secondary text-lg leading-relaxed font-mono tracking-tight">
                We noticed that traditional coding platforms can feel sterile and intimidating. By introducing vibrant leaderboards, XP systems, and seamless integrations, we've turned algorithmic training into an arena where developers can push their limits, track their growth, and compete with their peers.
              </p>
            </div>
          </Card>

          {/* Meet the Team Section */}
          <section>
            <h2 className="text-3xl font-bold text-blue-400 mb-6">Meet the Team</h2>
            
            {/* Team Grid */}
            <div className="flex flex-wrap gap-4">
              {[
                { name: "Ritesh Kumar", image: "/team/ritesh.jpg", linkedin: "https://www.linkedin.com/in/ritesh-kr08/", roles: [{ name: "Founder", color: "bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30" }] },
                { name: "Nishant Kumar", image: "/team/nishant.jpg", linkedin: "https://www.linkedin.com/in/nishant-kumar-b91a96325/", roles: [{ name: "Frontend", color: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30" }] },
                { name: "Nirakar Patel", image: "/team/nirakar.png", linkedin: "https://www.linkedin.com/in/nirakarpatel/", roles: [{ name: "Frontend", color: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30" }, { name: "Backend", color: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30" }] },
                { name: "Rashmi Anand", image: "/team/rashmi.jpg", linkedin: "https://www.linkedin.com/in/rashmi-anand718/", roles: [{ name: "Backend", color: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30" }] },
                { name: "Siddhant Jena", image: "/team/siddhant.jpg", linkedin: "https://www.linkedin.com/in/siddhant-jena-457350389", roles: [{ name: "Frontend", color: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30" }, { name: "Backend", color: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30" }] },
                { name: "Ayush Kumar", image: "/team/ayush.jpg", linkedin: "https://www.linkedin.com/in/ayushkumarjsr", roles: [{ name: "Backend", color: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30" }] },
                { name: "Omm P.Rout", image: "/team/omm.jpg", linkedin: "https://www.linkedin.com/in/omm-prakash-rout", roles: [{ name: "Backend", color: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30" }] },
                { name: "Rishav Singh", image: "/team/rishav.jpg", linkedin: "https://www.linkedin.com/in/rishav-singh13", roles: [{ name: "Backend", color: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30" }] },
                { name: "Akash Pattnaik", image: "/team/akash.jpg", linkedin: "https://www.linkedin.com/in/iakashpattnaik/", roles: [{ name: "Backend", color: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30" }] },
                { name: "Ashutosh Padhi", image: "/team/ashutosh.png", linkedin: "https://www.linkedin.com/in/ashutosh-padhi", roles: [{ name: "DevOps", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30" }] },
                { name: "Nandish Sinha", image: "/team/nandish.jpg", linkedin: "https://www.linkedin.com/in/nandishsinha", roles: [{ name: "DevOps", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30" }] }
              ].map((member) => (
                <a key={member.name} href={member.linkedin} target="_blank" rel="noopener noreferrer" className="block outline-none flex-auto min-w-[140px] md:min-w-[160px] max-w-full">
                  <Card className="p-4 flex flex-col items-center text-center border border-black/10 dark:border-white/10 hover:-translate-y-1 hover:border-blue-500/50 transition-all h-full justify-between">
                    <div className="w-14 h-14 rounded-full mb-3 mx-auto overflow-hidden bg-black/5 dark:bg-white/10 flex-shrink-0">
                      <img src={member.image || getAvatar(member.name)} alt={member.name} className="w-full h-full object-cover" style={member.imageStyle || {}} />
                    </div>
                    <h4 className="font-mono text-sm mb-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{member.name}</h4>
                    <div className="flex flex-wrap gap-1 justify-center mt-auto">
                      {member.roles.map((role, idx) => (
                        <span key={idx} className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap shadow-sm ${role.color}`}>
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          </section>

          {/* Special Thanks To Section */}
          <section>
            <h2 className="text-3xl font-bold text-blue-500 dark:text-blue-400 mb-6">Special Thanks To</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { name: "Mohammad Faiz", image: "/team/faiz.png", linkedin: "https://www.linkedin.com/in/mohammad-faiz-developer/", role: "Chapter Lead", roleColor: "bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30", quote: "" },
                { name: "Harsh Kumar", image: "/team/harsh.png", linkedin: "https://www.linkedin.com/in/harsh-kumar-173410306/", role: "Management Lead", roleColor: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30", quote: "" },
                { name: "Kumar Rakshit", image: "/team/rakshit.png", linkedin: "https://www.linkedin.com/in/rex7t/", role: "Tech Lead", roleColor: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30", quote: "" },
                { name: "Pavan Kumar", image: "/team/pavan.png", linkedin: "https://www.linkedin.com/in/rajana-durga-pavan-kumar-432248298/", role: "Design Lead", roleColor: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30", quote: "" },
                { name: "Mansa Sidhi", image: "/team/mansa.png", linkedin: "https://www.linkedin.com/in/mansa-siddhi-4545a72ba/", role: "Media Lead", roleColor: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30", quote: "" }
              ].map((member) => (
                <a key={member.name} href={member.linkedin} target="_blank" rel="noopener noreferrer" className="block outline-none h-full">
                  <Card className="p-4 flex flex-col items-center text-center border border-black/10 dark:border-white/10 hover:-translate-y-1 hover:border-blue-500/50 transition-all h-full">
                  <div className="w-14 h-14 rounded-full mb-3 mx-auto overflow-hidden bg-black/5 dark:bg-white/10 flex-shrink-0">
                    <img src={member.image || getAvatar(member.name)} alt={member.name} className="w-full h-full object-cover" style={member.imageStyle || {}} />
                  </div>
                  <h4 className="font-mono text-sm mb-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{member.name}</h4>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap shadow-sm mb-2 ${member.roleColor}`}>{member.role}</span>
                  {member.quote && <p className="text-secondary font-mono text-[10px] leading-tight mt-auto">"{member.quote}"</p>}
                  </Card>
                </a>
              ))}
            </div>
          </section>

        </motion.div>
      </main>

    </div>
  );
};

export default About;
