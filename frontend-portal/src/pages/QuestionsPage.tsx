import React, { useState, useEffect } from 'react';
import { api, type MapData, type QuestionData } from '../services/api';
import { HelpCircle, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

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
  const [answers, setAnswers] = useState<{ text: string; is_correct: boolean }[]>([
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaps();
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

  const handleAddAnswerChoice = () => {
    if (answers.length < 4) {
      setAnswers([...answers, { text: '', is_correct: false }]);
    }
  };

  const handleRemoveAnswerChoice = (index: number) => {
    if (answers.length > 2) {
      const newAnswers = answers.filter((_, i) => i !== index);
      // Ensure at least one correct choice remains
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

    if (!sentence.includes(highlightedWord)) {
      setFormError(`Sentence must contain the word "${highlightedWord}" verbatim.`);
      return;
    }

    try {
      setSaving(true);
      await api.createQuestion(selectedMapId, {
        order_index: questions.length + 1,
        sentence,
        highlighted_word: highlightedWord,
        has_image: Boolean(imageFile || imageUrl),
        image_url: imageUrl || undefined,
        image_file: imageFile,
        answers,
      });
      setShowModal(false);
      setSentence('');
      setHighlightedWord('');
      setImageUrl('');
      setImageFile(null);
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
          <h2 className="text-2xl font-bold text-white font-heading">Question & Content Builder</h2>
          <p className="text-sm text-slate-400 mt-1">
            Add context-highlighted vocabulary questions and answer options
          </p>
        </div>

        {selectedMapId && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary self-start sm:self-auto"
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
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
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
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                    Q{idx + 1}
                  </span>
                  <div>
                    <h4 className="text-base font-semibold text-white">
                      Highlighted Word: <span className="text-emerald-400 underline">{q.highlighted_word}</span>
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Sentence Display with Highlight */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 mb-4 text-sm text-slate-200">
                {q.sentence.split(q.highlighted_word).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                        {q.highlighted_word}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Answer Choices Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.answers.map((ans) => (
                  <div
                    key={ans.id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      ans.is_correct
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium'
                        : 'bg-slate-900/40 border-white/5 text-slate-400'
                    }`}
                  >
                    <span>{ans.text}</span>
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-white/10 animate-fade-in my-8">
            <h3 className="text-xl font-bold text-white font-heading mb-4">Add Question to Map {currentMap?.order_index}</h3>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Highlighted Word
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter target word (e.g. exhausted)"
                  value={highlightedWord}
                  onChange={(e) => setHighlightedWord(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Full Sentence (Must contain highlighted word verbatim)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter sentence containing the target word..."
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  className="glass-input resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Question Image (Optional)
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
                    className="glass-input"
                  />
                </div>
              </div>

              {/* Answer Choices */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Answer Options (2 to 4 items, select 1 correct)
                </label>

                {answers.map((ans, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctChoice"
                      checked={ans.is_correct}
                      onChange={() => handleSelectCorrect(idx)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                    <input
                      type="text"
                      required
                      placeholder={`Option ${idx + 1}`}
                      value={ans.text}
                      onChange={(e) => {
                        const newAnswers = [...answers];
                        newAnswers[idx].text = e.target.value;
                        setAnswers(newAnswers);
                      }}
                      className="glass-input py-2 text-xs"
                    />
                    {answers.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAnswerChoice(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
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
                    className="text-xs text-emerald-400 hover:underline pt-1 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Answer Option</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs"
                >
                  {saving ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
