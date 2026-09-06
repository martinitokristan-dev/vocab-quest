import React, { useState, useEffect, useRef } from 'react';
import { api, resolveMediaUrl, type FeedbackAudioItem } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  RotateCcw,
  XCircle,
  ToggleLeft,
  ToggleRight,
  FileAudio,
  X,
  Loader2,
  Globe,
  Crown,
  Volume2,
} from 'lucide-react';

type MapOption = { id: number; title: string; order_index: number };

// Teacher and Kingdom information for elementary school teachers & students
const TEACHER_GUIDES: Record<number, { teacher: string; kingdomName: string }> = {
  1: { teacher: 'Teacher Faith', kingdomName: 'EPCES Adventure Entrance' },
  2: { teacher: 'Teacher Gevina', kingdomName: 'Bayan ng Prosperidad' },
  3: { teacher: 'Principal Flores', kingdomName: 'Provincial Capitol' },
};

// Kingdom theme styling for clean white/light theme
const KINGDOM_COLORS: Record<number, { bg: string; text: string; border: string; activeBtn: string }> = {
  1: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    activeBtn: 'bg-sky-500 text-white font-bold border-sky-500 shadow-sm shadow-sky-500/20',
  },
  2: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    activeBtn: 'bg-purple-600 text-white font-bold border-purple-600 shadow-sm shadow-purple-600/20',
  },
  3: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    activeBtn: 'bg-amber-500 text-white font-bold border-amber-500 shadow-sm shadow-amber-500/20',
  },
};

function KingdomBadge({ mapId, maps }: { mapId: number | null; maps: MapOption[] }) {
  if (mapId == null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <Globe className="w-3 h-3 text-slate-500" />
        All Kingdoms
      </span>
    );
  }
  const map = maps.find((m) => m.id === mapId);
  const order = map?.order_index ?? 1;
  const guide = TEACHER_GUIDES[order];
  const colors = KINGDOM_COLORS[order] ?? KINGDOM_COLORS[1];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
    >
      <Crown className="w-3 h-3" />
      {guide ? `${guide.teacher} • ${map ? map.title : guide.kingdomName}` : map ? map.title : `Kingdom ${mapId}`}
    </span>
  );
}

