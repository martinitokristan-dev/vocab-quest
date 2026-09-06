import React, { useState, useEffect, useRef } from 'react';
import { api, resolveMediaUrl, type MapData, type QuestionData } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Trash2,
  CheckCircle2,
  Mic,
  Upload,
  Play,
  Pause,
  X,
  FileAudio,
  Loader2,
  Crown,
  Volume2,
  Image as ImageIcon,
  BookOpen,
  Type,
  Target,
  Check,
  Video,
} from 'lucide-react';

// Teacher and Kingdom information for elementary school teachers & students
const TEACHER_GUIDES: Record<number, { teacher: string; kingdomName: string }> = {
  1: { teacher: 'Teacher Faith', kingdomName: 'EPCES Adventure Entrance' },
  2: { teacher: 'Teacher Gevina', kingdomName: 'Bayan ng Prosperidad' },
  3: { teacher: 'Principal Flores', kingdomName: 'Provincial Capitol' },
};

// Kingdom theme styling for clean default white/light theme
const KINGDOM_COLORS: Record<number, { bg: string; text: string; border: string; activeTab: string }> = {
  1: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    activeTab: 'bg-sky-500 text-white font-bold border-sky-500 shadow-sm shadow-sky-500/20',
  },
  2: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    activeTab: 'bg-purple-600 text-white font-bold border-purple-600 shadow-sm shadow-purple-600/20',
  },
  3: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    activeTab: 'bg-amber-500 text-white font-bold border-amber-500 shadow-sm shadow-amber-500/20',
  },
};

