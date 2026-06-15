import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiLock, FiMail, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Card from '../components/Card';
import PixelBlast from '../components/PixelBlast';
import ThemeToggle from '../components/ThemeToggle';
import { api } from '../lib/api';
import { useAuth } from '../context/useAuth';
import Logo from '../components/Logo';

const Register = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(currentTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const canSubmit = useMemo(() => {
    return formData.username.trim().length >= 3 && formData.email.trim().length > 0 && formData.password.length >= 6;
  }, [formData]);

  const validate = () => {
    const nextErrors = {};
    if (formData.username.trim().length < 3) nextErrors.username = 'Username must be at least 3 characters';
    if (!formData.email.trim()) nextErrors.email = 'Email is required';
    if (formData.password.length < 6) nextErrors.password = 'Password must be at least 6 characters';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      const res = await api.post('/api/auth/register', formData);
      login(res.data?.data);
      toast.success('Account created');
      navigate('/dashboard');
    } catch (err) {
      const message = err.userMessage || 'Registration failed';
      setErrors({ form: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 relative overflow-hidden">


      <div className="absolute inset-0 z-0 pointer-events-none">
        <PixelBlast
          variant="square"
          pixelSize={4}
          color={theme === 'dark' ? '#4f46e5' : '#4f46e5'}
          patternScale={2}
          patternDensity={1}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.5}
          edgeFade={0.25}
          transparent
        />
      </div>

      <div className="w-full max-w-md relative z-10 my-auto py-8">
        <Card className="shadow-2xl shadow-black/10 dark:shadow-black/50" hover={true} variant='glass'>
          <div className="text-center mb-8">
            {/* GDG Branding */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <Logo variant="hybrid" size="w-28 h-14" imgClassName="object-cover" />
            </div>
            <h2 className="text-sm font-medium text-secondary">Join the ranks.</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {errors.form && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {errors.form}
              </div>
            )}

            <div className="space-y-2">
              <label className="field-label">Codename (Username)</label>
              <div className="relative group">
                <FiUser className="absolute left-4 top-3.5 text-secondary group-focus-within:text-accent transition-colors" />
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-white/50 dark:bg-black/20 border border-glass-border rounded-xl py-3 pl-11 pr-4 text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-gray-400"
                  placeholder="e.g. Neo"
                  aria-invalid={Boolean(errors.username)}
                />
              </div>
              {errors.username && <p className="text-red-500 text-sm">{errors.username}</p>}
            </div>

            <div className="space-y-2">
              <label className="field-label">Email Address</label>
              <div className="relative group">
                <FiMail className="absolute left-4 top-3.5 text-secondary group-focus-within:text-accent transition-colors" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-white/50 dark:bg-black/20 border border-glass-border rounded-xl py-3 pl-11 pr-4 text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-gray-400"
                  placeholder="name@example.com"
                  aria-invalid={Boolean(errors.email)}
                />
              </div>
              {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <label className="field-label">Password</label>
              <div className="relative group">
                <FiLock className="absolute left-4 top-3.5 text-secondary group-focus-within:text-accent transition-colors" />
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-white/50 dark:bg-black/20 border border-glass-border rounded-xl py-3 pl-11 pr-4 text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-gray-400"
                  placeholder="Minimum 6 characters"
                  aria-invalid={Boolean(errors.password)}
                />
              </div>
              {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full py-3.5 rounded-xl bg-accent hover:bg-accent-glow text-white font-bold transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Profile...
                </>
              ) : (
                <>
                  Initialize Account <FiArrowRight />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center pt-6 border-t border-glass-border">
            <p className="text-sm text-secondary">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </Card>
      </div>

      {/* Footer */}

        <p className="text-sm text-secondary">
          Copyright 2026 Algorithm Arena. Built for{" "}
          <span className="text-primary font-semibold">
            GDG On Campus - SOA ITER
          </span>
          .
        </p>

    </div>
  );
};

export default Register;

