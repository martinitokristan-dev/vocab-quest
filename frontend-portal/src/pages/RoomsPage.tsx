import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type RoomData } from '../services/api';
import { Users, Plus, Play, BarChart2 } from 'lucide-react';

export const RoomsPage: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);

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
    try {
      setCreating(true);
      await api.createRoom(roomName || undefined);
      setShowModal(false);
      setRoomName('');
      fetchRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 p-8 text-center">Loading game rooms...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white font-heading">Classroom Game Rooms</h2>
          <p className="text-sm text-slate-400 mt-1">
            Generate 6-digit PIN rooms, host live game sessions, and view student analytics
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          <span>New Game Room</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">No Active or Past Rooms</p>
            <p className="text-xs text-slate-500 mt-1">Create a room to generate a 6-digit PIN for your students</p>
          </div>
        ) : (
          rooms.map((room) => {
            const isClosed = room.status === 'closed';

            return (
              <div
                key={room.id}
                className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`badge ${
                      room.status === 'waiting'
                        ? 'badge-pending'
                        : room.status === 'in_progress'
                        ? 'badge-published'
                        : 'badge-rejected'
                    }`}>
                      {room.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(room.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{room.name}</h3>

                  {/* Big PIN Display */}
                  <div className="my-4 p-4 rounded-xl bg-slate-950/80 border border-white/10 text-center">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Room PIN</p>
                    <p className="text-3xl font-extrabold text-emerald-400 font-mono tracking-wider">
                      {room.pin}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => navigate(`/rooms/${room.id}`)}
                    className="w-full btn-secondary justify-center text-xs py-2.5"
                  >
                    {isClosed ? (
                      <>
                        <BarChart2 className="w-4 h-4 text-cyan-400" />
                        <span>View Class Analytics</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 text-emerald-400" />
                        <span>Open Live Control Lobby</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 animate-fade-in">
            <h3 className="text-xl font-bold text-white font-heading mb-4">Create Game Room</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Room Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Enter room name (e.g. Grade 5 - Section Alpha)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="glass-input"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Defaults to "Room #XXXXXX" if left blank
                </p>
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
                  disabled={creating}
                  className="btn-primary text-xs"
                >
                  {creating ? 'Creating...' : 'Generate PIN & Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
