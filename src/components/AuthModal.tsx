import React from 'react';
import { UserProfile } from '../types';
import { X, Sparkles, Mail, User, Lock, Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { playCorrectSound, playIncorrectSound } from '../utils/soundEffects';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [school, setSchool] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleGoogleLogin = () => {
    const googleUser: UserProfile = {
      id: 'usr_g_' + Date.now(),
      name: 'Sahabat Dharma (Google)',
      email: 'user.buddhis@gmail.com',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=GoogleDharma',
      xp: 350,
      badge: 'Penjelajah Sutta & Tripitaka',
      level: 2,
      school: 'Vihara Buddhayana',
      role: 'user',
    };
    playCorrectSound();
    onLoginSuccess(googleUser);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi');
      playIncorrectSound();
      return;
    }

    if (password.length < 4) {
      setError('Kata sandi minimal 4 karakter');
      playIncorrectSound();
      return;
    }

    if (mode === 'register') {
      if (!name) {
        setError('Nama lengkap wajib diisi');
        playIncorrectSound();
        return;
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi kata sandi tidak cocok!');
        playIncorrectSound();
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.loginUser({
          email: email.trim(),
          password: password.trim(),
        });
        playCorrectSound();
        onLoginSuccess(res.user);
        onClose();
      } else {
        const res = await api.registerUser({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          school: school.trim() || undefined,
        });
        playCorrectSound();
        onLoginSuccess(res.user);
        onClose();
      }
    } catch (err) {
      playIncorrectSound();
      setError((err as Error).message || 'Terjadi kesalahan autentikasi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">☸</span>
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white leading-tight">
                {mode === 'login' ? 'Masuk Akun Pengguna' : 'Daftar Akun Baru'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {mode === 'login' ? 'Gunakan email dan kata sandi terdaftar' : 'Atur profil & kata sandi akun Anda'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Google One-Click Login */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Masuk dengan Akun Google</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-semibold uppercase">
            atau gunakan email & kata sandi
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400">Nama Lengkap</label>
                <div className="relative mt-1">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama Lengkap Siswa / Pengguna"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400">Sekolah / Vihara (Opsional)</label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Nama Sekolah atau Vihara"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400">Alamat Email</label>
            <div className="relative mt-1">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@sekolah.sch.id"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase text-slate-400">Kata Sandi (Password)</label>
            </div>
            <div className="relative mt-1">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400">Konfirmasi Kata Sandi</label>
              <div className="relative mt-1">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi Anda..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? (
              <span>Memproses...</span>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{mode === 'login' ? 'Masuk Sekarang' : 'Daftar & Dapatkan 150 XP'}</span>
              </>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <KeyRound className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <strong>Akun Siswa Terdaftar:</strong>
              <div>• ananda.m@dharmasurya.sch.id</div>
              <div>• dewi.s@vihara.org</div>
              <div>• Atau gunakan akun/sandi yang didaftarkan oleh Super Admin</div>
            </div>
          </div>
        )}

        <div className="text-center pt-1 text-xs text-slate-500">
          <span>{mode === 'login' ? 'Belum memiliki akun?' : 'Sudah punya akun?'}</span>
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-amber-600 dark:text-amber-400 font-semibold hover:underline ml-1 cursor-pointer"
          >
            {mode === 'login' ? 'Daftar Akun Baru' : 'Masuk Akun'}
          </button>
        </div>
      </div>
    </div>
  );
};
