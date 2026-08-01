import React from 'react';
import { Link } from 'react-router-dom';
import { FiInstagram, FiLinkedin } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import Logo from './Logo';

const socials = [
  { href: 'https://whatsapp.com/channel/0029VbBdIckHVvTRsbC5SJ16', title: 'WhatsApp Channel', Icon: FaWhatsapp },
  { href: 'https://www.instagram.com/gdg_iter?igsh=MXFhc3UwdW40NmQ2cg==', title: 'Instagram', Icon: FiInstagram },
  { href: 'https://www.linkedin.com/company/google-developer-student-club-iter/', title: 'LinkedIn', Icon: FiLinkedin },
];

const Footer = () => {
  return (
    <footer className="relative z-10 mt-auto w-full border-t border-subtle">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-start gap-12">

        {/* Logo Section */}
        <div className="flex flex-col items-start gap-4 max-w-xs">
          <Logo variant="arena" showText={true} />
          <p className="text-sm text-secondary leading-relaxed mt-1">
            The competitive programming arena built for students. Sharpen your DSA skills, climb the ranks, and dominate.
          </p>
        </div>

        {/* Links and Socials Section */}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row gap-10 sm:gap-20">
            {/* Legal Column */}
            <div className="flex flex-col gap-4">
              <h3 className="text-tertiary font-semibold text-xs tracking-wide uppercase">Legal</h3>
              <div className="flex flex-col gap-2.5">
                <Link to="/privacy" className="text-secondary hover:text-primary transition-colors text-sm">Privacy Policy</Link>
                <Link to="/terms" className="text-secondary hover:text-primary transition-colors text-sm">Terms &amp; Conditions</Link>
              </div>
            </div>

            {/* Company Column */}
            <div className="flex flex-col gap-4">
              <h3 className="text-tertiary font-semibold text-xs tracking-wide uppercase">Company</h3>
              <div className="flex flex-col gap-2.5">
                <Link to="/about" className="text-secondary hover:text-primary transition-colors text-sm">About Us</Link>
                <Link to="/contact" className="text-secondary hover:text-primary transition-colors text-sm">Contact Us</Link>
              </div>
            </div>
          </div>

          {/* Social Icons — unified to a single accent, no saturated per-brand color. */}
          <div className="flex items-center gap-3">
            {socials.map(({ href, title, Icon }) => (
              <a
                key={title}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={title}
                className="w-9 h-9 rounded-full border border-subtle flex items-center justify-center text-tertiary transition-colors hover:text-accent hover:border-accent/30"
              >
                <Icon size={15} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto px-6 pb-8 flex flex-col items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Logo variant="gdg" size="w-5 h-5" imgClassName="opacity-80" />
          <p className="text-[11px] text-tertiary tracking-wide text-center">
            © {new Date().getFullYear()} Algorithm Arena · <span className="text-secondary font-medium">GDG On Campus – SOA ITER</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
