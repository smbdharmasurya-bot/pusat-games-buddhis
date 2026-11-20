import React from 'react';
import {
  Game,
  Category,
  Testimonial,
  License,
  Certificate,
  AuditLog,
  SiteSettings,
  UserProfile,
  LeaderboardEntry,
  GameAccessLog,
  UserAccessStats,
  BackupImportMode,
  BackupSnapshotInfo,
  BackupSummary,
  BaselineStatus,
} from '../types';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Upload,
  Image,
  Award,
  Key,
  History,
  FolderPlus,
  Users,
  Lock,
  AlertCircle,
  Trophy,
  BarChart3,
  Globe,
  Smartphone,
  Tablet,
  Monitor,
  Download,
  Search,
  RefreshCw,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Link2,
  Sparkles,
  Database,
  FileJson,
  HardDrive,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import { playCorrectSound, playIncorrectSound } from '../utils/soundEffects';
import { normalizeCategoryName, resolveCategoryMatch } from '../utils/categorySync';
import {
  GAME_ICON_PRESETS,
  hasCustomThumbnail,
  resolveGameIcon,
  resolveGameThumbnail,
} from '../utils/gameMedia';
import { GameIconBadge } from './GameIconBadge';
import {
  countCertificateStatuses,
  filterCertificates,
  isCertificateActive,
} from '../utils/certificateSync';
import { resolveCountryFlagEmoji } from '../utils/accessLogSync';
import {
  isValidSqliteHeader,
  parseBackupPayload,
  summarizeBackupPayload,
} from '../utils/backupSync';
import {
  filterActiveGamesLeaderboard,
  getResettableLeaderboardGameNames,
} from '../utils/scoreAutoSync';
import {
  AUTO_BASELINE_SYNC_INTERVAL_MS,
  calculateNextAutoBaselineSyncSeconds,
  DEFAULT_PUBLISHED_SYNC_URL,
} from '../utils/baselineProtection';

interface AdminHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  categories: Category[];
  testimonials: Testimonial[];
  licenses: License[];
  certificates: Certificate[];
  settings: SiteSettings;
  auditLogs: AuditLog[];
  onDataChanged: () => void;
}

