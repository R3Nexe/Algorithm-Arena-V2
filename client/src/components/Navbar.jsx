import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiCpu,
  FiGrid,
  FiAward,
  FiUser,
  FiUsers,
  FiLogOut,
  FiMenu,
  FiX,
  FiShield,
  FiSettings,
  FiChevronDown,
  FiFolder,
  FiStar,
  FiMessageSquare,
  FiRadio
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { useAuth } from "../context/useAuth";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";

const Navbar = ({ onLogout }) => {
  const MotionDiv = motion.div;
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { role, user } = useAuth();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: FiGrid },
    { name: "Leaderboard", path: "/leaderboard", icon: FiAward },
    { name: "Clan", path: "/clans", icon: FiUsers },
    { name: "Archives", path: "/resources", icon: FiFolder },
  ];

  if (role === 'admin') {
    navItems.push({ name: 'Admin', path: '/admin', icon: FiShield });
  }

  if (role === 'clan-chief' || user?.isChief) {
    navItems.push({ name: 'Clan Chief', path: '/chief-panel', icon: FiShield });
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-glass-surface shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-10">
            <Link
              to="/"
              className="flex items-center group"
              onClick={closeMenu}
            >
              <Logo variant="arena" showText={true} size="sm" />
            </Link>
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-secondary hover:text-primary hover:bg-white/5",
                    )}
                  >
                    <Icon
                      className={clsx(
                        "text-lg",
                        isActive ? "text-accent" : "text-secondary",
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="relative">
                 <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="hidden md:flex items-center gap-3 group focus:outline-none py-1 px-2 rounded-2xl hover:bg-white/5 transition-all"
                 >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 p-0.5 transition-all group-hover:scale-105 shadow-lg shadow-accent/20">
                    {user?.profilePicture ? (
                      <img src={user.profilePicture} alt="Avatar" className="w-full h-full rounded-[9px] object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-[9px] bg-[#1a1a1c] flex items-center justify-center text-sm text-white font-black uppercase">
                        {user?.username?.[0] || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-xs font-bold text-primary group-hover:text-accent transition-colors">{user?.username || 'User'}</span>
                    <FiChevronDown className={clsx("text-secondary text-sm transition-transform duration-300", userDropdownOpen && "rotate-180")} />
                  </div>
                 </button>

                 <AnimatePresence>
                   {userDropdownOpen && (
                     <>
                       <div
                         className="fixed inset-0 z-40"
                         onClick={() => setUserDropdownOpen(false)}
                       />
                        <MotionDiv
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-3 w-64 macos-glass p-2 z-50 border-accent/20 shadow-2xl origin-top-right overflow-hidden"
                        >
                         <Link to="/profile" onClick={() => setUserDropdownOpen(false)} className="block px-4 py-3 bg-white/[0.03] rounded-xl mb-2 border border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all group">
                             <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1">Signed in as</p>
                             <p className="text-sm font-bold text-primary group-hover:text-accent truncate transition-colors">{user?.username}</p>
                             <p className="text-[10px] text-tertiary truncate">{user?.email || 'Authenticated User'}</p>
                          </Link>

                         <div className="space-y-1">
                           <Link
                             to="/profile"
                             onClick={() => setUserDropdownOpen(false)}
                             className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:text-primary hover:bg-white/5 transition-all group/item"
                           >
                             <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center group-hover/item:bg-accent/20 transition-colors">
                               <FiUser className="text-accent" />
                             </div>
                             <span>My Profile</span>
                           </Link>

                           <Link
                             to="/settings"
                             onClick={() => setUserDropdownOpen(false)}
                             className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:text-primary hover:bg-white/5 transition-all group/item"
                           >
                             <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover/item:bg-blue-500/20 transition-colors">
                               <FiSettings className="text-blue-400" />
                             </div>
                             <span>Settings</span>
                           </Link>
                         </div>

                         <div className="mt-2 pt-2 border-t border-white/5">
                           <button
                             onClick={() => {
                               setUserDropdownOpen(false);
                               onLogout();
                             }}
                             className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all group/logout"
                           >
                             <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover/logout:bg-red-500/20 transition-colors">
                               <FiLogOut />
                             </div>
                             <span>Sign Out</span>
                           </button>
                         </div>
                        </MotionDiv>
                     </>
                   )}
                 </AnimatePresence>
              </div>

              <button
                className="md:hidden p-2 rounded-lg border border-glass-border text-primary"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label={
                  menuOpen ? "Close navigation menu" : "Open navigation menu"
                }
                aria-expanded={menuOpen}
              >
                {menuOpen ? (
                  <FiX className="text-xl" />
                ) : (
                  <FiMenu className="text-xl" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "md:hidden fixed top-16 right-0 z-50 w-72 h-[calc(100vh-4rem)] bg-glass-surface backdrop-blur-xl border-l border-glass-border transform transition-transform duration-300",
          menuOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="Mobile navigation"
      >
        <div className="p-4 space-y-6">
          {/* Mobile User Header */}
          <div className="flex items-center gap-4 px-2 pb-4 border-b border-glass-border/40">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-600 p-0.5 shadow-lg shadow-accent/20">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Avatar" className="w-full h-full rounded-[9px] object-cover" />
              ) : (
                <div className="w-full h-full rounded-[9px] bg-[#1a1a1c] flex items-center justify-center text-sm text-white font-black uppercase">
                  {user?.username?.[0] || 'U'}
                </div>
              )}
            </div>
            <Link to="/profile" onClick={closeMenu} className="flex flex-col flex-1">
              <span className="text-sm font-bold text-primary hover:text-accent transition-colors truncate w-40">{user?.username || 'Guest User'}</span>
              <span className="text-[10px] text-tertiary uppercase tracking-wider font-bold">{role || 'Member'}</span>
            </Link>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black text-tertiary uppercase tracking-[0.2em] px-3 mb-2">Navigation</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMenu}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                    active
                      ? "bg-accent/15 text-accent"
                      : "text-primary hover:bg-white/5",
                  )}
                >
                  <Icon className={active ? "text-accent" : "text-secondary"} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black text-tertiary uppercase tracking-[0.2em] px-3 mb-2">Account</p>
            <Link
              to="/profile"
              onClick={closeMenu}
              className={clsx(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                location.pathname === "/profile" ? "bg-accent/15 text-accent" : "text-primary hover:bg-white/5"
              )}
            >
              <FiUser className={location.pathname === "/profile" ? "text-accent" : "text-secondary"} />
              <span className="font-medium">My Profile</span>
            </Link>
            <Link
              to="/settings"
              onClick={closeMenu}
              className={clsx(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                location.pathname === "/settings" ? "bg-accent/15 text-accent" : "text-primary hover:bg-white/5"
              )}
            >
              <FiSettings className={location.pathname === "/settings" ? "text-accent" : "text-secondary"} />
              <span className="font-medium">Settings</span>
            </Link>
          </div>

          <div className="pt-4 border-t border-glass-border/40">
            <button
              onClick={() => {
                closeMenu();
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
            >
              <FiLogOut />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