// Helper: Highlights the target vocabulary word inside the context sentence and underlines the context clue
function renderHighlightedSentence(sentence: string, targetWord?: string, contextClue?: string) {
  if (!sentence) return '';
  const escapedWord = targetWord ? targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const escapedClue = contextClue ? contextClue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

  const patterns: string[] = [];
  if (escapedWord) patterns.push(escapedWord);
  if (escapedClue) patterns.push(escapedClue);
  if (patterns.length === 0) return sentence;

  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
  const parts = sentence.split(regex);
  return (
    <span>
      {parts.map((part, i) => {
        const lower = part.toLowerCase();
        if (targetWord && lower === targetWord.toLowerCase()) {
          return (
            <span
              key={i}
              className="text-amber-900 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300"
              title="Target Word (Yellow Highlight)"
            >
              {part}
            </span>
          );
        }
        if (contextClue && lower === contextClue.toLowerCase()) {
          return (
            <span
              key={i}
              className="text-sky-900 font-bold underline decoration-sky-600 decoration-2 underline-offset-2 bg-sky-50 px-1 py-0.5 rounded"
              title="Context Clue (Underlined)"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export const QuestionsPage: React.FC = () => {
  const { showToast } = useToast();
  const [maps, setMaps] = useState<MapData[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete Target State
  const [deleteTarget, setDeleteTarget] = useState<QuestionData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [sentence, setSentence] = useState('');
  const [highlightedWord, setHighlightedWord] = useState('');
  const [contextClue, setContextClue] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Voiceover State
  const [voiceAudioBlob, setVoiceAudioBlob] = useState<Blob | null>(null);
  const [voiceAudioFile, setVoiceAudioFile] = useState<File | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState('');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  
  // Video State
  const [voiceVideoFile, setVoiceVideoFile] = useState<File | null>(null);
  const [voiceVideoUrl, setVoiceVideoUrl] = useState('');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [voiceMediaType, setVoiceMediaType] = useState<'audio' | 'video' | 'none'>('none');

  // Live Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playingListAudioId, setPlayingListAudioId] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);
  const listAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  const [questionType, setQuestionType] = useState<'multiple_choice' | 'identification'>('multiple_choice');
  const [identificationAnswer, setIdentificationAnswer] = useState('');

  const [answers, setAnswers] = useState<{ text: string; is_correct: boolean }[]>([
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaps();
    return () => {
      stopRecording();
      if (modalAudioRef.current) modalAudioRef.current.pause();
      if (listAudioRef.current) listAudioRef.current.pause();
    };
  }, []);

  useEffect(() => {
    if (selectedMapId) {
      fetchQuestions(selectedMapId);
    }
  }, [selectedMapId]);

  const fetchMaps = async () => {
    try {
      setLoading(true);
      const res = await api.getMaps();
      const sorted = [...res.data].sort((a, b) => a.order_index - b.order_index);
      setMaps(sorted);
      if (sorted.length > 0 && !selectedMapId) {
        setSelectedMapId(sorted[0].id);
      }
    } catch (err) {
      console.error('Failed to load maps:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (mapId: number) => {
    try {
      setLoading(true);
      const res = await api.getQuestions(mapId);
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const silentRefreshQuestions = async (mapId: number) => {
    try {
      const res = await api.getQuestions(mapId);
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to silently refresh questions:', err);
    }
  };

  const silentRefreshMaps = async () => {
    try {
      const res = await api.getMaps();
      const sorted = [...res.data].sort((a, b) => a.order_index - b.order_index);
      setMaps(sorted);
    } catch (err) {
      console.error('Failed to silently refresh maps:', err);
    }
  };

  useEffect(() => {
    if (selectedMapId) {
      setMaps((prev) =>
        prev.map((m) => (m.id === selectedMapId ? { ...m, question_count: questions.length } : m))
      );
    }
  }, [questions.length, selectedMapId]);

  const resetForm = () => {
    setEditingQuestion(null);
    setQuestionType('multiple_choice');
    setIdentificationAnswer('');
    setSentence('');
    setHighlightedWord('');
    setContextClue('');
    setImageUrl('');
    setImageFile(null);
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    clearVoiceRecorder();
    setVoiceVideoFile(null);
    setVoiceVideoUrl('');
    setVoiceMediaType('none');
    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl(null);
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    setAnswers([
      { text: '', is_correct: true },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ]);
    setFormError(null);
  };

  const openCreateModal = () => {
    if (questions.length >= 5) {
      showToast('Each kingdom stage is limited to a maximum of 5 questions.', 'warning');
      return;
    }
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (q: QuestionData) => {
    resetForm();
    setEditingQuestion(q);
    const qType = q.question_type || 'multiple_choice';
    setQuestionType(qType);
    setSentence(q.sentence);
    setHighlightedWord(q.highlighted_word || '');
    setContextClue(q.context_clue || '');
    setImageUrl(q.image_url || '');
    setImagePreviewUrl(q.image_url ? resolveMediaUrl(q.image_url) : null);
    setVoiceAudioUrl(q.voice_audio_url || '');
    setVoiceVideoUrl(q.voice_video_url || '');
    setVoiceMediaType(q.voice_media_type || 'none');
    if (q.voice_video_url) {
      setVideoPreviewUrl(resolveMediaUrl(q.voice_video_url));
    }

    const correctAns = q.answers?.find((a) => a.is_correct)?.text || q.highlighted_word || '';
    setIdentificationAnswer(correctAns);

    if (q.voice_audio_url) {
      setAudioPreviewUrl(resolveMediaUrl(q.voice_audio_url));
    }

    if (q.answers && q.answers.length > 0) {
      const loaded = q.answers.map((a) => ({
        text: a.text,
        is_correct: a.is_correct,
      }));
      while (loaded.length < 4) {
        loaded.push({ text: '', is_correct: false });
      }
      setAnswers(loaded);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    stopRecording();
    if (modalAudioRef.current) modalAudioRef.current.pause();
    setIsPlayingPreview(false);
    setShowModal(false);
    resetForm();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl('');
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImageUrl('');
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVoiceVideoFile(file);
    setVoiceVideoUrl('');
    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl(URL.createObjectURL(file));
    setVoiceMediaType('video');
  };

  const handleClearVideo = () => {
    setVoiceVideoFile(null);
    setVoiceVideoUrl('');
    setVoiceMediaType('none');
    if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl(null);
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
  };

  // Voiceover Mic Handlers
  const startRecording = async () => {
    try {
      setFormError(null);
      clearVoiceRecorder();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setVoiceAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
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

  const clearVoiceRecorder = () => {
    stopRecording();
    setVoiceAudioBlob(null);
    setVoiceAudioFile(null);
    setVoiceAudioUrl('');
    if (audioPreviewUrl && audioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
    if (modalAudioRef.current) modalAudioRef.current.pause();
    setIsPlayingPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleModalAudioPlayback = () => {
    if (!audioPreviewUrl) return;
    if (!modalAudioRef.current) {
      modalAudioRef.current = new Audio(audioPreviewUrl);
      modalAudioRef.current.onended = () => setIsPlayingPreview(false);
      modalAudioRef.current.onpause = () => setIsPlayingPreview(false);
      modalAudioRef.current.onplay = () => setIsPlayingPreview(true);
    }
    if (modalAudioRef.current.src !== audioPreviewUrl) {
      modalAudioRef.current.src = audioPreviewUrl;
    }
    if (isPlayingPreview) {
      modalAudioRef.current.pause();
    } else {
      modalAudioRef.current.play().catch(() => {});
    }
  };

  const handleListAudioPlay = (qId: number, rawUrl: string) => {
    if (playingListAudioId === qId) {
      if (listAudioRef.current) listAudioRef.current.pause();
      setPlayingListAudioId(null);
      return;
    }
    if (!listAudioRef.current) {
      listAudioRef.current = new Audio();
      listAudioRef.current.onended = () => setPlayingListAudioId(null);
      listAudioRef.current.onpause = () => setPlayingListAudioId(null);
    }
    listAudioRef.current.src = resolveMediaUrl(rawUrl);
    listAudioRef.current.play().catch(() => {});
    setPlayingListAudioId(qId);
  };

  const handleCorrectAnswerSelect = (index: number) => {
    setAnswers(answers.map((a, i) => ({ ...a, is_correct: i === index })));
  };

  const handleAnswerTextChange = (index: number, text: string) => {
    setAnswers(answers.map((a, i) => (i === index ? { ...a, text } : a)));
  };

  const handleAddChoice = () => {
    if (answers.length >= 4) return;
    setAnswers([...answers, { text: '', is_correct: false }]);
  };

  const handleRemoveChoice = (index: number) => {
    if (answers.length <= 2) return;
    const removed = answers.filter((_, i) => i !== index);
    if (!removed.some((a) => a.is_correct)) {
      removed[0].is_correct = true;
    }
    setAnswers(removed);
  };

  const handleSwitchToMultipleChoice = () => {
    setQuestionType('multiple_choice');
    setAnswers((prev) => {
      const existing = [...prev];
      if (existing.length === 0) {
        return [
          { text: identificationAnswer || '', is_correct: true },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
        ];
      }
      if (existing.length === 1) {
        return [
          { text: existing[0].text || identificationAnswer || '', is_correct: true },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
        ];
      }
      if (existing.length === 2) {
        return [
          ...existing,
          { text: '', is_correct: false },
          { text: '', is_correct: false },
        ];
      }
      if (existing.length === 3) {
        return [
          ...existing,
          { text: '', is_correct: false },
        ];
      }
      return existing.slice(0, 4);
    });
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMapId) return;

    if (!editingQuestion && questions.length >= 5) {
      setFormError('Each kingdom stage is limited to a maximum of 5 questions.');
      showToast('Each kingdom stage is limited to a maximum of 5 questions.', 'warning');
      return;
    }

    if (!sentence.trim() || !highlightedWord.trim()) {
      setFormError('Please provide both the context sentence and target vocabulary word.');
      return;
    }

    if (questionType === 'multiple_choice') {
      if (answers.length < 2) {
        setFormError('Multiple choice questions require at least 2 choices.');
        return;
      }
      if (answers.some((a) => !a.text.trim())) {
        setFormError('Please fill out all answer choices.');
        return;
      }
      if (!answers.some((a) => a.is_correct)) {
        setFormError('Please select one correct answer choice.');
        return;
      }
    }

    if (questionType === 'identification' && !identificationAnswer.trim() && !highlightedWord.trim()) {
      setFormError('Please enter the target correct word to identify.');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      const targetAnswers =
        questionType === 'identification'
          ? [{ text: identificationAnswer.trim() || highlightedWord.trim(), is_correct: true }]
          : answers;

      const payload = {
        map_id: selectedMapId,
        order_index: editingQuestion ? editingQuestion.order_index : questions.length + 1,
        question_type: questionType,
        sentence: sentence.trim(),
        highlighted_word: highlightedWord.trim(),
        context_clue: selectedMapId === 2 ? contextClue.trim() || undefined : undefined,
        image_url: selectedMapId === 2 ? undefined : (imageUrl.trim() || undefined),
        image_file: selectedMapId === 2 ? undefined : (imageFile || undefined),
        voice_audio_file: voiceAudioBlob || voiceAudioFile || undefined,
        voice_audio_url: voiceAudioUrl || undefined,
        voice_video_file: voiceVideoFile || undefined,
        voice_video_url: voiceVideoUrl || undefined,
        voice_media_type: voiceMediaType || undefined,
        answers: targetAnswers,
      };

      if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, payload);
        showToast('Question updated successfully!', 'success');
        // Silent background refresh to get updated data
        if (selectedMapId) {
          silentRefreshQuestions(selectedMapId);
        }
      } else {
        await api.createQuestion(selectedMapId, payload);
        showToast('Question created and saved successfully!', 'success');
        if (selectedMapId) {
          silentRefreshQuestions(selectedMapId);
          silentRefreshMaps();
        }
      }

      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save question.');
      showToast(err.message || 'Failed to save question.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteQuestion = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      setDeleting(true);
      await api.deleteQuestion(target.id);
      showToast('Question deleted successfully.', 'info');
      setDeleteTarget(null);
      // Optimistic update: remove the item from state without reloading
      setQuestions((prev) => prev.filter((q) => q.id !== target.id));
      silentRefreshMaps();
    } catch (err: any) {
      setDeleteTarget(null);
      if (
        err.status === 404 ||
        err.message?.includes('not found') ||
        err.message?.includes('already been deleted')
      ) {
        showToast('Question has already been removed.', 'info');
        // Optimistic update: remove the item from state without reloading
        setQuestions((prev) => prev.filter((q) => q.id !== target.id));
      } else {
        showToast(err.message || 'Failed to delete question', 'error');
      }
    } finally {
      setDeleting(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeMap = maps.find((m) => m.id === selectedMapId);
  const activeOrder = activeMap?.order_index ?? 1;
  const activeTeacher = TEACHER_GUIDES[activeOrder];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header & New Question Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <span>Vocabulary Questions</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage stage vocabulary challenges, sentence context, answer choices, and voiceovers.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary cursor-pointer shrink-0 shadow-sm py-2 px-4"
        >
          <span>New Question</span>
        </button>
      </div>

      {/* Map / Kingdom Tabs with Teacher Labels */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Select Stage / Kingdom:
        </label>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
          {maps.map((m) => {
            const order = m.order_index;
            const guide = TEACHER_GUIDES[order];
            const colors = KINGDOM_COLORS[order] ?? KINGDOM_COLORS[1];
            const isSelected = selectedMapId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMapId(m.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                  isSelected
                    ? colors.activeTab
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{guide ? `${guide.teacher} • ${m.title}` : m.title}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-black/20 text-white font-bold' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isSelected ? questions.length : (m.question_count ?? 0)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Kingdom summary banner */}
      {activeMap && (
        <div className="flex items-center justify-between text-xs text-slate-600 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Stage:</span>
            <span className="text-slate-900 font-bold">{activeMap.title}</span>
            <span className="text-slate-400">• Guide:</span>
            <span className="text-emerald-700 font-bold">{activeTeacher?.teacher || 'Teacher Guide'}</span>
          </div>
          <span className="text-slate-500 font-medium">
            {questions.length} {questions.length === 1 ? 'Question' : 'Questions'} Total
          </span>
        </div>
      )}

      {/* Questions List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading stage questions...</div>
      ) : questions.length === 0 ? (
        <div className="surface-card p-12 text-center text-slate-500 rounded-2xl border border-slate-200 space-y-3 bg-white shadow-sm">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No questions found in this kingdom</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "+ New Question" above to create the first vocabulary challenge for students in this stage.
          </p>
          <button onClick={openCreateModal} className="btn-primary text-xs py-2 px-4 cursor-pointer mt-2">
            <span>Create First Question</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="surface-card p-5 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all space-y-4 shadow-sm bg-white"
            >
              {/* Card Header Row: Question Number, Format Type, Target Word & Actions */}
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Index badge */}
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs flex items-center justify-center font-bold border border-slate-200 shadow-xs">
                    #{idx + 1}
                  </span>

                  {/* Format badge with clear label */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {q.question_type === 'identification' ? (
                      <>
                        <Type className="w-3.5 h-3.5 text-purple-600" />
                        <span>Format: Identification (Typing)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                        <span>Format: Multiple Choice</span>
                      </>
                    )}
                  </span>

                  {/* Target Word badge with clear label */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
                      Target Word:
                    </span>
                    <span className="text-emerald-900 font-bold">{q.highlighted_word}</span>
                  </span>
                </div>

                {/* Right Action buttons: Edit & Delete */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(q)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Edit question details"
                  >
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setDeleteTarget(q)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card Middle: Sentence in Game + Visual Clue */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3 text-slate-400" />
                    <span>Challenge Sentence (Context):</span>
                  </div>
                  <div className="text-sm md:text-base font-medium text-slate-900 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    "{renderHighlightedSentence(q.sentence, q.highlighted_word, q.context_clue || undefined)}"
                  </div>
                  {q.context_clue && (
                    <div className="text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold">Context Clue:</span>
                      <span className="text-slate-800 font-bold underline decoration-slate-400 decoration-2 underline-offset-2">{q.context_clue}</span>
                    </div>
                  )}
                </div>

                {/* Visual Context Photo (if attached) */}
                {q.image_url && (
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <a
                      href={resolveMediaUrl(q.image_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block"
                      title="Click to view full visual clue"
                    >
                      <img
                        src={resolveMediaUrl(q.image_url)}
                        alt={q.highlighted_word}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 group-hover:border-emerald-500 transition-all shadow-xs"
                      />
                      <span className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-[10px] font-bold text-white">
                        View
                      </span>
                    </a>
                    <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                      <ImageIcon className="w-2.5 h-2.5" /> Clue Image
                    </span>
                  </div>
                )}
              </div>

              {/* Card Bottom: Answers Section + Voiceover Playback */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-100">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {q.question_type === 'identification' ? 'Correct Answer to Type:' : 'Answer Choices (Definitions):'}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {q.question_type === 'identification' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mr-0.5">
                          Correct:
                        </span>
                        <span>{q.answers?.[0]?.text || q.highlighted_word}</span>
                      </span>
                    ) : (
                      q.answers?.map((ans, aIdx) => (
                        <span
                          key={aIdx}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                            ans.is_correct
                              ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300 shadow-xs ring-1 ring-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                          }`}
                        >
                          {ans.is_correct ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-[10px] uppercase font-bold text-emerald-800">Correct:</span>
                            </>
                          ) : (
                            <span className="text-[10px] uppercase font-bold text-slate-500">Option:</span>
                          )}
                          <span className="truncate max-w-[220px]">{ans.text}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Voiceover preview button if present */}
                {q.voice_audio_url && (
                  <div className="shrink-0 flex items-center">
                    <button
                      onClick={() => handleListAudioPlay(q.id, q.voice_audio_url!)}
                      className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        playingListAudioId === q.id
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm font-bold'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                      }`}
                      title="Play teacher question voiceover"
                    >
                      {playingListAudioId === q.id ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Playing Voice...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Listen Voiceover</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sleek Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-xl p-6 rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar space-y-5 bg-white text-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>{editingQuestion ? 'Edit Question' : 'Create New Question'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign target vocabulary, challenge sentence, answer definitions, and hints.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <X className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-5">
              {/* Section 1: Target Word & Context Sentence */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1. Target Vocabulary & Sentence</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Target Word to Learn *</label>
                    <span className="text-[11px] text-slate-500">The word highlighted in the game</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. exhausted"
                    value={highlightedWord}
                    onChange={(e) => setHighlightedWord(e.target.value)}
                    className="minimal-input font-bold text-emerald-700 py-2.5 px-3.5"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Challenge Sentence (Context) *</label>
                    <span className="text-[11px] text-slate-500">Full sentence shown to students</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The student felt exhausted after studying all night."
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    className="minimal-input py-2.5 px-3.5"
                  />
                </div>

                {selectedMapId === 2 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">Context Clue (Underlined) *</label>
                      <span className="text-[11px] text-slate-500">Phrase underlined in game</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. organized all her study notes neatly"
                      value={contextClue}
                      onChange={(e) => setContextClue(e.target.value)}
                      className="minimal-input font-medium text-slate-900 py-2.5 px-3.5"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Kingdom 2 rule: Image clues are disabled. This phrase is underlined in the sentence to provide context.
                    </p>
                  </div>
                )}
              </div>

              {/* Section 2: Question Format */}
              <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-sky-600" />
                  <span>2. Question Format</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleSwitchToMultipleChoice}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      questionType === 'multiple_choice'
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 shrink-0 ${
                        questionType === 'multiple_choice' ? 'text-sky-600' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Multiple Choice</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Students select from 4 definition choices</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuestionType('identification')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      questionType === 'identification'
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Type
                      className={`w-5 h-5 shrink-0 ${
                        questionType === 'identification' ? 'text-purple-600' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Identification</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Students type the vocabulary word themselves</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 3: Answer Setup */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3. Correct Answer & Definitions</span>
                </div>

                {questionType === 'identification' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Correct Target Answer (What the student must type) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={highlightedWord ? `e.g. ${highlightedWord}` : 'Enter the target word...'}
                      value={identificationAnswer}
                      onChange={(e) => setIdentificationAnswer(e.target.value)}
                      className="minimal-input text-xs py-2.5 px-3.5"
                    />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">
                        Click the radio button to select which definition is <strong className="text-emerald-700">Correct</strong>:
                      </span>
                      {answers.length < 4 && (
                        <button
                          type="button"
                          onClick={handleAddChoice}
                          className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                        >
                          <span>Add Choice</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {answers.map((ans, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                            ans.is_correct
                              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* Radio button to mark as correct */}
                          <button
                            type="button"
                            onClick={() => handleCorrectAnswerSelect(idx)}
                            className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                              ans.is_correct
                                ? 'bg-emerald-500 border-emerald-500 text-white font-bold shadow-xs'
                                : 'border-slate-300 hover:border-slate-400 text-transparent'
                            }`}
                            title={ans.is_correct ? 'Correct answer' : 'Click to set as correct answer'}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Choice {String.fromCharCode(65 + idx)}{' '}
                                {ans.is_correct && (
                                  <span className="text-emerald-700 font-bold ml-1">• Correct Answer</span>
                                )}
                              </span>
                            </div>
                            <input
                              type="text"
                              required
                              placeholder={`Enter definition for Choice ${String.fromCharCode(65 + idx)}...`}
                              value={ans.text}
                              onChange={(e) => handleAnswerTextChange(idx, e.target.value)}
                              className="minimal-input text-xs py-1.5"
                            />
                          </div>

                          {answers.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveChoice(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remove choice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Multimedia Clues (Optional) */}
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>4. Multimedia Clues (Optional)</span>
                </div>

                {/* Visual Context Image (Disabled for Kingdom 2) */}
                {selectedMapId === 2 ? (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Kingdom 2 (Average Round):</span> Image clues are disabled. Context clues in the sentence are underlined instead.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Visual Context Image (Photo Clue)</label>

                  {!imagePreviewUrl ? (
                    <div className="flex items-center gap-2">
                      <label className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs">
                        <input
                          ref={imageFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Upload Image File (JPG, PNG, WebP)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={imagePreviewUrl}
                          alt="Clue Preview"
                          className="h-14 w-14 rounded-lg object-contain bg-slate-100 border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {imageFile ? imageFile.name : 'Attached Image Preview'}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-medium">
                            {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : 'Image URL linked'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="Remove image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

                {/* Teacher Voiceover */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700">Teacher Voiceover (Spoken Question Clue)</label>

                  {/* Upload Options - All Visible */}
                  {!isRecording && !audioPreviewUrl && !videoPreviewUrl && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={startRecording}
                          className="py-2.5 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <Mic className="w-4 h-4 text-emerald-600" />
                          <span>Record</span>
                          <span className="text-[10px] text-emerald-600 font-normal">Live audio</span>
                        </button>

                        <label className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setVoiceAudioFile(file);
                                setAudioPreviewUrl(URL.createObjectURL(file));
                                setVoiceMediaType('audio');
                              }
                            }}
                            className="hidden"
                          />
                          <Upload className="w-4 h-4 text-slate-500" />
                          <span>Upload Audio</span>
                          <span className="text-[10px] text-slate-500 font-normal">MP3, WAV</span>
                        </label>

                        <label className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs">
                          <input
                            ref={videoFileInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/ogg"
                            onChange={handleVideoFileChange}
                            className="hidden"
                          />
                          <Video className="w-4 h-4 text-slate-500" />
                          <span>Upload Video</span>
                          <span className="text-[10px] text-slate-500 font-normal">MP4, WebM</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Active Recording */}
                  {isRecording && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <span>Recording Voice: {formatSeconds(recordingSeconds)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Stop Recording
                      </button>
                    </div>
                  )}

                  {/* Audio Preview Bar */}
                  {audioPreviewUrl && !isRecording && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5 text-xs text-slate-800">
                        <FileAudio className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[200px] font-medium">Audio recording ready</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleModalAudioPlayback}
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                          <span>{isPlayingPreview ? 'Pause' : 'Test'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={clearVoiceRecorder}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove audio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Video Preview Bar */}
                  {videoPreviewUrl && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-14 w-14 rounded-lg bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                          <Video className="w-6 h-6 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {voiceVideoFile ? voiceVideoFile.name : 'Video URL linked'}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-medium">
                            {voiceVideoFile ? `${(voiceVideoFile.size / 1024).toFixed(1)} KB` : 'Video URL linked'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearVideo}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="Remove video"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button type="button" onClick={closeModal} className="btn-secondary text-xs px-4 py-2 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs font-bold px-5 py-2 shadow-sm cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Question...</span>
                    </>
                  ) : editingQuestion ? (
                    'Update Question'
                  ) : (
                    'Save Question'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <h3 className="text-sm font-bold text-slate-900">Delete Question</h3>
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
                Delete question for word <span className="font-bold text-slate-900">"{deleteTarget.highlighted_word}"</span>?
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                This question will be removed from the stage sequence.
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
                onClick={confirmDeleteQuestion}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Question</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
