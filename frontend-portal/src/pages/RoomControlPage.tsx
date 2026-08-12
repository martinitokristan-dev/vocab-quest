import React, { useState, useEffect } from 'react';
import { api, type RoomResultsData } from '../services/api';
import { ArrowLeft, Play, Square, Users, Trophy, BarChart2, CheckCircle2 } from 'lucide-react';

interface RoomControlPageProps {
  roomId: number;
  onBack: () => void;
}

export const RoomControlPage: React.FC<RoomControlPageProps> = ({ roomId, onBack }) => {
  const [data, setData] = useState<RoomResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchResults = async () => {
    try {
      const res = await api.getRoomResults(roomId);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch room results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();

    const interval = setInterval(() => {
      if (data?.room?.status && data.room.status !== 'closed') {
        fetchResults();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [roomId, data?.room?.status]);

  const handleStartRoom = async () => {
    try {
      setActionLoading(true);
      await api.startRoom(roomId);
      fetchResults();
    } catch (err: any) {
      alert(err.message || 'Failed to start room');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseRoom = async () => {
    if (confirm('Close this room? Joining will end and historical score analysis will be generated.')) {
      try {
        setActionLoading(true);
        await api.closeRoom(roomId);
        fetchResults();
      } catch (err: any) {
        alert(err.message || 'Failed to close room');
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (loading || !data) {
    return <div className="text-zinc-400 p-8 text-center text-xs">Connecting to room live server...</div>;
  }

  const { room, students = [], summary, question_breakdown = [] } = data || {};
  const isClosed = room?.status === 'closed';

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-secondary text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Rooms</span>
        </button>

        <div className="flex items-center gap-2.5">
          {room?.status === 'waiting' && (
            <button
              onClick={handleStartRoom}
              disabled={actionLoading}
              className="btn-primary text-xs py-1.5 px-3"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Game Session</span>
            </button>
          )}

          {!isClosed && (
            <button
              onClick={handleCloseRoom}
              disabled={actionLoading}
              className="btn-danger text-xs py-1.5 px-3"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End & Close Room</span>
            </button>
          )}
        </div>
      </div>

      {/* Classroom Projection Banner */}
      <div className="surface-card p-6 bg-[#121215] text-center border border-white/10">
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
            Student Join PIN
          </span>
          <h1 className="text-5xl font-extrabold text-zinc-100 font-mono tracking-widest my-1 select-all">
            {room?.pin}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Room: <span className="font-semibold text-zinc-200">{room?.name}</span> • Status:{' '}
            <span className="capitalize font-semibold text-emerald-400">{room?.status?.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {/* Mode 1: Live Scoreboard */}
      {!isClosed ? (
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-zinc-100">Connected Live Students</h3>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono animate-pulse">
              ● Auto-refreshing live scores
            </span>
          </div>

          {students.length === 0 ? (
            <div className="text-center py-10 text-zinc-500">
              <p className="text-xs font-medium text-zinc-400">Waiting for students to enter PIN...</p>
              <p className="text-[11px] text-zinc-500 mt-1">Students enter PIN "{room?.pin}" on their devices to join</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/80 uppercase tracking-wider text-zinc-400 font-semibold border-b border-white/10">
                  <tr>
                    <th className="p-3">Rank</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Avatar</th>
                    <th className="p-3">Questions Answered</th>
                    <th className="p-3">Current Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {students.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-bold text-emerald-400">#{idx + 1}</td>
                      <td className="p-3 font-semibold text-zinc-100">{student.player_name}</td>
                      <td className="p-3 capitalize text-zinc-400">{student.avatar_slug}</td>
                      <td className="p-3">{student.questions_answered}</td>
                      <td className="p-3 font-bold text-emerald-400">{student.score} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Mode 2: Historical Class Analytics */
        <div className="space-y-6">
          {/* Class Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="surface-card p-5 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
              <p className="text-xl font-bold text-zinc-100">{summary?.total_students || 0}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Total Class Participants</p>
            </div>

            <div className="surface-card p-5 text-center">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
              <p className="text-xl font-bold text-zinc-100">{summary?.completed_students || 0}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Completed All Maps</p>
            </div>

            <div className="surface-card p-5 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <p className="text-xl font-bold text-zinc-100">{summary?.class_average_score || 0} pts</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Class Average Score</p>
            </div>
          </div>

          {/* Question Accuracy Breakdown Table */}
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-zinc-100">Per-Question Class Accuracy</h3>
            </div>

            {question_breakdown && question_breakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/80 uppercase tracking-wider text-zinc-400 font-semibold border-b border-white/10">
                    <tr>
                      <th className="p-2.5">Word</th>
                      <th className="p-2.5">Sentence</th>
                      <th className="p-2.5">Total Attempts</th>
                      <th className="p-2.5">Correct / Wrong</th>
                      <th className="p-2.5">Accuracy %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {question_breakdown.map((q) => (
                      <tr key={q.question_id} className="hover:bg-white/5 transition-colors">
                        <td className="p-2.5 font-semibold text-emerald-400">{q.highlighted_word}</td>
                        <td className="p-2.5 max-w-xs truncate text-zinc-400">{q.sentence}</td>
                        <td className="p-2.5">{q.total_attempts}</td>
                        <td className="p-2.5">
                          <span className="text-emerald-400 font-semibold">{q.correct_count}</span> /{' '}
                          <span className="text-rose-400 font-semibold">{q.wrong_count}</span>
                        </td>
                        <td className="p-2.5 font-semibold text-zinc-100">
                          <div className="flex items-center gap-2">
                            <span>{q.accuracy_percentage}%</span>
                            <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
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
              <div className="text-zinc-500 text-center py-6 text-xs">No question breakdown data available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
