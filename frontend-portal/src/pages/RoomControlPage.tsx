import React, { useState, useEffect, useMemo } from 'react';
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
  Eye,
} from 'lucide-react';

const CHARACTER_META: Record<string, { label: string; badgeClass: string }> = {
  'learner-girl':  { label: 'Learner Girl',  badgeClass: 'text-rose-700 bg-rose-50 border-rose-200' },
  'learner-boy':   { label: 'Learner Boy',   badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'quest-boy':     { label: 'Learner Boy',   badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'scholar-girl':  { label: 'School Girl',   badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  'scholar-boy':   { label: 'School Boy',    badgeClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  'morena-girl':   { label: 'Sporty Girl',   badgeClass: 'text-amber-800 bg-amber-50 border-amber-200' },
  'sporty-girl':   { label: 'Sporty Girl',   badgeClass: 'text-amber-800 bg-amber-50 border-amber-200' },
  'moreno-boy':    { label: 'Explorer Boy',  badgeClass: 'text-cyan-800 bg-cyan-50 border-cyan-200' },
  'explorer-boy':  { label: 'Explorer Boy',  badgeClass: 'text-cyan-800 bg-cyan-50 border-cyan-200' },
  'explorer-girl': { label: 'Explorer Girl', badgeClass: 'text-teal-800 bg-teal-50 border-teal-200' },
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
    badgeClass: 'text-cyan-800 bg-cyan-50 border-cyan-200',
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
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<any | null>(null);

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

  const silentRefreshResults = async () => {
    try {
      const res = await api.getRoomResults(roomId);
      const roomPayload = (res as any)?.data || res;
      setData(roomPayload);
    } catch (err) {
      console.error('Failed to silently refresh results:', err);
    }
  };

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 3000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Sort questions ascending from question 1 to 15 in game progression order
  const question_breakdown = useMemo(() => {
    const list = data?.question_breakdown || [];
    return list.slice().sort((a, b) => {
      if (a.question_number != null && b.question_number != null) {
        return a.question_number - b.question_number;
      }
      const mapA = a.map_order ?? (a.map_id ?? 0);
      const mapB = b.map_order ?? (b.map_id ?? 0);
      if (mapA !== mapB) return mapA - mapB;
      return (a.order_index ?? 0) - (b.order_index ?? 0);
    });
  }, [data?.question_breakdown]);

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading classroom telemetry...</div>;
  }

  const room = data?.room;
  const students = data?.students || [];
  const summary = data?.summary;
  const isClosed = room?.status === 'closed';
  const isPaused = room?.status === 'paused';
  const pupilCount = room?.active_students_count ?? room?.students_count ?? students.length;
  const maxCap = room?.max_students ?? 40;
  const capacityPercent = Math.min(100, Math.round((pupilCount / maxCap) * 100));

  const handleStartRoom = async () => {
    try {
      setActionLoading(true);
      await api.startRoom(roomId);
      showToast('Game session started!', 'success');
      // Optimistic update: update room status in state
      setData((prev) => (prev ? {
        ...prev,
        room: { ...prev.room, status: 'in_progress' }
      } : null));
      // Silent background refresh to get updated data
      silentRefreshResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to start session', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseRoom = async () => {
    try {
      setActionLoading(true);
      await api.pauseRoom(roomId);
      showToast('Session paused.', 'info');
      // Optimistic update: update room status in state
      setData((prev) => (prev ? {
        ...prev,
        room: { ...prev.room, status: 'paused' }
      } : null));
      // Silent background refresh to get updated data
      silentRefreshResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to pause session', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeRoom = async () => {
    try {
      setActionLoading(true);
      await api.resumeRoom(roomId);
      showToast('Session resumed.', 'success');
      // Optimistic update: update room status in state
      setData((prev) => (prev ? {
        ...prev,
        room: { ...prev.room, status: 'in_progress' }
      } : null));
      // Silent background refresh to get updated data
      silentRefreshResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to resume session', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCloseRoom = async () => {
    try {
      setActionLoading(true);
      await api.closeRoom(roomId);
      showToast('Session ended and archived.', 'info');
      setShowCloseModal(false);
      // Optimistic update: update room status in state
      setData((prev) => (prev ? {
        ...prev,
        room: { ...prev.room, status: 'closed' }
      } : null));
      // Silent background refresh to get updated data
      silentRefreshResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to end session', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmResetRoom = async () => {
    try {
      setActionLoading(true);
      await api.resetRoom(roomId);
      showToast('Room pupils reset.', 'info');
      setShowResetModal(false);
      // Invalidate cache and refresh to get updated data
      api.invalidateCache(`/rooms/${roomId}/results`);
      silentRefreshResults();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset room', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;
    const headers = ['Rank', 'Student Name', 'Character', 'Stage', 'Questions Answered', 'Final Stars', 'Progress %', 'Status'];
    const rows = students.map((s, idx) => [
      idx + 1,
      `"${s.player_name}"`,
      `"${getCharacterInfo(s.avatar_slug).label}"`,
      `"${s.current_map_title || `Kingdom ${s.current_map_order || 1}`}"`,
      s.correct_answers ?? s.questions_answered ?? 0,
      s.stars ?? s.score ?? 0,
      `${s.progress_percentage || 0}%`,
      s.is_completed ? 'Finished Quest' : 'In Progress',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VocabQuest_${(room?.name || 'Room').replace(/\s+/g, '_')}_Scores_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Top Navigation & Session Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
        <button onClick={() => navigate('/rooms')} className="btn-secondary text-xs cursor-pointer shadow-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Rooms</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetModal(true)}
            disabled={actionLoading}
            className="btn-secondary text-xs py-1.5 px-3 cursor-pointer shadow-xs"
            title="Clear joined pupils / reset scoreboard"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Pupils</span>
          </button>

          {room?.status === 'waiting' && (
            <button
              onClick={handleStartRoom}
              disabled={actionLoading}
              className="btn-primary text-xs py-1.5 px-3.5 font-semibold cursor-pointer shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Session</span>
            </button>
          )}

          {room?.status === 'in_progress' && (
            <button
              onClick={handlePauseRoom}
              disabled={actionLoading}
              className="px-3.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
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
              className="btn-primary text-xs py-1.5 px-3.5 font-semibold cursor-pointer animate-pulse shadow-sm"
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
              className="btn-danger text-xs py-1.5 px-3.5 font-semibold cursor-pointer shadow-xs"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End Session</span>
            </button>
          )}
        </div>
      </div>

      {isPaused && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between animate-fade-in print:hidden">
          <div className="flex items-center gap-2.5">
            <Pause className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-900">Session Temporarily Paused</div>
              <div className="text-[11px] text-amber-800">Student gameplay is locked on all pupil devices until you resume.</div>
            </div>
          </div>
          <button
            onClick={handleResumeRoom}
            disabled={actionLoading}
            className="btn-primary text-xs py-1 px-3 font-bold shadow-xs"
          >
            Resume Quest
          </button>
        </div>
      )}

      {/* Classroom Status HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* PIN Card */}
        <div className="surface-card p-5 border border-slate-200 rounded-2xl flex flex-col justify-between text-center relative overflow-hidden bg-white shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Student Join PIN
          </span>
          <div className="my-1">
            <span className="font-mono text-4xl font-extrabold text-emerald-700 tracking-wider">
              {room?.pin}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className="font-bold text-slate-800">{room?.name}</span>
            <span>•</span>
            <span
              className={`font-bold capitalize ${
                room?.status === 'in_progress'
                  ? 'text-emerald-700'
                  : room?.status === 'paused'
                  ? 'text-amber-700'
                  : room?.status === 'waiting'
                  ? 'text-sky-700'
                  : 'text-slate-500'
              }`}
            >
              {room?.status?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Occupancy Card */}
        <div className="surface-card p-5 border border-slate-200 rounded-2xl flex flex-col justify-between bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Pupils in Room
            </span>
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {pupilCount} / {maxCap}
            </span>
          </div>

          <div className="space-y-1.5 my-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Classroom Occupancy</span>
              <span className="font-mono font-bold text-slate-700">{capacityPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            {maxCap - pupilCount > 0 ? `${maxCap - pupilCount} seats remaining` : 'Room is currently full'}
          </p>
        </div>

        {/* Class Average Score */}
        <div className="surface-card p-5 border border-slate-200 rounded-2xl flex flex-col justify-between text-center bg-white shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Class Average Score
          </span>
          <div className="flex items-center justify-center gap-1.5 my-1">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{summary?.class_average_score || 0}</span>
            <span className="text-xs text-slate-500 font-bold">pts</span>
          </div>
          <p className="text-xs text-slate-500">
            {pupilCount} active {pupilCount === 1 ? 'pupil' : 'pupils'} participating
          </p>
        </div>
      </div>

      {/* Main Student Score Sheet Section */}
      <div className="surface-card p-5 rounded-2xl border border-slate-200 space-y-4 bg-white shadow-xs text-slate-900">
        {/* Header Row with Export Action & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-slate-500" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {isClosed ? 'Final Student Score Sheet & Grades' : 'Live Student Scoreboard'}
                </h3>
                <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {pupilCount}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isClosed
                  ? 'All scores and star ratings are permanently saved for grade sheet transfer'
                  : 'Live student progress and real-time star ratings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 print:hidden">
            {isClosed ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Saved to Analytics</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live updating</span>
              </span>
            )}

            {/* Export CSV Button */}
            {students.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Download CSV score sheet to transfer to grading sheet"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            )}

            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/60">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs cursor-pointer transition-all ${
                  viewMode === 'table' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs cursor-pointer transition-all ${
                  viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Cards Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            {isClosed ? 'No student scores recorded for this session' : `Waiting for students to join with PIN "${room?.pin}"`}
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[860px]">
              <thead className="border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-16 text-center font-normal">Rank</th>
                  <th className="py-3 px-4 font-normal">Student Name</th>
                  <th className="py-3 px-4 font-normal">Character</th>
                  <th className="py-3 px-4 font-normal">Stage / Kingdom</th>
                  <th className="py-3 px-4 text-center font-normal">Questions</th>
                  <th className="py-3 px-4 text-center font-normal">Final Stars</th>
                  <th className="py-3 px-4 text-center font-normal">Progress</th>
                  <th className="py-3 px-4 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {students.map((student, idx) => {
                  const charInfo = getCharacterInfo(student.avatar_slug);
                  const answeredCount = student.correct_answers ?? student.questions_answered ?? 0;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono">
                        {idx === 0 ? (
                          <span className="font-semibold text-xs text-amber-500">#1</span>
                        ) : idx === 1 ? (
                          <span className="font-semibold text-xs text-slate-600">#2</span>
                        ) : idx === 2 ? (
                          <span className="font-semibold text-xs text-amber-700">#3</span>
                        ) : (
                          <span className="text-xs text-slate-400">#{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 tracking-tight">
                        {student.player_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-normal">
                        {charInfo.label}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{student.current_map_title || `Kingdom ${student.current_map_order || 1}`}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="font-semibold text-slate-800">{answeredCount}</span>
                        <span className="text-slate-400 text-[11px]"> / 15</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center gap-1 font-mono font-semibold text-slate-800">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{student.stars ?? student.score ?? 0}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2 max-w-[120px] mx-auto">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${student.progress_percentage || 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 min-w-[28px] text-right">
                            {student.progress_percentage || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {student.is_completed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {students.map((student, idx) => {
              const charInfo = getCharacterInfo(student.avatar_slug);
              const answeredCount = student.correct_answers ?? student.questions_answered ?? 0;
              return (
                <div
                  key={student.id}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 space-y-3 shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-semibold text-slate-400">#{idx + 1}</span>
                        <span className="text-sm font-semibold text-slate-900 tracking-tight">{student.player_name}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-normal">
                        {charInfo.label}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-800">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{student.stars ?? student.score ?? 0}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{student.current_map_title || `Kingdom ${student.current_map_order || 1}`}</span>
                      </span>
                      <span className="font-mono text-slate-600">
                        {answeredCount} / 15
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {student.is_completed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span>Question #{student.current_question_number || 1}</span>
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-slate-400">
                        {student.progress_percentage || 0}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${student.progress_percentage || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Question Accuracy Breakdown Section */}
      <div className="surface-card p-5 rounded-2xl border border-slate-200 space-y-4 bg-white shadow-xs text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-4 h-4 text-slate-500" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Classroom Question Accuracy & Vocabulary Mastery</h3>
              <p className="text-[11px] text-slate-400">Breakdown of correct vs wrong attempts across all vocabulary words</p>
            </div>
          </div>
        </div>

        {question_breakdown && question_breakdown.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[860px]">
              <thead className="border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-14 text-center font-normal">#</th>
                  <th className="py-3 px-4 w-32 font-normal">Word</th>
                  <th className="py-3 px-4 font-normal">Sentence Prompt</th>
                  <th className="py-3 px-4 w-40 text-center font-normal">Total Attempts</th>
                  <th className="py-3 px-4 w-44 text-center font-normal">Correct / Wrong (1st Try)</th>
                  <th className="py-3 px-4 w-32 text-center font-normal">1st Attempt %</th>
                  <th className="py-3 px-4 w-20 text-center font-normal">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {question_breakdown.map((q, idx) => {
                  const qNum = q.question_number ?? (idx + 1);
                  const firstAttemptPct = q.first_attempt_percentage ?? q.accuracy_percentage ?? 0;
                  const firstAttemptCount = q.first_attempt_count ?? q.correct_count;
                  const firstAttemptWrong = q.first_attempt_wrong ?? q.wrong_count;

                  return (
                    <tr key={q.question_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-400 text-center">
                        #{qNum}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-emerald-700">
                        {q.highlighted_word}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600" title={q.sentence}>
                        {q.sentence}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-800 text-center">
                        {q.total_attempts} <span className="font-normal text-slate-400">({firstAttemptPct}%)</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-center">
                        <span className="text-emerald-600">{firstAttemptCount}</span>
                        <span className="text-slate-300 font-normal px-1">/</span>
                        <span className="text-rose-500">{firstAttemptWrong}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-800 text-center">
                        {firstAttemptPct}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedQuestionForModal(q)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title={`View Question #${qNum} Details`}
                          aria-label={`View Question #${qNum} Details`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-slate-400 text-center py-8 text-xs">No vocabulary attempts recorded for this room</div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setShowResetModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Reset Room Pupils</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Reset scoreboard for <span className="font-bold text-slate-900">{room?.name || `Room #${room?.pin}`}</span>?
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                This will clear all current pupil session scores and reset the leaderboard for a fresh game session.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetRoom}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Pupils</span>
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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setShowCloseModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Square className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">End Game Session</h3>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                End session for <span className="font-bold text-slate-900">{room?.name || `Room #${room?.pin}`}</span>?
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The room will be closed to students and final scores/analytics will be finalized.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCloseRoom}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-60"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ending...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>End Session</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Question Details Modal */}
      {selectedQuestionForModal && (() => {
        const q = selectedQuestionForModal;
        const firstAttemptPct = q.first_attempt_percentage ?? q.accuracy_percentage ?? 0;
        const firstAttemptCount = q.first_attempt_count ?? q.correct_count;
        const secondAttemptCount = q.second_attempt_count ?? 0;
        const secondAttemptPct = q.second_attempt_percentage ?? 0;
        const thirdAttemptCount = q.third_attempt_count ?? 0;
        const thirdAttemptPct = q.third_attempt_percentage ?? 0;
        const totalStudents = q.total_students ?? (firstAttemptCount + (q.first_attempt_wrong ?? 0));

        return (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setSelectedQuestionForModal(null)}
          >
            <div
              className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-400">
                      #{q.question_number || (question_breakdown.findIndex((x) => x.question_id === q.question_id) + 1)}
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {q.highlighted_word}
                    </span>
                    {q.map_title && (
                      <span className="text-[11px] text-slate-400 font-sans">
                        • {q.map_title}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    "{q.sentence}"
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedQuestionForModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {totalStudents === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No pupils have attempted this question yet.
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {/* 3 Attempts Breakdown */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">1st Attempt</div>
                      <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
                        {firstAttemptPct}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {firstAttemptCount} {firstAttemptCount === 1 ? 'pupil' : 'pupils'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">2nd Attempt</div>
                      <div className="text-lg font-bold font-mono text-amber-600 mt-0.5">
                        {secondAttemptPct}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {secondAttemptCount} {secondAttemptCount === 1 ? 'pupil' : 'pupils'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">3rd+ Attempt</div>
                      <div className="text-lg font-bold font-mono text-rose-600 mt-0.5">
                        {thirdAttemptPct}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {thirdAttemptCount} {thirdAttemptCount === 1 ? 'pupil' : 'pupils'}
                      </div>
                    </div>
                  </div>

                  {/* Distribution Progress Bar & Summary */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${firstAttemptPct}%` }}
                        title={`1st: ${firstAttemptPct}%`}
                      />
                      <div
                        className="bg-amber-400 h-full transition-all duration-300"
                        style={{ width: `${secondAttemptPct}%` }}
                        title={`2nd: ${secondAttemptPct}%`}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all duration-300"
                        style={{ width: `${thirdAttemptPct}%` }}
                        title={`3rd+: ${thirdAttemptPct}%`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{totalStudents} total {totalStudents === 1 ? 'pupil' : 'pupils'}</span>
                      <span>{q.total_attempts} total attempts</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
