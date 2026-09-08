import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type RoomData } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Copy, Check, X, Trash2, Loader2 } from 'lucide-react';

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
    // Refresh rooms when page regains focus (e.g., navigating back from RoomControlPage)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentRefreshRooms();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const silentRefreshRooms = async () => {
    try {
      const res = await api.getRooms();
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to silently refresh rooms:', err);
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
      // Optimistic update: add new room to state without reloading
      if (res.data) {
        setRooms((prev) => [res.data, ...prev]);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create game room.');
      showToast(err.message || 'Failed to create game room.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    showToast(`PIN ${pin} copied to clipboard!`, 'info');
    setTimeout(() => setCopiedPin(null), 2000);
  };

  const handleDeleteRoom = (e: React.MouseEvent, room: RoomData) => {
    e.stopPropagation();
    setDeleteTarget(room);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteRoom(deleteTarget.id);
      showToast(`Room #${deleteTarget.pin} deleted.`, 'info');
      setDeleteTarget(null);
      // Optimistic update: remove the room from state without reloading
      setRooms((prev) => prev.filter((room) => room.id !== deleteTarget.id));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete room', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading live game rooms...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Game Rooms</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Host live vocabulary challenges and monitor student gameplay in real-time
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary cursor-pointer shadow-sm">
          <span>New Room</span>
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.length === 0 ? (
          <div className="col-span-full surface-card p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80">
            <p className="text-sm font-semibold text-slate-800">No rooms created yet</p>
            <p className="text-xs text-slate-400 mt-1">Create a game room to generate a 6-digit PIN for your students</p>
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
                className="surface-card p-5 rounded-2xl border border-slate-200/80 hover:border-slate-300 flex flex-col justify-between gap-4 transition-colors bg-white shadow-xs text-slate-900"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    {room.status === 'waiting' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Waiting</span>
                      </span>
                    ) : room.status === 'in_progress' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>In Progress</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <span>Closed</span>
                      </span>
                    )}

                    {/* Pupil Limit Indicator */}
                    <span className="text-xs font-mono text-slate-400">
                      <span className="font-semibold text-slate-700">{pupilCount}</span> / {maxCap} pupils
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{room.name || `Room #${room.pin}`}</h3>
                  </div>

                  {/* Sleek PIN Code Box */}
                  <div
                    onClick={() => handleCopyPin(room.pin)}
                    className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 flex items-center justify-between cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-colors group"
                    title="Click to copy PIN"
                  >
                    <div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Room PIN</div>
                      <div className="text-xl font-mono font-bold text-slate-900 tracking-widest group-hover:text-emerald-600 transition-colors">
                        {room.pin}
                      </div>
                    </div>
                    <div className="text-slate-400 group-hover:text-slate-700 transition-colors">
                      {copiedPin === room.pin ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Pupil Capacity Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                      <span>Room Capacity</span>
                      <span className="font-mono text-slate-600">{capacityPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          capacityPercent >= 90
                            ? 'bg-rose-500'
                            : capacityPercent >= 60
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${capacityPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/rooms/${room.id}`)}
                    className="flex-1 inline-flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>{isClosed ? 'View Results' : 'Monitor Room'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRoom(e, room)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete room"
                    aria-label="Delete room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 rounded-2xl border border-slate-200 space-y-4 bg-white text-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-900">Create Game Room</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Room Name (e.g. Section Mango)</label>
                <input
                  type="text"
                  placeholder="e.g. Section Mango"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="minimal-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pupil Limit / Max Capacity
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
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        maxStudents === cap
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cap} Pupils
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary text-xs py-1.5 px-4 font-semibold shadow-xs">
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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="surface-card w-full max-w-sm p-5 rounded-2xl border border-slate-200 space-y-4 bg-white text-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-900">Delete Room</h3>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">Room #{deleteTarget.pin}</strong>? This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Room</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
