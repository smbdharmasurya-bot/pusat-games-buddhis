import React from 'react';
import { Game, Testimonial } from '../types';
import { Star, MessageSquarePlus, CheckCircle, ShieldCheck } from 'lucide-react';
import { playCorrectSound } from '../utils/soundEffects';
import { getEvaluatableGameOptions } from '../utils/scoreAutoSync';

interface TestimonialsViewProps {
  testimonials: Testimonial[];
  games: Game[];
  onSubmit: (testi: {
    name: string;
    role: string;
    game: string;
    rating: number;
    message: string;
  }) => Promise<void>;
}

export const TestimonialsView: React.FC<TestimonialsViewProps> = ({
  testimonials,
  games,
  onSubmit,
}) => {
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [game, setGame] = React.useState('');
  const [rating, setRating] = React.useState(5);
  const [message, setMessage] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const evaluatableGames = React.useMemo(() => getEvaluatableGameOptions(games), [games]);

  React.useEffect(() => {
    if (game && !evaluatableGames.some((g) => g.title === game)) {
      setGame('');
    }
  }, [evaluatableGames, game]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ name, role, game, rating, message });
      playCorrectSound();
      setSubmitted(true);
      setName('');
      setRole('');
      setGame('');
      setMessage('');
      setTimeout(() => setSubmitted(false), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">
          Ulasan & Testimoni Pengguna
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Pengalaman nyata para Bhikkhu, guru agama Buddha, kepala sekolah, dan peserta didik di seluruh Indonesia.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Submit Review Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-amber-500" />
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
              Kirim Testimoni Anda
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Bagikan kesan dan manfaat pembelajaran Dharma yang dirasakan oleh Anda atau siswa Anda.
          </p>

          {submitted && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Testimoni Anda berhasil dikirim dan menunggu verifikasi admin!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400">Nama Lengkap & Gelar</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Ani Rahmawati, S.Ag."
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400">Peran / Institusi</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Contoh: Guru Agama Buddha SMP Maitreyawira"
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="testimonial-game-select" className="text-[11px] font-bold uppercase text-slate-400">
                Game yang Dievaluasi
              </label>
              <select
                id="testimonial-game-select"
                required
                value={game}
                onChange={(e) => setGame(e.target.value)}
                disabled={evaluatableGames.length === 0}
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 disabled:opacity-60 cursor-pointer"
              >
                {evaluatableGames.length === 0 ? (
                  <option value="">-- Belum ada game yang diupload --</option>
                ) : (
                  <>
                    <option value="">-- Pilih Nama Game yang Diupload --</option>
                    {evaluatableGames.map((g) => (
                      <option key={g.id} value={g.title}>
                        {g.title} ({g.category})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {evaluatableGames.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Dropdown otomatis terisi mengikuti nama game yang diunggah melalui Admin Hub.
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400">Rating Bintang</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5 - Luar Biasa / Sangat Bermanfaat)</option>
                <option value={4}>⭐⭐⭐⭐ (4 - Bagus & Menyenangkan)</option>
                <option value={3}>⭐⭐⭐ (3 - Cukup Membantu)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400">Pesan Ulasan</label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan pengalaman pembelajaran siswa, respon di kelas, atau rekomendasi..."
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || evaluatableGames.length === 0}
              className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Mengirim...' : 'Kirim Testimoni (Moderasi Server)'}
            </button>
          </form>
        </div>

        {/* Right: Testimonials Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-500">
              Menampilkan {testimonials.length} ulasan terverifikasi
            </span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Moderasi Guru Aktif</span>
            </div>
          </div>

          <div className="space-y-4">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                      {t.name}
                    </h4>
                    {/* Unboxed Metadata (Zero-Pill Discipline) */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{t.role}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.game}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 text-amber-400 text-xs">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                  "{t.message}"
                </p>
              </div>
            ))}

            {testimonials.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs italic bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                Belum ada testimoni yang disetujui. Jadilah pengguna pertama yang mengirim ulasan!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
