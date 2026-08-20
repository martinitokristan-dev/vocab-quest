import React, { useState, useEffect } from 'react';
import { api, resolveMediaUrl, type MapData } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Plus, CheckCircle2, Image as ImageIcon, Layers, Edit2, X } from 'lucide-react';

export const MapsPage: React.FC = () => {
  const { showToast } = useToast();
  const [maps, setMaps] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingMap, setEditingMap] = useState<MapData | null>(null);
  const [title, setTitle] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [bgUrl, setBgUrl] = useState('');
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishingMapId, setPublishingMapId] = useState<number | null>(null);

  const fetchMaps = async () => {
    try {
      setLoading(true);
      const res = await api.getMaps();
      setMaps(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaps();
  }, []);

  const openCreateModal = (seq = 1) => {
    setEditingMap(null);
    setTitle('');
    setOrderIndex(seq);
    setBgUrl('');
    setBgFile(null);
    setShowModal(true);
  };

  const openEditModal = (map: MapData) => {
    setEditingMap(map);
    setTitle(map.title);
    setOrderIndex(map.order_index);
    setBgUrl(map.background_url || '');
    setBgFile(null);
    setShowModal(true);
  };

  const handleSaveMap = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingMap) {
        await api.updateMap(editingMap.id, {
          title,
          order_index: orderIndex,
          background_url: bgUrl || undefined,
          background_image: bgFile,
        });
        showToast(`Map "${title}" updated successfully!`, 'success');
      } else {
        await api.createMap({
          title,
          order_index: orderIndex,
          background_url: bgUrl || undefined,
          background_image: bgFile,
        });
        showToast(`Map "${title}" created successfully!`, 'success');
      }
      setShowModal(false);
      fetchMaps();
    } catch (err: any) {
      showToast(err.message || 'Failed to save map', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishMap = async (mapId: number) => {
    setPublishingMapId(mapId);
    try {
      await api.publishMap(mapId);
      showToast('Map published and now active for students!', 'success');
      fetchMaps();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish map', 'error');
    } finally {
      setPublishingMapId(null);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-zinc-500">Loading maps...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Maps & Stages</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Manage the 3 progressive adventure kingdom stages</p>
        </div>

        <button onClick={() => openCreateModal(maps.length + 1)} className="btn-primary cursor-pointer">
          <Plus className="w-4 h-4" />
          <span>New Map</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((seq) => {
          const map = maps.find((m) => m.order_index === seq);
          const isPublished = map?.published;

          return (
            <div
              key={seq}
              className={`surface-card p-4 rounded-xl border border-white/5 flex flex-col justify-between gap-3 ${
                !map ? 'opacity-50 border-dashed' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-300 text-xs font-mono font-bold flex items-center justify-center border border-zinc-700">
                    {seq}
                  </span>
                  <span className="text-xs font-bold text-zinc-300">Stage {seq}</span>
                </div>

                {map && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      isPublished
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isPublished ? 'Published' : 'Draft'}
                  </span>
                )}
              </div>

              {map ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white truncate">{map.title}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{map.question_count || 0} Questions</span>
                    </div>
                  </div>

                  {/* Image Preview */}
                  <div className="h-28 rounded-lg bg-zinc-950 border border-white/5 overflow-hidden flex items-center justify-center">
                    {map.background_url ? (
                      <img
                        src={resolveMediaUrl(map.background_url)}
                        alt={map.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-zinc-600" />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openEditModal(map)}
                      className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5 flex-1 justify-center"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    {!isPublished ? (
                      <button
                        onClick={() => handlePublishMap(map.id)}
                        disabled={publishingMapId === map.id}
                        className="btn-primary text-xs py-1.5 px-2.5 flex-1 justify-center font-semibold"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{publishingMapId === map.id ? 'Saving...' : 'Publish'}</span>
                      </button>
                    ) : (
                      <div className="text-center py-1.5 px-2 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 rounded-lg flex-1">
                        Active
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-zinc-500">
                  <p className="text-xs">Stage {seq} Empty</p>
                  <button
                    onClick={() => openCreateModal(seq)}
                    className="btn-secondary text-xs mt-3 py-1 px-3"
                  >
                    + Add Stage
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-5 rounded-xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-sm font-bold text-white">{editingMap ? 'Edit Map' : 'Create Map'}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMap} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Map Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EPCES Elementary & Riverside"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="minimal-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Background Image URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={bgUrl}
                  onChange={(e) => setBgUrl(e.target.value)}
                  className="minimal-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5 px-4 font-bold">
                  {saving ? 'Saving...' : 'Save Map'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
