import React, { useState, useEffect, useRef } from 'react';
import { api, resolveMediaUrl, type MapData, type QuestionData } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Mic,
  Upload,
  Play,
  Pause,
  Edit3,
  X,
  FileAudio,
  Loader2,
} from 'lucide-react';

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
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Voiceover State
  const [voiceAudioBlob, setVoiceAudioBlob] = useState<Blob | null>(null);
  const [voiceAudioFile, setVoiceAudioFile] = useState<File | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState('');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

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

  const [questionType, setQuestionType] = useState<'multiple_choice' | 'identification'>('multiple_choice');
  const [identificationAnswer, setIdentificationAnswer] = useState('');

  const [answers, setAnswers] = useState<{ text: string; is_correct: boolean }[]>([
    { text: '', is_correct: true },
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
      setMaps(res.data);
      if (res.data.length > 0 && !selectedMapId) {
        setSelectedMapId(res.data[0].id);
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

  const resetForm = () => {
    setEditingQuestion(null);
    setQuestionType('multiple_choice');
    setIdentificationAnswer('');
    setSentence('');
    setHighlightedWord('');
    setImageUrl('');
    setImageFile(null);
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    clearVoiceRecorder();
    setAnswers([
      { text: '', is_correct: true },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ]);
    setFormError(null);
  };

  const openCreateModal = () => {
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
    setImageUrl(q.image_url || '');
    setImagePreviewUrl(q.image_url ? resolveMediaUrl(q.image_url) : null);
    setVoiceAudioUrl(q.voice_audio_url || '');

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
      // If only 1 answer exists (e.g. from identification mode), pad with empty choices for multiple choice mode
      while (loaded.length < 3) {
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

  const handleImageUrlChange = (url: string) => {
    setImageUrl(url);
    setImageFile(null);
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(url ? resolveMediaUrl(url) : null);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
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

  // --- Voiceover Mic Handlers ---
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
    if (answers.length >= 3) return;
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
        ];
      }
      if (existing.length === 1) {
        return [
          { text: existing[0].text || identificationAnswer || '', is_correct: true },
          { text: '', is_correct: false },
          { text: '', is_correct: false },
        ];
      }
      if (existing.length === 2) {
        return [
          ...existing,
          { text: '', is_correct: false },
        ];
      }
      return existing;
    });
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMapId) return;

    if (!sentence.trim() || !highlightedWord.trim()) {
      setFormError('Please provide both a sentence and the target vocabulary word.');
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

      const targetAnswers = questionType === 'identification'
        ? [{ text: identificationAnswer.trim() || highlightedWord.trim(), is_correct: true }]
        : answers;

      const payload = {
        map_id: selectedMapId,
        order_index: editingQuestion ? editingQuestion.order_index : questions.length + 1,
        question_type: questionType,
        sentence: sentence.trim(),
        highlighted_word: highlightedWord.trim(),
        image_url: imageUrl.trim() || undefined,
        image_file: imageFile || undefined,
        voice_audio_file: voiceAudioBlob || voiceAudioFile || undefined,
        voice_audio_url: voiceAudioUrl || undefined,
        answers: targetAnswers,
      };

      if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, payload);
        showToast('Question updated successfully!', 'success');
      } else {
        await api.createQuestion(selectedMapId, payload);
        showToast('Question created and saved successfully!', 'success');
      }

      closeModal();
      fetchQuestions(selectedMapId);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save question.');
      showToast(err.message || 'Failed to save question.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteQuestion = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteQuestion(deleteTarget.id);
      showToast('Question deleted successfully.', 'info');
      setDeleteTarget(null);
      if (selectedMapId) fetchQuestions(selectedMapId);
    } catch (err: any) {
      setDeleteTarget(null);
      showToast(err.message || 'Failed to delete question', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header & Map Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Questions</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Manage vocabulary challenges, clues, and voiceovers</p>
        </div>

        <button onClick={openCreateModal} className="btn-primary cursor-pointer shrink-0">
          <Plus className="w-4 h-4" />
          <span>New Question</span>
        </button>
      </div>

      {/* Map Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {maps.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMapId(m.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
              selectedMapId === m.id
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
            }`}
          >
            {m.title}
            <span className="ml-2 text-[10px] text-zinc-500 font-mono">({m.question_count || 0})</span>
          </button>
        ))}
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-500">Loading questions...</div>
      ) : questions.length === 0 ? (
        <div className="surface-card p-12 text-center text-zinc-500">
          <p className="text-sm font-medium text-zinc-300">No questions found</p>
          <p className="text-xs text-zinc-500 mt-1">Create your first vocabulary challenge above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="surface-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {/* Index badge */}
                <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 font-mono text-xs flex items-center justify-center shrink-0 border border-zinc-700/60 font-semibold mt-0.5">
                  {idx + 1}
                </div>

                {/* Content */}
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {q.question_type === 'identification' ? (
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-white/5">
                        Identification
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-white/5">
                        Multiple Choice
                      </span>
                    )}
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {q.highlighted_word}
                    </span>
                    <span className="text-xs text-zinc-200 font-medium truncate">"{q.sentence}"</span>
                  </div>

                  {/* Answers summary */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                    {q.answers?.map((ans, aIdx) => (
                      <span
                        key={aIdx}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                          ans.is_correct
                            ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30'
                            : 'bg-zinc-800/60 text-zinc-400'
                        }`}
                      >
                        {ans.is_correct && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                        <span className="truncate max-w-[200px]">{ans.text}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions & Media Preview */}
              <div className="flex items-center gap-2 shrink-0">
                {q.image_url && (
                  <img
                    src={resolveMediaUrl(q.image_url)}
                    alt="Clue"
                    className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                    title="Visual clue photo"
                  />
                )}

                {q.voice_audio_url && (
                  <button
                    onClick={() => handleListAudioPlay(q.id, q.voice_audio_url!)}
                    className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      playingListAudioId === q.id
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
                    }`}
                    title="Play teacher voice recording"
                  >
                    {playingListAudioId === q.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                )}

                <button
                  onClick={() => openEditModal(q)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="Edit question"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setDeleteTarget(q)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Delete question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clean Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-xl p-6 rounded-2xl border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingQuestion ? 'Edit Question' : 'Create Question'}
              </h3>
              <button
                onClick={closeModal}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {/* Sentence & Highlighted Word */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Sentence *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The student felt exhausted after studying all night."
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    className="minimal-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Target Word to Highlight *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. exhausted"
                    value={highlightedWord}
                    onChange={(e) => setHighlightedWord(e.target.value)}
                    className="minimal-input font-bold text-emerald-400"
                  />
                </div>
              </div>

              {/* Visual Clue Image Upload & URL */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="block text-xs font-semibold text-zinc-300">Visual Context Image (Optional)</label>

                {!imagePreviewUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="flex-1 py-2 px-3 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                        <input
                          ref={imageFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Image File (JPG, PNG, WebP)</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Or paste Image URL (https://...)"
                        value={imageUrl}
                        onChange={(e) => handleImageUrlChange(e.target.value)}
                        className="minimal-input text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={imagePreviewUrl}
                        alt="Clue Preview"
                        className="h-16 w-16 rounded-lg object-contain bg-black/60 border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {imageFile ? imageFile.name : 'Attached Image Preview'}
                        </div>
                        <div className="text-[11px] text-emerald-400">
                          {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : 'Image URL linked'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Teacher Voiceover */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="block text-xs font-semibold text-zinc-300">Teacher Voiceover (Optional)</label>

                {!isRecording && !audioPreviewUrl && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={startRecording}
                      className="flex-1 py-2 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Record Voice</span>
                    </button>

                    <label className="flex-1 py-2 px-3 rounded-lg border border-zinc-700 bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setVoiceAudioFile(file);
                            setAudioPreviewUrl(URL.createObjectURL(file));
                          }
                        }}
                        className="hidden"
                      />
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Audio File</span>
                    </label>
                  </div>
                )}

                {/* Active Recording */}
                {isRecording && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>Recording: {formatSeconds(recordingSeconds)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                )}

                {/* Audio Preview Bar */}
                {audioPreviewUrl && !isRecording && (
                  <div className="p-2.5 rounded-lg bg-zinc-800/80 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-zinc-200">
                      <FileAudio className="w-4 h-4 text-emerald-400" />
                      <span className="truncate max-w-[200px]">Voice recording ready</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleModalAudioPlayback}
                        className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {isPlayingPreview ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isPlayingPreview ? 'Pause' : 'Test'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={clearVoiceRecorder}
                        className="p-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                        title="Remove audio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Question Format Selector */}
              <div className="space-y-2 pt-3 border-t border-white/5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Question Format
                </label>
                <div className="p-1 rounded-xl bg-zinc-950/80 border border-white/10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSwitchToMultipleChoice}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      questionType === 'multiple_choice'
                        ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Multiple Choice
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuestionType('identification')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      questionType === 'identification'
                        ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Identification
                  </button>
                </div>
              </div>

              {/* Identification Input vs Multiple Choice Answer Choices */}
              {questionType === 'identification' ? (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Target Answer (Word/phrase student must type) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter the correct word or phrase..."
                    value={identificationAnswer}
                    onChange={(e) => setIdentificationAnswer(e.target.value)}
                    className="minimal-input text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Answer Choices (Select the correct definition) *
                    </label>
                    {answers.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddChoice}
                        className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Choice</span>
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {answers.map((ans, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleCorrectAnswerSelect(idx)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            ans.is_correct
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : 'border-zinc-600 hover:border-zinc-400'
                          }`}
                          title="Mark as correct answer"
                        >
                          {ans.is_correct && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                        <input
                          type="text"
                          required
                          placeholder={`Choice ${String.fromCharCode(65 + idx)} definition...`}
                          value={ans.text}
                          onChange={(e) => handleAnswerTextChange(idx, e.target.value)}
                          className="minimal-input text-xs flex-1"
                        />
                        {answers.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveChoice(idx)}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remove this choice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={closeModal} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs font-bold">
                  {saving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Modal */}
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
                <h3 className="text-sm font-semibold text-white">Delete Question</h3>
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
                Delete question for word <span className="font-semibold text-white">"{deleteTarget.highlighted_word}"</span>?
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This question will be removed from the stage sequence.
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
                onClick={confirmDeleteQuestion}
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
                    Delete Question
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