export const AdminHubModal: React.FC<AdminHubModalProps> = ({
  isOpen,
  onClose,
  games,
  categories,
  testimonials,
  licenses,
  certificates,
  settings,
  auditLogs,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = React.useState<
    'games' | 'upload' | 'categories' | 'hero' | 'testimonials' | 'licenses' | 'certificates' | 'users' | 'leaderboard' | 'stats' | 'backup' | 'audit'
  >('games');

  // Password verification & Role state
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authenticatedRole, setAuthenticatedRole] = React.useState<'admin' | 'uploader'>('admin');
  const [passwordInput, setPasswordInput] = React.useState('');
  const [authError, setAuthError] = React.useState<string | null>(null);

  // Users Management state
  const [usersList, setUsersList] = React.useState<UserProfile[]>([]);
  const [newUserName, setNewUserName] = React.useState('');
  const [newUserEmail, setNewUserEmail] = React.useState('');
  const [newUserSchool, setNewUserSchool] = React.useState('');
  const [newUserBadge, setNewUserBadge] = React.useState('Sahabat Pemula Dharma');
  const [newUserLevel, setNewUserLevel] = React.useState(1);
  const [newUserXp, setNewUserXp] = React.useState(100);
  const [newUserRole, setNewUserRole] = React.useState<'admin' | 'uploader' | 'user'>('user');
  const [newUserPassword, setNewUserPassword] = React.useState('');
  const [editingPasswordUserId, setEditingPasswordUserId] = React.useState<string | null>(null);
  const [editingPasswordValue, setEditingPasswordValue] = React.useState('');
  const [userRoleFilter, setUserRoleFilter] = React.useState<'all' | 'admin' | 'uploader' | 'user'>('all');
  const [userSearchTerm, setUserSearchTerm] = React.useState('');

  // Leaderboard Management & Reset State
  const [leaderboardList, setLeaderboardList] = React.useState<LeaderboardEntry[]>([]);
  const [selectedLeaderboardGame, setSelectedLeaderboardGame] = React.useState<string>('all');
  const [leaderboardSearch, setLeaderboardSearch] = React.useState('');
  const [isResetScoresModalOpen, setIsResetScoresModalOpen] = React.useState(false);
  const [resetScoresGameTitle, setResetScoresGameTitle] = React.useState<string | null>(null);
  const [resetScoresPassword, setResetScoresPassword] = React.useState('');
  const [resetScoresError, setResetScoresError] = React.useState<string | null>(null);

  // User Access Analytics & Logs State
  const [accessStats, setAccessStats] = React.useState<UserAccessStats | null>(null);
  const [accessLogs, setAccessLogs] = React.useState<GameAccessLog[]>([]);
  const [logSearchQuery, setLogSearchQuery] = React.useState('');
  const [logDeviceFilter, setLogDeviceFilter] = React.useState('');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = React.useState(false);
  const [isClearLogsModalOpen, setIsClearLogsModalOpen] = React.useState(false);
  const [clearLogsPassword, setClearLogsPassword] = React.useState('');
  const [clearLogsError, setClearLogsError] = React.useState<string | null>(null);

  // Category Edit state
  const [editingCat, setEditingCat] = React.useState<Category | null>(null);
  const [editCatName, setEditCatName] = React.useState('');
  const [editCatIcon, setEditCatIcon] = React.useState('');

  // Reset Plays Password Protected Modal state
  const [isResetPlaysModalOpen, setIsResetPlaysModalOpen] = React.useState(false);
  const [resetPasswordInput, setResetPasswordInput] = React.useState('');
  const [resetPasswordError, setResetPasswordError] = React.useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = React.useState<string | null>(null);

  // Form states for adding game
  const [newTitle, setNewTitle] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('');
  const [categoryMode, setCategoryMode] = React.useState<'existing' | 'new'>('existing');
  const [customCategoryName, setCustomCategoryName] = React.useState('');
  const [customCategoryIcon, setCustomCategoryIcon] = React.useState('fa-seedling');
  const [newDifficulty, setNewDifficulty] = React.useState<'Mudah' | 'Sedang' | 'Sangat Sulit'>('Mudah');
  const [newType, setNewType] = React.useState<'quiz' | 'memory' | 'html5' | 'iframe'>('html5');
  const [newDesc, setNewDesc] = React.useState('');
  const [newThumbnail, setNewThumbnail] = React.useState('');
  const [newIcon, setNewIcon] = React.useState('🎮');
  const [newHtml5Code, setNewHtml5Code] = React.useState('');
  const [newUrl, setNewUrl] = React.useState('');
  const [newIsPremium, setNewIsPremium] = React.useState(false);
  const [newIsActive, setNewIsActive] = React.useState(true);
  const [gameStatusFilter, setGameStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [gameSearchQuery, setGameSearchQuery] = React.useState('');
  const [isSubmittingGame, setIsSubmittingGame] = React.useState(false);

  // Edit Game state
  const [editingGame, setEditingGame] = React.useState<Game | null>(null);
  const [editGameTitle, setEditGameTitle] = React.useState('');
  const [editGameCategory, setEditGameCategory] = React.useState('');
  const [editGameCustomCategory, setEditGameCustomCategory] = React.useState('');
  const [editGameDifficulty, setEditGameDifficulty] = React.useState<'Mudah' | 'Sedang' | 'Sangat Sulit'>('Mudah');
  const [editGameDesc, setEditGameDesc] = React.useState('');
  const [editGameThumbnail, setEditGameThumbnail] = React.useState('');
  const [editGameIcon, setEditGameIcon] = React.useState('');
  const [isSubmittingEditGame, setIsSubmittingEditGame] = React.useState(false);

  // Form states for new category
  const [catName, setCatName] = React.useState('');
  const [catIcon, setCatIcon] = React.useState('fa-seedling');

  // Hero config state
  const [heroTitle, setHeroTitle] = React.useState(settings.title || 'Candi & Stupa Dharma');
  const [heroSubtitle, setHeroSubtitle] = React.useState(settings.subtitle || 'Nilai Kebijaksanaan & Kemurnian');
  const [heroEmoji, setHeroEmoji] = React.useState(settings.emoji || '🪷');
  const [heroImage, setHeroImage] = React.useState(settings.imageUrl || '');

  // New License State
  const [newSchool, setNewSchool] = React.useState('');
  const [newPlan, setNewPlan] = React.useState('Pro School Suite');

  // New Certificate State
  const [certStudent, setCertStudent] = React.useState('');
  const [certModule, setCertModule] = React.useState('Dasar-Dasar Tripitaka & Kemoralan');
  const [certInstitution, setCertInstitution] = React.useState('Vihara Dharma Surya');
  const [certStatusFilter, setCertStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [certSearchQuery, setCertSearchQuery] = React.useState('');

  // Non-blocking in-modal toast and confirm states (iframe safe, no window.alert or window.confirm)
  const [toastMessage, setToastMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = React.useState<{
    type: 'game' | 'category' | 'user' | 'license' | 'testimonial' | 'score' | 'certificate';
    id: string | number;
    title: string;
    description: string;
  } | null>(null);

  // Backup & Restore state
  const [backupSnapshots, setBackupSnapshots] = React.useState<BackupSnapshotInfo[]>([]);
  const [isBackupBusy, setIsBackupBusy] = React.useState(false);
  const [backupImportMode, setBackupImportMode] = React.useState<BackupImportMode>('merge');
  const [backupInputKind, setBackupInputKind] = React.useState<'json' | 'db'>('json');
  const [backupFileName, setBackupFileName] = React.useState('');
  const [backupJsonText, setBackupJsonText] = React.useState('');
  const [backupDbBase64, setBackupDbBase64] = React.useState('');
  const [backupPreviewSummary, setBackupPreviewSummary] = React.useState<BackupSummary | null>(null);
  const [backupParseError, setBackupParseError] = React.useState<string | null>(null);
  const [confirmReplaceAction, setConfirmReplaceAction] = React.useState<{
    source: 'upload' | 'snapshot';
    snapshotFilename?: string;
    label: string;
  } | null>(null);
  const [baselineStatus, setBaselineStatus] = React.useState<BaselineStatus | null>(null);
  const [publishedSyncUrl, setPublishedSyncUrl] = React.useState(DEFAULT_PUBLISHED_SYNC_URL);
  const [isSyncingPublished, setIsSyncingPublished] = React.useState(false);
  const [isSyncingBaselineNow, setIsSyncingBaselineNow] = React.useState(false);
  const [baselineCountdownSec, setBaselineCountdownSec] = React.useState<number>(60);

  const showToast = React.useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const prevCategoriesLenRef = React.useRef(categories.length);
  const pendingSelectedCategoryRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const prevLen = prevCategoriesLenRef.current;
    prevCategoriesLenRef.current = categories.length;

    if (categories.length === 0) {
      setCategoryMode('new');
      setNewCategory('');
      return;
    }

    if (pendingSelectedCategoryRef.current) {
      const target = pendingSelectedCategoryRef.current;
      const found = categories.find((c) => c.name === target);
      if (found) {
        pendingSelectedCategoryRef.current = null;
        setCategoryMode('existing');
        setNewCategory(found.name);
        return;
      }
    }

    if (prevLen === 0 && categories.length > 0) {
      setCategoryMode('existing');
      setNewCategory(categories[0].name);
      return;
    }

    const exists = categories.some((c) => c.name === newCategory);
    if (!exists && categoryMode === 'existing') {
      setNewCategory(categories[0].name);
    } else if (!newCategory && categoryMode === 'existing') {
      setNewCategory(categories[0].name);
    }
  }, [categories, newCategory, categoryMode]);

  const loadUsers = React.useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsersList(data);
    } catch {
      // ignore
    }
  }, []);

  const loadLeaderboard = React.useCallback(async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboardList(data);
    } catch {
      // ignore
    }
  }, []);

  const activeLeaderboardList = React.useMemo(
    () => filterActiveGamesLeaderboard(leaderboardList, games),
    [leaderboardList, games]
  );

  const resettableGameNames = React.useMemo(
    () => getResettableLeaderboardGameNames(games, activeLeaderboardList),
    [games, activeLeaderboardList]
  );

  React.useEffect(() => {
    if (selectedLeaderboardGame !== 'all' && !resettableGameNames.includes(selectedLeaderboardGame)) {
      setSelectedLeaderboardGame('all');
    }
  }, [selectedLeaderboardGame, resettableGameNames]);

  const loadAnalytics = React.useCallback(async () => {
    try {
      setIsLoadingAnalytics(true);
      const [stats, logs] = await Promise.all([
        api.getAccessStats(),
        api.getAccessLogs({ search: logSearchQuery, device: logDeviceFilter, limit: 150 }),
      ]);
      setAccessStats(stats);
      setAccessLogs(logs);
    } catch (err) {
      console.warn('Failed loading analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [logSearchQuery, logDeviceFilter]);

  const loadBackupSnapshots = React.useCallback(async () => {
    try {
      const [list, status] = await Promise.all([
        api.getBackupSnapshots(),
        api.getBaselineStatus().catch(() => null),
      ]);
      setBackupSnapshots(list);
      if (status) {
        setBaselineStatus(status);
        if (status.publishedSyncUrl) {
          setPublishedSyncUrl((prev) => prev.trim() || status.publishedSyncUrl || DEFAULT_PUBLISHED_SYNC_URL);
        }
        setBaselineCountdownSec(
          calculateNextAutoBaselineSyncSeconds(status.lastAutoSyncAt, Date.now())
        );
      }
    } catch (err) {
      console.warn('Failed loading backup snapshots:', err);
    }
  }, []);

  React.useEffect(() => {
    setHeroTitle(settings.title);
    setHeroSubtitle(settings.subtitle);
    setHeroEmoji(settings.emoji);
    setHeroImage(settings.imageUrl || '');
  }, [settings]);

  const latestAuditId = auditLogs[0]?.id ?? 0;
  const totalGamePlayers = React.useMemo(
    () => games.reduce((sum, g) => sum + (Number(g.players) || 0), 0),
    [games]
  );

  React.useEffect(() => {
    if (isOpen && isAuthenticated) {
      if (activeTab === 'users' || activeTab === 'games') {
        loadUsers();
      } else if (activeTab === 'leaderboard') {
        loadLeaderboard();
      } else if (activeTab === 'stats') {
        loadAnalytics();
      } else if (activeTab === 'backup') {
        loadBackupSnapshots();
      }
    }
  }, [isOpen, isAuthenticated, activeTab, latestAuditId, totalGamePlayers, loadUsers, loadLeaderboard, loadAnalytics, loadBackupSnapshots]);

  // Real-time auto-polling when Admin Hub is viewing Statistik & Log Akses
  React.useEffect(() => {
    if (!isOpen || !isAuthenticated || activeTab !== 'stats') return;
    const interval = window.setInterval(() => {
      void loadAnalytics();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isOpen, isAuthenticated, activeTab, loadAnalytics]);

  // Automatic 1-minute synchronization for Perlindungan Baseline Data Terpublish
  React.useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    const syncInterval = window.setInterval(async () => {
      try {
        const res = await api.syncBaselineNow({
          publishedSyncUrl: publishedSyncUrl.trim() || DEFAULT_PUBLISHED_SYNC_URL,
          autoSyncEnabled: true,
          forceSnapshot: false,
        });
        if (res?.data) {
          setBaselineStatus(res.data);
          setBaselineCountdownSec(
            calculateNextAutoBaselineSyncSeconds(res.data.lastAutoSyncAt, Date.now())
          );
        }
        if (activeTab === 'backup') {
          const snapshots = await api.getBackupSnapshots().catch(() => null);
          if (snapshots) setBackupSnapshots(snapshots);
        }
      } catch (err) {
        console.warn('Auto baseline sync check failed:', err);
      }
    }, AUTO_BASELINE_SYNC_INTERVAL_MS);

    return () => window.clearInterval(syncInterval);
  }, [isOpen, isAuthenticated, activeTab, publishedSyncUrl]);

  // Live 1-second countdown indicator for 1-minute automatic baseline sync when viewing Backup & Restore tab
  React.useEffect(() => {
    if (!isOpen || !isAuthenticated || activeTab !== 'backup') return;
    const tick = window.setInterval(() => {
      setBaselineCountdownSec((prev) => {
        if (baselineStatus?.lastAutoSyncAt) {
          const remaining = calculateNextAutoBaselineSyncSeconds(
            baselineStatus.lastAutoSyncAt,
            Date.now()
          );
          if (remaining <= 1) {
            void api
              .syncBaselineNow({
                publishedSyncUrl: publishedSyncUrl.trim() || DEFAULT_PUBLISHED_SYNC_URL,
                autoSyncEnabled: true,
                forceSnapshot: false,
              })
              .then((res) => {
                if (res?.data) {
                  setBaselineStatus(res.data);
                }
                return loadBackupSnapshots();
              })
              .catch(() => {});
          }
          return remaining;
        }
        return prev <= 1 ? 60 : prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isOpen, isAuthenticated, activeTab, baselineStatus?.lastAutoSyncAt, publishedSyncUrl, loadBackupSnapshots]);

  const handlePruneDummyLogs = async () => {
    try {
      setIsLoadingAnalytics(true);
      const res = await api.pruneDummyAccessLogs();
      showToast(res.message, 'success');
      playCorrectSound();
      await loadAnalytics();
      onDataChanged();
    } catch (err) {
      showToast((err as Error).message || 'Gagal membersihkan log dummy', 'error');
      playIncorrectSound();
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleOpenResetScoresModal = (gameTitle: string | null = null) => {
    setResetScoresGameTitle(gameTitle);
    setResetScoresPassword('');
    setResetScoresError(null);
    setIsResetScoresModalOpen(true);
  };

  const handleConfirmResetScores = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetScoresError(null);
    try {
      const res = await api.resetLeaderboard(resetScoresPassword, resetScoresGameTitle || undefined);
      showToast(res.message, 'success');
      playCorrectSound();
      setIsResetScoresModalOpen(false);
      setResetScoresPassword('');
      loadLeaderboard();
      onDataChanged();
    } catch (err) {
      setResetScoresError((err as Error).message || 'Kata sandi salah!');
      playIncorrectSound();
    }
  };

  const handleConfirmClearLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    setClearLogsError(null);
    try {
      const res = await api.clearAccessLogs(clearLogsPassword);
      showToast(res.message, 'success');
      playCorrectSound();
      setIsClearLogsModalOpen(false);
      setClearLogsPassword('');
      loadAnalytics();
    } catch (err) {
      setClearLogsError((err as Error).message || 'Kata sandi salah!');
      playIncorrectSound();
    }
  };

  const handleExportLogsCSV = () => {
    if (accessLogs.length === 0) {
      showToast('Tidak ada data log akses untuk diekspor', 'error');
      return;
    }
    const headers = ['ID', 'Waktu', 'Pengguna', 'Role', 'Game', 'Kategori', 'IP Address', 'Negara', 'Kota', 'Perangkat', 'Model', 'Browser', 'OS', 'Resolusi', 'Durasi Detik', 'Status Selesai'];
    const rows = accessLogs.map(l => [
      l.id,
      `"${l.createdAt}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.userRole}"`,
      `"${l.gameTitle.replace(/"/g, '""')}"`,
      `"${l.gameCategory || ''}"`,
      `"${l.ipAddress}"`,
      `"${l.country}"`,
      `"${l.city || ''}"`,
      `"${l.deviceType}"`,
      `"${l.deviceModel || ''}"`,
      `"${l.browser}"`,
      `"${l.os}"`,
      `"${l.screenResolution || ''}"`,
      l.durationSeconds,
      l.completed ? 'Selesai' : 'Sedang Bermain'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `log_akses_pengguna_portal_game_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Log akses pengguna berhasil diekspor ke CSV!', 'success');
  };

  if (!isOpen) return null;

  const handleAdminLogin = async (e: React.FormEvent, directPassword?: string) => {
    if (e) e.preventDefault();
    setAuthError(null);
    const pwd = directPassword || passwordInput;
    try {
      const res = await api.adminLogin(pwd);
      const role = res.role || (pwd === 'uploader123' ? 'uploader' : 'admin');
      setAuthenticatedRole(role);
      setIsAuthenticated(true);
      if (role === 'uploader') {
        setActiveTab('upload');
      }
      playCorrectSound();
      showToast(`Berhasil masuk sebagai ${role === 'admin' ? 'Admin (Pengelola Penuh)' : 'Uploader (Khusus Upload Game)'}!`);
    } catch (err) {
      setAuthError((err as Error).message);
      playIncorrectSound();
    }
  };

  const handleOpenResetPlaysModal = () => {
    setResetPasswordInput('');
    setResetPasswordError(null);
    setResetSuccessMessage(null);
    setIsResetPlaysModalOpen(true);
  };

  const handleConfirmResetPlays = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError(null);
    try {
      const res = await api.resetPlayerStats(resetPasswordInput);
      playCorrectSound();
      setResetSuccessMessage(res.message || 'Counter total permainan berhasil direset ke 0!');
      onDataChanged();
      setTimeout(() => {
        setIsResetPlaysModalOpen(false);
        setResetSuccessMessage(null);
      }, 1500);
    } catch (err) {
      playIncorrectSound();
      setResetPasswordError((err as Error).message);
    }
  };

  const handleDeleteGame = (id: number, title?: string) => {
    setConfirmDeleteModal({
      type: 'game',
      id,
      title: 'Hapus Game',
      description: `Apakah Anda yakin ingin menghapus game "${title || `ID: ${id}`}" dari database SQL?`,
    });
  };

  const handleTogglePremium = async (game: Game) => {
    try {
      await api.updateGame(game.id, { isPremium: !game.isPremium });
      onDataChanged();
      showToast(`Status akses game diubah menjadi ${!game.isPremium ? 'PRO (Lisensi)' : 'GRATIS'}`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleToggleGameStatus = async (game: Game) => {
    const nextActive = game.isActive === false ? true : false;
    try {
      await api.toggleGameStatus(game.id, nextActive);
      playCorrectSound();
      onDataChanged();
      showToast(`Permainan "${game.title}" sekarang ${nextActive ? 'AKTIF (Dapat dimainkan)' : 'NONAKTIF (Disembunyikan dari publik)'}!`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  // Upload Portable Game file (.html, .json, .js)
  const handlePortableFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (ext === 'json') {
        try {
          const json = JSON.parse(content);
          if (json.title) setNewTitle(json.title);
          if (json.description) setNewDesc(json.description);
          if (json.category) {
            const { matchedCategory, normalizedInput } = resolveCategoryMatch(String(json.category), categories);
            if (matchedCategory) {
              setCategoryMode('existing');
              setNewCategory(matchedCategory.name);
            } else if (normalizedInput) {
              setCategoryMode('new');
              setCustomCategoryName(normalizedInput);
            }
          }
          if (json.type) setNewType(json.type);
          if (json.html5Code) setNewHtml5Code(json.html5Code);
          if (json.url) setNewUrl(json.url);
          if (json.thumbnail) setNewThumbnail(json.thumbnail);
          if (json.icon) setNewIcon(json.icon);
          showToast(`Paket game JSON "${json.title || fileName}" berhasil dimuat!`);
        } catch {
          showToast('Format JSON file game tidak valid', 'error');
        }
      } else if (ext === 'html' || ext === 'html5' || ext === 'js') {
        setNewType('html5');
        let codeToSave = content;
        if (ext === 'js' && !content.includes('<html') && !content.includes('<body') && !content.includes('<script')) {
          codeToSave = `<!DOCTYPE html>\n<html lang="id">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">\n  <title>${fileName}</title>\n  <style>html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; } canvas { display: block; margin: 0 auto; max-width: 100%; height: auto; }</style>\n</head>\n<body>\n  <canvas id="canvas"></canvas>\n  <script>\n${content}\n  </script>\n</body>\n</html>`;
        }
        setNewHtml5Code(codeToSave);
        const clean = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        if (!newTitle) {
          setNewTitle(clean.charAt(0).toUpperCase() + clean.slice(1));
        }
        showToast(`File game portable "${fileName}" berhasil dimuat ke editor HTML5!`);
      }
    };
    reader.readAsText(file);
  };

  // Thumbnail upload (Upload Game tab)
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewThumbnail(event.target?.result as string);
      showToast(`Thumbnail (${file.name}) berhasil dimuat!`);
    };
    reader.readAsDataURL(file);
  };

  // Game Icon upload (Upload Game tab)
  const handleNewGameIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewIcon(event.target?.result as string);
      showToast(`Ikon game (${file.name}) berhasil dimuat!`);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingGame) return;
    const chosenCategory = categoryMode === 'new'
      ? normalizeCategoryName(customCategoryName)
      : normalizeCategoryName(newCategory);

    if (!chosenCategory) {
      playIncorrectSound();
      showToast('Kategori pembelajaran wajib dipilih atau diisi saat upload game baru!', 'error');
      return;
    }

    setIsSubmittingGame(true);
    try {
      const res = await api.createGame({
        title: newTitle,
        category: chosenCategory,
        categoryIcon: categoryMode === 'new' ? customCategoryIcon : undefined,
        difficulty: newDifficulty,
        type: newType,
        description: newDesc,
        isPremium: newIsPremium,
        isActive: newIsActive,
        thumbnail: newThumbnail,
        icon: newIcon,
        html5Code: newHtml5Code,
        url: newUrl,
      });
      playCorrectSound();
      setNewTitle('');
      setNewDesc('');
      setNewHtml5Code('');
      setNewUrl('');
      setNewThumbnail('');
      setNewIcon('🎮');
      setNewIsActive(true);
      setCustomCategoryName('');
      setCustomCategoryIcon('fa-seedling');
      const finalSyncedCat = res.category || chosenCategory;
      pendingSelectedCategoryRef.current = finalSyncedCat;
      if (categories.some((c) => c.name === finalSyncedCat)) {
        setCategoryMode('existing');
        setNewCategory(finalSyncedCat);
      }
      setActiveTab('games');
      onDataChanged();
      showToast(res.message || `Game baru berhasil disimpan dan tersinkronisasi dengan kategori "${finalSyncedCat}"!`);
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsSubmittingGame(false);
    }
  };

  const handleStartEditGame = (game: Game) => {
    setEditingGame(game);
    setEditGameTitle(game.title);
    const hasCat = categories.some((c) => c.name === game.category);
    if (hasCat) {
      setEditGameCategory(game.category);
      setEditGameCustomCategory('');
    } else {
      setEditGameCategory('__NEW__');
      setEditGameCustomCategory(game.category);
    }
    setEditGameDifficulty(game.difficulty || 'Mudah');
    setEditGameDesc(game.description || '');
    setEditGameThumbnail(game.thumbnail || '');
    setEditGameIcon(game.icon || '');
  };

  const handleEditGameThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditGameThumbnail(event.target?.result as string);
      showToast(`Thumbnail baru (${file.name}) siap disimpan!`);
    };
    reader.readAsDataURL(file);
  };

  const handleEditGameIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditGameIcon(event.target?.result as string);
      showToast(`Ikon game baru (${file.name}) siap disimpan!`);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame || isSubmittingEditGame) return;
    const chosenCategory =
      editGameCategory === '__NEW__'
        ? normalizeCategoryName(editGameCustomCategory)
        : normalizeCategoryName(editGameCategory);

    if (!chosenCategory) {
      showToast('Kategori permainan wajib diisi atau dipilih!', 'error');
      return;
    }

    setIsSubmittingEditGame(true);
    try {
      const res = await api.updateGame(editingGame.id, {
        title: editGameTitle,
        category: chosenCategory,
        difficulty: editGameDifficulty,
        description: editGameDesc,
        thumbnail: editGameThumbnail,
        icon: editGameIcon,
      });
      playCorrectSound();
      setEditingGame(null);
      onDataChanged();
      showToast(res.message || 'Data, thumbnail & ikon permainan berhasil disinkronkan!');
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsSubmittingEditGame(false);
    }
  };

  // Add category with optional file (.ico/.webp/png)
  const handleCategoryIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCatIcon(event.target?.result as string);
      showToast(`File ikon (${file.name}) berhasil dimuat!`);
    };
    reader.readAsDataURL(file);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCategory({ name: catName, icon: catIcon });
      playCorrectSound();
      setCatName('');
      setCatIcon('fa-seedling');
      onDataChanged();
      showToast('Kategori berhasil ditambahkan ke database!');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleDeleteCategory = (id: number, name?: string) => {
    setConfirmDeleteModal({
      type: 'category',
      id,
      title: 'Hapus Kategori',
      description: `Apakah Anda yakin ingin menghapus kategori "${name || `ID: ${id}`}"?`,
    });
  };

  const handleStartEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon);
  };

  const handleCancelEditCategory = () => {
    setEditingCat(null);
    setEditCatName('');
    setEditCatIcon('');
  };

  const handleEditCategoryIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditCatIcon(event.target?.result as string);
      showToast(`Ikon baru berhasil dimuat!`);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editingCat.id) return;
    try {
      await api.updateCategory(editingCat.id, {
        name: editCatName.trim(),
        icon: editCatIcon.trim(),
      });
      playCorrectSound();
      setEditingCat(null);
      setEditCatName('');
      setEditCatIcon('');
      onDataChanged();
      showToast('Kategori berhasil diperbarui!');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  // User management handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        name: newUserName,
        email: newUserEmail,
        school: newUserSchool,
        badge: newUserBadge,
        level: newUserLevel,
        xp: newUserXp,
        role: newUserRole,
        password: newUserPassword.trim() || 'dharma123',
      });
      playCorrectSound();
      setNewUserName('');
      setNewUserEmail('');
      setNewUserSchool('');
      setNewUserPassword('');
      setNewUserXp(100);
      setNewUserLevel(1);
      setNewUserRole('user');
      loadUsers();
      onDataChanged();
      showToast(`Pengguna baru tingkat "${newUserRole}" berhasil ditambahkan dengan kata sandi terkonfigurasi!`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleUpdateUserRole = async (id: string, role: 'admin' | 'uploader' | 'user') => {
    try {
      await api.updateUser(id, { role });
      playCorrectSound();
      loadUsers();
      onDataChanged();
      showToast(`Tingkat peran pengguna berhasil diubah ke "${role}"!`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleUpdateUserPassword = async (id: string, newPassword: string) => {
    if (!newPassword || newPassword.trim().length < 4) {
      showToast('Kata sandi minimal 4 karakter!', 'error');
      return;
    }
    try {
      await api.updateUser(id, { password: newPassword.trim() });
      playCorrectSound();
      setEditingPasswordUserId(null);
      setEditingPasswordValue('');
      loadUsers();
      showToast('Kata sandi pengguna berhasil disesuaikan!');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleDeleteUser = (id: string, name?: string) => {
    setConfirmDeleteModal({
      type: 'user',
      id,
      title: 'Hapus Pengguna',
      description: `Apakah Anda yakin ingin menghapus profil pengguna "${name || id}" dari database?`,
    });
  };

  // License delete handler
  const handleDeleteLicense = (id: number, schoolName?: string) => {
    setConfirmDeleteModal({
      type: 'license',
      id,
      title: 'Hapus Lisensi Sekolah',
      description: `Apakah Anda yakin ingin menghapus lisensi sekolah "${schoolName || `ID: ${id}`}"? Tindakan ini tidak dapat dibatalkan.`,
    });
  };

  // Hero image upload
  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setHeroImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings({
        title: heroTitle,
        subtitle: heroSubtitle,
        emoji: '',
        imageUrl: heroImage,
      });
      playCorrectSound();
      onDataChanged();
      showToast('Pengaturan Banner Setengah Lingkaran & Stupa berhasil disimpan ke database!');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  // Testimonial moderation
  const handleModerateTestimonial = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await api.moderateTestimonial(id, status);
      onDataChanged();
      playCorrectSound();
      showToast(`Testimoni berhasil di-${status === 'approved' ? 'setujui' : 'tolak'}!`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleDeleteTestimonial = (id: number) => {
    setConfirmDeleteModal({
      type: 'testimonial',
      id,
      title: 'Hapus Testimoni',
      description: 'Apakah Anda yakin ingin menghapus ulasan testimoni ini?',
    });
  };

  // License create
  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLicense({ schoolName: newSchool, plan: newPlan, expiresDate: '2028-12-31' });
      playCorrectSound();
      setNewSchool('');
      onDataChanged();
      showToast('Lisensi sekolah berhasil diterbitkan!');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  // Certificate issue
  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.issueCertificate({
        studentName: certStudent,
        module: certModule,
        institution: certInstitution,
      });
      playCorrectSound();
      setCertStudent('');
      onDataChanged();
      showToast(`Sertifikat berhasil diterbitkan! Kode verifikasi: ${res.verificationCode}`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  // Certificate status toggle (Aktif / Nonaktif)
  const handleToggleCertificateStatus = async (cert: Certificate) => {
    const currentlyActive = isCertificateActive(cert);
    const nextActive = !currentlyActive;
    try {
      await api.toggleCertificateStatus(cert.id, nextActive);
      playCorrectSound();
      onDataChanged();
      showToast(
        nextActive
          ? `Sertifikat "${cert.verificationCode}" (${cert.studentName}) berhasil diaktifkan kembali.`
          : `Sertifikat "${cert.verificationCode}" (${cert.studentName}) dinonaktifkan dan tidak berlaku saat diverifikasi.`
      );
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    }
  };

  // Certificate delete confirmation trigger
  const handleDeleteCertificate = (cert: Certificate) => {
    setConfirmDeleteModal({
      type: 'certificate',
      id: cert.id,
      title: 'Hapus Sertifikat?',
      description: `Sertifikat "${cert.verificationCode}" atas nama "${cert.studentName}" akan dihapus permanen dari arsip dan tidak dapat diverifikasi lagi.`,
    });
  };

  // Unified delete execution
  const handleExecuteDelete = async () => {
    if (!confirmDeleteModal) return;
    const { type, id } = confirmDeleteModal;
    setConfirmDeleteModal(null);
    try {
      if (type === 'game') {
        await api.deleteGame(Number(id));
        showToast('Game berhasil dihapus dari database!');
      } else if (type === 'category') {
        await api.deleteCategory(Number(id));
        showToast('Kategori berhasil dihapus!');
      } else if (type === 'user') {
        await api.deleteUser(String(id));
        loadUsers();
        showToast('Pengguna berhasil dihapus!');
      } else if (type === 'license') {
        await api.deleteLicense(Number(id));
        showToast('Lisensi sekolah berhasil dihapus!');
      } else if (type === 'testimonial') {
        await api.deleteTestimonial(Number(id));
        showToast('Testimoni berhasil dihapus!');
      } else if (type === 'score') {
        await api.deleteLeaderboardEntry(Number(id));
        loadLeaderboard();
        showToast('Entri skor berhasil dihapus dari leaderboard!');
      } else if (type === 'certificate') {
        await api.deleteCertificate(String(id));
        showToast('Sertifikat berhasil dihapus dari arsip!');
      }
      playCorrectSound();
      onDataChanged();
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    }
  };

  // Backup & Restore handlers
  const handleDownloadBackupJson = async () => {
    try {
      setIsBackupBusy(true);
      const payload = await api.exportBackupJson();
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `portal_game_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      playCorrectSound();
      showToast('Backup JSON lengkap berhasil diunduh!');
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleDownloadBackupDb = async () => {
    try {
      setIsBackupBusy(true);
      const res = await fetch(api.getBackupDbDownloadUrl());
      if (!res.ok) {
        throw new Error('Gagal mengunduh file database SQLite (.db)');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `portal_game_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      playCorrectSound();
      showToast('File SQLite (.db) berhasil diunduh!');
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleCreateServerSnapshot = async () => {
    try {
      setIsBackupBusy(true);
      const created = await api.createBackupSnapshot();
      await loadBackupSnapshots();
      playCorrectSound();
      showToast(`Snapshot server "${created.filename}" berhasil dibuat!`);
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleSyncBaselineNow = async () => {
    try {
      setIsSyncingBaselineNow(true);
      const res = await api.syncBaselineNow({
        publishedSyncUrl: publishedSyncUrl.trim() || DEFAULT_PUBLISHED_SYNC_URL,
        autoSyncEnabled: true,
        forceSnapshot: true,
      });
      if (res?.data) {
        setBaselineStatus(res.data);
        setBaselineCountdownSec(
          calculateNextAutoBaselineSyncSeconds(res.data.lastAutoSyncAt, Date.now())
        );
      }
      await loadBackupSnapshots();
      onDataChanged();
      playCorrectSound();
      showToast(res.message || 'Perlindungan Baseline Data Terpublish berhasil disinkronkan!');
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message || 'Gagal menyinkronkan baseline data', 'error');
    } finally {
      setIsSyncingBaselineNow(false);
    }
  };

  const handleSyncFromPublishedUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishedSyncUrl.trim()) {
      showToast('Masukkan URL website yang sudah terpublish terlebih dahulu.', 'error');
      return;
    }
    try {
      setIsSyncingPublished(true);
      const res = await api.syncFromPublishedUrl(publishedSyncUrl.trim(), 'merge');
      playCorrectSound();
      await loadBackupSnapshots();
      onDataChanged();
      showToast(res.message);
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsSyncingPublished(false);
    }
  };

  const handleBackupJsonTextChange = (text: string) => {
    setBackupInputKind('json');
    setBackupDbBase64('');
    setBackupJsonText(text);
    if (!text.trim()) {
      setBackupPreviewSummary(null);
      setBackupParseError(null);
      return;
    }
    try {
      const parsed = parseBackupPayload(text);
      setBackupPreviewSummary(summarizeBackupPayload(parsed));
      setBackupParseError(null);
    } catch (err) {
      setBackupPreviewSummary(null);
      setBackupParseError((err as Error).message);
    }
  };

  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupFileName(file.name);
    setBackupParseError(null);
    setBackupPreviewSummary(null);

    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.db') || lower.endsWith('.sqlite') || lower.endsWith('.sqlite3')) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (!isValidSqliteHeader(bytes)) {
          throw new Error('File bukan database SQLite (.db) yang valid.');
        }
        const reader = new FileReader();
        reader.onload = () => {
          const resStr = String(reader.result || '');
          setBackupInputKind('db');
          setBackupDbBase64(resStr);
          setBackupJsonText('');
          setBackupParseError(null);
          showToast(`File SQLite "${file.name}" siap diimpor.`);
        };
        reader.readAsDataURL(file);
      } else {
        const text = await file.text();
        setBackupInputKind('json');
        setBackupDbBase64('');
        setBackupJsonText(text);
        const parsed = parseBackupPayload(text);
        setBackupPreviewSummary(summarizeBackupPayload(parsed));
        setBackupParseError(null);
        showToast(`File JSON "${file.name}" terbaca & siap diimpor.`);
      }
    } catch (err) {
      setBackupParseError((err as Error).message);
      playIncorrectSound();
    } finally {
      e.target.value = '';
    }
  };

  const executeImportBackup = async (mode: BackupImportMode) => {
    try {
      setIsBackupBusy(true);
      let result;
      if (backupInputKind === 'db') {
        if (!backupDbBase64) {
          throw new Error('Silakan pilih file SQLite (.db) terlebih dahulu.');
        }
        result = await api.importBackupDb(mode, backupFileName || 'backup.db', backupDbBase64);
      } else {
        const parsed = parseBackupPayload(backupJsonText);
        result = await api.importBackupJson(mode, { version: '1.0', data: parsed });
      }
      playCorrectSound();
      setBackupJsonText('');
      setBackupDbBase64('');
      setBackupFileName('');
      setBackupPreviewSummary(null);
      setBackupParseError(null);
      await loadBackupSnapshots();
      onDataChanged();
      showToast(result.message);
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsBackupBusy(false);
    }
  };

  const executeRestoreServerSnapshot = async (filename: string, mode: BackupImportMode) => {
    try {
      setIsBackupBusy(true);
      const result = await api.restoreBackupSnapshot(filename, mode);
      playCorrectSound();
      await loadBackupSnapshots();
      onDataChanged();
      showToast(result.message);
    } catch (err) {
      playIncorrectSound();
      showToast((err as Error).message, 'error');
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleTriggerImportBackup = () => {
    if (backupInputKind === 'json') {
      try {
        parseBackupPayload(backupJsonText);
      } catch (err) {
        setBackupParseError((err as Error).message);
        playIncorrectSound();
        showToast((err as Error).message, 'error');
        return;
      }
    } else if (!backupDbBase64) {
      showToast('Silakan pilih file backup .json atau .db terlebih dahulu.', 'error');
      return;
    }

    if (backupImportMode === 'replace') {
      setConfirmReplaceAction({
        source: 'upload',
        label: backupFileName || (backupInputKind === 'db' ? 'File SQLite (.db)' : 'Data JSON Backup'),
      });
      return;
    }
    executeImportBackup('merge');
  };

  const handleTriggerRestoreSnapshot = (filename: string, mode: BackupImportMode) => {
    if (mode === 'replace') {
      setConfirmReplaceAction({
        source: 'snapshot',
        snapshotFilename: filename,
        label: filename,
      });
      return;
    }
    executeRestoreServerSnapshot(filename, 'merge');
  };

  const handleConfirmReplaceAction = async () => {
    if (!confirmReplaceAction) return;
    const action = confirmReplaceAction;
    setConfirmReplaceAction(null);
    if (action.source === 'snapshot' && action.snapshotFilename) {
      await executeRestoreServerSnapshot(action.snapshotFilename, 'replace');
    } else {
      await executeImportBackup('replace');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full h-[90vh] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-xl text-amber-400">
                Admin Hub Studio Pro
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                SQL Central
              </span>
              {isAuthenticated && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  authenticatedRole === 'admin'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                }`}>
                  {authenticatedRole === 'admin' ? '🛡️ Admin (Pengelola Penuh)' : '📤 Uploader (Khusus Upload Game)'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Pusat kendali game portable, kategori dinamis, moderasi testimoni, lisensi & sertifikat
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && authenticatedRole === 'uploader' && (
              <button
                onClick={() => {
                  setIsAuthenticated(false);
                  setPasswordInput('');
                }}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline mr-2 cursor-pointer"
                title="Beralih ke hak akses Admin Penuh"
              >
                Ganti ke Admin Penuh
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Password Gate if not authenticated */}
        {!isAuthenticated ? (
          <div className="flex-grow flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-2xl mx-auto shadow-sm">
                <Key className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                Masuk Akses Pengelola
              </h3>
              <p className="text-xs text-slate-500">
                Pilih tingkatan peran akses dan masukkan kata sandi terdaftar:
              </p>

              {/* Roles Description Cards */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="p-3 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Admin Penuh</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Pengelola penuh seluruh database, pengguna & portal.
                  </div>
                </div>

                <div className="p-3 rounded-2xl border border-sky-200 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Uploader</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Khusus upload & kelola game pembelajaran portable.
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-500 text-left">
                🎮 <strong>User (Pemain)</strong>: Bermain game & peroleh skor di Papan Peringkat.<br />
                👣 <strong>Tamu</strong>: Langsung bermain game tanpa perlu login.
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-semibold">
                  {authError}
                </div>
              )}

              <form onSubmit={(e) => handleAdminLogin(e)} className="space-y-3 pt-1">
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan Kata Sandi..."
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs text-center font-mono focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow transition cursor-pointer"
                >
                  Verifikasi & Masuk Hub
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Main Authenticated Admin Tabs */
          <div className="flex flex-col flex-grow overflow-hidden">
            {/* Sub-tabs bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 space-x-6 text-xs font-bold overflow-x-auto shrink-0 bg-slate-50 dark:bg-slate-900/60">
              <button
                onClick={() => setActiveTab('games')}
                className={`pb-3 whitespace-nowrap transition-colors ${
                  activeTab === 'games'
                    ? 'text-amber-600 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Katalog Games ({games.length})
              </button>

              <button
                onClick={() => setActiveTab('upload')}
                className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-1 ${
                  activeTab === 'upload'
                    ? 'text-amber-600 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Game Portable</span>
              </button>

              {/* Admin-only Tabs: Hidden for Uploader */}
              {authenticatedRole === 'admin' && (
                <>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className={`pb-3 whitespace-nowrap transition-colors ${
                      activeTab === 'categories'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Kelola Kategori & Ikon ({categories.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('hero')}
                    className={`pb-3 whitespace-nowrap transition-colors ${
                      activeTab === 'hero'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Pengaturan Banner & Foto/Logo
                  </button>

                  <button
                    onClick={() => setActiveTab('testimonials')}
                    className={`pb-3 whitespace-nowrap transition-colors ${
                      activeTab === 'testimonials'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Moderasi Testimoni ({testimonials.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('licenses')}
                    className={`pb-3 whitespace-nowrap transition-colors ${
                      activeTab === 'licenses'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Lisensi Sekolah ({licenses.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('certificates')}
                    className={`pb-3 whitespace-nowrap transition-colors ${
                      activeTab === 'certificates'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Arsip Sertifikat ({certificates.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      activeTab === 'users'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Kelola Pengguna ({usersList.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('leaderboard')}
                    className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      activeTab === 'leaderboard'
                        ? 'text-amber-600 border-b-2 border-amber-600 font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Reset & Kelola Skor ({activeLeaderboardList.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      activeTab === 'stats'
                        ? 'text-amber-600 border-b-2 border-amber-600 font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Statistik & Log Akses</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('backup')}
                    className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      activeTab === 'backup'
                        ? 'text-amber-600 border-b-2 border-amber-600 font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Backup & Restore</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-1 ${
                      activeTab === 'audit'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Log Audit Server</span>
                  </button>
                </>
              )}
            </div>

            {/* Tab Contents Viewport */}
            <div className="flex-grow p-4 sm:p-6 overflow-y-auto space-y-6">
              {/* TAB 1: GAMES MANAGEMENT */}
              {activeTab === 'games' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Sinkronisasi Database SQL: <span className="text-emerald-600 font-bold">Aktif & Terpusat</span>
                      {authenticatedRole === 'uploader' && (
                        <span className="ml-2 text-sky-600 font-normal">(Mode: Uploader Game)</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {authenticatedRole === 'admin' && (
                        <>
                          <button
                            onClick={handleOpenResetPlaysModal}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                            title="Reset counter total pemain seluruh game (Dilindungi Password)"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Reset Total Permainan</span>
                          </button>

                          <button
                            onClick={() => handleOpenResetScoresModal(null)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                            title="Reset skor seluruh game di Papan Peringkat (Dilindungi Password)"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            <span>Reset Skor Leaderboard</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setActiveTab('upload')}
                        className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Game Portable</span>
                      </button>
                    </div>
                  </div>

                  {/* Status Filter & Search bar for Katalog Games */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Filter:</span>
                      <button
                        type="button"
                        onClick={() => setGameStatusFilter('all')}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          gameStatusFilter === 'all'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Semua ({games.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameStatusFilter('active')}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          gameStatusFilter === 'active'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Aktif ({games.filter((g) => g.isActive !== false).length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameStatusFilter('inactive')}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          gameStatusFilter === 'inactive'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>Nonaktif ({games.filter((g) => g.isActive === false).length})</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={gameSearchQuery}
                        onChange={(e) => setGameSearchQuery(e.target.value)}
                        placeholder="Cari judul atau topik..."
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 w-44 sm:w-56"
                      />
                    </div>
                  </div>

                  {/* Inline Edit Game, Thumbnail & Icon Panel (shown directly above table for instant access) */}
                  {editingGame && (
                    <form onSubmit={handleSaveEditGame} className="bg-amber-500/10 dark:bg-amber-950/30 p-5 rounded-3xl border-2 border-amber-500/40 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading font-bold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-amber-600" />
                          <span>Edit Game, Thumbnail & Ikon: {editingGame.title}</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingGame(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          ✕ Batal
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="edit-game-title" className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Judul Permainan</label>
                          <input
                            id="edit-game-title"
                            type="text"
                            required
                            value={editGameTitle}
                            onChange={(e) => setEditGameTitle(e.target.value)}
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-game-category" className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Kategori</label>
                          <select
                            id="edit-game-category"
                            value={editGameCategory}
                            onChange={(e) => setEditGameCategory(e.target.value)}
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          >
                            {categories.map((c) => (
                              <option key={c.id || c.name} value={c.name}>{c.name}</option>
                            ))}
                            <option value="__NEW__">+ Buat Kategori Baru...</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="edit-game-difficulty" className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Tingkat Kesulitan</label>
                          <select
                            id="edit-game-difficulty"
                            value={editGameDifficulty}
                            onChange={(e) => setEditGameDifficulty(e.target.value as 'Mudah' | 'Sedang' | 'Sangat Sulit')}
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          >
                            <option value="Mudah">Mudah</option>
                            <option value="Sedang">Sedang</option>
                            <option value="Sangat Sulit">Sangat Sulit</option>
                          </select>
                        </div>
                      </div>

                      {editGameCategory === '__NEW__' && (
                        <div>
                          <label htmlFor="edit-game-custom-category" className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Nama Kategori Baru</label>
                          <input
                            id="edit-game-custom-category"
                            type="text"
                            required
                            value={editGameCustomCategory}
                            onChange={(e) => setEditGameCustomCategory(e.target.value)}
                            placeholder="Ketik nama kategori baru..."
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-400 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      )}

                      {/* Edit Thumbnail & Icon Game Section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Thumbnail Editor */}
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                              <Image className="w-3.5 h-3.5 text-amber-500" />
                              <span>Edit Thumbnail Game</span>
                            </span>
                            {hasCustomThumbnail(editGameThumbnail) && (
                              <button
                                type="button"
                                onClick={() => setEditGameThumbnail('')}
                                className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                              >
                                Hapus Thumbnail
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <img
                              src={resolveGameThumbnail(editGameThumbnail)}
                              alt="Preview Thumbnail Game"
                              className="w-24 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0"
                            />
                            <div className="flex-1 min-w-0 space-y-2">
                              <div>
                                <label htmlFor="edit-game-thumbnail-file" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                  Unggah Gambar Baru (.png, .jpg, .webp)
                                </label>
                                <input
                                  id="edit-game-thumbnail-file"
                                  type="file"
                                  accept="image/*"
                                  onChange={handleEditGameThumbnailUpload}
                                  className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-amber-600 file:text-white cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label htmlFor="edit-game-thumbnail-url" className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                              URL Gambar Thumbnail (Opsional)
                            </label>
                            <input
                              id="edit-game-thumbnail-url"
                              type="text"
                              value={editGameThumbnail}
                              onChange={(e) => setEditGameThumbnail(e.target.value)}
                              placeholder="https://... atau unggah file di atas"
                              className="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        {/* Icon Game Editor */}
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>Edit Ikon Game</span>
                            </span>
                            {editGameIcon && (
                              <button
                                type="button"
                                onClick={() => setEditGameIcon('')}
                                className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                              >
                                Reset Ikon Default
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <GameIconBadge icon={editGameIcon} title="Preview Ikon Game" size="lg" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                Pilih Cepat Ikon atau Unggah File Ikon (.ico, .png, .webp, .svg)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {GAME_ICON_PRESETS.map((preset) => (
                                  <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setEditGameIcon(preset.value)}
                                    title={preset.label}
                                    aria-label={`Pilih ikon ${preset.label}`}
                                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center border transition cursor-pointer ${
                                      editGameIcon === preset.value
                                        ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                                    }`}
                                  >
                                    {preset.value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label htmlFor="edit-game-icon-input" className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                                Emoji / Teks / URL Ikon
                              </label>
                              <input
                                id="edit-game-icon-input"
                                type="text"
                                value={editGameIcon}
                                onChange={(e) => setEditGameIcon(e.target.value)}
                                placeholder="Contoh: 🪷 atau https://..."
                                className="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label htmlFor="edit-game-icon-file" className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                                Unggah Gambar Ikon
                              </label>
                              <input
                                id="edit-game-icon-file"
                                type="file"
                                accept=".ico,.webp,.png,.jpg,.jpeg,.svg,image/*"
                                onChange={handleEditGameIconUpload}
                                className="w-full mt-1 text-[11px] text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-700 file:text-white cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="edit-game-desc" className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Deskripsi</label>
                        <textarea
                          id="edit-game-desc"
                          rows={2}
                          required
                          value={editGameDesc}
                          onChange={(e) => setEditGameDesc(e.target.value)}
                          className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={isSubmittingEditGame}
                          className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSubmittingEditGame ? 'Menyimpan & Menyinkronkan...' : 'Simpan Perubahan & Sinkronkan'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGame(null)}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                          <th className="py-3 px-4">Thumbnail, Ikon & Judul</th>
                          <th className="py-3 px-4">Kategori</th>
                          <th className="py-3 px-4">Engine</th>
                          <th className="py-3 px-4">Pemain</th>
                          <th className="py-3 px-4">Akses</th>
                          <th className="py-3 px-4">Status Game</th>
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(() => {
                          const filtered = games.filter((g) => {
                            const matchStatus =
                              gameStatusFilter === 'all'
                                ? true
                                : gameStatusFilter === 'active'
                                ? g.isActive !== false
                                : g.isActive === false;
                            const matchSearch =
                              !gameSearchQuery ||
                              g.title.toLowerCase().includes(gameSearchQuery.toLowerCase()) ||
                              g.category.toLowerCase().includes(gameSearchQuery.toLowerCase());
                            return matchStatus && matchSearch;
                          });

                          if (games.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="py-10 text-center text-slate-400">
                                  <div className="space-y-2">
                                    <p className="font-bold text-xs text-slate-600 dark:text-slate-300">
                                      Belum ada permainan di katalog database.
                                    </p>
                                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                                      Silakan unggah permainan baru melalui tab Upload Game Portable — kategorinya akan otomatis tersinkronisasi.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('upload')}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer mt-1"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Upload Game Pertama</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-slate-400">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-xs">Tidak ada permainan yang sesuai dengan filter.</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGameStatusFilter('all');
                                        setGameSearchQuery('');
                                      }}
                                      className="text-amber-600 dark:text-amber-400 text-xs hover:underline cursor-pointer font-bold"
                                    >
                                      Reset Filter
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((g) => {
                            const hasThumb = hasCustomThumbnail(g.thumbnail);
                            const iconInfo = resolveGameIcon(g.icon);
                            return (
                              <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="relative shrink-0">
                                      <img
                                        src={resolveGameThumbnail(g.thumbnail)}
                                        alt={`Thumbnail ${g.title}`}
                                        className="w-12 h-8 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                      />
                                      <div className="absolute -bottom-1 -right-1 shadow-sm rounded-md bg-white dark:bg-slate-900">
                                        <GameIconBadge icon={g.icon} title={`Ikon ${g.title}`} size="xs" />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                                        <span>{g.title}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                                        <span>Tingkat: {g.difficulty}</span>
                                        <span aria-hidden="true">·</span>
                                        <span className={hasThumb ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                                          {hasThumb ? 'Thumb Kustom' : 'Thumb Default'}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span>
                                          Ikon: {iconInfo.kind === 'image' ? 'Gambar' : iconInfo.value}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                  {g.category}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-500 uppercase">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {g.type}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-bold text-amber-600 tabular-nums">
                                  {g.players}
                                </td>
                                <td className="py-3 px-4">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePremium(g)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                      g.isPremium
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                    title={g.isPremium ? 'Game PRO / Berlisensi' : 'Game Terbuka Gratis'}
                                  >
                                    {g.isPremium ? 'PRO' : 'GRATIS'}
                                  </button>
                                </td>
                                {/* STATUS AKTIF / NONAKTIF TOGGLE */}
                                <td className="py-3 px-4">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleGameStatus(g)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer select-none ${
                                      g.isActive !== false
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                                    }`}
                                    title={
                                      g.isActive !== false
                                        ? 'Permainan sedang AKTIF (Dapat dimainkan oleh publik). Klik untuk MENONAKTIFKAN.'
                                        : 'Permainan sedang NONAKTIF (Disembunyikan dari publik). Klik untuk MENGAKTIFKAN kembali.'
                                    }
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        g.isActive !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                      }`}
                                    />
                                    <span>{g.isActive !== false ? 'Aktif' : 'Nonaktif'}</span>
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditGame(g)}
                                    className="text-amber-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer transition"
                                    title={`Edit Game, Thumbnail & Ikon "${g.title}"`}
                                    aria-label={`Edit Game, Thumbnail & Ikon ${g.title}`}
                                  >
                                    <Edit2 className="w-4 h-4 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGame(g.id, g.title)}
                                    className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition"
                                    title={`Hapus Game "${g.title}"`}
                                    aria-label={`Hapus Game ${g.title}`}
                                  >
                                    <Trash2 className="w-4 h-4 inline" />
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: UPLOAD PORTABLE GAME */}
              {activeTab === 'upload' && (
                <form onSubmit={handleSaveGame} className="space-y-4 max-w-2xl bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Upload className="w-4 h-4" /> Unggah File Game Portable (.html, .json, .js)
                    </label>
                    <input
                      type="file"
                      accept=".html,.html5,.json,.js"
                      onChange={handlePortableFileUpload}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">
                      Mendukung paket standalone HTML5 interaktif, konfigurasi JSON, atau file script portable.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400">Judul Permainan</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Contoh: Petualangan Delapan Jalan Mulia"
                      className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="upload-game-category" className="text-[11px] font-bold uppercase text-slate-400">
                        Kategori Pembelajaran
                      </label>
                      {categories.length > 0 ? (
                        <select
                          id="upload-game-category"
                          value={categoryMode === 'new' ? '__NEW__' : newCategory}
                          onChange={(e) => {
                            if (e.target.value === '__NEW__') {
                              setCategoryMode('new');
                            } else {
                              setCategoryMode('existing');
                              setNewCategory(e.target.value);
                            }
                          }}
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        >
                          {categories.map((c) => (
                            <option key={c.id || c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                          <option value="__NEW__">+ Buat Kategori Baru...</option>
                        </select>
                      ) : (
                        <div className="mt-1 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          Kategori masih kosong — isi kategori baru di bawah
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="upload-game-type" className="text-[11px] font-bold uppercase text-slate-400">
                        Engine / Tipe
                      </label>
                      <select
                        id="upload-game-type"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as 'quiz' | 'memory' | 'html5' | 'iframe')}
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                      >
                        <option value="html5">HTML5 Standalone Code</option>
                        <option value="quiz">Kuis Interaktif</option>
                        <option value="memory">Memory Card Match</option>
                        <option value="iframe">URL Embed Iframe</option>
                      </select>
                    </div>
                  </div>

                  {categoryMode === 'new' && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <FolderPlus className="w-4 h-4 text-amber-600" />
                          <span>Buat & Sinkronkan Kategori Baru</span>
                        </span>
                        {categories.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryMode('existing');
                              setNewCategory(categories[0].name);
                            }}
                            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            Pilih Kategori Tersedia
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="upload-new-category-name" className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                            Nama Kategori Baru
                          </label>
                          <input
                            id="upload-new-category-name"
                            type="text"
                            required
                            value={customCategoryName}
                            onChange={(e) => setCustomCategoryName(e.target.value)}
                            placeholder="Contoh: TK, SD, SMP, atau Topik Kustom"
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/40 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label htmlFor="upload-new-category-icon" className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                            Ikon Kategori
                          </label>
                          <select
                            id="upload-new-category-icon"
                            value={customCategoryIcon}
                            onChange={(e) => setCustomCategoryIcon(e.target.value)}
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/40 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          >
                            <option value="fa-seedling">Tunas Kebijaksanaan (fa-seedling)</option>
                            <option value="fa-dharmachakra">Roda Dharma (fa-dharmachakra)</option>
                            <option value="fa-book-open">Kitab Tripitaka (fa-book-open)</option>
                            <option value="fa-landmark">Sejarah & Candi (fa-landmark)</option>
                            <option value="fa-shield-halved">Pancasila Buddhis (fa-shield-halved)</option>
                            <option value="fa-heart">Etika & Moralitas (fa-heart)</option>
                            <option value="fa-om">Meditasi (fa-om)</option>
                            <option value="fa-circle-question">Kuis Pengetahuan (fa-circle-question)</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                        Kategori ini otomatis ditambahkan ke daftar Kategori Pembelajaran dan tersinkronisasi dengan game yang diunggah.
                      </p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="upload-game-difficulty" className="text-[11px] font-bold uppercase text-slate-400">
                      Tingkat Kesulitan
                    </label>
                    <select
                      id="upload-game-difficulty"
                      value={newDifficulty}
                      onChange={(e) => setNewDifficulty(e.target.value as 'Mudah' | 'Sedang' | 'Sangat Sulit')}
                      className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                    >
                      <option value="Mudah">Mudah</option>
                      <option value="Sedang">Sedang</option>
                      <option value="Sangat Sulit">Sangat Sulit</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="upload-game-thumbnail-file" className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                          Thumbnail Game
                        </label>
                        {newThumbnail && (
                          <button
                            type="button"
                            onClick={() => setNewThumbnail('')}
                            className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <input
                        id="upload-game-thumbnail-file"
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-slate-700 cursor-pointer"
                      />
                      <input
                        id="upload-game-thumbnail-url"
                        type="text"
                        value={newThumbnail}
                        onChange={(e) => setNewThumbnail(e.target.value)}
                        placeholder="Atau tempel URL gambar thumbnail..."
                        className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                      />
                      {newThumbnail && (
                        <img src={newThumbnail} alt="Preview Thumbnail" className="w-24 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                      )}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="upload-game-icon-input" className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-300">
                          Ikon Game
                        </label>
                        <GameIconBadge icon={newIcon} title="Preview Ikon Game Baru" size="sm" />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {GAME_ICON_PRESETS.slice(0, 8).map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setNewIcon(preset.value)}
                            title={preset.label}
                            aria-label={`Pilih ikon awal ${preset.label}`}
                            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center border transition cursor-pointer ${
                              newIcon === preset.value
                                ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                            }`}
                          >
                            {preset.value}
                          </button>
                        ))}
                      </div>
                      <input
                        id="upload-game-icon-input"
                        type="text"
                        value={newIcon}
                        onChange={(e) => setNewIcon(e.target.value)}
                        placeholder="Emoji (misal 🪷) atau URL gambar ikon..."
                        className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                      />
                      <input
                        id="upload-game-icon-file"
                        type="file"
                        accept=".ico,.webp,.png,.jpg,.jpeg,.svg,image/*"
                        onChange={handleNewGameIconUpload}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-slate-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  {newType === 'html5' && (
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-400">Kode HTML5 Portable Script</label>
                      <textarea
                        rows={6}
                        value={newHtml5Code}
                        onChange={(e) => setNewHtml5Code(e.target.value)}
                        placeholder="<!DOCTYPE html><html><body>...</body></html>"
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  )}

                  {newType === 'iframe' && (
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-400">URL Game Eksternal</label>
                      <input
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400">Deskripsi Singkat</label>
                    <textarea
                      required
                      rows={2}
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Tujuan pembelajaran dan deskripsi game..."
                      className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={newIsActive}
                        onChange={(e) => setNewIsActive(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Status Aktif (Dapat dimainkan oleh publik)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        id="premiumCheck"
                        checked={newIsPremium}
                        onChange={(e) => setNewIsPremium(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Tandai sebagai Game PRO (Lisensi)</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingGame}
                    className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md transition cursor-pointer"
                  >
                    {isSubmittingGame ? 'Mengunggah & Menyinkronkan ke Database...' : 'Simpan Game ke Database SQL'}
                  </button>
                </form>
              )}

              {/* TAB 3: CATEGORIES */}
              {activeTab === 'categories' && (
                <div className="space-y-6">
                  {/* Edit Category Form (Visible when editingCat is selected) */}
                  {editingCat && (
                    <form onSubmit={handleSaveEditCategory} className="bg-amber-500/10 dark:bg-amber-950/30 p-6 rounded-3xl border-2 border-amber-500/40 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading font-bold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-amber-600" />
                          Edit Kategori: <span className="underline font-black">{editingCat.name}</span>
                        </h4>
                        <button
                          type="button"
                          onClick={handleCancelEditCategory}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          ✕ Batal
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Nama Kategori</label>
                          <input
                            type="text"
                            required
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Ganti File Ikon (.ico, .webp, .png)</label>
                          <input
                            type="file"
                            accept=".ico,.webp,.png,.jpg"
                            onChange={handleEditCategoryIconUpload}
                            className="w-full mt-1 text-xs text-slate-500 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-amber-600 file:text-white cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Kode FontAwesome / URL Ikon</label>
                          <input
                            type="text"
                            value={editCatIcon}
                            onChange={(e) => setEditCatIcon(e.target.value)}
                            className="w-full mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow hover:bg-amber-700 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Perubahan Kategori</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditCategory}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Add Category Form */}
                  <form onSubmit={handleAddCategory} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-amber-500" />
                      Tambah Kategori & Ikon (.ico / .webp / FontAwesome)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Nama Kategori</label>
                        <input
                          type="text"
                          required
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder="Nama Kategori Baru..."
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Pilih File Ikon (.ico, .webp, .png)</label>
                        <input
                          type="file"
                          accept=".ico,.webp,.png,.jpg"
                          onChange={handleCategoryIconFileUpload}
                          className="w-full mt-1 text-xs text-slate-500 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-amber-600 file:text-white cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Kode Ikon FontAwesome</label>
                        <input
                          type="text"
                          value={catIcon}
                          onChange={(e) => setCatIcon(e.target.value)}
                          placeholder="fa-seedling"
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow hover:bg-amber-700 transition cursor-pointer"
                    >
                      + Tambah Kategori
                    </button>
                  </form>

                  {/* Categories Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                          <th className="py-3 px-4">Ikon</th>
                          <th className="py-3 px-4">Nama Kategori</th>
                          <th className="py-3 px-4">Jumlah Game Terkait</th>
                          <th className="py-3 px-4 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {categories.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-slate-400 text-xs">
                              Belum ada kategori pembelajaran tersimpan. Tambahkan kategori baru di formulir atas atau langsung saat mengunggah game baru.
                            </td>
                          </tr>
                        ) : (
                          categories.map((c) => {
                            const linkedCount = games.filter((g) => g.category === c.name).length;
                            const isBeingEdited = editingCat?.id === c.id;
                            return (
                              <tr key={c.id || c.name} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${isBeingEdited ? 'bg-amber-500/10' : ''}`}>
                                <td className="py-3 px-4 text-amber-600">
                                  {c.icon.startsWith('data:image') || c.icon.startsWith('http') ? (
                                    <img src={c.icon} alt="Icon" className="w-6 h-6 object-contain rounded" />
                                  ) : (
                                    <span className="font-mono text-xs">{c.icon}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                  {c.name}
                                  {isBeingEdited && (
                                    <span className="ml-2 text-[10px] text-amber-600 font-semibold">(Sedang diedit)</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {linkedCount} game
                                </td>
                                <td className="py-3 px-4 text-right space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCategory(c)}
                                    className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer transition"
                                    title={`Edit Kategori ${c.name}`}
                                    aria-label={`Edit Kategori ${c.name}`}
                                  >
                                    <Edit2 className="w-4 h-4 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(c.id!, c.name)}
                                    className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer transition"
                                    title={`Hapus Kategori ${c.name}`}
                                    aria-label={`Hapus Kategori ${c.name}`}
                                  >
                                    <Trash2 className="w-4 h-4 inline" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: HERO BANNER & PHOTO/LOGO CONFIG */}
              {activeTab === 'hero' && (
                <form onSubmit={handleSaveHero} className="space-y-4 max-w-xl bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                      Pengaturan Banner Setengah Lingkaran & Foto/Logo Hero
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Kustomisasi judul banner (lengkung luar atas) dan subjudul banner (lengkung luar bawah) yang memeluk tepi luar lingkaran, serta unggah foto atau logo untuk ditampilkan secara bersih dan menarik di tengah lingkaran.
                    </p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      Tipografi Tepi Luar (Tidak Menghalangi Gambar)
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      • <strong>Judul Banner:</strong> Membentuk busur setengah lingkaran luar atas.<br />
                      • <strong>Subjudul Banner:</strong> Membentuk busur setengah lingkaran luar bawah.<br />
                      • <strong>Tengah Lingkaran:</strong> Bersih tanpa ornamen yang menumpuk, siap menampilkan foto atau logo institusi secara maksimal.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400">Judul Banner (Setengah Lingkaran Atas)</label>
                    <input
                      type="text"
                      required
                      value={heroTitle}
                      onChange={(e) => setHeroTitle(e.target.value)}
                      placeholder="Contoh: CANDI & STUPA DHARMA"
                      className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400">Subjudul Banner (Setengah Lingkaran Bawah)</label>
                    <input
                      type="text"
                      required
                      value={heroSubtitle}
                      onChange={(e) => setHeroSubtitle(e.target.value)}
                      placeholder="Contoh: Nilai Kebijaksanaan & Kemurnian"
                      className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Image className="w-4 h-4 text-amber-500" />
                      Unggah Foto / Logo Hero (.png, .jpg, .webp)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroImageUpload}
                      className="w-full mt-1 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-amber-600 file:text-white cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Foto atau logo akan ditampilkan di tengah lingkaran tanpa terhalang ornamen tengah.
                    </p>
                    {heroImage && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={heroImage} alt="Preview Foto/Logo" className="w-20 h-20 rounded-xl object-cover border" />
                        <button
                          type="button"
                          onClick={() => setHeroImage('')}
                          className="text-xs text-rose-500 hover:underline"
                        >
                          Hapus Foto / Logo
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow transition cursor-pointer"
                  >
                    Simpan Perubahan Banner & Foto/Logo
                  </button>
                </form>
              )}

              {/* TAB 5: MODERASI TESTIMONI */}
              {activeTab === 'testimonials' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                        <th className="py-3 px-4">Pengirim</th>
                        <th className="py-3 px-4">Pesan Ulasan</th>
                        <th className="py-3 px-4">Rating</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Moderasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {testimonials.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {t.name} <span className="text-slate-400 font-normal">({t.role})</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            "{t.message}"
                          </td>
                          <td className="py-3 px-4 text-amber-500">
                            {'⭐'.repeat(t.rating)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === 'approved'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {t.status === 'approved' ? 'Disetujui' : 'Menunggu'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            {t.status !== 'approved' && (
                              <button
                                onClick={() => handleModerateTestimonial(t.id, 'approved')}
                                className="text-emerald-600 hover:text-emerald-800 font-bold p-1"
                                title="Setujui"
                              >
                                <Check className="w-4 h-4 inline" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteTestimonial(t.id)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 6: LISENSI */}
              {activeTab === 'licenses' && (
                <div className="space-y-6">
                  {/* Create License */}
                  <form onSubmit={handleCreateLicense} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-500" /> Terbitkan Lisensi Institusi / Vihara Baru
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Nama Sekolah / Vihara</label>
                        <input
                          type="text"
                          required
                          value={newSchool}
                          onChange={(e) => setNewSchool(e.target.value)}
                          placeholder="Contoh: SMA Buddhis Jayakarta"
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Paket Lisensi</label>
                        <select
                          value={newPlan}
                          onChange={(e) => setNewPlan(e.target.value)}
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        >
                          <option value="Pro School Suite">Pro School Suite (Akses Lengkap)</option>
                          <option value="Vihara Learning Pack">Vihara Learning Pack (Kelas Minggu)</option>
                          <option value="National Dharma Enterprise">National Dharma Enterprise</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow hover:bg-amber-700 transition cursor-pointer"
                    >
                      + Terbitkan Lisensi
                    </button>
                  </form>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                          <th className="py-3 px-4">Nama Institusi</th>
                          <th className="py-3 px-4">Paket</th>
                          <th className="py-3 px-4">Kunci Lisensi Resmi</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Berlaku Hingga</th>
                          <th className="py-3 px-4 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {licenses.map((lic) => (
                          <tr key={lic.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {lic.schoolName}
                            </td>
                            <td className="py-3 px-4 text-amber-600 font-semibold">{lic.plan}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                              {lic.licenseKey}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                {lic.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500">{lic.expiresDate}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteLicense(lic.id, lic.schoolName)}
                                className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer transition"
                                title="Hapus Lisensi Sekolah"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: SERTIFIKAT */}
              {activeTab === 'certificates' && (() => {
                const certCounts = countCertificateStatuses(certificates);
                const filteredCerts = filterCertificates(certificates, certStatusFilter, certSearchQuery);
                return (
                  <div className="space-y-5">
                    {/* Issue Certificate Form */}
                    <form onSubmit={handleIssueCertificate} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-500" /> Terbitkan Sertifikat Kelulusan Siswa
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="cert-student-name" className="text-[10px] font-bold uppercase text-slate-400">Nama Siswa</label>
                          <input
                            id="cert-student-name"
                            type="text"
                            required
                            value={certStudent}
                            onChange={(e) => setCertStudent(e.target.value)}
                            placeholder="Contoh: Metta Bhavana"
                            className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label htmlFor="cert-module-name" className="text-[10px] font-bold uppercase text-slate-400">Modul Pembelajaran</label>
                          <input
                            id="cert-module-name"
                            type="text"
                            required
                            value={certModule}
                            onChange={(e) => setCertModule(e.target.value)}
                            placeholder="Modul Pembelajaran..."
                            className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label htmlFor="cert-institution-name" className="text-[10px] font-bold uppercase text-slate-400">Institusi Penerbit</label>
                          <input
                            id="cert-institution-name"
                            type="text"
                            required
                            value={certInstitution}
                            onChange={(e) => setCertInstitution(e.target.value)}
                            placeholder="Institusi..."
                            className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow hover:bg-amber-700 transition cursor-pointer"
                      >
                        + Terbitkan Sertifikat Resmi
                      </button>
                    </form>

                    {/* Status Filter & Search Bar for Arsip Sertifikat */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Filter Status:</span>
                        <button
                          type="button"
                          onClick={() => setCertStatusFilter('all')}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            certStatusFilter === 'all'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Semua ({certCounts.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCertStatusFilter('active')}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            certStatusFilter === 'active'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Aktif ({certCounts.active})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCertStatusFilter('inactive')}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            certStatusFilter === 'inactive'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>Nonaktif ({certCounts.inactive})</span>
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={certSearchQuery}
                          onChange={(e) => setCertSearchQuery(e.target.value)}
                          placeholder="Cari kode, siswa, atau institusi..."
                          className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 w-48 sm:w-64"
                        />
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                            <th className="py-3 px-4">Kode Verifikasi</th>
                            <th className="py-3 px-4">Nama Siswa</th>
                            <th className="py-3 px-4">Modul Kelulusan</th>
                            <th className="py-3 px-4">Institusi</th>
                            <th className="py-3 px-4">Tanggal</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {certificates.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-slate-400">
                                <p className="font-bold text-xs text-slate-600 dark:text-slate-300">
                                  Belum ada sertifikat yang diterbitkan.
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Gunakan formulir di atas untuk menerbitkan sertifikat resmi siswa.
                                </p>
                              </td>
                            </tr>
                          ) : filteredCerts.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400">
                                <div className="space-y-1">
                                  <p className="font-semibold text-xs">Tidak ada sertifikat yang sesuai dengan filter.</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCertStatusFilter('all');
                                      setCertSearchQuery('');
                                    }}
                                    className="text-amber-600 dark:text-amber-400 text-xs hover:underline cursor-pointer font-bold"
                                  >
                                    Reset Filter
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredCerts.map((c) => {
                              const active = isCertificateActive(c);
                              return (
                                <tr
                                  key={c.id}
                                  className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition ${
                                    active ? '' : 'opacity-75 bg-rose-50/30 dark:bg-rose-950/10'
                                  }`}
                                >
                                  <td className="py-3 px-4 font-mono font-bold text-amber-600 whitespace-nowrap">
                                    {c.verificationCode}
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                    {c.studentName}
                                  </td>
                                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{c.module}</td>
                                  <td className="py-3 px-4 text-slate-500">{c.institution}</td>
                                  <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">{c.date}</td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCertificateStatus(c)}
                                      aria-label={
                                        active
                                          ? `Nonaktifkan Status Sertifikat ${c.verificationCode}`
                                          : `Aktifkan Status Sertifikat ${c.verificationCode}`
                                      }
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer select-none ${
                                        active
                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                                      }`}
                                      title={
                                        active
                                          ? 'Sertifikat AKTIF & SAH saat diverifikasi. Klik untuk menonaktifkan.'
                                          : 'Sertifikat DINONAKTIFKAN (Tidak berlaku saat verifikasi). Klik untuk mengaktifkan kembali.'
                                      }
                                    >
                                      <span
                                        className={`w-2 h-2 rounded-full ${
                                          active ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`}
                                      />
                                      <span>{active ? 'Aktif' : 'Nonaktif'}</span>
                                    </button>
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCertificateStatus(c)}
                                        aria-label={
                                          active
                                            ? `Nonaktifkan Sertifikat ${c.verificationCode}`
                                            : `Aktifkan Sertifikat ${c.verificationCode}`
                                        }
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                          active
                                            ? 'border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                                            : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                                        }`}
                                      >
                                        {active ? 'Nonaktifkan' : 'Aktifkan'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCertificate(c)}
                                        aria-label={`Hapus Sertifikat ${c.verificationCode}`}
                                        title={`Hapus Sertifikat ${c.verificationCode}`}
                                        className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 8: KELOLA PENGGUNA */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  {/* Role Level Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Admin */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-sm">
                      <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-[11px] font-bold uppercase mb-1">
                        <span className="flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" />
                          <span>Admin Penuh</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-[9px] font-mono">Tingkat 1</span>
                      </div>
                      <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                        {usersList.filter((u) => u.role === 'admin').length}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Pengelola secara penuh (semua tab & reset)
                      </div>
                    </div>

                    {/* 2. Uploader */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-sky-200 dark:border-sky-900/40 shadow-sm">
                      <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 text-[11px] font-bold uppercase mb-1">
                        <span className="flex items-center gap-1.5">
                          <Upload className="w-4 h-4" />
                          <span>Uploader</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-[9px] font-mono">Tingkat 2</span>
                      </div>
                      <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                        {usersList.filter((u) => u.role === 'uploader').length}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Hanya melakukan upload game portable
                      </div>
                    </div>

                    {/* 3. User */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase mb-1">
                        <span className="flex items-center gap-1.5">
                          <Trophy className="w-4 h-4" />
                          <span>User (Pemain)</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px] font-mono">Tingkat 3</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {usersList.filter((u) => u.role === 'user' || !u.role).length}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Hanya bermain game & peroleh skor
                      </div>
                    </div>

                    {/* 4. Tamu */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/40 shadow-sm">
                      <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-[11px] font-bold uppercase mb-1">
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-4 h-4" />
                          <span>Tamu Aktif</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-[9px] font-mono">Tanpa Login</span>
                      </div>
                      <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                        {accessStats?.guestUsersCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Akses game langsung tanpa perlu login
                      </div>
                    </div>
                  </div>

                  {/* Tambah Pengguna Baru Form */}
                  <form onSubmit={handleCreateUser} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-500" />
                          <span>Tambah Pengguna & Tentukan Tingkat Peran</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Daftarkan akun pengguna baru dengan hak akses spesifik: Admin Penuh, Uploader Game, atau User Pemain.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      {/* Tingkat Peran Selector */}
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Tingkat Peran Akun</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'uploader' | 'user')}
                          className="w-full mt-1 p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-200 outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="user">🎮 User (Hanya Bermain & Skor)</option>
                          <option value="uploader">📤 Uploader (Hanya Upload Game)</option>
                          <option value="admin">🛡️ Admin (Pengelola Penuh)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Nama Lengkap</label>
                        <input
                          type="text"
                          required
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Nama Pengguna / Siswa..."
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Email Pengguna</label>
                        <input
                          type="email"
                          required
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="nama@sekolah.sch.id..."
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Kata Sandi Akun</label>
                        <div className="relative mt-1">
                          <input
                            type="password"
                            required
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Sandi login akun..."
                            className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Sekolah / Vihara</label>
                        <input
                          type="text"
                          value={newUserSchool}
                          onChange={(e) => setNewUserSchool(e.target.value)}
                          placeholder="Nama Sekolah atau Vihara..."
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Gelar Kebijaksanaan</label>
                        <select
                          value={newUserBadge}
                          onChange={(e) => setNewUserBadge(e.target.value)}
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        >
                          <option value="Sahabat Pemula Dharma">Sahabat Pemula Dharma</option>
                          <option value="Penjelajah Sutta & Tripitaka">Penjelajah Sutta & Tripitaka</option>
                          <option value="Penyelaras Sila & Samadhi">Penyelaras Sila & Samadhi</option>
                          <option value="Penjaga Bodhicitta">Penjaga Bodhicitta</option>
                          <option value="Maha Pandita Dharma">Maha Pandita Dharma</option>
                          <option value="Guru Pembina Dharma">Guru Pembina Dharma</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Tingkat / Level</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={newUserLevel}
                          onChange={(e) => setNewUserLevel(Number(e.target.value))}
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">XP Awal</label>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={newUserXp}
                          onChange={(e) => setNewUserXp(Number(e.target.value))}
                          className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-slate-400 italic">
                        * Tamu dapat langsung bermain permainan tanpa perlu login atau didaftarkan di sini.
                      </div>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow hover:bg-amber-700 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Simpan Pengguna Baru</span>
                      </button>
                    </div>
                  </form>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">Filter Tingkat:</span>
                      <button
                        onClick={() => setUserRoleFilter('all')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                          userRoleFilter === 'all'
                            ? 'bg-slate-800 dark:bg-slate-700 text-white shadow'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        Semua ({usersList.length})
                      </button>
                      <button
                        onClick={() => setUserRoleFilter('admin')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                          userRoleFilter === 'admin'
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Admin ({usersList.filter((u) => u.role === 'admin').length})</span>
                      </button>
                      <button
                        onClick={() => setUserRoleFilter('uploader')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                          userRoleFilter === 'uploader'
                            ? 'bg-sky-600 text-white shadow'
                            : 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Uploader ({usersList.filter((u) => u.role === 'uploader').length})</span>
                      </button>
                      <button
                        onClick={() => setUserRoleFilter('user')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                          userRoleFilter === 'user'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                        }`}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>User ({usersList.filter((u) => u.role === 'user' || !u.role).length})</span>
                      </button>
                    </div>

                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        placeholder="Cari pengguna / email..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs border-0 outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                          <th className="py-3 px-4">Pengguna</th>
                          <th className="py-3 px-4">Tingkat Peran</th>
                          <th className="py-3 px-4">Sekolah / Vihara</th>
                          <th className="py-3 px-4">Level & XP</th>
                          <th className="py-3 px-4">Gelar Kebijaksanaan</th>
                          <th className="py-3 px-4">Kata Sandi</th>
                          <th className="py-3 px-4 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(() => {
                          const filtered = usersList.filter((u) => {
                            const matchesRole =
                              userRoleFilter === 'all'
                                ? true
                                : userRoleFilter === 'user'
                                ? u.role === 'user' || !u.role
                                : u.role === userRoleFilter;

                            const searchLower = userSearchTerm.toLowerCase();
                            const matchesSearch =
                              !userSearchTerm ||
                              u.name.toLowerCase().includes(searchLower) ||
                              u.email.toLowerCase().includes(searchLower) ||
                              (u.school && u.school.toLowerCase().includes(searchLower));

                            return matchesRole && matchesSearch;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-slate-400">
                                  Belum ada pengguna yang sesuai dengan filter.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((u) => {
                            const currentRole = u.role || 'user';
                            return (
                              <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <img
                                      src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.name)}`}
                                      alt={u.name}
                                      className="w-8 h-8 rounded-full bg-amber-100 dark:bg-slate-800 shrink-0"
                                    />
                                    <div>
                                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span>{u.name}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400">{u.email}</div>
                                    </div>
                                  </div>
                                </td>

                                {/* Role Selector & Badge */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={currentRole}
                                      onChange={(e) => handleUpdateUserRole(u.id, e.target.value as 'admin' | 'uploader' | 'user')}
                                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border outline-none cursor-pointer ${
                                        currentRole === 'admin'
                                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                          : currentRole === 'uploader'
                                          ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                      }`}
                                      title="Klik untuk mengubah tingkat peran pengguna"
                                    >
                                      <option value="admin">🛡️ Admin (Penuh)</option>
                                      <option value="uploader">📤 Uploader</option>
                                      <option value="user">🎮 User (Pemain)</option>
                                    </select>
                                  </div>
                                </td>

                                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                  {u.school || 'Umum'}
                                </td>

                                <td className="py-3 px-4">
                                  <span className="font-bold text-amber-600">Lvl {u.level}</span>
                                  <span className="text-slate-400 ml-1.5 tabular-nums">({u.xp} XP)</span>
                                </td>

                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                    {u.badge}
                                  </span>
                                </td>

                                {/* Password Management Cell */}
                                <td className="py-3 px-4">
                                  {editingPasswordUserId === u.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="password"
                                        value={editingPasswordValue}
                                        onChange={(e) => setEditingPasswordValue(e.target.value)}
                                        placeholder="Sandi baru..."
                                        className="w-28 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-amber-500 text-[11px] font-mono outline-none text-slate-800 dark:text-slate-100"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateUserPassword(u.id, editingPasswordValue)}
                                        className="p-1 rounded bg-amber-600 text-white hover:bg-amber-700 transition cursor-pointer"
                                        title="Simpan Sandi Baru"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPasswordUserId(null);
                                          setEditingPasswordValue('');
                                        }}
                                        className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer"
                                        title="Batal"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 select-none tracking-widest">
                                        ••••••••
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPasswordUserId(u.id);
                                          setEditingPasswordValue('');
                                        }}
                                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer font-medium"
                                        title="Ubah kata sandi pengguna"
                                      >
                                        <Key className="w-3 h-3" />
                                        <span>Ubah</span>
                                      </button>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.name)}
                                    className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition"
                                    title="Hapus Pengguna"
                                  >
                                    <Trash2 className="w-4 h-4 inline" />
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 9: AUDIT LOGS */}
              {activeTab === 'audit' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                    Jejak audit seluruh aktivitas administrator dan server SQL secara kronologis.
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Aktor</th>
                        <th className="py-3 px-4">Tindakan</th>
                        <th className="py-3 px-4">Rincian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 font-mono">
                          <td className="py-2.5 px-4 text-slate-400 text-[11px]">{log.createdAt}</td>
                          <td className="py-2.5 px-4 font-bold text-amber-600">{log.actor}</td>
                          <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">{log.action}</td>
                          <td className="py-2.5 px-4 text-slate-500 max-w-sm truncate">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 10: RESET & KELOLA SKOR LEADERBOARD */}
              {activeTab === 'leaderboard' && (
                <div className="space-y-5">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Total Skor Tercatat</div>
                        <div className="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono mt-0.5">{activeLeaderboardList.length}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold">
                        <Trophy className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Skor Tertinggi</div>
                        <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200 font-mono mt-0.5">
                          {activeLeaderboardList.length > 0 ? Math.max(...activeLeaderboardList.map(l => l.score)) : 0}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
                        <Flame className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Total XP Diberikan</div>
                        <div className="text-2xl font-black text-purple-900 dark:text-purple-200 font-mono mt-0.5">
                          {activeLeaderboardList.reduce((acc, l) => acc + l.xpEarned, 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center font-bold">
                        <Award className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Actions & Filters Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2 flex-grow max-w-lg">
                      <div className="relative flex-grow min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={leaderboardSearch}
                          onChange={(e) => setLeaderboardSearch(e.target.value)}
                          placeholder="Cari nama siswa, sekolah, atau game..."
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <select
                        value={selectedLeaderboardGame}
                        onChange={(e) => setSelectedLeaderboardGame(e.target.value)}
                        aria-label="Filter Permainan Skor"
                        className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      >
                        <option value="all">Semua Permainan Aktif ({resettableGameNames.length})</option>
                        {resettableGameNames.map(gt => (
                          <option key={gt} value={gt}>{gt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedLeaderboardGame !== 'all' && (
                        <button
                          onClick={() => handleOpenResetScoresModal(selectedLeaderboardGame)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                          title={`Reset skor hanya untuk game: ${selectedLeaderboardGame}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Skor Game Ini</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenResetScoresModal(null)}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                        title="Reset seluruh skor leaderboard menjadi kosong"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Reset Total Semua Skor</span>
                      </button>
                    </div>
                  </div>

                  {/* Leaderboard Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto max-h-[480px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400 z-10">
                          <tr>
                            <th className="py-3 px-4"># Rank</th>
                            <th className="py-3 px-4">Siswa / Pemain</th>
                            <th className="py-3 px-4">Sekolah / Asal</th>
                            <th className="py-3 px-4">Permainan</th>
                            <th className="py-3 px-4">Skor</th>
                            <th className="py-3 px-4">XP</th>
                            <th className="py-3 px-4">Tanggal</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {activeLeaderboardList
                            .filter(l => {
                              const matchGame = selectedLeaderboardGame === 'all' || l.gameTitle === selectedLeaderboardGame;
                              const matchSearch = !leaderboardSearch || 
                                l.userName.toLowerCase().includes(leaderboardSearch.toLowerCase()) ||
                                (l.school || '').toLowerCase().includes(leaderboardSearch.toLowerCase()) ||
                                l.gameTitle.toLowerCase().includes(leaderboardSearch.toLowerCase());
                              return matchGame && matchSearch;
                            })
                            .map((l, index) => (
                              <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                <td className="py-3 px-4 font-mono font-bold text-amber-600">
                                  {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={l.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(l.userName)}`}
                                      alt={l.userName}
                                      className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0"
                                    />
                                    <div>
                                      <div className="font-bold text-slate-900 dark:text-white leading-tight">{l.userName}</div>
                                      <div className="text-[10px] text-amber-600 font-semibold">{l.badge}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                  {l.school || 'Umum / Mandiri'}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                  {l.gameTitle}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-amber-600">
                                  {l.score.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-purple-600">
                                  +{l.xpEarned}
                                </td>
                                <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">
                                  {l.createdAt}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => setConfirmDeleteModal({
                                      type: 'score',
                                      id: l.id,
                                      title: 'Hapus Entri Skor',
                                      description: `Yakin ingin menghapus skor ${l.score} milik ${l.userName} pada game "${l.gameTitle}"?`
                                    })}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                    title="Hapus skor ini"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          {activeLeaderboardList.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400">
                                Belum ada skor yang tercatat untuk permainan aktif saat ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 11: STATISTIK & LOG AKSES PENGGUNA LENGKAP */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                  {/* Header & Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-amber-500" />
                          <span>Pemantauan & Statistik Akses Pengguna Real-Time</span>
                        </h4>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live Sinkron Otomatis (Log Real)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Memantau secara langsung setiap pemain real (login maupun tamu), perangkat (HP/tablet/PC), IP address, negara, browser, dan penyelesaian game aktif.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={loadAnalytics}
                        disabled={isLoadingAnalytics}
                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        title="Segarkan data statistik"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? 'animate-spin' : ''}`} />
                        <span>Segarkan</span>
                      </button>

                      <button
                        onClick={handlePruneDummyLogs}
                        disabled={isLoadingAnalytics}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                        title="Bersihkan log uji/dummy dan pertahankan log pengguna real"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Bersihkan Log Dummy</span>
                      </button>

                      <button
                        onClick={handleExportLogsCSV}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                        title="Unduh log akses ke file spreadsheet CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Ekspor CSV</span>
                      </button>

                      <button
                        onClick={() => {
                          setClearLogsPassword('');
                          setClearLogsError(null);
                          setIsClearLogsModalOpen(true);
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                        title="Bersihkan seluruh log akses pengguna"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Reset Semua Log</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1">
                        <span>Total Akses Game</span>
                        <Flame className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                        {accessStats?.totalAccess || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Sesi bermain tercatat</div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1">
                        <span>Pengunjung Unik (IP)</span>
                        <Globe className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                        {accessStats?.uniqueIps || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Alamat IP unik berbeda</div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1">
                        <span>Tamu vs Member</span>
                        <Users className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                        {accessStats?.guestUsersCount || 0} <span className="text-xs font-normal text-slate-400">/ {accessStats?.registeredUsersCount || 0}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Tamu : Terdaftar</div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase mb-1">
                        <span>Tamat / Selesai</span>
                        <Trophy className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {accessStats?.completedGamesCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {accessStats?.totalAccess ? Math.round(((accessStats.completedGamesCount || 0) / accessStats.totalAccess) * 100) : 0}% tingkat penyelesaian
                      </div>
                    </div>
                  </div>

                  {/* Device, OS, Browser, and Country Distributions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Device distribution */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                      <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-amber-500" />
                        <span>Sebaran Perangkat</span>
                      </h5>
                      {(() => {
                        const m = accessStats?.devices?.mobile || 0;
                        const t = accessStats?.devices?.tablet || 0;
                        const d = accessStats?.devices?.desktop || 0;
                        const total = m + t + d || 1;
                        return (
                          <div className="space-y-2.5 text-xs">
                            <div>
                              <div className="flex justify-between text-[11px] mb-1 font-medium">
                                <span className="flex items-center gap-1"><Smartphone className="w-3 h-3 text-amber-500" /> Ponsel (HP)</span>
                                <span className="font-mono font-bold">{m} ({Math.round((m / total) * 100)}%)</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(m / total) * 100}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] mb-1 font-medium">
                                <span className="flex items-center gap-1"><Tablet className="w-3 h-3 text-blue-500" /> Tablet</span>
                                <span className="font-mono font-bold">{t} ({Math.round((t / total) * 100)}%)</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(t / total) * 100}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[11px] mb-1 font-medium">
                                <span className="flex items-center gap-1"><Monitor className="w-3 h-3 text-purple-500" /> Desktop PC</span>
                                <span className="font-mono font-bold">{d} ({Math.round((d / total) * 100)}%)</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(d / total) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Top Operating Systems & Browsers */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                      <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Monitor className="w-4 h-4 text-blue-500" />
                        <span>Browser & Sistem Operasi</span>
                      </h5>
                      <div className="space-y-1.5 text-xs">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Browser:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {accessStats?.browsers && accessStats.browsers.length > 0 ? (
                            accessStats.browsers.map(b => (
                              <span key={b.name} className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                {b.name}: <strong className="text-amber-600">{b.count}</strong>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400">Belum ada data</span>
                          )}
                        </div>

                        <div className="text-[10px] font-bold uppercase text-slate-400 pt-2">Sistem Operasi:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {accessStats?.operatingSystems && accessStats.operatingSystems.length > 0 ? (
                            accessStats.operatingSystems.map(o => (
                              <span key={o.name} className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                {o.name}: <strong className="text-blue-600">{o.count}</strong>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400">Belum ada data</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Top Countries & Games */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                      <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-emerald-500" />
                        <span>Negara & Game Populer</span>
                      </h5>
                      <div className="space-y-1.5 text-xs">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Negara:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {accessStats?.countries && accessStats.countries.length > 0 ? (
                            accessStats.countries.map(c => (
                              <span key={c.name} className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium border border-emerald-200 dark:border-emerald-900/40">
                                {resolveCountryFlagEmoji(c.code, c.name)} {c.name}: <strong>{c.count}</strong>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400">Belum ada data</span>
                          )}
                        </div>

                        <div className="text-[10px] font-bold uppercase text-slate-400 pt-2">Game Terpopuler:</div>
                        <div className="space-y-1">
                          {accessStats?.topGames && accessStats.topGames.slice(0, 3).map(g => (
                            <div key={g.title} className="flex justify-between items-center text-[11px]">
                              <span className="truncate max-w-[180px] text-slate-700 dark:text-slate-300">{g.title}</span>
                              <span className="font-mono font-bold text-amber-600 shrink-0">{g.count}x</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filterable Detailed Access Log Table */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h5 className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                        Riwayat Log Akses Terperinci ({accessLogs.length} Entri Terbaru)
                      </h5>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={logSearchQuery}
                            onChange={(e) => setLogSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') loadAnalytics(); }}
                            placeholder="Cari IP, nama, game, atau negara..."
                            className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 w-52 sm:w-64"
                          />
                        </div>

                        <select
                          value={logDeviceFilter}
                          onChange={(e) => setLogDeviceFilter(e.target.value)}
                          className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                        >
                          <option value="">Semua Perangkat</option>
                          <option value="Ponsel">Ponsel (HP)</option>
                          <option value="Tablet">Tablet</option>
                          <option value="Desktop">Desktop PC</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400 z-10">
                            <tr>
                              <th className="py-3 px-3">Waktu</th>
                              <th className="py-3 px-3">Pengguna</th>
                              <th className="py-3 px-3">Permainan</th>
                              <th className="py-3 px-3">IP Address</th>
                              <th className="py-3 px-3">Negara / Kota</th>
                              <th className="py-3 px-3">Perangkat</th>
                              <th className="py-3 px-3">OS & Browser</th>
                              <th className="py-3 px-3">Resolusi</th>
                              <th className="py-3 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {accessLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 font-mono text-[11px]">
                                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                                  {log.createdAt.replace('T', ' ').slice(0, 19)}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <span className="font-bold text-slate-900 dark:text-white">{log.userName}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                                      log.userRole === 'admin'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                        : log.userRole === 'uploader'
                                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'
                                        : log.userRole === 'user'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                      {log.userRole}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap max-w-[180px] truncate" title={log.gameTitle}>
                                  {log.gameTitle}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-amber-600 whitespace-nowrap">
                                  {log.ipAddress}
                                </td>
                                <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {log.country} {log.city && log.city !== 'Online' && log.city !== 'Nusantara' ? `(${log.city})` : ''}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 font-sans font-semibold ${
                                    log.deviceType.includes('Ponsel')
                                      ? 'text-amber-600'
                                      : log.deviceType.includes('Tablet')
                                      ? 'text-blue-600'
                                      : 'text-purple-600'
                                  }`}>
                                    {log.deviceType.includes('Ponsel') ? <Smartphone className="w-3 h-3" /> : log.deviceType.includes('Tablet') ? <Tablet className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                                    {log.deviceType}
                                  </span>
                                  {log.deviceModel && <div className="text-[10px] text-slate-400 font-normal">{log.deviceModel}</div>}
                                </td>
                                <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  <div>{log.browser}</div>
                                  <div className="text-[10px] text-slate-400">{log.os}</div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                                  {log.screenResolution || '-'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {log.completed ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                                      <Check className="w-3 h-3" /> Selesai ({log.durationSeconds}s)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                      Main ({log.durationSeconds}s)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {accessLogs.length === 0 && (
                              <tr>
                                <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                                  Belum ada rekaman log akses permainan pengguna.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 11: BACKUP & RESTORE */}
              {activeTab === 'backup' && (
                <div className="space-y-6">
                  {/* Section 0: Baseline Data Protection & Published Sync */}
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900/60 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Perlindungan Baseline Data Terpublish</span>
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            baselineStatus?.protected
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {baselineStatus?.protected ? 'Perlindungan Baseline Aktif' : 'Memeriksa Baseline...'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                            <span>Sinkron Otomatis Setiap 1 Menit (Aktif)</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800">
                            <Globe className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Baseline Dinamis &amp; Berkembang (Rev #{baselineStatus?.baselineRevision ?? 1})</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
                          Data baseline bersifat <strong>dinamis dan terus berkembang otomatis</strong> mengikuti setiap akses pengguna dari seluruh dunia, penambahan sesi permainan, pencatatan skor baru, serta pembaruan atau unggahan game baru—tersinkron otomatis setiap <strong>1 menit</strong> dan setiap ada perubahan data.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSyncBaselineNow}
                          disabled={isSyncingBaselineNow}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition shadow-sm disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBaselineNow ? 'animate-spin' : ''}`} />
                          <span>{isSyncingBaselineNow ? 'Menyinkronkan...' : 'Sinkronkan Baseline Sekarang'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={loadBackupSnapshots}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/60 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 cursor-pointer transition"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Perbarui Status</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Game Aktif</div>
                        <div className="text-base font-black text-amber-600 font-mono">{baselineStatus?.counts.games ?? games.length}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Total Main</div>
                        <div className="text-base font-black text-rose-600 font-mono">{baselineStatus?.growthMetrics?.totalGamePlays ?? totalGamePlayers}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Kategori</div>
                        <div className="text-base font-black text-emerald-600 font-mono">{baselineStatus?.counts.categories ?? categories.length}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Pengguna</div>
                        <div className="text-base font-black text-indigo-600 font-mono">{baselineStatus?.counts.users ?? '-'}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Skor</div>
                        <div className="text-base font-black text-orange-600 font-mono">{baselineStatus?.counts.leaderboard ?? '-'}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Testimoni</div>
                        <div className="text-base font-black text-purple-600 font-mono">{baselineStatus?.counts.testimonials ?? testimonials.length}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Log Akses</div>
                        <div className="text-base font-black text-slate-700 dark:text-slate-200 font-mono">{baselineStatus?.counts.accessLogs ?? '-'}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Negara / IP</div>
                        <div className="text-base font-black text-teal-600 font-mono">
                          {baselineStatus?.growthMetrics?.uniqueCountries ?? 1} / {baselineStatus?.growthMetrics?.uniqueIps ?? 2}
                        </div>
                      </div>
                    </div>

                    {/* Worldwide Reach & Latest Baseline Evolution Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700 dark:text-slate-200 bg-emerald-100/60 dark:bg-emerald-900/30 px-3.5 py-2 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">🌏 Jangkauan Akses Dunia:</span>
                        {baselineStatus?.growthMetrics?.countriesList && baselineStatus.growthMetrics.countriesList.length > 0 ? (
                          baselineStatus.growthMetrics.countriesList.map((c) => (
                            <span
                              key={`${c.code}-${c.name}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 text-[10px] font-bold"
                            >
                              <span>{resolveCountryFlagEmoji(c.code, c.name)}</span>
                              <span>{c.name}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono">({c.count})</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-semibold">🇮🇩 Indonesia</span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold">Perkembangan Terakhir:</span>{' '}
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          {baselineStatus?.lastGrowthReason || 'Baseline Berkembang Sesuai Akses & Pembaruan Game'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 px-3.5 py-2.5 rounded-2xl border border-emerald-100 dark:border-slate-800">
                      <div>
                        <span className="font-semibold">Snapshot Baseline Terbaru:</span>{' '}
                        <span className="font-mono text-emerald-700 dark:text-emerald-300">
                          {baselineStatus?.latestBaselineSnapshot?.filename || 'Otomatis dibuat saat ada data terekam'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <span className="font-semibold">Interval:</span>{' '}
                          <span className="font-mono text-sky-700 dark:text-sky-300 font-bold">
                            Setiap 1 Menit ({baselineStatus?.autoSyncIntervalSeconds ?? 60} Detik)
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold">Terakhir Sinkron:</span>{' '}
                          <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                            {baselineStatus?.lastAutoSyncAt
                              ? new Date(baselineStatus.lastAutoSyncAt).toLocaleTimeString('id-ID')
                              : 'Baru saja'}
                          </span>
                        </div>
                        <div className="px-2 py-0.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-mono font-bold">
                          Sinkron Berikutnya: {baselineCountdownSec} dtk
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSyncFromPublishedUrl} className="pt-1 space-y-2">
                      <label htmlFor="published-sync-url" className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                        Tarik &amp; Gabungkan Data dari Website Terpublish (Mode Aman / Tanpa Menghapus Data Lokal)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-grow">
                          <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="published-sync-url"
                            type="url"
                            value={publishedSyncUrl}
                            onChange={(e) => setPublishedSyncUrl(e.target.value)}
                            placeholder="https://ais-pre-xxxx.run.app"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSyncingPublished || !publishedSyncUrl.trim()}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPublished ? 'animate-spin' : ''}`} />
                          <span>{isSyncingPublished ? 'Menarik Data...' : 'Tarik & Gabungkan Data'}</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Jika URL terpublish dilindungi login browser, unduh berkas <code className="font-mono">.json</code> atau <code className="font-mono">.db</code> dari Admin Hub website terpublish lalu impor di Bagian Import dengan <strong>Mode Gabungkan (Merge — Aman)</strong>.
                      </p>
                    </form>
                  </div>

                  {/* Section 1: Export Backup */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <Download className="w-4 h-4 text-emerald-500" />
                          <span>Export Backup Database & Konten Lengkap</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-2xl">
                          Unduh cadangan seluruh game (termasuk kode HTML5, thumbnail gambar, dan ikon), kategori pembelajaran, pengaturan banner/logo, sertifikat, testimoni, lisensi, dan leaderboard.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBackupBusy}
                          onClick={handleDownloadBackupJson}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <FileJson className="w-4 h-4" />
                          <span>Unduh Backup JSON</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBackupBusy}
                          onClick={handleDownloadBackupDb}
                          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <Database className="w-4 h-4" />
                          <span>Unduh File SQLite (.db)</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBackupBusy}
                          onClick={handleCreateServerSnapshot}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold shadow flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <HardDrive className="w-4 h-4" />
                          <span>Buat Snapshot Server</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Permainan</div>
                        <div className="text-lg font-black text-amber-600 font-mono">{games.length}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Kategori</div>
                        <div className="text-lg font-black text-emerald-600 font-mono">{categories.length}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Sertifikat</div>
                        <div className="text-lg font-black text-sky-600 font-mono">{certificates.length}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Testimoni</div>
                        <div className="text-lg font-black text-purple-600 font-mono">{testimonials.length}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Lisensi</div>
                        <div className="text-lg font-black text-rose-600 font-mono">{licenses.length}</div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Import / Restore Backup */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <Upload className="w-4 h-4 text-amber-500" />
                        <span>Import & Pulihkan Backup (.json atau .db)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Unggah berkas hasil Export Backup (`.json` / `.db`) atau tempel data JSON langsung (termasuk JSON dari `/api/v1/games`). Setiap impor otomatis membuat snapshot pengaman di server terlebih dahulu.
                      </p>
                    </div>

                    {/* Import Mode Toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBackupImportMode('merge')}
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                          backupImportMode === 'merge'
                            ? 'bg-emerald-500/10 border-emerald-500/50 ring-2 ring-emerald-500/20'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Mode Gabungkan (Merge — Aman)
                          </span>
                          {backupImportMode === 'merge' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Menambahkan data baru dan memperbarui game/kategori/sertifikat yang cocok tanpa menghapus data lokal yang sudah ada.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBackupImportMode('replace')}
                        className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                          backupImportMode === 'replace'
                            ? 'bg-rose-500/10 border-rose-500/50 ring-2 ring-rose-500/20'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Mode Ganti Total (Replace)
                          </span>
                          {backupImportMode === 'replace' && (
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Mengganti seluruh katalog game, kategori, sertifikat, testimoni, lisensi, & skor dengan isi file backup (cadangan otomatis dibuat).
                        </p>
                      </button>
                    </div>

                    {/* File Picker */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                      <label htmlFor="backup-import-file" className="block text-[11px] font-bold uppercase text-slate-500">
                        Pilih File Backup (.json atau .db)
                      </label>
                      <input
                        id="backup-import-file"
                        type="file"
                        accept=".json,.db,.sqlite,.sqlite3"
                        onChange={handleBackupFileSelect}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                      />
                      {backupFileName && (
                        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          File terpilih: <span className="font-mono">{backupFileName}</span> ({backupInputKind === 'db' ? 'SQLite .db' : 'JSON'})
                        </div>
                      )}
                    </div>

                    {/* Paste JSON Textarea */}
                    <div>
                      <label htmlFor="backup-json-textarea" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Atau Tempel Teks JSON Backup / Data `/api/v1/games` di Sini
                      </label>
                      <textarea
                        id="backup-json-textarea"
                        rows={5}
                        value={backupJsonText}
                        onChange={(e) => handleBackupJsonTextChange(e.target.value)}
                        placeholder='Tempel isi JSON backup (mis. {"version":"1.0","data":{"games":[...]}}) atau array game dari /api/v1/games...'
                        className="w-full p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-0 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {/* Parse Error Feedback */}
                    {backupParseError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{backupParseError}</span>
                      </div>
                    )}

                    {/* Live Preview Summary */}
                    {backupPreviewSummary && !backupParseError && (
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>Pratinjau Data Backup Siap Diimpor:</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200">
                            {backupPreviewSummary.games} Game
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200">
                            {backupPreviewSummary.categories} Kategori
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200">
                            {backupPreviewSummary.siteSettings} Pengaturan
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200">
                            {backupPreviewSummary.certificates} Sertifikat
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200">
                            {backupPreviewSummary.leaderboard} Skor
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      {(backupJsonText || backupDbBase64 || backupFileName) && (
                        <button
                          type="button"
                          onClick={() => {
                            setBackupJsonText('');
                            setBackupDbBase64('');
                            setBackupFileName('');
                            setBackupPreviewSummary(null);
                            setBackupParseError(null);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        >
                          Bersihkan Input
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBackupBusy || (!backupJsonText.trim() && !backupDbBase64) || Boolean(backupParseError)}
                        onClick={handleTriggerImportBackup}
                        className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          backupImportMode === 'replace'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {isBackupBusy
                            ? 'Memproses Backup...'
                            : backupImportMode === 'replace'
                            ? 'Jalankan Restore (Ganti Total)'
                            : 'Jalankan Import (Gabungkan)'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Saved Server Snapshots */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <h4 className="font-heading font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <HardDrive className="w-4 h-4 text-amber-500" />
                          <span>Snapshot Database Tersimpan di Server ({backupSnapshots.length})</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Arsip berkas SQLite `.db` otomatis maupun manual di folder <code className="font-mono">data/backups/</code>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={loadBackupSnapshots}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Segarkan</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-400">
                            <th className="py-3 px-4">Nama Berkas Snapshot</th>
                            <th className="py-3 px-4">Ukuran</th>
                            <th className="py-3 px-4">Waktu Tersimpan</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {backupSnapshots.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                                Belum ada file snapshot `.db` di server. Klik "Buat Snapshot Server" di atas.
                              </td>
                            </tr>
                          ) : (
                            backupSnapshots.map((snap) => (
                              <tr key={snap.filename} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-100">
                                  {snap.filename}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                                  {(snap.sizeBytes / 1024).toFixed(1)} KB
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                                  {new Date(snap.createdAt).toLocaleString('id-ID')}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <a
                                      href={api.getSnapshotDownloadUrl(snap.filename)}
                                      download={snap.filename}
                                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 transition"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Unduh</span>
                                    </a>
                                    <button
                                      type="button"
                                      disabled={isBackupBusy}
                                      onClick={() => handleTriggerRestoreSnapshot(snap.filename, 'merge')}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer transition disabled:opacity-50"
                                    >
                                      Gabungkan
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBackupBusy}
                                      onClick={() => handleTriggerRestoreSnapshot(snap.filename, 'replace')}
                                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer transition disabled:opacity-50"
                                    >
                                      Pulihkan Penuh
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Password-protected Reset Total Permainan Modal */}
        {isResetPlaysModalOpen && (
          <div className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Konfirmasi Reset Total Permainan
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Otorisasi Administrator Diperlukan
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Tindakan ini akan mengembalikan counter jumlah pemain seluruh game di database ke angka 0. Masukkan kata sandi administrator untuk melanjutkan:
              </p>

              <form onSubmit={handleConfirmResetPlays} className="space-y-3">
                <div>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    placeholder="Masukkan kata sandi admin..."
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                {resetPasswordError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{resetPasswordError}</span>
                  </div>
                )}

                {resetSuccessMessage && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{resetSuccessMessage}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetPlaysModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Total Permainan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Password-protected Reset Skor Leaderboard Modal */}
        {isResetScoresModalOpen && (
          <div className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Konfirmasi Reset Skor Papan Peringkat
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {resetScoresGameTitle ? `Target: Game "${resetScoresGameTitle}"` : 'Target: Seluruh Skor Leaderboard'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {resetScoresGameTitle
                  ? `Tindakan ini akan menghapus semua skor pemain untuk permainan "${resetScoresGameTitle}". Masukkan kata sandi admin untuk mengonfirmasi:`
                  : 'Tindakan ini akan menghapus SELURUH skor yang tercatat di papan peringkat nasional. Masukkan kata sandi admin untuk melanjutkan:'}
              </p>

              <form onSubmit={handleConfirmResetScores} className="space-y-3">
                <div>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={resetScoresPassword}
                    onChange={(e) => setResetScoresPassword(e.target.value)}
                    placeholder="Masukkan kata sandi admin..."
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                {resetScoresError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{resetScoresError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResetScoresModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Skor Sekarang</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Password-protected Clear Access Logs Modal */}
        {isClearLogsModalOpen && (
          <div className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Konfirmasi Bersihkan Log Akses Pengguna
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Otorisasi Administrator Diperlukan
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Tindakan ini akan menghapus seluruh rekaman riwayat log akses game, IP address, dan perangkat dari database. Masukkan kata sandi administrator:
              </p>

              <form onSubmit={handleConfirmClearLogs} className="space-y-3">
                <div>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={clearLogsPassword}
                    onChange={(e) => setClearLogsPassword(e.target.value)}
                    placeholder="Masukkan kata sandi admin..."
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 dark:text-white font-mono"
                  />
                </div>

                {clearLogsError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{clearLogsError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsClearLogsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bersihkan Semua Log</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Unified In-Modal Confirm Delete Dialog */}
        {confirmDeleteModal && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    {confirmDeleteModal.title}
                  </h4>
                  <p className="text-[11px] text-slate-500">Konfirmasi Tindakan</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {confirmDeleteModal.description}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Non-blocking Confirm Replace Backup Modal */}
        {confirmReplaceAction && (
          <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Konfirmasi Restore Penuh
                  </h4>
                  <p className="text-[11px] text-slate-500">Mode Ganti Total (Replace)</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Seluruh data game, kategori, sertifikat, testimoni, lisensi, dan leaderboard saat ini akan diganti dengan isi dari <strong>{confirmReplaceAction.label}</strong>. Snapshot pengaman otomatis akan disimpan di server sebelum proses berjalan.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmReplaceAction(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReplaceAction}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Ya, Pulihkan Penuh</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-Modal Floating Toast */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] transition-all duration-200">
            <div
              className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-medium flex items-center gap-2 ${
                toastMessage.type === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
              }`}
            >
              {toastMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
