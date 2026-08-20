import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type RoomData } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Plus, BarChart2, Copy, Check, X, Users, Eye, Trash2, Loader2 } from 'lucide-react';

const CAPACITY_PRESETS = [20, 30, 40, 50];

export const RoomsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Room Modal State
  const [showModal, setShowModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxStudents, setMaxStudents] = useState(40);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<RoomData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await api.getRooms();
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      setCreating(true);
      const res = await api.createRoom({
        name: roomName.trim() || undefined,
        max_students: Number(maxStudents) || 40,
      });
      setShowModal(false);
      setRoomName('');
      setMaxStudents(40);
      showToast(`Game room "${res.data?.name || 'Room'}" created with PIN: ${res.data?.pin}`, 'success');
      fetchRooms();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create game room.');
      showToast(err.message || 'Failed to create game room.', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Opens the custom delete confirmation modal instead of browser confirm()
  const handleDeleteRoom = (e: React.MouseEvent, room: RoomData) => {
    e.stopPropagation();
    setDeleteTarget(room);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteRoom(deleteTarget.id);
      showToast(`Room #${deleteTarget.pin} deleted successfully.`, 'info');
      setDeleteTarget(null);
      fetchRooms();
    } catch (err: any) {
      setDeleteTarget(null);
      showToast(err?.message || 'Failed to delete room. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    showToast(`Room PIN ${pin} copied to clipboard!`, 'info', 2000);
    setTimeout(() => setCopiedPin(null), 1500);
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-zinc-500">Loading game rooms...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Game Rooms</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Create PIN rooms for classroom play and monitor results</p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setRoomName('');
            setMaxStudents(40);
            setShowModal(true);
          }}
          className="btn-primary cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Room</span>
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.length === 0 ? (
          <div className="col-span-full surface-card p-12 text-center text-zinc-500">
            <p className="text-sm font-medium text-zinc-300">No rooms created yet</p>
            <p className="text-xs text-zinc-500 mt-1">Create a game room to generate a 6-digit PIN for your students</p>
          </div>
        ) : (
          rooms.map((room) => {
            const isClosed = room.status === 'closed';
            const pupilCount = room.active_students_count ?? room.students_count ?? 0;
            const maxCap = room.max_students ?? 40;
            const capacityPercent = Math.min(100, Math.round((pupilCount / maxCap) * 100));

            return (
              <div
                key={room.id}
                className="surface-card p-4 rounded-xl border border-white/5 flex flex-col justify-between gap-4 hover:border-white/10 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        room.status === 'waiting'
                          ? 'bg-amber-500/15 text-amber-300'
                          : room.status === 'in_progress'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {room.status.replace('_', ' ')}
                    </span>

                    {/* Pupil Limit Indicator */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-900/90 px-2 py-0.5 rounded border border-white/5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold">{pupilCount}</span>
                      <span className="text-zinc-500 font-mono">/ {maxCap} Pupils</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{room.name || `Room #${room.pin}`}</h3>
                  </div>

                  {/* Big PIN Code Box */}
                  <div
                    onClick={() => handleCopyPin(room.pin)}
                    className="p-3 bg-zinc-950 rounded-lg border border-white/5 flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition-colors group"
                    title="Click to copy PIN"
                  >
                    <div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Room PIN</div>
                      <div className="text-xl font-mono font-bold text-emerald-400 tracking-widest">{room.pin}</div>
                    </div>
                    <div className="text-zinc-500 group-hover:text-emerald-400">
                      {copiedPin === room.pin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Pupil Capacity Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Room Capacity</span>
                      <span className="font-mono text-zinc-400">{capacityPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          capacityPercent >= 90
                            ? 'bg-rose-500'
                            : capacityPercent >= 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${capacityPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                  {isClosed ? (
                    /* Closed session: Results + Delete */
                    <>
                      <button
                        onClick={() => navigate(`/rooms/${room.id}`)}
                        className="flex-1 btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span>Results</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRoom(e, room)}
                        className="flex-none btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer text-rose-400 hover:text-rose-300"
                        title="Delete room"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  ) : (
                    /* Active/waiting session: Monitor + Delete */
                    <>
                      <button
                        onClick={() => navigate(`/rooms/${room.id}`)}
                        className="flex-1 btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Monitor</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRoom(e, room)}
                        className="flex-none btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1.5 cursor-pointer text-rose-400 hover:text-rose-300"
                        title="Delete room"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Create Room Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 rounded-xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-sm font-bold text-white">Create Game Room</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Room Name (e.g. Section Mango)</label>
                <input
                  type="text"
                  placeholder="e.g. Section Mango"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="minimal-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Pupil Limit / Max Capacity (Pupils allowed to join)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(Number(e.target.value) || 1)}
                  className="minimal-input text-xs"
                />

                <div className="flex items-center gap-1.5 mt-2">
                  {CAPACITY_PRESETS.map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setMaxStudents(cap)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        maxStudents === cap
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cap} Pupils
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary text-xs py-1.5 px-4 font-bold">
                  {creating ? 'Generating PIN...' : 'Generate PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">Delete Room</h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-zinc-300">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-white">
                  {deleteTarget.name || `Room #${deleteTarget.pin}`}
                </span>
                ?
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This will permanently erase all student scores, session analytics, and deactivate PIN{' '}
                <span className="font-mono text-zinc-400">{deleteTarget.pin}</span>. This cannot be undone.
              </p>
            </div>

            {/* Footer */}
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
                onClick={confirmDelete}
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
                    Delete Room
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
