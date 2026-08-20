import React, { useState, useEffect, useRef } from 'react';
import { api, resolveMediaUrl, type FeedbackAudioItem } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Heart,
  ToggleLeft,
  ToggleRight,
  FileAudio,
  X,
  Loader2,
} from 'lucide-react';

const PRAISE_PRESETS = [
  'Fantastic job! That is the correct answer!',
  'Excellent work! You are a true vocabulary champion!',
  'Outstanding! You found the exact meaning!',
  'Superb! Keep conquering the quest!',
];

const CHEER_UP_PRESETS = [
  "Good try! Don't give up, give it another shot!",
  'Almost there! Listen closely and choose the best meaning.',
  'That is okay! Think about the clue and try again.',
];

export const AudioReviewPage: React.FC = () => {
  const { showToast } = useToast();
  const [audios, setAudios] = useState<FeedbackAudioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'praise' | 'cheer_up'>('all');

  // Delete Target State
  const [deleteTarget, setDeleteTarget] = useState<FeedbackAudioItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [selectedType, setSelectedType] = useState<'praise' | 'cheer_up'>('praise');
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
    if (file.type.startsWith('audio/')) {
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file));
    } else {
      setFormError('Please select a valid audio file (MP3, WAV, M4A, WebM).');
    }
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
      setFormError('Please enter a phrase for this voiceover.');
      return;
    }
    if (!audioBlob && !audioFile) {
      setFormError('Please record or upload an audio file.');
      return;
    }

    try {
      setSaving(true);
      await api.uploadFeedbackAudio({
        type: selectedType,
        phrase: phrase.trim(),
        audio_file: audioBlob || audioFile,
      });

      clearRecorder();
      setPhrase('');
      showToast('Voiceover clip uploaded and saved successfully!', 'success');
      fetchAudios();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save voiceover.');
      showToast(err.message || 'Failed to save voiceover.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      await api.toggleFeedbackAudio(id);
      showToast('Voiceover clip status updated.', 'info');
      fetchAudios();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const confirmDeleteAudio = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteFeedbackAudio(deleteTarget.id);
      showToast('Voiceover clip deleted successfully.', 'info');
      setDeleteTarget(null);
      fetchAudios();
    } catch (err: any) {
      setDeleteTarget(null);
      showToast(err.message || 'Failed to delete voiceover', 'error');
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

  const praiseList = audios.filter((a) => a.type === 'praise');
  const cheerUpList = audios.filter((a) => a.type === 'cheer_up');
  const displayedAudios =
    activeTab === 'praise' ? praiseList : activeTab === 'cheer_up' ? cheerUpList : audios;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-xl font-bold text-white tracking-tight">Voice Studio</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Record custom praise and cheer-up voiceovers shuffled automatically in game
        </p>
      </div>

      {/* Recording Studio Card */}
      <div className="surface-card p-5 rounded-xl border border-white/5 space-y-4">
        {/* Category Switch */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => {
                setSelectedType('praise');
                clearRecorder();
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                selectedType === 'praise'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Correct Praise</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedType('cheer_up');
                clearRecorder();
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                selectedType === 'cheer_up'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Wrong Cheer-Up</span>
            </button>
          </div>
        </div>

        {formError && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {formError}
          </div>
        )}

        <form onSubmit={handleSaveFeedbackAudio} className="space-y-4">
          {/* Phrase Input & Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Spoken Phrase *</label>
            <input
              type="text"
              required
              placeholder={
                selectedType === 'praise'
                  ? 'e.g. Fantastic job! That is the correct answer!'
                  : "e.g. Good try! Don't give up, give it another shot!"
              }
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="minimal-input text-xs"
            />

            {/* Quick Inspiration Pills */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {(selectedType === 'praise' ? PRAISE_PRESETS : CHEER_UP_PRESETS).map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => setPhrase(preset)}
                  className="px-2 py-0.5 rounded text-[11px] bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-white/5 cursor-pointer"
                >
                  "{preset}"
                </button>
              ))}
            </div>
          </div>

          {/* Recording & Upload Options */}
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 space-y-3">
            {!isRecording && !audioPreviewUrl && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={startRecording}
                  className="py-2.5 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  <span>Record with Microphone</span>
                </button>

                <label className="py-2.5 px-3 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="w-4 h-4" />
                  <span>Upload Audio File</span>
                </label>
              </div>
            )}

            {/* Active Recording Bar */}
            {isRecording && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>Recording: {formatSeconds(recordingSeconds)}</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop</span>
                </button>
              </div>
            )}

            {/* Audio Preview Bar */}
            {audioPreviewUrl && !isRecording && (
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-200 min-w-0">
                  <FileAudio className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate max-w-[240px]">
                    {audioFile ? audioFile.name : 'Voice recording ready'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleStudioAudioPlayback}
                    className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    {isPlayingStudioPreview ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-slate-950" />}
                    <span>{isPlayingStudioPreview ? 'Pause' : 'Test'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                    title="Re-record"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={clearRecorder}
                    className="p-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                    title="Discard"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving || isRecording || (!audioBlob && !audioFile)}
              className="btn-primary text-xs font-bold"
            >
              {saving ? 'Saving...' : 'Save Voice Clip'}
            </button>
          </div>
        </form>
      </div>

      {/* Library */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 pb-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({audios.length})
          </button>
          <button
            onClick={() => setActiveTab('praise')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'praise'
                ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Correct ({praiseList.length})
          </button>
          <button
            onClick={() => setActiveTab('cheer_up')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'cheer_up'
                ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Cheer-Up ({cheerUpList.length})
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading audio library...</div>
        ) : displayedAudios.length === 0 ? (
          <div className="surface-card p-8 text-center text-zinc-500 text-xs">No voiceover clips found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayedAudios.map((item) => (
              <div
                key={item.id}
                className="surface-card p-3.5 rounded-xl border border-white/5 flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.type === 'praise'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {item.type === 'praise' ? 'Praise' : 'Cheer-Up'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-white truncate">"{item.phrase}"</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handlePlayListItem(item.id, item.audio_url)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      playingAudioId === item.id
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
                    }`}
                    title="Play voiceover clip"
                  >
                    {playingAudioId === item.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleToggleActive(item.id)}
                    className="cursor-pointer p-1 text-zinc-400 hover:text-white"
                    title={item.is_active ? 'Active in shuffle' : 'Disabled in shuffle'}
                  >
                    {item.is_active ? (
                      <ToggleRight className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-zinc-600" />
                    )}
                  </button>

                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                    title="Delete clip"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">Delete Voiceover</h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-zinc-300">
                Delete voiceover phrase <span className="font-semibold text-white">"{deleteTarget.phrase}"</span>?
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This voice recording will be removed from gameplay feedback shuffles.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-white/8 cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAudio}
                disabled={deleting}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Clip
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
