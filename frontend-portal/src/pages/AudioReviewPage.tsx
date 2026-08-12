import React, { useState, useEffect } from 'react';
import { api, type VocabularyAudioItem } from '../services/api';
import { Volume2, RefreshCw, Play, Pause, Upload, CheckCircle2, XCircle } from 'lucide-react';

export const AudioReviewPage: React.FC = () => {
  const [items, setItems] = useState<VocabularyAudioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAudios();
  }, []);

  const fetchAudios = async () => {
    try {
      setLoading(true);
      const res = await api.getVocabularyAudios();
      setItems(res.data);
    } catch (err) {
      console.error('Failed to load vocabulary audios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = (audioId: number, url: string) => {
    if (playingAudioId === audioId && audioElement) {
      audioElement.pause();
      setPlayingAudioId(null);
      setAudioElement(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(url);
    audio.play();
    setPlayingAudioId(audioId);
    setAudioElement(audio);

    audio.onended = () => {
      setPlayingAudioId(null);
      setAudioElement(null);
    };
  };

  const handleApprove = async (audioId: number) => {
    try {
      await api.approveAudio(audioId);
      fetchAudios();
    } catch (err: any) {
      alert(err.message || 'Failed to approve audio');
    }
  };

  const handleReject = async (audioId: number) => {
    try {
      await api.rejectAudio(audioId);
      fetchAudios();
    } catch (err: any) {
      alert(err.message || 'Failed to reject audio');
    }
  };

  const handleRegenerate = async (vocabId: number) => {
    try {
      await api.regenerateAudio(vocabId);
      alert('AI TTS generation queued. Check back in a few seconds!');
      fetchAudios();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger re-generation');
    }
  };

  const handleFileUpload = async (vocabId: number, file: File) => {
    try {
      setUploadingId(vocabId);
      await api.uploadAudio(vocabId, file);
      alert('Custom audio file uploaded and approved successfully!');
      fetchAudios();
    } catch (err: any) {
      alert(err.message || 'Failed to upload custom audio file.');
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return <div className="text-slate-400 p-8 text-center">Loading TTS vocabulary audio review list...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white font-heading">Audio Review & Management Center</h2>
        <p className="text-sm text-slate-400 mt-1">
          Listen to AI-generated TTS audio clips, approve pending clips, or upload custom recorded MP3/WAV files
        </p>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Volume2 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">No Vocabulary Words Created</p>
            <p className="text-xs text-slate-500 mt-1">
              Add questions with highlighted words to trigger automatic TTS audio synthesis
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((item) => {
              const approved = item.approved_audio;
              const pending = item.pending_audio;

              return (
                <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-emerald-400">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white capitalize">{item.word}</h4>
                      <p className="text-xs text-slate-400">
                        {approved
                          ? 'Approved audio ready'
                          : pending
                          ? 'Pending teacher review'
                          : 'No audio approved'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {approved ? (
                      <>
                        <button
                          onClick={() => handlePlayAudio(approved.id, approved.url)}
                          className="btn-secondary text-xs py-2 px-3 flex items-center gap-2"
                        >
                          {playingAudioId === approved.id ? (
                            <Pause className="w-4 h-4 text-emerald-400 animate-pulse" />
                          ) : (
                            <Play className="w-4 h-4 text-emerald-400" />
                          )}
                          <span>Listen Audio</span>
                        </button>
                        <span className="badge badge-published">Approved</span>
                      </>
                    ) : pending ? (
                      <>
                        <button
                          onClick={() => handlePlayAudio(pending.id, pending.url)}
                          className="btn-secondary text-xs py-2 px-3 flex items-center gap-2"
                        >
                          {playingAudioId === pending.id ? (
                            <Pause className="w-4 h-4 text-emerald-400 animate-pulse" />
                          ) : (
                            <Play className="w-4 h-4 text-emerald-400" />
                          )}
                          <span>Listen Audio</span>
                        </button>
                        <button
                          onClick={() => handleApprove(pending.id)}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReject(pending.id)}
                          className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <span className="badge badge-draft">No audio approved</span>
                    )}

                    <label
                      title="Upload Custom MP3/WAV Audio"
                      className="btn-secondary text-xs py-2 px-3 flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-cyan-400" />
                      <span>{uploadingId === item.id ? 'Uploading…' : 'Upload MP3'}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        disabled={uploadingId === item.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(item.id, file);
                        }}
                        className="hidden"
                      />
                    </label>

                    <button
                      onClick={() => handleRegenerate(item.id)}
                      title="Trigger Fresh AI TTS Generation"
                      className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
