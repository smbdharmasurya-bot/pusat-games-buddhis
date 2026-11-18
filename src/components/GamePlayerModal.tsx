import React from 'react';
import { Game, UserProfile } from '../types';
import {
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  Trophy,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Smartphone,
  Tablet,
  Monitor,
  Eye,
  EyeOff,
  Check,
  Lock,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  playCorrectSound,
  playIncorrectSound,
  playCardFlipSound,
  playVictorySound,
  playBellSound,
} from '../utils/soundEffects';
import { calculateScoreAndXP } from '../utils/gameLogic';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { GameIconBadge } from './GameIconBadge';
import { resolveAutoCloseScore } from '../utils/scoreAutoSync';

interface GamePlayerModalProps {
  game: Game | null;
  onClose: () => void;
  onSubmitScore: (
    gameTitle: string,
    score: number,
    xpEarned: number,
    isCompleted?: boolean,
    accessLogId?: number,
    gameId?: number
  ) => Promise<void>;
  playerName: string;
  currentUser?: UserProfile | null;
}

type DeviceMode = 'full' | 'mobile' | 'tablet';

/**
 * Enhanced portable HTML5 preprocessor:
 * 1. Guarantees mobile/tablet/desktop responsive viewport & CSS resets.
 * 2. Injects safe in-memory fallback for localStorage & sessionStorage to avoid sandboxed DOMExceptions.
 * 3. Auto-unlocks Web AudioContext on first user interaction so game loops never freeze.
 * 4. Enables touch and pointer interoperability.
 */
