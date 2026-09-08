import React, { useState, useEffect, useRef } from 'react';
import { api, resolveMediaUrl, type FeedbackAudioItem } from '../services/api';
import { useToast } from '../context/ToastContext';
import { broadcastSync, subscribeSync } from '../utils/realtimeSync';
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
  Upload,
  Pencil,
} from 'lucide-react';

type MapOption = { id: number; title: string; order_index: number };

// Teacher and Kingdom information for elementary school teachers & students
const TEACHER_GUIDES: Record<number, { teacher: string; kingdomName: string }> = {
  1: { teacher: 'Teacher Faith', kingdomName: 'EPCES Elementary & Riverside' },
  2: { teacher: 'Teacher Gevina', kingdomName: 'Ancient Library & Enchanted Forest' },
  3: { teacher: 'Teacher Yanna', kingdomName: 'Provincial Capitol' },
};



function KingdomBadge({ mapId, maps }: { mapId: number | null; maps: MapOption[] }) {
  if (mapId == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
        <Globe className="w-3 h-3 text-slate-400" />
        <span>All Kingdoms</span>
      </span>
    );
  }
  const map = maps.find((m) => m.id === mapId);
  const order = map?.order_index ?? 1;
  const guide = TEACHER_GUIDES[order];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
      <Crown className="w-3 h-3 text-slate-400" />
      <span>{guide ? `${guide.teacher} • ${map ? map.title : guide.kingdomName}` : map ? map.title : `Kingdom ${mapId}`}</span>
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

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<FeedbackAudioItem | null>(null);
  const [editPhrase, setEditPhrase] = useState('');
  const [editType, setEditType] = useState<'praise' | 'cheer_up'>('praise');
  const [editMapId, setEditMapId] = useState<number | null>(null);
  const [editAudioBlob, setEditAudioBlob] = useState<Blob | null>(null);
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
  const [editAudioPreviewUrl, setEditAudioPreviewUrl] = useState<string | null>(null);
  const [isEditRecording, setIsEditRecording] = useState(false);
  const [editRecordingSeconds, setEditRecordingSeconds] = useState(0);
  const [isPlayingEditAudio, setIsPlayingEditAudio] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const studioAudioRef = useRef<HTMLAudioElement | null>(null);
  const listAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  const editMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const editAudioChunksRef = useRef<Blob[]>([]);
  const editTimerIntervalRef = useRef<any>(null);
  const editAudioRef = useRef<HTMLAudioElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchAudios();
    fetchMaps();
    const unsub = subscribeSync((msg) => {
      if (msg.type === 'FEEDBACK_AUDIO_CHANGED') {
        fetchAudios(true);
      }
    });
    return () => {
      unsub();
      stopRecording();
      if (editTimerIntervalRef.current) clearInterval(editTimerIntervalRef.current);
      if (editMediaRecorderRef.current && editMediaRecorderRef.current.state !== 'inactive') {
        editMediaRecorderRef.current.stop();
      }
      if (studioAudioRef.current) studioAudioRef.current.pause();
      if (listAudioRef.current) listAudioRef.current.pause();
      if (editAudioRef.current) editAudioRef.current.pause();
    };
  }, []);

  const fetchAudios = async (skipCache = false) => {
    try {
      setLoading(true);
      const res = await api.getFeedbackAudios(skipCache);
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
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
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
      // Authoritative update: directly fetch fresh active audios from server
      await fetchAudios(true);
      // Instant broadcast to all open game tabs (0ms delay, zero polling)
      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
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
      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
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
      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
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

  const openEditModal = (item: FeedbackAudioItem) => {
    setEditingItem(item);
    setEditPhrase(item.phrase);
    setEditType(item.type);
    setEditMapId(item.map_id);
    setEditAudioBlob(null);
    setEditAudioFile(null);
    if (editAudioPreviewUrl && editAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editAudioPreviewUrl);
    }
    setEditAudioPreviewUrl(null);
    setIsEditRecording(false);
    setEditRecordingSeconds(0);
    setIsPlayingEditAudio(false);
    setEditError(null);
  };

  const closeEditModal = () => {
    stopEditRecording();
    if (editAudioRef.current) {
      editAudioRef.current.pause();
      setIsPlayingEditAudio(false);
    }
    if (editAudioPreviewUrl && editAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editAudioPreviewUrl);
    }
    setEditingItem(null);
    setEditAudioBlob(null);
    setEditAudioFile(null);
    setEditAudioPreviewUrl(null);
    setIsEditRecording(false);
    setEditRecordingSeconds(0);
    setEditError(null);
  };

  const startEditRecording = async () => {
    try {
      setEditError(null);
      clearEditAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      editAudioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm') && MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      editMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          editAudioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(editAudioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setEditAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setEditAudioPreviewUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100);
      setIsEditRecording(true);
      setEditRecordingSeconds(0);

      editTimerIntervalRef.current = setInterval(() => {
        setEditRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error in edit modal:', err);
      setEditError('Unable to access microphone. Please check browser permissions.');
    }
  };

  const stopEditRecording = () => {
    if (editTimerIntervalRef.current) {
      clearInterval(editTimerIntervalRef.current);
      editTimerIntervalRef.current = null;
    }
    if (editMediaRecorderRef.current && editMediaRecorderRef.current.state !== 'inactive') {
      editMediaRecorderRef.current.stop();
    }
    setIsEditRecording(false);
  };

  const clearEditAudio = () => {
    if (editAudioPreviewUrl && editAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editAudioPreviewUrl);
    }
    setEditAudioBlob(null);
    setEditAudioFile(null);
    setEditAudioPreviewUrl(null);
    if (editAudioRef.current) {
      editAudioRef.current.pause();
      setIsPlayingEditAudio(false);
    }
  };

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearEditAudio();
    setEditAudioFile(file);
    const url = URL.createObjectURL(file);
    setEditAudioPreviewUrl(url);
  };

  const handlePlayEditCurrent = (url: string) => {
    if (isPlayingEditAudio) {
      if (editAudioRef.current) editAudioRef.current.pause();
      setIsPlayingEditAudio(false);
      return;
    }
    if (!editAudioRef.current) {
      editAudioRef.current = new Audio();
      editAudioRef.current.onended = () => setIsPlayingEditAudio(false);
      editAudioRef.current.onpause = () => setIsPlayingEditAudio(false);
    }
    editAudioRef.current.src = resolveMediaUrl(url);
    editAudioRef.current.play().catch(() => {});
    setIsPlayingEditAudio(true);
  };

  const handlePlayEditPreview = () => {
    if (!editAudioPreviewUrl) return;
    if (isPlayingEditAudio) {
      if (editAudioRef.current) editAudioRef.current.pause();
      setIsPlayingEditAudio(false);
      return;
    }
    if (!editAudioRef.current) {
      editAudioRef.current = new Audio();
      editAudioRef.current.onended = () => setIsPlayingEditAudio(false);
      editAudioRef.current.onpause = () => setIsPlayingEditAudio(false);
    }
    editAudioRef.current.src = editAudioPreviewUrl;
    editAudioRef.current.play().catch(() => {});
    setIsPlayingEditAudio(true);
  };

  const handleSaveEditedAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditError(null);

    if (!editPhrase.trim()) {
      setEditError('Please enter what the teacher says (phrase).');
      return;
    }

    try {
      setEditSaving(true);
      await api.updateFeedbackAudio(editingItem.id, {
        phrase: editPhrase.trim(),
        type: editType,
        map_id: editMapId,
        audio_file: editAudioBlob || editAudioFile || undefined,
      });

      showToast('Voice feedback updated successfully!', 'success');
      await fetchAudios(true);
      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
      closeEditModal();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update voice feedback.');
      showToast(err.message || 'Failed to update voice feedback.', 'error');
    } finally {
      setEditSaving(false);
    }
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

  const isVideoFile =
    !!audioFile &&
    (audioFile.type.startsWith('video/') ||
      /\.(mp4|webm|ogg|mov|mkv)$/i.test(audioFile.name));

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
      <div className="surface-card p-6 rounded-2xl border border-slate-200/80 space-y-6 shadow-xs bg-white text-slate-900">
        <form onSubmit={handleSaveFeedbackAudio} className="space-y-6">
          {/* Step 1: Feedback Type */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                1
              </span>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Trigger Event
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
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                  selectedType === 'praise'
                    ? 'bg-emerald-50/40 border-emerald-500/80 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50/50'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    selectedType === 'praise'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Correct Answer
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Plays when student chooses the right answer (Praise & Cheer)
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
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                  selectedType === 'cheer_up'
                    ? 'bg-amber-50/40 border-amber-500/80 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50/50'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    selectedType === 'cheer_up'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Incorrect / Try Again
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Gentle encouragement to motivate students to try again
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Kingdom / Teacher Assignment */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                2
              </span>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Teacher / Kingdom
              </label>
            </div>

            <select
              value={selectedMapId === null ? 'universal' : selectedMapId || ''}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedMapId(value === 'universal' ? null : Number(value));
              }}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 transition-colors"
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
          </div>

          {/* Step 3: Message Script */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                  3
                </span>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Teacher Spoken Line
                </label>
              </div>
              <span className="text-[11px] text-slate-400">Subtitle on student screen</span>
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
              className="minimal-input text-xs py-2.5 px-3.5"
            />
          </div>

          {/* Step 4: Record or Upload Audio */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                4
              </span>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Voice Audio Recording
              </label>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
              {!isRecording && !audioPreviewUrl && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={startRecording}
                      className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <Mic className="w-4 h-4 text-emerald-600" />
                      <span>Record Mic</span>
                      <span className="text-[10px] text-slate-400 font-normal">Live Voice</span>
                    </button>

                    <label className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Upload Audio</span>
                      <span className="text-[10px] text-slate-400 font-normal">MP3, WAV, M4A</span>
                    </label>

                    <label className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs">
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/ogg,.mp4,.webm"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Volume2 className="w-4 h-4 text-indigo-500" />
                      <span>Upload Video</span>
                      <span className="text-[10px] text-slate-400 font-normal">MP4, WebM (Audio track)</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Accepts all formats (MP3, WAV, WebM, MP4). Only audio is used during gameplay (no video display).
                  </p>
                </div>
              )}

              {/* Active Recording State */}
              {isRecording && (
                <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-rose-700 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>Recording: {formatSeconds(recordingSeconds)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Finish</span>
                  </button>
                </div>
              )}

              {/* Video Preview Bar (Audio only, with Test Audio button!) */}
              {audioPreviewUrl && !isRecording && isVideoFile && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 text-xs text-slate-800 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 text-xs">
                        {audioFile ? audioFile.name : 'MP4 Voice Recording ready'}
                      </div>
                      <div className="text-[10px] text-indigo-700 font-medium flex items-center gap-1">
                        <span>MP4 Video Recording (Audio Only — No Video Display)</span>
                        {audioFile && <span>• {(audioFile.size / 1024).toFixed(1)} KB</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleStudioAudioPlayback}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
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
                      onClick={clearRecorder}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Discard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Preview Bar */}
              {audioPreviewUrl && !isRecording && !isVideoFile && (
                <div className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 text-xs text-slate-800 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileAudio className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 text-xs">
                        {audioFile ? audioFile.name : 'Voice recording ready'}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                        <span>Audio Voiceover</span>
                        {audioFile && <span>• {(audioFile.size / 1024).toFixed(1)} KB</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleStudioAudioPlayback}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
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
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Re-record"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={clearRecorder}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
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
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-400">
              {!phrase.trim() || (!audioBlob && !audioFile) ? (
                <span>Type spoken line and record/upload audio to save.</span>
              ) : (
                <span className="text-emerald-600 font-medium">Ready to save feedback audio</span>
              )}
            </div>
            <button
              type="submit"
              disabled={saving || isRecording || !phrase.trim() || (!audioBlob && !audioFile)}
              className="btn-primary text-xs font-semibold py-2 px-4 shadow-xs cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
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
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Saved Voice Feedbacks</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Voice feedback messages currently available to students during gameplay
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          {/* Category Segmented Control */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/60">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-emerald-800 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({audios.length})
            </button>
            <button
              onClick={() => setActiveTab('praise')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                activeTab === 'praise'
                  ? 'bg-white text-emerald-700 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Correct ({filteredPraiseList.length})
            </button>
            <button
              onClick={() => setActiveTab('cheer_up')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                activeTab === 'cheer_up'
                  ? 'bg-white text-amber-700 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Try Again ({filteredCheerUpList.length})
            </button>
          </div>

          {/* Kingdom Filter */}
          {maps.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-slate-400">Kingdom:</label>
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
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none transition-colors"
              >
                <option value="all">All Kingdoms</option>
                <option value="universal">Universal</option>
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
          <div className="p-8 text-center text-xs text-slate-400">Loading audio library...</div>
        ) : displayedAudios.length === 0 ? (
          <div className="surface-card p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200/80">
            No feedback audio recordings found for this selection.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayedAudios.map((item) => (
              <div
                key={item.id}
                className="surface-card p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors flex flex-col justify-between gap-3 bg-white shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.type === 'praise' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Correct</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <XCircle className="w-3 h-3" />
                          <span>Try Again</span>
                        </span>
                      )}

                      <span className="text-slate-300">•</span>

                      {/* Kingdom indicator badge */}
                      <KingdomBadge mapId={item.map_id} maps={maps} />
                    </div>

                    {/* Active in game indicator */}
                    <span
                      className={`text-[11px] font-medium flex items-center gap-1.5 ${
                        item.is_active ? 'text-emerald-600' : 'text-slate-400'
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

                  <p className="text-xs font-medium text-slate-800 leading-relaxed">"{item.phrase}"</p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                  <button
                    onClick={() => handlePlayListItem(item.id, item.audio_url)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                      playingAudioId === item.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {playingAudioId === item.id ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Playing</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-slate-500" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(item.id)}
                      className="cursor-pointer p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                      title={item.is_active ? 'Click to mute' : 'Click to activate'}
                      aria-label="Toggle active"
                    >
                      {item.is_active ? (
                        <ToggleRight className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit voice feedback"
                      aria-label="Edit voice feedback"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete voice clip"
                      aria-label="Delete voice clip"
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

      {/* Edit Feedback Audio Modal */}
      {editingItem && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-5 text-slate-900 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Voice Feedback</h3>
                  <p className="text-[11px] text-slate-400">Update phrase, type, kingdom, or voice recording</p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditedAudio} className="space-y-4">
              {/* Category / Type Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Feedback Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditType('praise')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editType === 'praise'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Correct (Praise)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditType('cheer_up')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editType === 'cheer_up'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-amber-600" />
                    <span>Try Again (Encourage)</span>
                  </button>
                </div>
              </div>

              {/* Phrase Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  What Teacher Says (Phrase)
                </label>
                <input
                  type="text"
                  value={editPhrase}
                  onChange={(e) => setEditPhrase(e.target.value)}
                  placeholder="e.g. Great job!, Kaya mo yan!, Amazing work!"
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* Kingdom Assignment */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kingdom / Guide Assignment
                </label>
                <select
                  value={editMapId === null ? 'universal' : editMapId}
                  onChange={(e) => setEditMapId(e.target.value === 'universal' ? null : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="universal">Universal (All Kingdoms & Teachers)</option>
                  {maps.map((map) => {
                    const order = map.order_index;
                    const guide = TEACHER_GUIDES[order];
                    return (
                      <option key={map.id} value={map.id}>
                        {guide ? `${guide.teacher} • ${map.title}` : map.title}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Audio Section */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Voice Audio
                </label>
                
                {/* Current Audio playback preview */}
                {!editAudioPreviewUrl && editingItem.audio_url && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-700 font-medium">Current Audio</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePlayEditCurrent(editingItem.audio_url)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      {isPlayingEditAudio ? (
                        <>
                          <Pause className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-slate-500" />
                          <span>Test Audio</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* If new audio preview exists */}
                {editAudioPreviewUrl && (
                  <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 text-indigo-700 text-xs font-medium">
                      <Volume2 className="w-4 h-4" />
                      <span>New Audio Ready</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePlayEditPreview}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 flex items-center gap-1 cursor-pointer"
                      >
                        {isPlayingEditAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isPlayingEditAudio ? 'Pause' : 'Play'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={clearEditAudio}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                        title="Discard new audio"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Optional Replace Recording / Upload */}
                {!isEditRecording && !editAudioPreviewUrl && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={startEditRecording}
                      className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Replace (Mic)</span>
                    </button>
                    <label className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="audio/*,video/mp4,video/webm,.mp3,.wav,.ogg,.m4a,.mp4,.webm"
                        onChange={handleEditFileUpload}
                        className="hidden"
                      />
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Replace (File)</span>
                    </label>
                  </div>
                )}

                {isEditRecording && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2 text-rose-700 text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>Recording: {formatSeconds(editRecordingSeconds)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={stopEditRecording}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-white" />
                      <span>Finish</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
