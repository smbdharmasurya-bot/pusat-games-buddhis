import React from 'react';
import { UserProfile } from '../types';
import { Volume2, VolumeX, Moon, Sun, Sliders, Menu, X, LogIn, Award } from 'lucide-react';
import { isMuted, toggleMute, playBellSound } from '../utils/soundEffects';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onOpenVerifier: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  isDark,
  onToggleTheme,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onOpenVerifier,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [muted, setMuted] = React.useState(isMuted());

  const handleMuteToggle = () => {
    const newState = toggleMute();
    setMuted(newState);
    if (!newState) {
      playBellSound();
    }
  };

  const navLinks = [
    { id: 'home', label: 'Beranda' },
    { id: 'catalog', label: 'Semua Games' },
    { id: 'featured', label: 'Game Unggulan' },
    { id: 'leaderboard', label: 'Papan Peringkat' },
    { id: 'testimonials', label: 'Testimoni' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-2 xl:gap-3">
          {/* Brand Wordmark */}
          <div
            onClick={() => {
              playBellSound();
              onNavigate('home');
            }}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <span className="text-xl animate-spin-slow select-none">☸</span>
            </div>
            <div>
              <div className="font-heading font-extrabold text-base lg:text-lg tracking-tight text-slate-900 dark:text-white leading-tight whitespace-nowrap">
                PUSAT GAMES <span className="text-amber-600 dark:text-amber-400">BUDDHIS</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wider uppercase font-semibold">
                Dharma Learning Hub
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links (Top Bar Contract: 4-5 concise single-line links) */}
          <nav className="hidden md:flex items-center gap-3 lg:gap-4 text-[13px] font-medium">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  playBellSound();
                  onNavigate(link.id);
                }}
                className={`whitespace-nowrap transition-colors py-1 relative ${
                  currentView === link.id
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {link.label}
                {currentView === link.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-400 rounded-full" />
                )}
              </button>
            ))}

            <button
              onClick={() => onOpenVerifier()}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Award className="w-4 h-4 text-amber-500" /> Cek Sertifikat
            </button>
          </nav>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Audio Synth Mute */}
            <button
              onClick={handleMuteToggle}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title={muted ? 'Aktifkan Suara' : 'Bisukan Suara'}
              aria-label="Toggle Audio"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-amber-500" />}
            </button>

            {/* Dark / Light Theme */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Ganti Tema"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Admin Hub Studio Pro CTA */}
            <button
              onClick={onOpenAdmin}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition whitespace-nowrap border border-amber-500/20"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Admin Hub</span>
            </button>

            {/* User Profile / Auth */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 pr-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-xl object-cover bg-amber-500/10"
                />
                <div className="text-left hidden sm:block max-w-[130px]">
                  <div className="font-bold text-xs truncate text-slate-800 dark:text-slate-100 leading-tight flex items-center gap-1">
                    <span>{currentUser.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                      {currentUser.xp} XP
                    </span>
                    <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                      currentUser.role === 'admin'
                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        : currentUser.role === 'uploader'
                        ? 'bg-sky-500/10 text-sky-600 border border-sky-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    }`}>
                      {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'uploader' ? 'Uploader' : 'User'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-rose-500 text-xs ml-0.5 p-1"
                  title="Keluar"
                  aria-label="Logout"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="hidden 2xl:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                  👣 Tamu
                </span>
                <button
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm shadow-amber-600/20 transition whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk</span>
                </button>
              </div>
            )}

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => {
                onNavigate(link.id);
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left py-2 px-3 rounded-xl font-medium text-sm ${
                currentView === link.id
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => {
              onOpenVerifier();
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 px-3 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Verifikasi Sertifikat Siswa
          </button>
          <button
            onClick={() => {
              onOpenAdmin();
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 px-3 rounded-xl text-sm font-bold text-amber-600 dark:text-amber-400"
          >
            Admin Hub Studio Pro
          </button>
        </div>
      )}
    </header>
  );
};