function preparePortableHtml(rawCode: string, gameTitle: string): string {
  if (!rawCode || !rawCode.trim()) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
  <title>${gameTitle}</title>
  <style>
    body { background: #0f172a; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    h3 { color: #f59e0b; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div>
    <h3>Game Portable Siap Dimainkan</h3>
    <p>Silakan upload file game HTML5 melalui Admin Hub.</p>
  </div>
</body>
</html>`;
  }

  let code = rawCode.trim();

  // If raw javascript without html tags, wrap in standard HTML5 canvas container
  if (!code.includes('<html') && !code.includes('<!DOCTYPE') && !code.includes('<body') && !code.includes('<script')) {
    code = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
  <title>${gameTitle}</title>
  <style>
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; margin: 0 auto; max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
${code}
  </script>
</body>
</html>`;
  }

  // Inject responsive viewport if not present
  if (!code.includes('name="viewport"') && !code.includes("name='viewport'")) {
    if (code.includes('<head>')) {
      code = code.replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">');
    } else if (code.includes('<head ')) {
      code = code.replace(/<head[^>]*>/, '$&\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">');
    }
  }

  // Universal CSS reset and responsive canvas scaler
  const responsiveStyle = `
  <style id="portal-game-responsive-injector">
    html, body {
      width: 100% !important;
      min-height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      -webkit-text-size-adjust: 100%;
      touch-action: manipulation;
    }
    *, *::before, *::after {
      box-sizing: inherit;
    }
    /* Auto-scale canvases to responsive container width */
    canvas {
      max-width: 100% !important;
      height: auto;
      touch-action: none;
    }
    /* Ensure scrollable bodies work cleanly on touch */
    body {
      overflow-x: hidden;
    }
  </style>
`;

  // Runtime polyfill: safe localStorage, alert/confirm fallback, AudioContext auto-unlock
  const runtimePolyfill = `
  <script id="portal-game-runtime-enhancer">
    (function() {
      // 1. Safe localStorage & sessionStorage fallback so sandboxed storage never crashes game
      try {
        var testKey = '__portal_test_store__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
      } catch (e) {
        console.warn('[PortalGame] Sandboxed storage detected - activating resilient in-memory storage fallback.');
        var memStorage = {};
        var storagePolyfill = {
          getItem: function(key) { return Object.prototype.hasOwnProperty.call(memStorage, key) ? memStorage[key] : null; },
          setItem: function(key, val) { memStorage[key] = String(val); },
          removeItem: function(key) { delete memStorage[key]; },
          clear: function() { memStorage = {}; },
          key: function(idx) { return Object.keys(memStorage)[idx] || null; },
          get length() { return Object.keys(memStorage).length; }
        };
        try { Object.defineProperty(window, 'localStorage', { value: storagePolyfill, configurable: true, writable: true }); } catch(_) {}
        try { Object.defineProperty(window, 'sessionStorage', { value: storagePolyfill, configurable: true, writable: true }); } catch(_) {}
      }

      // 2. AudioContext auto-unlock on first user interaction
      function unlockAudio() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC && window.__portalAudioContexts) {
          window.__portalAudioContexts.forEach(function(ctx) {
            if (ctx && ctx.state === 'suspended') {
              ctx.resume();
            }
          });
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      }
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });

      // 3. Smart completion observer, live score reader & postMessage bridge
      (function() {
        var hasReportedCompletion = false;
        var lastLiveScoreSent = 0;

        function readLiveDomScore(rootEl) {
          var scope = rootEl || document;
          var scoreSelectors = [
            '#result-final-score', '#final-score', '.final-score',
            '#score', '.score', '[data-score]', '[id*="score"]', '[class*="score"]'
          ];
          for (var s = 0; s < scoreSelectors.length; s++) {
            var els = scope.querySelectorAll(scoreSelectors[s]);
            for (var j = 0; j < els.length; j++) {
              var candidate = els[j];
              var rawAttr = candidate.getAttribute && candidate.getAttribute('data-score');
              var rawText = rawAttr || candidate.innerText || candidate.textContent || '';
              var trimmed = String(rawText).trim();
              if (!trimmed || trimmed.length > 40) continue;
              var parsed = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(parsed) && parsed > 0 && parsed <= 1000000) {
                return parsed;
              }
            }
          }
          return 0;
        }

        function scanLiveScore() {
          var liveScore = readLiveDomScore(document);
          if (liveScore > 0 && liveScore !== lastLiveScoreSent) {
            lastLiveScoreSent = liveScore;
            try {
              window.parent.postMessage({
                type: 'PORTAL_GAME_SCORE_LIVE',
                score: liveScore
              }, '*');
            } catch(e) {}
          }
        }

        function scanForGameCompletion() {
          scanLiveScore();
          if (hasReportedCompletion) return;
          var selectors = [
            '#screen-result', '.screen-result', '#game-over', '.game-over',
            '#result-screen', '#hasil', '.hasil-kuis', '#summary-screen',
            '#screen-finish', '.screen-finish', '#game-complete', '.game-complete'
          ];
          for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) {
              var isHidden = el.classList.contains('hidden') || el.style.display === 'none' || el.style.visibility === 'hidden';
              if (!isHidden) {
                var detected = readLiveDomScore(el) || readLiveDomScore(document);
                var finalScore = detected > 0 ? detected : 500;
                hasReportedCompletion = true;
                try {
                  window.parent.postMessage({
                    type: 'PORTAL_GAME_COMPLETED',
                    score: finalScore,
                    finished: true,
                    selector: selectors[i]
                  }, '*');
                } catch(e) {}
                return;
              }
            }
          }
        }

        var domObserver = new MutationObserver(scanForGameCompletion);
        function initObservers() {
          if (document.body) {
            domObserver.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ['class', 'style', 'hidden', 'data-score'] });
          }
          scanForGameCompletion();
        }
        if (document.body) {
          initObservers();
        } else {
          document.addEventListener('DOMContentLoaded', initObservers);
        }
        window.addEventListener('load', scanForGameCompletion);
        setInterval(scanForGameCompletion, 500);
        window.addEventListener('beforeunload', scanLiveScore);

        window.addEventListener('message', function(ev) {
          if (ev && ev.data && (ev.data.type === 'portal_game_score' || ev.data.type === 'PORTAL_GAME_COMPLETED' || ev.data.type === 'PORTAL_GAME_SCORE_LIVE' || ev.data.finished)) {
            try {
              window.parent.postMessage(ev.data, '*');
            } catch(err) {}
          }
        });
      })();
    })();
  </script>
`;

  // Inject style and polyfill into <head> or at beginning of body
  if (code.includes('</head>')) {
    code = code.replace('</head>', `${responsiveStyle}\n${runtimePolyfill}\n</head>`);
  } else if (code.includes('<body')) {
    code = code.replace(/<body[^>]*>/, `$&\n${responsiveStyle}\n${runtimePolyfill}`);
  } else {
    code = `${responsiveStyle}\n${runtimePolyfill}\n${code}`;
  }

  return code;
}

