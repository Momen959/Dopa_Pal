import React, { useState, useRef, useCallback, useEffect } from 'react';
import './Bubble.css';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { applyTheme, getActiveThemeId } from '../../themes';
import { createAudioPlayer } from '../AudioLab/audioEngine';


/* ─── Detect Electron ───────────────────────────────────── */
const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI;

/* ─── API base URL for direct fetch calls (voice upload) ── */
const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL : 'http://localhost:8000/api/v1';

/* ─── Window sizes per view ─────────────────────────────── */
const SIZES = {
  icon: [80, 80],
  panel: [480, 360],
  addMenu: [360, 550],
  voice: [360, 550],
  aiSummary: [360, 550],
  aiSummaryDisplay: [360, 550],
  manual: [360, 650],
};

const ORB_SIZE = 68;
const ROOT_PAD_BOTTOM = 6;
const DRAG_PX = 5;

/* ─── Priority auto-calc from due date ──────────────────── */
function calcPriority(dueDateStr) {
  if (!dueDateStr) return 'routine';
  const diff = (new Date(dueDateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 3) return 'focus';
  if (diff < 7) return 'flow';
  return 'routine';
}

const PRIORITY_META = {
  focus: { label: 'FOCUS', color: '#a855f7' },
  flow: { label: 'FLOW', color: '#8b5cf6' },
  routine: { label: 'ROUTINE', color: '#6366f1' },
};

/* ─── SVG Icons ─────────────────────────────────────────── */
const Svg = ({ size = 22, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const BrainIcon = () => <span style={{ fontSize: '36px', filter: 'drop-shadow(0 0 10px rgba(var(--accent-rgb),.6))', transform: 'translateY(-2px)' }}>🧠</span>;
const HomeIcon = () => <Svg><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Svg>;
const PlusIcon = () => <Svg><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></Svg>;
const SparkleIcon = () => <Svg><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" /></Svg>;
const MicIcon = () => <Svg><rect x="9" y="3" width="6" height="10" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></Svg>;
const SpeakerIcon = () => <Svg><polygon points="5 8 9 8 13 4 13 20 9 16 5 16" /><path d="M15.5 8.5a3.5 3.5 0 0 1 0 7" /><path d="M18 5a6 6 0 0 1 0 14" /></Svg>;
const PenIcon = () => <Svg><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
const ClipboardIcon = () => <Svg><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></Svg>;
const CloseIcon = () => <Svg size={11}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
const BackIcon = () => <Svg size={16}><polyline points="15 18 9 12 15 6" /></Svg>;
const SendIcon = () => <Svg><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></Svg>;
const PlayIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>;

/* ─── Main Bubble ───────────────────────────────────────── */
export default function Bubble() {
  const { t } = useLanguage();
  const [view, setView] = useState('icon'); // icon|panel|addMenu|voice|aiSummary|manual|play|task|mood|reward|empty
  const [panelAnim, setPanelAnim] = useState('');
  const [panelSide, setPanelSide] = useState('left');
  const [recording, setRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiText, setAiText] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [userXp, setUserXp] = useState(0);
  const [bubbleTask, setBubbleTask] = useState(null);
  const [stateScore, setStateScore] = useState(75);
  const [focusMode, setFocusMode] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [activeMusic, setActiveMusic] = useState('none');
  const [audioVolume, setAudioVolume] = useState(0.55);
  const [rewardCopy, setRewardCopy] = useState('');
  const audioCtxRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const [moodScore, setMoodScore] = useState(null);
  const [moodCheckedToday, setMoodCheckedToday] = useState(false);
  const [playSession, setPlaySession] = useState(null);
  const [playSummary, setPlaySummary] = useState(null);
  const [playDraftDurations, setPlayDraftDurations] = useState({});
  const [task, setTask] = useState({ title: '', duration: '', due: '', notes: '' });

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const drag = useRef({ on: false, sx: 0, sy: 0, wx: 0, wy: 0, moved: false });
  const exitTmr = useRef(null);
  const dragStarted = useRef(false);

  /* ── Resize helper ──────────────────────────────────── */
  const resize = useCallback((viewName) => {
    // Resize is no longer needed since we use a fixed size window and click-through
  }, []);

  /* ── Navigate between views ─────────────────────────── */
  const goTo = useCallback((nextView, anim = 'in') => {
    clearTimeout(exitTmr.current);
    if (nextView === 'icon') {
      setPanelAnim('out');
      exitTmr.current = setTimeout(() => {
        setView('icon');
      }, 160);
    } else {
      setView(nextView);
      setPanelAnim(anim);
    }
  }, []);

  const stateTier = stateScore < 40 ? 'low' : stateScore < 70 ? 'mid' : 'high';
  const stateDotClass = `b-state-dot b-state-dot--${stateTier}`;
  const currentBlock = bubbleTask?.primary_block || null;
  const bonusBlock = bubbleTask?.bonus_blocks?.[0] || null;
  const taskCategory = stateTier === 'low' ? 'coral' : stateTier === 'mid' ? 'blue' : 'amber';
  const taskCategoryLabel = stateTier === 'low' ? 'Needs a nudge' : stateTier === 'mid' ? 'Focus task' : 'Momentum task';

  const saveMood = async (score) => {
    const today = new Date().toISOString().slice(0, 10);
    setMoodScore(score);
    localStorage.setItem('dopapal_mood_date_v1', today);
    localStorage.setItem('dopapal_last_mood_v1', String(score));
    setMoodCheckedToday(true);
    try {
      await api.submitMood(score);
    } catch { }
    setTimeout(() => goTo(currentBlock ? 'task' : 'empty'), 380);
  };

  const completeCurrentBlock = async () => {
    if (!currentBlock) return;
    setIsLoading(true);
    try {
      await api.completeSubBlock(currentBlock.sub_block_id);
      setRewardCopy([
        'Done. Anchor is reshuffling the next step.',
        'Nice. The next move is being queued quietly.',
        'Complete. The load just got lighter.',
      ][Math.floor(Math.random() * 3)]);
      goTo('reward');
      setTimeout(async () => {
        const next = await api.getNextBubbleTask().catch(() => null);
        setBubbleTask(next);
        setStateScore(Number(next?.state_score ?? stateScore));
        goTo(next?.primary_block ? 'task' : 'empty');
      }, 2600);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedXp = localStorage.getItem('dopapal_xp_v3');
    if (savedXp) setUserXp(parseInt(savedXp, 10));

    const loadAudioPrefs = () => {
      const savedMusic = localStorage.getItem('dopapal_active_music_v1') || 'none';
      const savedVolume = parseFloat(localStorage.getItem('dopapal_audio_volume_v1') || '0.55');
      setActiveMusic(savedMusic);
      setAudioVolume(Number.isNaN(savedVolume) ? 0.55 : savedVolume);
    };

    loadAudioPrefs();
    const handleStorage = (event) => {
      if (event.key === 'dopapal_active_music_v1' && event.newValue) {
        setActiveMusic(event.newValue);
      }
      if (event.key === 'dopapal_audio_volume_v1') {
        const nextVolume = parseFloat(event.newValue || '0.55');
        setAudioVolume(Number.isNaN(nextVolume) ? 0.55 : nextVolume);
      }
    };
    window.addEventListener('storage', handleStorage);

    const savedPlay = localStorage.getItem('dopapal_play_state_v1');
    if (savedPlay) {
      try {
        const parsed = JSON.parse(savedPlay);
        setPlaySession(parsed);
      } catch {
        localStorage.removeItem('dopapal_play_state_v1');
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const moodDate = localStorage.getItem('dopapal_mood_date_v1');
    setFocusMode(localStorage.getItem('dopapal_focus_mode_v1') !== '0');
    setAudioMuted(localStorage.getItem('dopapal_audio_muted_v1') === '1');
    setMoodScore(Number(localStorage.getItem('dopapal_last_mood_v1') || 0) || null);
    setMoodCheckedToday(moodDate === today);

    api.getNextBubbleTask().then(next => {
      setBubbleTask(next);
      setStateScore(Number(next?.state_score ?? 75));
      if (!moodDate || moodDate !== today) {
        setView('mood');
      } else if (next?.primary_block) {
        setView('task');
      } else {
        setView('empty');
      }
    }).catch(() => { });

    if (IS_ELECTRON && window.electronAPI.onOpenAddMenu) {
      window.electronAPI.onOpenAddMenu(() => {
        goTo('addMenu');
      });
    }
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearTimeout(exitTmr.current);
    };
  }, [goTo]);

  /* ── Apply active theme on mount & listen for changes ── */
  useEffect(() => {
    applyTheme(getActiveThemeId());
    const handler = () => applyTheme(getActiveThemeId());
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 3000);
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (audioMuted || !activeMusic || activeMusic === 'none') {
      audioPlayerRef.current?.stop();
      audioPlayerRef.current = null;
      return;
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const spec = activeMusic;

    if (audioPlayerRef.current?.soundId !== activeMusic) {
      audioPlayerRef.current?.stop();
      audioPlayerRef.current = createAudioPlayer(audioCtxRef.current, spec, audioVolume);
      if (audioPlayerRef.current) audioPlayerRef.current.soundId = activeMusic;
    } else if (audioPlayerRef.current) {
      audioPlayerRef.current.setVolume(audioVolume);
    }

    return () => {
      audioPlayerRef.current?.stop();
      audioPlayerRef.current = null;
    };
  }, [activeMusic, audioMuted, audioVolume]);

  useEffect(() => {
    const poll = setInterval(() => {
      const savedMusic = localStorage.getItem('dopapal_active_music_v1') || 'none';
      const savedVolume = parseFloat(localStorage.getItem('dopapal_audio_volume_v1') || '0.55');
      if (savedMusic !== activeMusic) setActiveMusic(savedMusic);
      if (!Number.isNaN(savedVolume) && savedVolume !== audioVolume) setAudioVolume(savedVolume);
    }, 2200);
    return () => clearInterval(poll);
  }, [activeMusic, audioVolume]);

  useEffect(() => {
    if (!playSession?.current || playSession.stage !== 'running') return;
    const timer = setInterval(() => {
      setPlaySession(prev => {
        if (!prev?.current || prev.stage !== 'running') return prev;
        const queue = prev.queue.slice();
        const current = { ...queue[prev.currentIndex] };
        current.remaining_seconds -= 1;
        queue[prev.currentIndex] = current;
        return {
          ...prev,
          queue,
          current,
          overallSeconds: prev.overallSeconds - 1,
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playSession?.currentIndex, playSession?.current, playSession?.stage]);

  useEffect(() => {
    if (playSession) {
      localStorage.setItem('dopapal_play_state_v1', JSON.stringify(playSession));
    } else {
      localStorage.removeItem('dopapal_play_state_v1');
    }
  }, [playSession]);

  /* ── Click-through logic ───────────────────────────── */
  useEffect(() => {
    if (!IS_ELECTRON) return;
    const handleMouseMove = (e) => {
      // Never interfere while a window drag is in progress
      if (drag.current.on) return;

      if (view !== 'icon') {
        window.electronAPI.setIgnoreMouse(false);
        return;
      }
      // If mouse is directly over the body, root, or transparent SVG, pass clicks through!
      const target = e.target;
      const isTransparent =
        target === document.body ||
        target === document.documentElement ||
        target.classList.contains('b-root');

      window.electronAPI.setIgnoreMouse(isTransparent);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const isDragBlocked = (target) => {
    if (!target || !target.closest) return false;
    return !!target.closest('button, input, textarea, select, option, a, [role="button"], [data-no-drag]');
  };

  const toSeconds = (minutes) => Math.max(0, Math.round(Number(minutes || 0) * 60));
  const formatClock = (seconds) => {
    const sign = seconds < 0 ? '-' : '';
    const abs = Math.abs(seconds);
    const mins = Math.floor(abs / 60);
    const secs = abs % 60;
    return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const buildPlayQueue = useCallback((next) => {
    const queue = [
      ...(next?.primary_block ? [next.primary_block] : []),
      ...(next?.bonus_blocks || []).slice(0, 1),
    ];

    return queue.map((item, index) => {
      const key = String(item.sub_block_id ?? index);
      const draftMinutes = playDraftDurations[key];
      const minutes = Number.isFinite(Number(draftMinutes)) && Number(draftMinutes) > 0
        ? Number(draftMinutes)
        : Number(item.duration_minutes || 1);
      const normalizedMinutes = Math.max(1, minutes);
      return {
        ...item,
        original_minutes: normalizedMinutes,
        remaining_seconds: toSeconds(normalizedMinutes),
        completed: false,
        overtime: 0,
      };
    });
  }, [playDraftDurations]);

  const startPlayMode = useCallback(async () => {
    const next = await api.getNextBubbleTask();
    const queue = buildPlayQueue(next);
    if (!queue.length) return;
    setPlaySummary(null);
    setPlaySession({
      active: true,
      stage: 'setup',
      queue,
      currentIndex: 0,
      current: null,
      overallSeconds: queue.reduce((sum, item) => sum + item.remaining_seconds, 0),
    });
    goTo('play');
  }, [buildPlayQueue, goTo]);

  const beginPlayRun = useCallback(() => {
    setPlaySession(prev => {
      if (!prev?.queue?.length) return prev;
      const queue = prev.queue.map((item, index) => index === 0 ? { ...item, remaining_seconds: Math.max(1, item.remaining_seconds) } : item);
      return {
        ...prev,
        stage: 'running',
        currentIndex: 0,
        current: queue[0],
        queue,
        overallSeconds: queue.reduce((sum, item) => sum + item.remaining_seconds, 0),
      };
    });
  }, []);

  const closePlayMode = useCallback(() => {
    setPlaySession(null);
    setPlaySummary(null);
    setPlayDraftDurations({});
  }, []);

  const shiftPlayQueue = useCallback((index, delta) => {
    setPlaySession(prev => {
      if (!prev) return prev;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= prev.queue.length) return prev;
      const queue = prev.queue.slice();
      const [item] = queue.splice(index, 1);
      queue.splice(nextIndex, 0, item);
      const currentIndex = prev.current
        ? queue.findIndex(entry => entry.sub_block_id === prev.current.sub_block_id)
        : 0;
      return {
        ...prev,
        queue,
        currentIndex,
        current: prev.current ? (queue[currentIndex] || null) : null,
        overallSeconds: queue.reduce((sum, entry) => sum + entry.remaining_seconds, 0),
      };
    });
  }, []);

  const updatePlayDuration = useCallback((blockId, value) => {
    const key = String(blockId);
    setPlayDraftDurations(prev => ({ ...prev, [key]: value }));
    setPlaySession(prev => {
      if (!prev) return prev;
      const queue = prev.queue.map(item => {
        if (String(item.sub_block_id) !== key) return item;
        const minutes = Math.max(1, Number(value) || item.original_minutes || 1);
        const remaining = Math.max(1, toSeconds(minutes));
        return {
          ...item,
          original_minutes: minutes,
          remaining_seconds: remaining,
        };
      });
      const current = queue[prev.currentIndex] || null;
      return {
        ...prev,
        queue,
        current,
        overallSeconds: queue.reduce((sum, entry) => sum + entry.remaining_seconds, 0),
      };
    });
  }, []);

  const finishPlayBlock = useCallback(async () => {
    if (!playSession?.current) return;
    const current = playSession.current;
    const earnedBase = Math.max(20, Math.round((current.original_minutes * 60) / 8));
    const bonus = Math.max(0, Math.round(Math.max(0, current.remaining_seconds) / 10));
    const penalty = current.remaining_seconds < 0 ? Math.min(earnedBase, Math.round(Math.abs(current.remaining_seconds) / 8)) : 0;
    const net = Math.max(0, earnedBase + bonus - penalty);

    try {
      await api.completeSubBlock(current.sub_block_id);
    } catch (err) {
      console.error('Failed to complete play block:', err);
    }

    setUserXp(x => {
      const nx = x + net;
      localStorage.setItem('dopapal_xp_v3', nx);
      return nx;
    });

    setPlaySession(prev => {
      if (!prev) return prev;
      const queue = prev.queue.map((item, idx) => idx === prev.currentIndex ? {
        ...item,
        completed: true,
        actualSeconds: Math.max(0, item.original_minutes * 60 - item.remaining_seconds),
      } : item);
      const nextIndex = prev.currentIndex + 1;
      const nextCurrent = queue[nextIndex] || null;
      if (!nextCurrent) {
        setPlaySummary({
          totalBlocks: queue.length,
          totalBaseXp: queue.reduce((sum, item) => sum + Math.max(20, Math.round((item.original_minutes * 60) / 8)), 0),
          totalBonusXp: bonus,
          totalPenalty: penalty,
          netXp: net,
          blocks: queue,
        });
        return null;
      }
      return {
        ...prev,
        queue,
        currentIndex: nextIndex,
        current: nextCurrent,
        stage: 'running',
        overallSeconds: Math.max(0, prev.overallSeconds - (current.original_minutes * 60)),
      };
    });
  }, [playSession]);

  /* ── Drag (now works from orb + empty bubble background) ─────────── */
  const beginBubbleDrag = useCallback((e) => {
    if (!IS_ELECTRON || e.button !== 0) return;
    if (isDragBlocked(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    // Mark drag active immediately (suppresses click-through) but window
    // position will arrive asynchronously via IPC invoke.
    drag.current = { on: true, sx: e.screenX, sy: e.screenY, moved: false };
    dragStarted.current = false;

    const onMove = (mv) => {
      const d = drag.current;
      if (!d.on) return;
      // Wait until the main process has returned the real window position
      if (d.wx === undefined) return;

      if (!d.moved && Math.hypot(mv.screenX - d.sx, mv.screenY - d.sy) > DRAG_PX) {
        d.moved = true;
        dragStarted.current = true;
      }

      if (d.moved) {
        if (window.electronAPI.setWindowPosition) {
          const scale = window.devicePixelRatio || 1;
          const x = d.wx + (mv.screenX - d.sx) / scale;
          const y = d.wy + (mv.screenY - d.sy) / scale;
          window.electronAPI.setWindowPosition(x, y);
        }

        const screenLeft = window.screen.availLeft || 0;
        setPanelSide((mv.screenX - screenLeft) > (window.screen.width / 2) ? 'left' : 'right');
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (dragStarted.current && window.electronAPI.stopBubbleDrag) {
        window.electronAPI.stopBubbleDrag();
      }

      if (!drag.current.moved) {
        if (view === 'icon') {
          const screenLeft = window.screen.availLeft || 0;
          setPanelSide((window.screenX - screenLeft) > (window.screen.width / 2) ? 'left' : 'right');
          // Mid-sprint, the orb reopens the single-focus run; otherwise the orbital menu.
          goTo(playSession?.stage === 'running' ? 'play' : 'panel');
        } else {
          goTo('icon');
        }
      }

      drag.current.on = false;
      dragStarted.current = false;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // Fetch the real window position from the main process (avoids stale
    // window.screenX/Y in the renderer).  wx/wy are set once the response
    // arrives; until then onMove returns early.
    window.electronAPI.getWindowPosition().then(({ x, y }) => {
      const d = drag.current;
      d.wx = x;
      d.wy = y;
    });
  }, [view, goTo, playSession]);

  /* ── Task submit ─────────────────────────────────────── */
  const submitTask = useCallback(async (source, extraData = null) => {
    setIsLoading(true);
    try {
      if (source === 'manual') {
        let hours = 2.0;
        const dStr = task.duration.trim().toLowerCase();
        if (dStr === '15m' || dStr === '15 minutes') hours = 0.25;
        else if (dStr === '30m' || dStr === '30 minutes') hours = 0.5;
        else if (dStr === '45m' || dStr === '45 minutes') hours = 0.75;
        else if (dStr === '1h' || dStr === '1 hour') hours = 1.0;
        else if (dStr === '2h' || dStr === '2 hours') hours = 2.0;
        else if (dStr === 'half-day') hours = 4.0;
        else if (dStr === 'full-day') hours = 8.0;
        else if (dStr) {
          const match = dStr.match(/^([\d.]+)\s*(h|m|hour|min)?/);
          if (match) {
            const val = parseFloat(match[1]);
            const unit = match[2];
            if (unit && unit.startsWith('m')) {
              hours = val / 60.0;
            } else if (unit && unit.startsWith('h')) {
              hours = val;
            } else {
              // no unit: assume minutes if > 10, else hours
              hours = val > 10 ? val / 60.0 : val;
            }
          }
        }

        await window.electronAPI.createTask({
          title: task.title,
          deadline: task.due ? new Date(task.due).toISOString() : new Date(Date.now() + 86400000 * 7).toISOString(),
          estimatedHours: hours,
          sourceType: 'manual',
          interestTag: null
        });
      } else if (source === 'ai') {
        await window.electronAPI.ingestTask({
          source_text: aiText,
          source_type: 'highlight'
        });
      }

      // Reset forms
      setTask({ title: '', duration: '', due: '', notes: '' });
      setAiText('');
      goTo('icon');
    } catch (e) {
      console.error("Failed to submit task:", e);
      alert("Error saving task: " + e.message);
    } finally {
      setIsLoading(false);
    }
  }, [task, aiText, goTo]);

  const handleAISummaryClick = async () => {
    goTo('aiSummaryDisplay');
    setIsLoading(true);
    setSummaryData(null);
    try {
      const res = await api.getAISummary();
      setSummaryData(res);
    } catch (e) {
      console.error("Failed to get summary:", e);
      setSummaryData({ text: "عذراً، حدث خطأ أثناء الاتصال بالـ AI." });
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Voice Recording Logic ───────────────────────────── */
  const recordingStartTime = useRef(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      recordingStartTime.current = Date.now();
      mediaRecorder.current.start();
      setRecording(true);
      console.log('[Voice] Recording started at', recordingStartTime.current);
    } catch (e) {
      console.error("Microphone error:", e);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder.current) return;
    mediaRecorder.current.onstop = async () => {
      const duration = Date.now() - recordingStartTime.current;
      const totalBytes = audioChunks.current.reduce((sum, c) => sum + c.size, 0);
      console.log('[Voice] Recording stopped. Duration:', duration, 'ms | Chunks:', audioChunks.current.length, '| Total bytes:', totalBytes);

      if (audioChunks.current.length === 0) {
        console.warn('[Voice] No audio chunks recorded');
        setRecording(false);
        return;
      }
      if (duration < 500) {
        console.warn('[Voice] Recording too short:', duration, 'ms');
        setRecording(false);
        alert('Recording too short — please hold the button longer.');
        return;
      }
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
      await submitVoiceTask(audioBlob);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      audioChunks.current = [];
    };
    mediaRecorder.current.stop();
    setRecording(false);
  };

  const submitVoiceTask = async (audioBlob) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice_recording.webm');
      formData.append('source_type', 'voice');

      const response = await fetch(`${API_BASE_URL}/tasks/ingest-voice`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Voice] Ingestion successful:', result);

      // Reset forms and navigate back
      setTask({ title: '', duration: '', due: '', notes: '' });
      setAiText('');
      goTo('icon');
    } catch (e) {
      console.error("Failed to submit voice task:", e);
      alert("Error saving voice task: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Priority from due date ──────────────────────────── */
  const priority = calcPriority(task.due);
  const priorityMeta = PRIORITY_META[priority];

  /* ── Compact alarm orb (minimized while a sprint runs) ── */
  const sessionRunning = playSession?.stage === 'running' && !!playSession?.current;
  const orbOvertime = sessionRunning && playSession.current.remaining_seconds < 0;
  const showOrbTimer = view === 'icon' && sessionRunning;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="b-root" onMouseDownCapture={beginBubbleDrag}>
      {view === 'mood' && (
        <div className="b-panel b-panel--tall b-panel--mood" data-no-drag>
          <div className="b-status-row">
            <span className={stateDotClass} />
            <span>Morning check-in</span>
            <button className="b-close" onClick={() => goTo(currentBlock ? 'task' : 'empty')}><CloseIcon /></button>
          </div>
          <div className="b-menu-title">How are you feeling?</div>
          <div className="b-mood-pips">
            {[1, 2, 3, 4, 5].map(score => (
              <button key={score} className="b-mood-pip" onClick={() => saveMood(score)}>{score}</button>
            ))}
          </div>
          <button className="b-text-link" onClick={() => goTo(currentBlock ? 'task' : 'empty')}>Skip for now</button>
        </div>
      )}

      {/* ━━━━━━━━ ORBITAL MENU ━━━━━━━━ */}
      {view === 'task' && currentBlock && (
        <div className="b-panel b-panel--tall b-panel--task" data-no-drag>
          <div className="b-status-row">
            <span className={stateDotClass} />
            <span>Right now</span>
            <button className="b-close" onClick={() => goTo('icon')}><CloseIcon /></button>
          </div>
          <div className={`b-category-chip b-category-chip--${taskCategory}`}>
            <span className="b-category-chip-dot" />
            <span>{taskCategoryLabel}</span>
          </div>
          <div className="b-task-sentence">{currentBlock.block_title || currentBlock.task_title}</div>
          <div className="b-task-meta">⏱ {currentBlock.duration_minutes} min</div>
          <button className="b-task-complete" onClick={completeCurrentBlock} disabled={isLoading}>Complete</button>
          {stateTier === 'high' && bonusBlock && (
            <div className="b-bonus-row">
              <span className="b-bonus-label">Bonus</span>
              <span className="b-bonus-text">{bonusBlock.block_title || bonusBlock.task_title}</span>
            </div>
          )}
          <div className="b-intake-row">
            <button className="b-mini-action" onClick={() => goTo('voice')}>Voice</button>
            <button className="b-mini-action" onClick={() => goTo('addMenu')}>Highlight</button>
          </div>
          <div className="b-card-footer">
            <button className="b-mini-toggle" onClick={() => { const next = !focusMode; setFocusMode(next); localStorage.setItem('dopapal_focus_mode_v1', next ? '1' : '0'); }}>
              Focus Mode
            </button>
            {/* Bubble mini-player: only visible when audio is playing */}
            {activeMusic && activeMusic !== 'none' && (
              <div className={`b-mini-toggle b-mini-toggle--audio${audioMuted ? ' muted' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => { /* no play/skip here, just show and stop */ }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'default' }}><SpeakerIcon /></button>
                <button onClick={() => setTab('audio-lab')} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>{(() => {
                  const builtinNames = {
                    'music-brown-noise': 'Deep Brown Noise',
                    'music-lofi': 'Lo-fi Focus Loop',
                    'music-rain': 'Rain Desk'
                  };
                  const getMixLabel = () => {
                    if (typeof activeMusic === 'string' && activeMusic.startsWith('mix:')) {
                      try {
                        const mixes = JSON.parse(window.localStorage.getItem('dopaPal_customMixes') || '[]');
                        const mix = mixes.find(m => m.id === activeMusic.slice(4));
                        return mix?.name || activeMusic;
                      } catch (_err) {
                        return activeMusic;
                      }
                    }
                    return activeMusic;
                  };
                  const label = builtinNames[activeMusic] || getMixLabel();
                  return (label || '').length > 18 ? (label || '').slice(0, 17) + '…' : (label || '');
                })()}</button>
                <button onClick={() => { setActiveMusic('none'); localStorage.setItem('dopapal_active_music_v1', 'none'); }} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }} title="Stop">■</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'reward' && (
        <div className="b-panel b-panel--tall b-panel--reward" data-no-drag>
          <div className="b-reward-glow">✓</div>
          <div className="b-menu-title">Completed</div>
          <div className="b-menu-sub">{rewardCopy}</div>
        </div>
      )}

      {view === 'empty' && (
        <div className="b-panel b-panel--tall b-panel--empty" data-no-drag>
          <div className="b-status-row">
            <span className="b-state-dot b-state-dot--low" />
            <span>Needs a nudge</span>
            <button className="b-close" onClick={() => goTo('icon')}><CloseIcon /></button>
          </div>
          <div className="b-category-chip b-category-chip--coral">
            <span className="b-category-chip-dot" />
            <span>Ambient suggestion</span>
          </div>
          <div className="b-task-sentence">Your queue is empty. Want me to turn something passive into a plan?</div>
          <button className="b-task-complete" onClick={() => goTo('addMenu')}>Add from voice or highlight</button>
        </div>
      )}

      {(view === 'panel') && (
        <div className={`b-ow b-ow--${panelSide} b-ow--${panelAnim}`} data-no-drag>
          <button className="b-ob b-ob--0" data-label="Home" id="btn-home" onClick={() => { goTo('icon'); if (IS_ELECTRON) window.electronAPI.openDashboard(); }}><HomeIcon /></button>
          <button className="b-ob b-ob--1" data-label="Add Task" id="btn-add-task" onClick={() => goTo('addMenu')}><PlusIcon /></button>
          <button className="b-ob b-ob--2 b-ob--play" data-label="Play" id="btn-play" onClick={startPlayMode}><PlayIcon /></button>
        </div>
      )}

      {/* ━━━━━━━━ ADD TASK MENU ━━━━━━━━ */}
      {view === 'addMenu' && (
        <div className={`b-panel b-panel--tall b-panel--${panelAnim}`} data-no-drag>
          <button className="b-back" onClick={() => goTo('panel')}><BackIcon /></button>
          <button className="b-close" onClick={() => goTo('icon')}><CloseIcon /></button>

          <div className="b-menu-title">{t('bubble.newTask')}</div>
          <div className="b-menu-sub">{t('bubble.captureSub')}</div>

          <div className="b-menu-options">
            {/* Voice */}
            <button className="b-menu-btn" id="btn-voice" onClick={() => goTo('voice')}>
              <div className="b-menu-icon b-menu-icon--purple"><MicIcon /></div>
              <div className="b-menu-text">
                <span className="b-menu-label">{t('bubble.voiceMemo')}</span>
                <span className="b-menu-desc">{t('bubble.voiceMemoDesc')}</span>
              </div>
            </button>

            {/* AI Smart Input */}
            <button className="b-menu-btn" id="btn-ai-summary" onClick={() => goTo('aiSummary')}>
              <div className="b-menu-icon b-menu-icon--blue"><PenIcon /></div>
              <div className="b-menu-text">
                <span className="b-menu-label">{t('bubble.aiSmartInput')}</span>
                <span className="b-menu-desc">{t('bubble.aiSmartInputDesc')}</span>
              </div>
            </button>

            {/* Manual */}
            <button className="b-menu-btn b-menu-btn--primary" id="btn-manual" onClick={() => goTo('manual')}>
              <div className="b-menu-icon b-menu-icon--green"><ClipboardIcon /></div>
              <div className="b-menu-text">
                <span className="b-menu-label">{t('bubble.manualEntry')}</span>
                <span className="b-menu-desc">{t('bubble.manualEntryDesc')}</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━ VOICE VIEW ━━━━━━━━ */}
      {view === 'voice' && (
        <div className={`b-panel b-panel--tall b-panel--${panelAnim}`} style={{ flexDirection: 'column', gap: 14 }} data-no-drag>
          <button className="b-back" onClick={() => goTo('addMenu')}><BackIcon /></button>
          <button className="b-close" onClick={() => goTo('icon')}><CloseIcon /></button>

          <div className="b-menu-title">Voice Input</div>
          <div className="b-menu-sub">Press &amp; hold to record</div>

          <button
            className={`b-voice-btn ${recording ? 'b-voice-btn--active' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            disabled={isLoading}
          >
            <MicIcon />
            {isLoading ? <span>Processing AI...</span> : (recording ? <span>Recording…</span> : <span>Hold to speak</span>)}
          </button>
        </div>
      )}

      {/* ━━━━━━━━ AI SUMMARY DISPLAY ━━━━━━━━ */}
      {view === 'aiSummaryDisplay' && (
        <div className={`b-panel b-panel--tall b-panel--${panelAnim}`} style={{ flexDirection: 'column', gap: 12 }} data-no-drag>
          <button className="b-back" onClick={() => goTo('panel')}><BackIcon /></button>
          <button className="b-close" onClick={() => goTo('icon')}><CloseIcon /></button>

          <div className="b-menu-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SparkleIcon /> AI Summary
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', color: 'var(--text2)', fontSize: '14px', lineHeight: '1.6' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <div style={{ animation: 'pulse 1.5s infinite', color: 'var(--accent)' }}>Generating summary... 🧠</div>
              </div>
            ) : (
              <div style={{ background: 'rgba(var(--glass-rgb),0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(var(--glass-rgb),0.1)' }}>
                {summaryData?.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━━━━━━ AI SMART INPUT VIEW ━━━━━━━━ */}
      {view === 'aiSummary' && (
        <div className={`b-panel b-panel--tall b-panel--${panelAnim}`} style={{ flexDirection: 'column', gap: 12 }} data-no-drag>
          <button className="b-back" onClick={() => goTo('addMenu')}><BackIcon /></button>
          <button className="b-close" onClick={() => goTo('icon')}><CloseIcon /></button>

          <div className="b-menu-title">AI Summary</div>
          <div className="b-menu-sub">Describe your task in plain words</div>

          <textarea
            className="b-textarea"
            placeholder="e.g. I need to finish the report by Friday, it's really important…"
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            rows={4}
            autoFocus
          />
          <button className="b-submit-btn" onClick={() => submitTask('ai')} disabled={isLoading || !aiText}>
            {isLoading ? "Thinking..." : <><SparkleIcon /> Let AI Create Task</>}
          </button>
        </div>
      )}

      {/* ━━━━━━━━ MANUAL FORM ━━━━━━━━ */}
      {view === 'manual' && (
        <div className={`b-panel b-panel--form b-panel--${panelAnim}`} data-no-drag>
          <button className="b-back" onClick={() => goTo('addMenu')}><BackIcon /></button>
          <button className="b-close" onClick={() => goTo('icon')}><CloseIcon /></button>

          <div className="b-menu-title">New Task</div>

          <div className="b-form">
            {/* Title */}
            <div className="b-field">
              <label className="b-label">Task Title</label>
              <input className="b-input" placeholder="What needs to be done?"
                value={task.title}
                onChange={e => setTask(t => ({ ...t, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Duration */}
            <div className="b-field">
              <label className="b-label">Duration</label>
              <input className="b-input"
                list="duration-options"
                placeholder="Select or type (e.g. 45m, 1.5h)"
                value={task.duration}
                onChange={e => setTask(t => ({ ...t, duration: e.target.value }))}
              />
              <datalist id="duration-options">
                <option value="15m" />
                <option value="30m" />
                <option value="45m" />
                <option value="1h" />
                <option value="2h" />
                <option value="half-day" />
                <option value="full-day" />
              </datalist>
            </div>

            {/* Due date */}
            <div className="b-field">
              <label className="b-label">Due Date</label>
              <input className="b-input" type="date"
                value={task.due}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setTask(t => ({ ...t, due: e.target.value }))}
              />
            </div>

            {/* Priority - auto from due date */}
            {task.due && (
              <div className="b-priority-pill" style={{ borderColor: priorityMeta.color + '55', background: priorityMeta.color + '18' }}>
                <span className="b-priority-dot" style={{ background: priorityMeta.color }} />
                <span style={{ color: priorityMeta.color, fontWeight: 700, fontSize: 11 }}>
                  {priorityMeta.label}
                </span>
                <span className="b-priority-note">
                  {priority === 'focus' ? 'Immediate focus' :
                    priority === 'flow' ? 'Upcoming flow' :
                      'Future routine'}
                </span>
              </div>
            )}

            {/* Notes */}
            <div className="b-field">
              <label className="b-label">Notes <span style={{ color: 'var(--text3)' }}>optional</span></label>
              <textarea className="b-input b-textarea-sm" placeholder="Any extra context…" rows={2}
                value={task.notes}
                onChange={e => setTask(t => ({ ...t, notes: e.target.value }))}
              />
            </div>

            <button className="b-submit-btn" onClick={() => submitTask('manual')}
              disabled={isLoading || !task.title}>
              {isLoading ? "Saving..." : <><PlusIcon /> Add Task</>}
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━━━ PLAY MODE ━━━━━━━━ */}
      {view === 'play' && (
        <div className={`b-panel b-panel--tall b-panel--${panelAnim}`} style={{ flexDirection: 'column', gap: 12 }} data-no-drag>
          <button className="b-back" onClick={() => goTo('panel')}><BackIcon /></button>
          <button className="b-close" onClick={() => { closePlayMode(); goTo('icon'); }}><CloseIcon /></button>

          <div className="b-menu-title">Play Mode</div>
          <div className="b-menu-sub">
            {playSession?.stage === 'setup'
              ? 'Review the queue, adjust durations, and start the sprint.'
              : 'Single-focus session, one block at a time'}
          </div>

          {playSession?.stage === 'setup' && playSession.queue?.length ? (
            <>
              <div className="b-play-clock-grid">
                <div className="b-play-clock-tile">
                  <span className="b-play-clock-label">Blocks</span>
                  <strong>{playSession.queue.length}</strong>
                </div>
                <div className="b-play-clock-tile">
                  <span className="b-play-clock-label">Total planned</span>
                  <strong>{formatClock(playSession.overallSeconds)}</strong>
                </div>
              </div>

              <div className="b-play-queue">
                {(() => {
                  const item = playSession.queue[0];
                  const index = 0;
                  return (
                    <div key={item.sub_block_id ?? index} className="b-play-queue-row b-play-queue-row--primary">
                      <div className="b-play-queue-main">
                        <div className="b-play-queue-title">{item.block_title || item.task_title}</div>
                        <div className="b-play-queue-meta">{item.block_title ? item.task_title : `Top Priority Block`}</div>
                      </div>
                      <div className="b-play-queue-controls">
                        <input
                          className="b-play-duration-input"
                          type="number"
                          min="1"
                          step="1"
                          value={playDraftDurations[String(item.sub_block_id ?? index)] ?? item.original_minutes}
                          onChange={e => updatePlayDuration(item.sub_block_id ?? index, e.target.value)}
                        />
                        <span className="b-play-queue-unit">min</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="b-play-actions">
                <button className="b-submit-btn" onClick={beginPlayRun}>Start</button>
              </div>
            </>
          ) : playSession?.current ? (
            <>
              <div className="b-play-clock-grid">
                <div className="b-play-clock-tile">
                  <span className="b-play-clock-label">This block</span>
                  <strong className={playSession.current.remaining_seconds < 0 ? 'b-play-clock-negative' : ''}>
                    {formatClock(playSession.current.remaining_seconds)}
                  </strong>
                </div>
                <div className="b-play-clock-tile">
                  <span className="b-play-clock-label">Total left</span>
                  <strong>{formatClock(playSession.overallSeconds)}</strong>
                </div>
              </div>

              <div className="b-play-current">
                <div className="b-play-current-title">{playSession.current.block_title || playSession.current.task_title}</div>
                <div className="b-play-current-meta">
                  <span>{playSession.current.block_title ? playSession.current.task_title + " • " : ""}⏱ {playSession.current.original_minutes} min</span>
                  <span>{playSession.queue.length - playSession.currentIndex} in rotation</span>
                </div>
              </div>

              <div className="b-play-actions">
                <button className="b-submit-btn" onClick={finishPlayBlock}>Complete</button>
              </div>
            </>
          ) : playSummary ? (
            <>
              <div className="b-play-summary-card">
                <div className="b-play-summary-stat">
                  <span>Blocks</span>
                  <strong>{playSummary.totalBlocks}</strong>
                </div>
                <div className="b-play-summary-stat">
                  <span>Base EXP</span>
                  <strong>{playSummary.totalBaseXp}</strong>
                </div>
                <div className="b-play-summary-stat">
                  <span>Bonus / Penalty</span>
                  <strong>{playSummary.totalBonusXp - playSummary.totalPenalty}</strong>
                </div>
                <div className="b-play-summary-stat">
                  <span>Net EXP</span>
                  <strong>{playSummary.netXp}</strong>
                </div>
              </div>
              <div className="b-play-summary-list" style={{ textAlign: 'center', padding: '16px' }}>
                <p style={{ color: 'var(--text-white)', fontSize: '15px', fontWeight: 600 }}>Great job!</p>
                <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '4px' }}>You stayed focused and completed your session successfully.</p>
              </div>
              <div className="b-play-actions">
                <button className="b-submit-btn" onClick={() => { setPlaySummary(null); startPlayMode(); }}>Replay</button>
              </div>
            </>
          ) : (
            <div className="b-play-empty">
              <p>No active session yet.</p>
              <button className="b-submit-btn" onClick={startPlayMode}>Load Next Session</button>
            </div>
          )}
        </div>
      )}

      {/* ━━━━━━━━ ORB ━━━━━━━━ */}
      <div
        id="bubble-icon"
        className={`b-orb${view !== 'icon' ? ' b-orb--open' : ''}${orbOvertime ? ' b-orb--alarm' : ''}`}
        onMouseDownCapture={beginBubbleDrag}
      >
        <div className="b-ring" />
        <div className="b-ring" style={{ animationDelay: '.85s' }} />
        <span className={stateDotClass} aria-hidden="true" />
        {showOrbTimer
          ? <span className={`b-orb-timer${orbOvertime ? ' b-orb-timer--over' : ''}`}>{formatClock(playSession.current.remaining_seconds)}</span>
          : <BrainIcon />}
      </div>

    </div>
  );
}
