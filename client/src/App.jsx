import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { MotionConfig } from 'framer-motion';
import { initSpotlight } from './lib/spotlight';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ClanChiefRoute from './components/ClanChiefRoute';
import LoadingScreen from './components/LoadingScreen';
import ThemeToggle from './components/ThemeToggle';
import NotificationListener from './components/NotificationListener';
import { useAuth } from './context/useAuth';

const Home = lazy(() => import('./pages/Home'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const ClaimUsername = lazy(() => import('./pages/ClaimUsername'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ChallengeDetails = lazy(() => import('./pages/ChallengeDetails'));
const SubmissionDetails = lazy(() => import('./pages/SubmissionDetails'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Clans = lazy(() => import('./pages/Clans'));
const Profile = lazy(() => import('./pages/Profile'));
const ClanChiefPanel = lazy(() => import('./pages/ClanChiefPanel'));
const Missions = lazy(() => import('./pages/Missions'));
const InterviewPrep = lazy(() => import('./pages/InterviewPrep'));
const DomainQuestionSolve = lazy(() => import('./pages/DomainQuestionSolve'));
const PendingTasks = lazy(() => import('./pages/PendingTasks'));
const Settings = lazy(() => import('./pages/Settings'));
const Badges = lazy(() => import('./pages/Badges'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Resources = lazy(() => import('./pages/Resources'));
const PendingAssignment = lazy(() => import('./pages/PendingAssignment'));
function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  React.useEffect(() => initSpotlight(), []);

  const handleLoginSuccess = () => {};

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-container">
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[60]">
          <ThemeToggle />
        </div>
        <NotificationListener />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout onLogout={handleLogout} />
              </ProtectedRoute>
            }
          >
            <Route path="/claim-username" element={<ClaimUsername />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/clans" element={<Clans />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/badges" element={<Navigate to="/badges" replace />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/profile/:username/badges" element={<Badges />} />
            <Route path="/challenge/:id" element={<ChallengeDetails />} />
            <Route path="/submission/:id" element={<SubmissionDetails />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/interview-prep" element={<InterviewPrep />} />
            <Route path="/interview-prep/:id" element={<DomainQuestionSolve />} />
            <Route path="/pending-tasks" element={<PendingTasks />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/badges/:username" element={<Badges />} />

              <Route path="/chief-panel" element={<ClanChiefRoute><ClanChiefPanel /></ClanChiefRoute>} />

              {/* New Features */}
              <Route path="/resources" element={<Resources />} />
              <Route path="/pending-assignment" element={<PendingAssignment />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </div>
    </MotionConfig>
  );
}

export default App;