export const GamePlayerModal: React.FC<GamePlayerModalProps> = ({
  game,
  onClose,
  onSubmitScore,
  playerName,
  currentUser,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [deviceMode, setDeviceMode] = React.useState<DeviceMode>('full');
  const [iframeKey, setIframeKey] = React.useState(0);
  const [isHudCollapsed, setIsHudCollapsed] = React.useState(false);
  const [portableScoreSaved, setPortableScoreSaved] = React.useState(false);
  const [portableGameCompleted, setPortableGameCompleted] = React.useState(false);
  const [playDurationSeconds, setPlayDurationSeconds] = React.useState(0);
  const [accessLogId, setAccessLogId] = React.useState<number | null>(null);
  const [completionNotice, setCompletionNotice] = React.useState<string | null>(null);
  const [customScoreInput, setCustomScoreInput] = React.useState<number>(500);
  const [showScoreInputModal, setShowScoreInputModal] = React.useState(false);

  const hasRecordedAutoScoreRef = React.useRef(false);
  const recordedGameSessionKeyRef = React.useRef<string>('');
  const latestPortableScoreRef = React.useRef(0);
  const liveSessionRef = React.useRef({
    game,
    score: 0,
    streak: 0,
    matchedPairs: 0,
    playDurationSeconds: 0,
    accessLogId: null as number | null,
    playerName,
  });

  // Track access log once per opened game session
  React.useEffect(() => {
    if (!game?.id) return;
    const sessionKey = `${game.id}::${currentUser?.id || playerName}`;
    if (recordedGameSessionKeyRef.current === sessionKey) {
      return;
    }
    recordedGameSessionKeyRef.current = sessionKey;

    let isMounted = true;
    const resolvedName = currentUser?.name || playerName || 'Tamu Dharma';
    const resolvedRole = currentUser?.role || (currentUser?.id ? 'user' : 'tamu');

    api.recordGameAccess({
      gameId: game.id,
      gameTitle: game.title,
      gameCategory: game.category,
      user: {
        id: currentUser?.id,
        name: resolvedName,
        role: resolvedRole,
      },
      clientInfo: {
        screen: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }).then((res) => {
      if (isMounted && res?.logId) {
        setAccessLogId(res.logId);
      }
    }).catch((err) => {
      console.warn('Game access log failed:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [game?.id, game?.title, game?.category, playerName, currentUser?.id, currentUser?.name, currentUser?.role]);

  // Periodic heartbeat & duration counter
  React.useEffect(() => {
    const timer = setInterval(() => {
      setPlayDurationSeconds((prev) => {
        const next = prev + 1;
        if (accessLogId && next % 10 === 0) {
          api.updateGameHeartbeat(accessLogId, next, portableGameCompleted).catch(() => {});
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [accessLogId, portableGameCompleted]);

  // Quiz State
  const quizQuestions = React.useMemo(() => [
    {
      question: 'Siapakah nama Pangeran yang mencapai Penerangan Sempurna di bawah Pohon Bodhi?',
      options: ['Pangeran Siddhartha Gotama', 'Raja Asoka Yang Agung', 'Yang Mulia Sariputta', 'Rahula Kumara'],
      correctIndex: 0,
      explanation: 'Pangeran Siddhartha Gotama mencapai Kebuddhaan di Bodh Gaya setelah menempuh Jalan Tengah.',
    },
    {
      question: 'Apa arti dari ajaran Empat Kebenaran Mulia yang pertama (Dukkha)?',
      options: ['Kebenaran tentang Akhir dari Dukkha', 'Kebenaran tentang Adanya Penderitaan / Ketidakpuasan', 'Kebenaran tentang Jalan Berunsur Delapan', 'Kebenaran tentang Asal Mula Keinginan'],
      correctIndex: 1,
      explanation: 'Dukkha Sacca mengajarkan bahwa keberadaan hidup senantiasa diwarnai ketidakkekalan dan ketidakpuasan.',
    },
    {
      question: 'Manakah salah satu pilar dalam Jalan Mulia Berunsur Delapan?',
      options: ['Pandangan Benar (Samma Ditthi)', 'Kekayaan Melimpah', 'Kemenangan Perang', 'Pengasingan Total'],
      correctIndex: 0,
      explanation: 'Samma Ditthi (Pandangan Benar) merupakan langkah awal memahami realitas apa adanya.',
    },
  ], []);

  const [currentQIndex, setCurrentQIndex] = React.useState(0);
  const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
  const [streak, setStreak] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [quizFinished, setQuizFinished] = React.useState(false);
  const [scoreSubmitted, setScoreSubmitted] = React.useState(false);

  // Memory Card State
  const initialSymbols = ['🪷', '☸️', '🔔', '📜', '🕯️', '🍃'];
  const [cards, setCards] = React.useState<{ id: number; symbol: string; flipped: boolean; matched: boolean }[]>([]);
  const [flippedCards, setFlippedCards] = React.useState<number[]>([]);
  const [memoryMoves, setMemoryMoves] = React.useState(0);
  const [memoryFinished, setMemoryFinished] = React.useState(false);

  // Initialize Memory Cards
  const initMemoryGame = React.useCallback(() => {
    const deck = [...initialSymbols, ...initialSymbols]
      .sort(() => Math.random() - 0.5)
      .map((sym, idx) => ({ id: idx, symbol: sym, flipped: false, matched: false }));
    setCards(deck);
    setFlippedCards([]);
    setMemoryMoves(0);
    setMemoryFinished(false);
    setScoreSubmitted(false);
  }, []);

  React.useEffect(() => {
    hasRecordedAutoScoreRef.current = false;
    latestPortableScoreRef.current = 0;
    if (game?.type === 'memory') {
      initMemoryGame();
    } else {
      setCurrentQIndex(0);
      setSelectedOption(null);
      setStreak(0);
      setScore(0);
      setQuizFinished(false);
      setScoreSubmitted(false);
    }
    setPortableScoreSaved(false);
    setPortableGameCompleted(false);
    setPlayDurationSeconds(0);
  }, [game?.id, game?.type, initMemoryGame]);

  // Keep latest session metrics accessible to close/unload callbacks
  React.useEffect(() => {
    liveSessionRef.current = {
      game,
      score,
      streak,
      matchedPairs: cards.filter((c) => c.matched).length / 2,
      playDurationSeconds,
      accessLogId,
      playerName,
    };
  }, [game, score, streak, cards, playDurationSeconds, accessLogId, playerName]);

  // Listen to fullscreen changes
  React.useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Listen for message from iframe (live score sync & game completion)
  React.useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'PORTAL_GAME_SCORE_LIVE') {
        const liveVal = Number(event.data.score);
        if (!Number.isNaN(liveVal) && liveVal > 0) {
          const rounded = Math.round(liveVal);
          latestPortableScoreRef.current = rounded;
          setCustomScoreInput(rounded);
        }
        return;
      }

      if (event.data.type === 'portal_game_score' || event.data.type === 'PORTAL_GAME_COMPLETED') {
        const gameScore =
          typeof event.data.score === 'number' && event.data.score > 0
            ? Math.round(event.data.score)
            : latestPortableScoreRef.current > 0
            ? latestPortableScoreRef.current
            : 500;
        latestPortableScoreRef.current = gameScore;
        setCustomScoreInput(gameScore);
        setPortableGameCompleted(true);
        playVictorySound();
        confetti({ particleCount: 80, spread: 70 });

        if (!portableScoreSaved && !hasRecordedAutoScoreRef.current && game) {
          hasRecordedAutoScoreRef.current = true;
          setPortableScoreSaved(true);
          const xp = Math.max(1, Math.round(gameScore * 0.5));
          void onSubmitScore(game.title, gameScore, xp, true, accessLogId || undefined, game.id);
          if (accessLogId) {
            api.updateGameHeartbeat(accessLogId, playDurationSeconds, true).catch(() => {});
          }
          setCompletionNotice(`🎉 Luar biasa! Permainan berhasil diselesaikan dengan skor ${gameScore}. Skor telah dicatat otomatis ke Papan Peringkat!`);
        } else {
          setCompletionNotice(`🎉 Permainan diselesaikan dengan skor ${gameScore}.`);
        }
        setTimeout(() => setCompletionNotice(null), 8000);
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [game, portableScoreSaved, accessLogId, playDurationSeconds, onSubmitScore]);

  const handleCloseGame = React.useCallback(() => {
    const current = liveSessionRef.current;
    if (current.game && current.game.isActive !== false && !hasRecordedAutoScoreRef.current) {
      hasRecordedAutoScoreRef.current = true;
      const auto = resolveAutoCloseScore({
        gameType: current.game.type,
        difficulty: current.game.difficulty,
        quizScore: current.score,
        streak: current.streak,
        matchedPairs: current.matchedPairs,
        detectedPortableScore: latestPortableScoreRef.current,
        playDurationSeconds: current.playDurationSeconds,
      });
      void onSubmitScore(
        current.game.title,
        auto.score,
        auto.xp,
        true,
        current.accessLogId || undefined,
        current.game.id
      );
      if (current.accessLogId) {
        api.updateGameHeartbeat(current.accessLogId, current.playDurationSeconds, true).catch(() => {});
      }
    }
    onClose();
  }, [onClose, onSubmitScore]);

  // Close with Escape key (auto-records score)
  React.useEffect(() => {
    if (!game) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showScoreInputModal) {
        handleCloseGame();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game, showScoreInputModal, handleCloseGame]);

  // Auto-record score if browser tab closes unexpectedly while playing
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      const current = liveSessionRef.current;
      if (!current.game || current.game.isActive === false || hasRecordedAutoScoreRef.current) {
        return;
      }
      hasRecordedAutoScoreRef.current = true;
      const auto = resolveAutoCloseScore({
        gameType: current.game.type,
        difficulty: current.game.difficulty,
        quizScore: current.score,
        streak: current.streak,
        matchedPairs: current.matchedPairs,
        detectedPortableScore: latestPortableScoreRef.current,
        playDurationSeconds: current.playDurationSeconds,
      });

      let activeUser: { name?: string; email?: string; school?: string; avatar?: string } | null = null;
      try {
        const saved = localStorage.getItem('pgb_active_user');
        if (saved) activeUser = JSON.parse(saved);
      } catch {
        // ignore storage error
      }

      const pName = activeUser?.name || 'Tamu Dharma';
      const payload = JSON.stringify({
        userName: pName,
        userEmail: activeUser?.email || undefined,
        gameId: current.game.id,
        gameTitle: current.game.title,
        score: auto.score,
        xpEarned: auto.xp,
        school: activeUser?.school || (activeUser ? 'Sekolah Dharma' : 'Tamu (Tanpa Login)'),
        avatar: activeUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(pName)}`,
        isCompleted: true,
        accessLogId: current.accessLogId || undefined,
      });

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/v1/leaderboard', new Blob([payload], { type: 'application/json' }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const toggleFullscreen = () => {
    const el = document.getElementById('game-player-wrapper');
    if (!document.fullscreenElement && el) {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleReloadGame = () => {
    setIframeKey((k) => k + 1);
    setPortableScoreSaved(false);
    setPortableGameCompleted(false);
    latestPortableScoreRef.current = 0;
    hasRecordedAutoScoreRef.current = false;
  };

  // Handle Quiz Option Selection
  const handleSelectQuizOption = (optIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optIndex);

    const isCorrect = optIndex === quizQuestions[currentQIndex].correctIndex;
    if (isCorrect) {
      playCorrectSound();
      setStreak((s) => s + 1);
      setScore((sc) => sc + 100 + (streak + 1) * 20);
    } else {
      playIncorrectSound();
      setStreak(0);
    }
  };

  const handleNextQuestion = () => {
    if (currentQIndex + 1 < quizQuestions.length) {
      setCurrentQIndex((idx) => idx + 1);
      setSelectedOption(null);
    } else {
      setQuizFinished(true);
      playVictorySound();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }
  };

  // Handle Memory Card Click
  const handleCardClick = (id: number) => {
    if (flippedCards.length === 2 || cards[id].flipped || cards[id].matched) return;
    playCardFlipSound();

    const newCards = [...cards];
    newCards[id].flipped = true;
    setCards(newCards);

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMemoryMoves((m) => m + 1);
      const [firstId, secondId] = newFlipped;
      if (cards[firstId].symbol === cards[secondId].symbol) {
        // Matched!
        setTimeout(() => {
          playCorrectSound();
          newCards[firstId].matched = true;
          newCards[secondId].matched = true;
          setCards([...newCards]);
          setFlippedCards([]);

          // Check if all matched
          if (newCards.every((c) => c.matched)) {
            setMemoryFinished(true);
            playVictorySound();
            confetti({ particleCount: 90, spread: 70 });
          }
        }, 500);
      } else {
        // Not matched
        setTimeout(() => {
          newCards[firstId].flipped = false;
          newCards[secondId].flipped = false;
          setCards([...newCards]);
          setFlippedCards([]);
        }, 900);
      }
    }
  };

  const calculatedResult = calculateScoreAndXP(
    game?.type === 'memory' ? Math.max(100, 400 - memoryMoves * 15) : score,
    game?.difficulty || 'Mudah',
    streak
  );

  const handleSaveToLeaderboard = React.useCallback(async () => {
    if (!game || hasRecordedAutoScoreRef.current) return;
    hasRecordedAutoScoreRef.current = true;
    setScoreSubmitted(true);
    await onSubmitScore(game.title, calculatedResult.score, calculatedResult.xp, true, accessLogId || undefined, game.id);
    if (accessLogId) {
      api.updateGameHeartbeat(accessLogId, playDurationSeconds, true).catch(() => {});
    }
    playBellSound();
  }, [game, onSubmitScore, calculatedResult.score, calculatedResult.xp, accessLogId, playDurationSeconds]);

  // Automatically record score when Quiz finishes
  React.useEffect(() => {
    if (quizFinished && !scoreSubmitted && game?.type === 'quiz') {
      void handleSaveToLeaderboard();
      setCompletionNotice(`🎉 Kuis Selesai! Skor ${calculatedResult.score} pts (+${calculatedResult.xp} XP) otomatis dicatat ke Papan Peringkat!`);
    }
  }, [quizFinished, scoreSubmitted, game?.type, handleSaveToLeaderboard, calculatedResult.score, calculatedResult.xp]);

  // Automatically record score when Memory match finishes
  React.useEffect(() => {
    if (memoryFinished && !scoreSubmitted && game?.type === 'memory') {
      void handleSaveToLeaderboard();
      setCompletionNotice(`🎉 Memory Candi Berhasil Diselesaikan! Skor otomatis dicatat ke Papan Peringkat!`);
    }
  }, [memoryFinished, scoreSubmitted, game?.type, handleSaveToLeaderboard]);

  const handleSavePortableScore = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!game) return;
    hasRecordedAutoScoreRef.current = true;
    setPortableScoreSaved(true);
    setShowScoreInputModal(false);
    const numericScore = Math.max(0, Math.round(Number(customScoreInput) || 0));
    const xp = Math.round(numericScore * 0.5);
    await onSubmitScore(game.title, numericScore, xp, true, accessLogId || undefined, game.id);
    if (accessLogId) {
      api.updateGameHeartbeat(accessLogId, playDurationSeconds, true).catch(() => {});
    }
    playVictorySound();
    confetti({ particleCount: 70, spread: 70 });
  };

  const processedHtml = React.useMemo(() => {
    if (game?.type === 'html5') {
      return preparePortableHtml(game.html5Code || '', game.title);
    }
    return '';
  }, [game?.type, game?.html5Code, game?.title]);

  if (!game) return null;

  const isPortable = game.type === 'html5' || game.type === 'iframe';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none overflow-hidden"
      id="game-player-wrapper"
    >
      {/* Top HUD Bar */}
      {!isHudCollapsed && (
        <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between text-white shrink-0 shadow-lg">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <GameIconBadge icon={game.icon || '☸'} title={game.title} size="md" />
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-xs sm:text-base text-amber-400 leading-tight truncate">
                {game.title}
              </h3>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-400">
                <span className="truncate">{game.category}</span>
                <span aria-hidden="true">·</span>
                <span className="hidden sm:inline">Kesulitan: {game.difficulty}</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="uppercase text-amber-500/90 font-semibold">{game.type}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Viewport switch for portable games (HP, Tablet, Fullscreen Flexible) */}
            {isPortable && (
              <div className="hidden md:flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDeviceMode('full')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 font-medium transition cursor-pointer ${
                    deviceMode === 'full' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tampilan Fleksibel / Layar Penuh"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Fleksibel 100%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('tablet')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 font-medium transition cursor-pointer ${
                    deviceMode === 'tablet' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Simulasi Tablet (768px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span>Tablet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('mobile')}
                  className={`px-2 py-1 rounded-lg flex items-center gap-1 font-medium transition cursor-pointer ${
                    deviceMode === 'mobile' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Simulasi HP / Ponsel (414px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Ponsel HP</span>
                </button>
              </div>
            )}

            {/* Reload game button for portable games */}
            {isPortable && (
              <button
                type="button"
                onClick={handleReloadGame}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs font-medium flex items-center gap-1 cursor-pointer"
                title="Muat Ulang Permainan (Restart)"
              >
                <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden lg:inline">Muat Ulang</span>
              </button>
            )}

            {/* Save score to leaderboard for portable games */}
            {isPortable && (
              <button
                type="button"
                onClick={() => {
                  if (portableScoreSaved) return;
                  if (latestPortableScoreRef.current > 0) {
                    setCustomScoreInput(latestPortableScoreRef.current);
                  } else if (!portableGameCompleted) {
                    const fallbackAuto = resolveAutoCloseScore({
                      gameType: game.type,
                      difficulty: game.difficulty,
                      quizScore: 0,
                      streak: 0,
                      matchedPairs: 0,
                      detectedPortableScore: 0,
                      playDurationSeconds,
                    });
                    setCustomScoreInput(fallbackAuto.score);
                  }
                  setShowScoreInputModal(true);
                }}
                disabled={portableScoreSaved}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  portableScoreSaved
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                    : portableGameCompleted
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/50 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80'
                }`}
                title={
                  portableGameCompleted
                    ? 'Permainan Selesai! Klik untuk mencatat skor'
                    : `Selesaikan game untuk catat skor (${playDurationSeconds}s)`
                }
              >
                {portableScoreSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Skor Tercatat</span>
                  </>
                ) : portableGameCompleted ? (
                  <>
                    <Trophy className="w-3.5 h-3.5 text-amber-200" />
                    <span>🏆 Catat Skor ({customScoreInput})</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Catat Skor</span>
                    <span className="text-[10px] text-slate-400 hidden lg:inline">({playDurationSeconds}s)</span>
                  </>
                )}
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh Sejati'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Kecilkan' : 'Fullscreen'}</span>
            </button>

            {/* Collapse HUD to give 100% space on phones */}
            <button
              type="button"
              onClick={() => setIsHudCollapsed(true)}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition text-xs cursor-pointer"
              title="Sembunyikan Menu Atas"
            >
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Close Button (auto-records score) */}
            <button
              type="button"
              onClick={handleCloseGame}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow flex items-center gap-1 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Tutup</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Restore HUD Button when HUD is collapsed */}
      {isHudCollapsed && (
        <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-700/70 shadow-2xl">
          <button
            type="button"
            onClick={() => setIsHudCollapsed(false)}
            className="text-[11px] font-semibold text-slate-200 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Menu Game</span>
          </button>
          <div className="w-px h-3.5 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-slate-300 hover:text-white p-0.5 cursor-pointer"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleCloseGame}
            className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
            title="Tutup Game"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Completion status notification banner */}
      {completionNotice && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-40 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>{completionNotice}</span>
          </div>
          <button
            onClick={() => setCompletionNotice(null)}
            className="p-1 hover:bg-black/10 rounded-lg transition shrink-0"
            title="Tutup Pesan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Playfield Stage */}
      <div
        className={`flex-grow w-full bg-slate-950 flex items-center justify-center overflow-auto ${
          isPortable ? 'p-0' : 'p-3 sm:p-6'
        }`}
      >
        {game.isActive === false ? (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 text-center space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 m-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
              Permainan Sedang Dinonaktifkan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Permainan <strong className="text-slate-800 dark:text-slate-200">"{game.title}"</strong> saat ini sedang dinonaktifkan sementara oleh pengelola untuk pembaruan materi pembelajaran.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
            >
              Kembali ke Beranda
            </button>
          </div>
        ) : (
          <>
            {/* ENGINE 1: QUIZ */}
        {game.type === 'quiz' && (
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            {!quizFinished ? (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span>
                    Pertanyaan {currentQIndex + 1} dari {quizQuestions.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-500 font-mono">Streak: {streak} 🔥</span>
                    <span className="text-emerald-500 font-mono font-bold text-sm">
                      Skor: {score}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white leading-relaxed">
                    {quizQuestions[currentQIndex].question}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {quizQuestions[currentQIndex].options.map((option, idx) => {
                      const isChosen = selectedOption === idx;
                      const isCorrect = idx === quizQuestions[currentQIndex].correctIndex;
                      let btnStyle = 'bg-slate-100 dark:bg-slate-800 hover:border-amber-500 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700';

                      if (selectedOption !== null) {
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-600 text-white border-emerald-600 shadow-md';
                        } else if (isChosen) {
                          btnStyle = 'bg-rose-600 text-white border-rose-600';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectQuizOption(idx)}
                          disabled={selectedOption !== null}
                          className={`p-4 rounded-2xl text-left text-xs font-semibold transition-all cursor-pointer ${btnStyle}`}
                        >
                          <span className="font-mono mr-2 font-bold opacity-70">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOption !== null && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <div className="font-bold text-amber-700 dark:text-amber-400">
                        {selectedOption === quizQuestions[currentQIndex].correctIndex
                          ? '✨ Benar Sekali! Anumodana!'
                          : 'Mari Renungkan Kembali:'}
                      </div>
                      <p>{quizQuestions[currentQIndex].explanation}</p>
                    </div>
                  )}
                </div>

                {selectedOption !== null && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-lg shadow-amber-600/25 flex items-center gap-2 cursor-pointer transition"
                    >
                      <span>
                        {currentQIndex + 1 < quizQuestions.length ? 'Pertanyaan Berikutnya' : 'Selesai & Lihat Hasil'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Quiz Result Summary */
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
                  <Trophy className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                    Modul Kuis Selesai!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Kebijaksanaan Dharma telah Anda asah dengan tekun.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <div>
                    <div className="font-mono font-black text-2xl text-amber-600 tabular-nums">
                      {calculatedResult.score}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Skor Diperoleh</div>
                  </div>
                  <div>
                    <div className="font-mono font-black text-2xl text-emerald-600 tabular-nums">
                      +{calculatedResult.xp} XP
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Poin Kebijaksanaan</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentQIndex(0);
                      setSelectedOption(null);
                      setStreak(0);
                      setScore(0);
                      setQuizFinished(false);
                      setScoreSubmitted(false);
                    }}
                    className="px-5 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Ulangi Kuis
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToLeaderboard}
                    disabled={scoreSubmitted}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{scoreSubmitted ? '✅ Skor Tersimpan di Database' : `Catat Skor (${playerName})`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ENGINE 2: MEMORY MATCH */}
        {game.type === 'memory' && (
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 text-center">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800 pb-3">
              <span>Langkah: {memoryMoves}</span>
              <button
                type="button"
                onClick={initMemoryGame}
                className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Acak Ulang
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardClick(card.id)}
                  className={`h-20 sm:h-24 rounded-2xl text-3xl font-bold flex items-center justify-center transition-all transform cursor-pointer border ${
                    card.flipped || card.matched
                      ? 'bg-amber-500/10 border-amber-500 scale-100 text-4xl shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {card.flipped || card.matched ? card.symbol : '❓'}
                </button>
              ))}
            </div>

            {memoryFinished && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="font-heading font-extrabold text-base text-amber-700 dark:text-amber-400">
                  🎉 Selamat! Seluruh Pasangan Suci Ditemukan!
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Selesai dalam {memoryMoves} langkah. Anda memperoleh {calculatedResult.score} poin (+{calculatedResult.xp} XP).
                </div>
                <button
                  type="button"
                  onClick={handleSaveToLeaderboard}
                  disabled={scoreSubmitted}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow transition cursor-pointer disabled:opacity-50"
                >
                  {scoreSubmitted ? '✅ Skor Tersimpan di Papan Peringkat' : 'Catat Skor ke Papan Peringkat'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ENGINE 3: STANDALONE PORTABLE HTML5 - FULL SCREEN & RESPONSIVE ENGINE */}
        {game.type === 'html5' && (
          <div
            className={`transition-all duration-200 flex flex-col h-full bg-slate-900 overflow-hidden ${
              deviceMode === 'full'
                ? 'w-full flex-grow'
                : deviceMode === 'tablet'
                ? 'w-full max-w-[768px] mx-auto my-auto rounded-3xl border-4 border-slate-700 shadow-2xl h-[92vh]'
                : 'w-full max-w-[420px] mx-auto my-auto rounded-3xl border-4 border-slate-700 shadow-2xl h-[92vh]'
            }`}
          >
            <iframe
              key={`html5-${iframeKey}`}
              srcDoc={processedHtml}
              title={game.title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-pointer-lock allow-popups allow-popups-to-escape-sandbox"
              allow="fullscreen; autoplay; gamepad; microphone; camera; clipboard-write; web-share"
              className="w-full h-full flex-grow border-0 bg-slate-900"
            />
          </div>
        )}

        {/* ENGINE 4: IFRAME EMBED (FULL SCREEN & RESPONSIVE) */}
        {game.type === 'iframe' && (
          <div
            className={`transition-all duration-200 flex flex-col h-full bg-slate-900 overflow-hidden ${
              deviceMode === 'full'
                ? 'w-full flex-grow'
                : deviceMode === 'tablet'
                ? 'w-full max-w-[768px] mx-auto my-auto rounded-3xl border-4 border-slate-700 shadow-2xl h-[92vh]'
                : 'w-full max-w-[420px] mx-auto my-auto rounded-3xl border-4 border-slate-700 shadow-2xl h-[92vh]'
            }`}
          >
            <iframe
              key={`iframe-${iframeKey}`}
              src={game.url || 'about:blank'}
              title={game.title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-pointer-lock allow-popups allow-popups-to-escape-sandbox"
              allow="fullscreen; autoplay; gamepad; microphone; camera; clipboard-write; web-share"
              className="w-full h-full flex-grow border-0 bg-white"
            />
          </div>
        )}
          </>
        )}
      </div>

      {/* MODAL CATAT SKOR PORTABLE GAME */}
      {showScoreInputModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                  Catat Skor Permainan
                </h4>
                <p className="text-[11px] text-slate-500">Pemain: {playerName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                Status: <strong className="text-emerald-600 dark:text-emerald-400">Selesai Terverifikasi</strong> · Bermain selama {playDurationSeconds} detik
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Anda telah menyelesaikan game <strong>{game.title}</strong>. Masukkan skor akhir Anda untuk disinkronkan ke Papan Peringkat Real-Time Nasional:
            </p>

            <form onSubmit={handleSavePortableScore} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Skor Permainan:
                </label>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  required
                  autoFocus
                  value={customScoreInput}
                  onChange={(e) => setCustomScoreInput(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                  Estimasi XP Diperoleh: +{Math.round(customScoreInput * 0.5)} XP
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScoreInputModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simpan ke Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
