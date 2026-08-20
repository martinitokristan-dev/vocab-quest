import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type RoomResultsData } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Users,
  Trophy,
  BarChart2,
  CheckCircle2,
  Star,
  MapPin,
  RotateCcw,
  LayoutGrid,
  List,
  Download,
  X,
  Loader2,
} from 'lucide-react';

const CHARACTER_META: Record<string, { label: string; badgeClass: string }> = {
  'learner-girl':  { label: 'Learner Girl',  badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  'learner-boy':   { label: 'Learner Boy',   badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  'quest-boy':     { label: 'Learner Boy',   badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  'scholar-girl':  { label: 'School Girl',   badgeClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  'scholar-boy':   { label: 'School Boy',    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  'morena-girl':   { label: 'Sporty Girl',   badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  'sporty-girl':   { label: 'Sporty Girl',   badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  'moreno-boy':    { label: 'Explorer Boy',  badgeClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  'explorer-boy':  { label: 'Explorer Boy',  badgeClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  'explorer-girl': { label: 'Explorer Girl', badgeClass: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
};

const getCharacterInfo = (slug: string = '') => {
  const meta = CHARACTER_META[slug];
  if (meta) return meta;

  const normalized = slug
    .replace('moreno-boy', 'explorer-boy')
    .replace('morena-girl', 'sporty-girl')
    .replace('quest-boy', 'learner-boy')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    label: normalized || 'Learner',
    badgeClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  };
};

export const RoomControlPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const roomId = Number(id);
  const [data, setData] = useState<RoomResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const { showToast } = useToast();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const fetchResults = async () => {
    try {
      const res = await api.getRoomResults(roomId);
      const roomPayload = (res as any)?.data || res;
      setData(roomPayload);
    } catch (err) {
      console.error('Failed to fetch room results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();

    const interval = setInterval(() => {
      fetchResults();
    }, 1500);

    return () => clearInterval(interval);
  }, [roomId]);

  const handleStartRoom = async () => {
    try {
      setActionLoading(true);
      await api.startRoom(roomId);
      showToast('Session started! Pupils can now begin their quest.', 'success');
      fetchResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to start room', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseRoom = async () => {
    try {
      setActionLoading(true);
      await api.pauseRoom(roomId);
      showToast('Session paused. Pupil gameplay is on hold.', 'info');
      fetchResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to pause room', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeRoom = async () => {
    try {
      setActionLoading(true);
      await api.resumeRoom(roomId);
      showToast('Session resumed! Pupils can continue playing.', 'success');
      fetchResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to resume room', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCloseRoom = async () => {
    try {
      setActionLoading(true);
      setShowCloseModal(false);
      await api.closeRoom(roomId);
      showToast('Session ended. Room analytics finalized.', 'info');
      fetchResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to close room', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmResetRoom = async () => {
    try {
      setActionLoading(true);
      setShowResetModal(false);
      await api.resetRoom(roomId);
      showToast('Room reset successfully. All pupil scores and sessions cleared.', 'success');
      fetchResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset room', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="text-zinc-400 p-12 text-center text-xs">Connecting to live room session...</div>;
  }

  const { room, students = [], summary, question_breakdown = [] } = data || {};
  const isClosed = room?.status === 'closed';
  const isPaused = room?.status === 'paused';
  const pupilCount = students.length;
  const maxCap = room?.max_students || 40;
  const capacityPercent = Math.min(100, Math.round((pupilCount / maxCap) * 100));

  const handleExportCSV = () => {
    if (!students || students.length === 0) return;
    const headers = [
      'Rank',
      'Student Name',
      'Character',
      'Current Stage / Kingdom',
      'Questions Answered (out of 13)',
      'Final Stars / Score',
      'Progress %',
      'Status',
    ];
    const rows = students.map((s, idx) => {
      const charInfo = getCharacterInfo(s.avatar_slug);
      const answeredCount = `${s.correct_answers ?? s.questions_answered ?? 0} / 13`;
      const statusText = s.is_completed ? 'Finished Quest' : `Kingdom #${s.current_map_order || 1}`;
      return [
        idx + 1,
        `"${(s.player_name || '').replace(/"/g, '""')}"`,
        `"${charInfo.label}"`,
        `"${s.current_map_title || ('Kingdom ' + (s.current_map_order || 1))}"`,
        `"${answeredCount}"`,
        s.stars ?? s.score ?? 0,
        `"${s.progress_percentage || 0}%"`,
        `"${statusText}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `VocabQuest_${(room?.name || 'Room').replace(/\s+/g, '_')}_Scores_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Top Navigation & Session Controls */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4 print:hidden">
        <button onClick={() => navigate('/rooms')} className="btn-secondary text-xs cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Rooms</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetModal(true)}
            disabled={actionLoading}
            className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
            title="Clear joined pupils / reset scoreboard"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Pupils</span>
          </button>

          {room?.status === 'waiting' && (
            <button
              onClick={handleStartRoom}
              disabled={actionLoading}
              className="btn-primary text-xs py-1.5 px-3.5 font-semibold cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Session</span>
            </button>
          )}

          {room?.status === 'in_progress' && (
            <button
              onClick={handlePauseRoom}
              disabled={actionLoading}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Pause session in case of emergency"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Session</span>
            </button>
          )}

          {isPaused && (
            <button
              onClick={handleResumeRoom}
              disabled={actionLoading}
              className="btn-primary text-xs py-1.5 px-3.5 font-semibold cursor-pointer animate-pulse"
              title="Resume game session"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Session</span>
            </button>
          )}

          {!isClosed && (
            <button
              onClick={() => setShowCloseModal(true)}
              disabled={actionLoading}
              className="btn-danger text-xs py-1.5 px-3.5 font-semibold cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End Session</span>
            </button>
          )}
        </div>
      </div>

      {isPaused && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between animate-fade-in print:hidden">
          <div className="flex items-center gap-2.5">
            <Pause className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-300">Session Temporarily Paused</div>
              <div className="text-[11px] text-amber-400/80">Student gameplay is locked on all pupil devices until you resume.</div>
            </div>
          </div>
          <button
            onClick={handleResumeRoom}
            disabled={actionLoading}
            className="btn-primary text-xs py-1 px-3 font-bold"
          >
            Resume Quest
          </button>
        </div>
      )}

      {/* Classroom Status HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* PIN Card */}
        <div className="surface-card p-5 border border-white/5 flex flex-col justify-between text-center relative overflow-hidden">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Student Join PIN
          </span>
          <div className="my-1">
            <span className="font-mono text-4xl font-extrabold text-emerald-400 tracking-wider">
              {room?.pin}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
            <span>{room?.name}</span>
            <span>•</span>
            <span
              className={`font-semibold capitalize ${
                room?.status === 'in_progress'
                  ? 'text-emerald-400'
                  : room?.status === 'paused'
                  ? 'text-amber-400'
                  : room?.status === 'waiting'
                  ? 'text-cyan-400'
                  : 'text-zinc-500'
              }`}
            >
              {room?.status?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Occupancy Card */}
        <div className="surface-card p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Pupils in Room
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {pupilCount} / {maxCap}
            </span>
          </div>

          <div className="space-y-1.5 my-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Classroom Occupancy</span>
              <span className="font-mono">{capacityPercent}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">
            {maxCap - pupilCount > 0 ? `${maxCap - pupilCount} seats remaining` : 'Room is currently full'}
          </p>
        </div>

        {/* Class Average Score */}
        <div className="surface-card p-5 border border-white/5 flex flex-col justify-between text-center">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Class Average Score
          </span>
          <div className="flex items-center justify-center gap-1.5 my-1">
            <Trophy className="w-6 h-6 text-amber-400" />
            <span className="text-3xl font-extrabold text-white font-mono">{summary?.class_average_score || 0}</span>
            <span className="text-xs text-zinc-400">pts</span>
          </div>
          <p className="text-xs text-zinc-400">
            {pupilCount} active {pupilCount === 1 ? 'pupil' : 'pupils'} participating
          </p>
        </div>
      </div>

      {/* Main Unified Student Score Sheet & Live Telemetry Section */}
      <div className="surface-card p-5 rounded-xl border border-white/5 space-y-4">
        {/* Header Row with Export Action & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {isClosed ? 'Final Student Score Sheet & Grades' : 'Live Student Scoreboard'} ({pupilCount})
              </h3>
              <p className="text-[11px] text-zinc-500">
                {isClosed
                  ? 'All scores and star ratings are permanently saved for grade sheet transfer'
                  : 'Live student progress and real-time star ratings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 print:hidden">
            {isClosed ? (
              <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved to Analytics</span>
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live updating
              </span>
            )}

            {/* Export CSV Button */}
            {students.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="btn-secondary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 border border-white/10"
                title="Download CSV score sheet to transfer to grading sheet"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}

            {/* View Toggle */}
            <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-white/5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                  viewMode === 'table' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                  viewMode === 'grid' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Cards Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs">
            {isClosed ? 'No student scores recorded for this session' : `Waiting for students to join with PIN "${room?.pin}"`}
          </div>
        ) : viewMode === 'table' ? (
          /* 1. Full-Width Clean Table View with Generous Proportional Spacing */
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-zinc-300 border-collapse min-w-[920px]">
              <thead className="bg-zinc-900/90 uppercase text-[10px] text-zinc-400 font-bold border-b border-white/10 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-16 text-center">Rank</th>
                  <th className="px-5 py-3.5 w-44">Student Name</th>
                  <th className="px-4 py-3.5 w-36">Character</th>
                  <th className="px-4 py-3.5 w-48">Stage / Kingdom</th>
                  <th className="px-4 py-3.5 w-40 text-center">Questions Answered</th>
                  <th className="px-4 py-3.5 w-36 text-center">Final Stars</th>
                  <th className="px-5 py-3.5 w-36 text-center">Progress</th>
                  <th className="px-5 py-3.5 w-40 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {students.map((student, idx) => {
                  const charInfo = getCharacterInfo(student.avatar_slug);
                  const answeredCount = student.correct_answers ?? student.questions_answered ?? 0;
                  return (
                    <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5 text-center font-bold font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            idx === 0
                              ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40'
                              : idx === 1
                              ? 'text-zinc-200 bg-zinc-700/50 border border-zinc-500/40'
                              : idx === 2
                              ? 'text-amber-600 bg-amber-700/20 border border-amber-700/40'
                              : 'text-zinc-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white uppercase tracking-tight text-sm">
                        {student.player_name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-semibold border ${charInfo.badgeClass}`}>
                          {charInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{student.current_map_title || `Kingdom ${student.current_map_order || 1}`}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center font-mono font-bold text-emerald-400 text-xs bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                          {answeredCount} / 13 Questions
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 text-amber-300 font-extrabold bg-amber-500/10 px-3 py-1 rounded-lg text-xs border border-amber-500/30">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm">{student.stars ?? student.score ?? 0} Stars</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                              style={{ width: `${student.progress_percentage || 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-zinc-300 min-w-[28px]">
                            {student.progress_percentage || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {student.is_completed ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md text-[11px] font-bold border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Finished Quest 🎉</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md text-[11px] font-bold border border-amber-500/20">
                            <MapPin className="w-3 h-3 text-amber-400" />
                            <span>Kingdom #{student.current_map_order || 1}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* 2. Responsive Cards Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {students.map((student, idx) => {
              const charInfo = getCharacterInfo(student.avatar_slug);
              return (
                <div
                  key={student.id}
                  className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-3 hover:border-emerald-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-emerald-400">#{idx + 1}</span>
                        <span className="text-xs font-bold text-white uppercase">{student.player_name}</span>
                      </div>
                      <span className={`inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${charInfo.badgeClass}`}>
                        {charInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{student.stars ?? student.score ?? 0} Stars</span>
                    </div>
                  </div>

                  <div className="bg-black/30 p-2.5 rounded-lg border border-white/5 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1 text-cyan-400">
                        <MapPin className="w-3 h-3" />
                        <span>{student.current_map_title || `Stage ${student.current_map_order || 1}`}</span>
                      </span>
                      <span className="text-zinc-500 font-mono">
                        {student.questions_answered} answered
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-200 pt-0.5">
                      <span className="font-semibold">
                        {student.is_completed ? (
                          <span className="text-emerald-400 font-bold">Finished Quest 🎉</span>
                        ) : (
                          <span>Question #{student.current_question_number || 1}</span>
                        )}
                      </span>
                      {(student as any).current_word && !student.is_completed && (
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 rounded text-[10px]">
                          "{(student as any).current_word}"
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${student.progress_percentage || 20}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Question Accuracy Breakdown Section (Saved Analytical Insights) */}
      <div className="surface-card p-5 rounded-xl border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Classroom Question Accuracy & Vocabulary Mastery</h3>
              <p className="text-[11px] text-zinc-500">Breakdown of correct vs wrong attempts across all vocabulary words</p>
            </div>
          </div>
        </div>

        {question_breakdown && question_breakdown.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/80 uppercase text-[10px] text-zinc-500 font-semibold border-b border-white/10">
                <tr>
                  <th className="p-2.5">Word</th>
                  <th className="p-2.5">Sentence Prompt</th>
                  <th className="p-2.5">Total Attempts</th>
                  <th className="p-2.5">Correct / Wrong</th>
                  <th className="p-2.5">Class Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {question_breakdown.map((q) => (
                  <tr key={q.question_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-2.5 font-bold text-emerald-400">{q.highlighted_word}</td>
                    <td className="p-2.5 max-w-xs truncate text-zinc-400">{q.sentence}</td>
                    <td className="p-2.5 font-mono">{q.total_attempts}</td>
                    <td className="p-2.5">
                      <span className="text-emerald-400 font-bold">{q.correct_count}</span> /{' '}
                      <span className="text-rose-400 font-bold">{q.wrong_count}</span>
                    </td>
                    <td className="p-2.5 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{q.accuracy_percentage}%</span>
                        <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              q.accuracy_percentage >= 70
                                ? 'bg-emerald-500'
                                : q.accuracy_percentage >= 40
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${q.accuracy_percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-zinc-500 text-center py-6 text-xs">No vocabulary attempts recorded for this room</div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowResetModal(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Reset Room Pupils</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-zinc-300">
                Reset scoreboard for <span className="font-semibold text-white">{room?.name || `Room #${room?.pin}`}</span>?
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This will clear all current pupil session scores and reset the leaderboard for a fresh game session.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-white/8 cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetRoom}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Pupils
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Room Confirmation Modal */}
      {showCloseModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCloseModal(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Square className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">End Game Session</h3>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-zinc-300">
                End session for <span className="font-semibold text-white">{room?.name || `Room #${room?.pin}`}</span>?
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                The room will be closed to students and final scores/analytics will be finalized.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-white/8 cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCloseRoom}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Ending...
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    End Session
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
