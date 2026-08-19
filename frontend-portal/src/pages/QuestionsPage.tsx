import React, { useState, useEffect, useRef } from 'react';
import { api, type MapData, type QuestionData } from '../services/api';
import {
  HelpCircle,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Mic,
  Upload,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Video,
  FileAudio,
} from 'lucide-react';

export const QuestionsPage: React.FC = () => {
  const [maps, setMaps] = useState<MapData[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [sentence, setSentence] = useState('');
  const [highlightedWord, setHighlightedWord] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Voiceover / Media State
  const [voiceAudioBlob, setVoiceAudioBlob] = useState<Blob | null>(null);
  const [voiceAudioFile, setVoiceAudioFile] = useState<File | null>(null);
  const [voiceVideoFile, setVoiceVideoFile] = useState<File | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState('');
  const [voiceVideoUrl, setVoiceVideoUrl] = useState('');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Mic Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Active playing audio card in question list
  const [activePlayingAudioUrl, setActivePlayingAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);
  const listAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      if (modalAudioRef.current) {
        modalAudioRef.current.pause();
      }
      if (listAudioRef.current) {
        listAudioRef.current.pause();
      }
    };
  }, []);

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

  useEffect(() => {
    if (selectedMapId) {
      fetchQuestions(selectedMapId);
    }
  }, [selectedMapId]);

  const fetchQuestions = async (mapId: number) => {
    try {
      const res = await api.getQuestions(mapId);
      setQuestions(res.data);
    } catch (err) {
      console.error('Failed to load questions:', err);
    }
  };

  // --- Voice Recorder Handlers ---
  const startRecording = async () => {
    try {
      setFormError(null);
      clearVoiceover();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setVoiceAudioBlob(audioBlob);
        const previewUrl = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(previewUrl);

        // Stop all audio stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setFormError('Microphone access denied or unavailable. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const handlePreRecordedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearVoiceover();

    if (file.type.startsWith('video/')) {
      setVoiceVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);
    } else {
      setVoiceAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioPreviewUrl(url);
    }
  };

  const clearVoiceover = () => {
    if (isRecording) {
      stopRecording();
    }
    if (modalAudioRef.current) {
      modalAudioRef.current.pause();
    }
    setIsPlayingPreview(false);
    setVoiceAudioBlob(null);
    setVoiceAudioFile(null);
    setVoiceVideoFile(null);
    setVoiceAudioUrl('');
    setVoiceVideoUrl('');
    setAudioPreviewUrl(null);
    setVideoPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      modalAudioRef.current.play().catch((e) => console.warn('Playback error:', e));
    }
  };

  const toggleListAudioPlayback = (url: string) => {
    if (activePlayingAudioUrl === url && listAudioRef.current && !listAudioRef.current.paused) {
      listAudioRef.current.pause();
      setActivePlayingAudioUrl(null);
      return;
    }

    if (listAudioRef.current) {
      listAudioRef.current.pause();
    }

    const audio = new Audio(url);
    listAudioRef.current = audio;
    audio.onended = () => setActivePlayingAudioUrl(null);
    audio.onpause = () => setActivePlayingAudioUrl(null);
    audio.onplay = () => setActivePlayingAudioUrl(url);
    audio.play().catch((e) => console.warn('List audio play failed:', e));
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddAnswerChoice = () => {
    if (answers.length < 4) {
      setAnswers([...answers, { text: '', is_correct: false }]);
    }
  };

  const handleRemoveAnswerChoice = (index: number) => {
    if (answers.length > 2) {
      const newAnswers = answers.filter((_, i) => i !== index);
      if (!newAnswers.some((a) => a.is_correct)) {
        newAnswers[0].is_correct = true;
      }
      setAnswers(newAnswers);
    }
  };

  const handleSelectCorrect = (index: number) => {
    setAnswers(answers.map((a, i) => ({ ...a, is_correct: i === index })));
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedMapId) return;

    if (!sentence.toLowerCase().includes(highlightedWord.toLowerCase())) {
      setFormError(`Sentence must contain the word "${highlightedWord}" verbatim.`);
      return;
    }

    try {
      setSaving(true);

      let voiceMediaType: 'audio' | 'video' | 'none' = 'none';
      if (voiceVideoFile || voiceVideoUrl) {
        voiceMediaType = 'video';
      } else if (voiceAudioBlob || voiceAudioFile || voiceAudioUrl) {
        voiceMediaType = 'audio';
      }

      await api.createQuestion(selectedMapId, {
        order_index: questions.length + 1,
        sentence,
        highlighted_word: highlightedWord,
        has_image: Boolean(imageFile || imageUrl),
        image_url: imageUrl || undefined,
        image_file: imageFile,
        voice_audio_file: voiceAudioBlob || voiceAudioFile || null,
        voice_video_file: voiceVideoFile || null,
        voice_audio_url: voiceAudioUrl || undefined,
        voice_video_url: voiceVideoUrl || undefined,
        voice_media_type: voiceMediaType,
        answers,
      });

      setShowModal(false);
      setSentence('');
      setHighlightedWord('');
      setImageUrl('');
      setImageFile(null);
      clearVoiceover();
      setAnswers([
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
      ]);
      fetchQuestions(selectedMapId);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create question');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (confirm('Delete this question?')) {
      try {
        await api.deleteQuestion(id);
        if (selectedMapId) fetchQuestions(selectedMapId);
      } catch (err) {
        alert('Failed to delete question');
      }
    }
  };

  if (loading) {
    return <div className="text-slate-400 p-8 text-center">Loading questions...</div>;
  }

  const currentMap = maps.find((m) => m.id === selectedMapId);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Map Selector & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-heading">Question & Voiceover Builder</h2>
          <p className="text-sm text-slate-400 mt-1">
            Create vocabulary challenges with teacher voice recordings, video voiceovers, or picture hints
          </p>
        </div>

        {selectedMapId && (
          <button
            onClick={() => {
              clearVoiceover();
              setShowModal(true);
            }}
            className="btn-primary self-start sm:self-auto shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            <span>Add Question</span>
          </button>
        )}
      </div>

      {/* Map Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 overflow-x-auto">
        {maps.map((map) => (
          <button
            key={map.id}
            onClick={() => setSelectedMapId(map.id)}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
              selectedMapId === map.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/10'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            Map {map.order_index}: {map.title}
          </button>
        ))}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="glass-panel p-12 text-center text-slate-500">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">No questions in Map {currentMap?.order_index || 1}</p>
            <p className="text-xs text-slate-500 mt-1">Add questions to prepare this map for student sessions</p>
          </div>
        ) : (
          questions.map((q, idx) => (
            <div key={q.id} className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                    Q{idx + 1}
                  </span>
                  <div>
                    <h4 className="text-base font-semibold text-white">
                      Target Word: <span className="text-emerald-400 font-bold underline">{q.highlighted_word}</span>
                    </h4>
                  </div>

                  {/* Media Badges */}
                  {q.voice_audio_url && (
                    <button
                      onClick={() => toggleListAudioPlayback(q.voice_audio_url!)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                        activePlayingAudioUrl === q.voice_audio_url
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30 animate-pulse'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                      }`}
                    >
                      {activePlayingAudioUrl === q.voice_audio_url ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{activePlayingAudioUrl === q.voice_audio_url ? 'Playing Voiceover...' : 'Teacher Voiceover'}</span>
                    </button>
                  )}

                  {q.voice_video_url && (
                    <a
                      href={q.voice_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-all"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Video Voiceover Attached</span>
                    </a>
                  )}

                  {!q.voice_audio_url && !q.voice_video_url && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-white/5">
                      TTS Fallback
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Delete question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Sentence Display with Highlight */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 mb-4 text-sm text-slate-200">
                {q.sentence.split(new RegExp(`(${q.highlighted_word})`, 'gi')).map((part, i) => (
                  <React.Fragment key={i}>
                    {part.toLowerCase() === q.highlighted_word.toLowerCase() ? (
                      <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                        {part}
                      </span>
                    ) : (
                      part
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Answer Choices Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.answers.map((ans, aIdx) => (
                  <div
                    key={ans.id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      ans.is_correct
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium'
                        : 'bg-slate-900/40 border-white/5 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-white/10 text-slate-300 font-bold flex items-center justify-center text-[10px]">
                        {String.fromCharCode(65 + aIdx)}
                      </span>
                      <span>{ans.text}</span>
                    </div>
                    {ans.is_correct && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Question Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 rounded-2xl border border-white/15 animate-fade-in my-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white font-heading">
                  Add Question to Map {currentMap?.order_index || 1}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record your authentic voice or upload audio for student reading assistance
                </p>
              </div>
              <button
                onClick={() => {
                  clearVoiceover();
                  setShowModal(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateQuestion} className="space-y-6">
              {/* Target Word & Sentence */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Target Word *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. courageous"
                    value={highlightedWord}
                    onChange={(e) => setHighlightedWord(e.target.value)}
                    className="glass-input text-emerald-300 font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Full Sentence (Must include Target Word) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The courageous student climbed the mountain."
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    className="glass-input"
                  />
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════════ */}
              {/* TWO PROMINENT ACTION BUTTONS: RECORD MIC VS UPLOAD PRE-RECORDED */}
              {/* ═══════════════════════════════════════════════════════════════════════ */}
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span>Question Voiceover (Teacher Voice / Video)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Provide your voice to read the sentence and choices to students during gameplay
                    </p>
                  </div>
                </div>

                {/* 2 Big Action Buttons */}
                {!isRecording && !audioPreviewUrl && !videoPreviewUrl && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Button 1: Record With Mic */}
                    <button
                      type="button"
                      onClick={startRecording}
                      className="p-4 rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 hover:from-emerald-500/25 hover:to-emerald-600/15 text-emerald-300 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-emerald-950/40 cursor-pointer text-center group"
                    >
                      <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                        <Mic className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">RECORD WITH MIC</div>
                        <div className="text-[11px] text-emerald-400/80">Click to record your voice directly</div>
                      </div>
                    </button>

                    {/* Button 2: Upload Pre-recorded */}
                    <label className="p-4 rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-500/15 to-sky-600/5 hover:from-sky-500/25 hover:to-sky-600/15 text-sky-300 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-sky-950/40 cursor-pointer text-center group">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,video/mp4,video/webm"
                        onChange={handlePreRecordedUpload}
                        className="hidden"
                      />
                      <div className="w-11 h-11 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-500/30 group-hover:bg-sky-500 group-hover:text-slate-950 transition-colors">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">UPLOAD PRE-RECORDED</div>
                        <div className="text-[11px] text-sky-400/80">Upload MP3, WAV, M4A, or MP4</div>
                      </div>
                    </label>
                  </div>
                )}

                {/* State 1: Active Live Recording Bar */}
                {isRecording && (
                  <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
                      <div>
                        <div className="text-xs font-bold text-white uppercase tracking-wider">Recording in progress...</div>
                        <div className="text-lg font-mono font-bold text-rose-400">{formatSeconds(recordingSeconds)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/50 cursor-pointer transition-all"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        <span>DONE / STOP</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* State 2: Audio Preview / Replay Bar */}
                {audioPreviewUrl && !isRecording && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <FileAudio className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">
                            {voiceAudioFile ? voiceAudioFile.name : 'Teacher Mic Voice Recording'}
                          </div>
                          <div className="text-[11px] text-emerald-400">
                            {voiceAudioFile ? `${(voiceAudioFile.size / 1024 / 1024).toFixed(2)} MB` : `Recorded (${formatSeconds(recordingSeconds)})`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleModalAudioPlayback}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 transition-all"
                        >
                          {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-slate-950" />}
                          <span>{isPlayingPreview ? 'Pause' : 'Play Preview'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={startRecording}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Re-record"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={clearVoiceover}
                          className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Remove voiceover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* State 3: Video Preview Bar */}
                {videoPreviewUrl && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-sky-500/30 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-sky-400" />
                        <span className="text-xs font-bold text-white">
                          {voiceVideoFile ? voiceVideoFile.name : 'Video Voiceover Preview'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearVoiceover}
                        className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Video</span>
                      </button>
                    </div>

                    <div className="rounded-xl overflow-hidden max-h-48 border border-white/10 bg-black">
                      <video src={videoPreviewUrl} controls className="w-full max-h-48 object-contain" />
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Question Image */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Question Picture Hint (Optional)
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="glass-input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 text-xs text-slate-400 cursor-pointer w-full"
                  />
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>or paste Image URL:</span>
                  </div>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>
              </div>

              {/* Answer Choices */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Answer Choices (2 to 4 options, pick 1 correct)
                  </label>
                </div>

                {answers.map((ans, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/40 text-xs">
                      <input
                        type="radio"
                        name="correctChoice"
                        checked={ans.is_correct}
                        onChange={() => handleSelectCorrect(idx)}
                        className="w-4 h-4 accent-emerald-500 cursor-pointer"
                      />
                      <span className="font-bold text-slate-300">{String.fromCharCode(65 + idx)}</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={`Choice ${String.fromCharCode(65 + idx)} text`}
                      value={ans.text}
                      onChange={(e) => {
                        const newAnswers = [...answers];
                        newAnswers[idx].text = e.target.value;
                        setAnswers(newAnswers);
                      }}
                      className="glass-input py-2 text-xs flex-1"
                    />
                    {answers.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAnswerChoice(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        title="Remove choice"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {answers.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddAnswerChoice}
                    className="text-xs text-emerald-400 hover:underline pt-1 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Answer Choice</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    clearVoiceover();
                    setShowModal(false);
                  }}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || isRecording}
                  className="btn-primary text-xs shadow-lg shadow-emerald-500/20"
                >
                  {saving ? 'Saving Question...' : 'Save & Publish Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