export const AudioReviewPage: React.FC = () => {
  const { showToast } = useToast();
  const [audios, setAudios] = useState<FeedbackAudioItem[]>([]);
  const [maps, setMaps] = useState<MapOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Library filter tabs
  const [activeTab, setActiveTab] = useState<'all' | 'praise' | 'cheer_up'>('all');
  const [filterMapId, setFilterMapId] = useState<number | null | 'all'>('all');

  // Delete Target State
  const [deleteTarget, setDeleteTarget] = useState<FeedbackAudioItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [selectedType, setSelectedType] = useState<'praise' | 'cheer_up'>('praise');
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null); // null = all kingdoms
  const [phrase, setPhrase] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Live Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingStudioPreview, setIsPlayingStudioPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // List Playback State
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const studioAudioRef = useRef<HTMLAudioElement | null>(null);
  const listAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchAudios();
    fetchMaps();
    return () => {
      stopRecording();
      if (studioAudioRef.current) studioAudioRef.current.pause();
      if (listAudioRef.current) listAudioRef.current.pause();
    };
  }, []);

  const fetchAudios = async () => {
    try {
      setLoading(true);
      const res = await api.getFeedbackAudios();
      setAudios(res.data);
    } catch (err) {
      console.error('Failed to load feedback audios:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaps = async () => {
    try {
      const res = await api.getMaps();
      const sorted = [...res.data].sort((a, b) => a.order_index - b.order_index);
      setMaps(sorted);
    } catch (err) {
      console.warn('Failed to load kingdoms:', err);
    }
  };

  const startRecording = async () => {
    try {
      setFormError(null);
      clearRecorder();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setFormError('Microphone permission required to record.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearRecorder();
    setAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
  };

  const clearRecorder = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioFile(null);
    if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
    if (studioAudioRef.current) studioAudioRef.current.pause();
    setIsPlayingStudioPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleStudioAudioPlayback = () => {
    if (!audioPreviewUrl) return;
    if (!studioAudioRef.current) {
      studioAudioRef.current = new Audio(audioPreviewUrl);
      studioAudioRef.current.onended = () => setIsPlayingStudioPreview(false);
      studioAudioRef.current.onpause = () => setIsPlayingStudioPreview(false);
      studioAudioRef.current.onplay = () => setIsPlayingStudioPreview(true);
    }
    if (studioAudioRef.current.src !== audioPreviewUrl) {
      studioAudioRef.current.src = audioPreviewUrl;
    }
    if (isPlayingStudioPreview) {
      studioAudioRef.current.pause();
    } else {
      studioAudioRef.current.play().catch(() => {});
    }
  };

  const handleSaveFeedbackAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!phrase.trim()) {
      setFormError('Please type what the teacher says.');
      return;
    }
    if (!audioBlob && !audioFile) {
      setFormError('Please record your voice or upload an audio file.');
      return;
    }

    try {
      setSaving(true);
      await api.uploadFeedbackAudio({
        type: selectedType,
        phrase: phrase.trim(),
        audio_file: audioBlob || audioFile,
        map_id: selectedMapId,
      });

      clearRecorder();
      setPhrase('');
      showToast('Voice feedback saved successfully!', 'success');
      // Optimistic update: add new item to state without reloading
      const newAudio = {
        id: Date.now(), // temporary ID
        type: selectedType,
        phrase: phrase.trim(),
        audio_url: audioPreviewUrl || '',
        is_active: true,
        map_id: selectedMapId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setAudios((prev) => [newAudio, ...prev]);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save voice feedback.');
      showToast(err.message || 'Failed to save voice feedback.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      await api.toggleFeedbackAudio(id);
      showToast('Voice feedback status updated.', 'info');
      // Optimistic update: toggle the item in state without reloading
      setAudios((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_active: !item.is_active } : item
        )
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const confirmDeleteAudio = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteFeedbackAudio(deleteTarget.id);
      showToast('Voice feedback deleted.', 'info');
      setDeleteTarget(null);
      // Optimistic update: remove the item from state without reloading
      setAudios((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    } catch (err: any) {
      setDeleteTarget(null);
      showToast(err.message || 'Failed to delete voice feedback', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handlePlayListItem = (id: number, url: string) => {
    if (playingAudioId === id) {
      if (listAudioRef.current) listAudioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }
    if (!listAudioRef.current) {
      listAudioRef.current = new Audio();
      listAudioRef.current.onended = () => setPlayingAudioId(null);
      listAudioRef.current.onpause = () => setPlayingAudioId(null);
    }
    listAudioRef.current.src = resolveMediaUrl(url);
    listAudioRef.current.play().catch(() => {});
    setPlayingAudioId(id);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Derived lists
  const praiseList = audios.filter((a) => a.type === 'praise');
  const cheerUpList = audios.filter((a) => a.type === 'cheer_up');
  
  // Filter by kingdom
  const filteredPraiseList =
    filterMapId === 'all'
      ? praiseList
      : filterMapId === null
      ? praiseList.filter((a) => a.map_id == null)
      : praiseList.filter((a) => a.map_id === filterMapId);
  
  const filteredCheerUpList =
    filterMapId === 'all'
      ? cheerUpList
      : filterMapId === null
      ? cheerUpList.filter((a) => a.map_id == null)
      : cheerUpList.filter((a) => a.map_id === filterMapId);
  
  const typeFiltered =
    activeTab === 'praise' ? filteredPraiseList : activeTab === 'cheer_up' ? filteredCheerUpList : audios;

  const displayedAudios =
    filterMapId === 'all'
      ? typeFiltered
      : filterMapId === null
      ? typeFiltered.filter((a) => a.map_id == null)
      : typeFiltered.filter((a) => a.map_id === filterMapId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-emerald-600" />
          <span>Audio Feedback Studio</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Record or upload teacher voice messages played when elementary students answer questions.
        </p>
      </div>

      {/* Recording Studio Card */}
      <div className="surface-card p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm bg-white text-slate-900">
        <form onSubmit={handleSaveFeedbackAudio} className="space-y-6">
          {/* Step 1: Feedback Type */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                1
              </span>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                When should this audio play?
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Correct Answer */}
              <button
                type="button"
                onClick={() => {
                  setSelectedType('praise');
                  clearRecorder();
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  selectedType === 'praise'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg shrink-0 ${
                    selectedType === 'praise'
                      ? 'bg-emerald-500 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div
                    className={`text-sm font-bold ${
                      selectedType === 'praise' ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    Correct Answer
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Plays when the student chooses the right answer (Praise & Cheer)
                  </div>
                </div>
              </button>

              {/* Option B: Incorrect / Try Again */}
              <button
                type="button"
                onClick={() => {
                  setSelectedType('cheer_up');
                  clearRecorder();
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  selectedType === 'cheer_up'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg shrink-0 ${
                    selectedType === 'cheer_up'
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <div
                    className={`text-sm font-bold ${
                      selectedType === 'cheer_up' ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    Incorrect / Try Again
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Gentle encouragement to motivate students to try again (Cheer Up)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Kingdom / Teacher Assignment */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                2
              </span>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Which teacher or kingdom will say this?
              </label>
            </div>

            <select
              value={selectedMapId === null ? 'universal' : selectedMapId || ''}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedMapId(value === 'universal' ? null : Number(value));
              }}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all"
            >
              <option value="universal">All Kingdoms & Teachers (Universal)</option>
              {maps.map((map) => {
                const order = map.order_index;
                const guide = TEACHER_GUIDES[order];
                return (
                  <option key={map.id} value={map.id}>
                    {guide ? `${guide.teacher} (${map.title})` : map.title}
                  </option>
                );
              })}
            </select>

            {/* Active Kingdom selection badge */}
            <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-2">
              <span className="text-slate-500">Will play during:</span>
              <KingdomBadge mapId={selectedMapId} maps={maps} />
            </div>
          </div>

          {/* Step 3: Message Script */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  3
                </span>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  What does the teacher say?
                </label>
              </div>
              <span className="text-[11px] text-slate-500">Appears as subtitles on student screen</span>
            </div>

            <input
              type="text"
              required
              placeholder={
                selectedType === 'praise'
                  ? 'e.g. Awesome job! You found the right answer!'
                  : 'e.g. Good try! Look at the clues and try once more!'
              }
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="minimal-input text-sm py-2.5 px-3.5"
            />
          </div>

          {/* Step 4: Record or Upload Audio */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                4
              </span>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Teacher Voice Audio
              </label>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              {!isRecording && !audioPreviewUrl && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={startRecording}
                    className="py-3 px-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
                  >
                    <Mic className="w-4 h-4 text-emerald-600" />
                    <span>Record with Microphone</span>
                  </button>

                  <label className="py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <span>Upload Audio File (Any Format)</span>
                  </label>
                </div>
              )}

              {/* Active Recording State */}
              {isRecording && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-rose-700 text-xs font-bold">
                    <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                    <span>Recording voice: {formatSeconds(recordingSeconds)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Finish Recording</span>
                  </button>
                </div>
              )}

              {/* Audio Preview State */}
              {audioPreviewUrl && !isRecording && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 text-xs text-slate-800 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileAudio className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-900 truncate">
                        {audioFile ? audioFile.name : 'Voice recording ready'}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-semibold">Ready to save</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleStudioAudioPlayback}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      {isPlayingStudioPreview ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-white" />
                      )}
                      <span>{isPlayingStudioPreview ? 'Pause' : 'Test Audio'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={startRecording}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Re-record"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={clearRecorder}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Discard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <X className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Footer Action */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              {!phrase.trim() || (!audioBlob && !audioFile) ? (
                <span>💡 Type what the teacher says and record or upload audio to save.</span>
              ) : (
                <span className="text-emerald-700 font-semibold">✓ Ready to save feedback audio!</span>
              )}
            </div>
            <button
              type="submit"
              disabled={saving || isRecording || !phrase.trim() || (!audioBlob && !audioFile)}
              className="btn-primary text-xs font-bold py-2.5 px-5 shadow-sm cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Voice Feedback...</span>
                </>
              ) : (
                <span>Save Voice Feedback</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Feedback Audio Library */}
      <div className="space-y-4 pt-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Saved Voice Feedbacks</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage voice feedback messages currently available to students during gameplay.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white border border-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Messages ({audios.length})
            </button>
            <button
              onClick={() => setActiveTab('praise')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'praise'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Correct Answers ({filteredPraiseList.length})
            </button>
            <button
              onClick={() => setActiveTab('cheer_up')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'cheer_up'
                  ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Try Again Clips ({filteredCheerUpList.length})
            </button>
          </div>

          {/* Kingdom Filter */}
          {maps.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Filter Kingdom:
              </label>
              <select
                value={filterMapId === 'all' ? 'all' : filterMapId === null ? 'universal' : filterMapId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') {
                    setFilterMapId('all');
                  } else if (value === 'universal') {
                    setFilterMapId(null);
                  } else {
                    setFilterMapId(Number(value));
                  }
                }}
                className="w-full px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all"
              >
                <option value="all">All Kingdoms</option>
                <option value="universal">Universal (All Kingdoms)</option>
                {maps.map((map) => {
                  const order = map.order_index;
                  const guide = TEACHER_GUIDES[order];
                  return (
                    <option key={map.id} value={map.id}>
                      {guide ? `${guide.teacher} (${map.title})` : map.title}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Audio Cards */}
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading audio library...</div>
        ) : displayedAudios.length === 0 ? (
          <div className="surface-card p-8 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
            No feedback audio recordings found for this selection.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayedAudios.map((item) => (
              <div
                key={item.id}
                className="surface-card p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between gap-3 bg-white shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Feedback type badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.type === 'praise'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.type === 'praise' ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Correct
                          </>
                        ) : (
                          <>
                            <XCircle className="w-2.5 h-2.5" />
                            Try Again
                          </>
                        )}
                      </span>

                      {/* Kingdom indicator badge */}
                      <KingdomBadge mapId={item.map_id} maps={maps} />
                    </div>

                    {/* Active in game indicator */}
                    <span
                      className={`text-[10px] font-semibold flex items-center gap-1 ${
                        item.is_active ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      {item.is_active ? 'Active' : 'Muted'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 leading-snug">"{item.phrase}"</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handlePlayListItem(item.id, item.audio_url)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      playingAudioId === item.id
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm font-bold'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                    }`}
                  >
                    {playingAudioId === item.id ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Playing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(item.id)}
                      className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
                      title={item.is_active ? 'Click to mute' : 'Click to activate'}
                    >
                      {item.is_active ? (
                        <ToggleRight className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      title="Delete voice clip"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Delete Voice Feedback</h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Are you sure you want to delete <span className="font-bold text-slate-900">"{deleteTarget.phrase}"</span>?
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                This voice recording will be permanently removed and will no longer play during gameplay.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAudio}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Clip</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
