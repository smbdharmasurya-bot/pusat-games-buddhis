import React from 'react';
import { Certificate } from '../types';
import { Award, CheckCircle2, XCircle, Search, X, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { playCorrectSound, playIncorrectSound } from '../utils/soundEffects';
import { resolveCertificateVerificationState } from '../utils/certificateSync';

interface CertificateVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CertificateVerifierModal: React.FC<CertificateVerifierModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [code, setCode] = React.useState('CERT-2026-001');
  const [result, setResult] = React.useState<(Certificate & { isValid: boolean }) | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.verifyCertificate(code.trim());
      setResult(data);
      if (resolveCertificateVerificationState(data) === 'valid') {
        playCorrectSound();
      } else {
        playIncorrectSound();
      }
    } catch (err) {
      setError((err as Error).message || 'Sertifikat tidak ditemukan');
      playIncorrectSound();
    } finally {
      setLoading(false);
    }
  };

  const verificationState = resolveCertificateVerificationState(result);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                Verifikasi Sertifikat Digital Dharma
              </h3>
              <p className="text-xs text-slate-500">
                Pemeriksaan keaslian sertifikat kelulusan modul pembelajaran Buddhis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup verifikasi sertifikat"
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verification Input */}
        <form onSubmit={handleVerify} className="space-y-3">
          <label htmlFor="verify-cert-code" className="text-[11px] font-bold uppercase text-slate-400">
            Nomor Sertifikat / Kode Verifikasi
          </label>
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                id="verify-cert-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Contoh: CERT-2026-001"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none uppercase text-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Memeriksa...' : 'Periksa'}
            </button>
          </div>
        </form>

        {/* Error Feedback */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Inactive / Revoked Certificate Banner */}
        {result && verificationState === 'inactive' && (
          <div className="p-5 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 space-y-3 text-center">
            <div className="inline-flex items-center gap-1.5 bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>DINONAKTIFKAN / TIDAK BERLAKU</span>
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-base text-slate-900 dark:text-white">
                {result.studentName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {result.institution} · <span className="font-mono">{result.verificationCode}</span>
              </p>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              Sertifikat untuk modul <strong>{result.module}</strong> ini telah dinonaktifkan oleh pengelola dan tidak lagi dinyatakan berlaku.
            </p>
          </div>
        )}

        {/* Authentic Active Certificate Preview Card */}
        {result && verificationState === 'valid' && (
          <div className="p-6 rounded-3xl bg-gradient-to-b from-amber-500/5 via-white to-amber-500/10 dark:from-amber-950/20 dark:via-slate-800 dark:to-slate-800 border-2 border-amber-500/40 shadow-lg space-y-4 relative overflow-hidden text-center">
            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> TERVERIFIKASI SAH
            </div>

            <div className="pt-2">
              <span className="text-3xl">☸</span>
              <div className="font-heading font-black text-xs uppercase tracking-widest text-amber-700 dark:text-amber-400 mt-1">
                Pusat Games Buddhis Indonesia
              </div>
              <h4 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white mt-2">
                {result.studentName}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {result.institution}
              </p>
            </div>

            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-amber-500/20 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Modul Kelulusan</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{result.module}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left text-[11px] pt-1">
              <div>
                <span className="text-slate-400 block text-[10px]">Nomor Registrasi:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {result.certificateNumber}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Tanggal Terbit:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {result.date}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

