import React, { useState, useEffect } from 'react';
import { api, type MapData } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Layers, X, Compass } from 'lucide-react';

const STAGE_DIFFICULTIES: Record<number, { label: string; color: string; border: string; bg: string }> = {
  1: { label: 'Easy Level', color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  2: { label: 'Medium Level', color: 'text-sky-700', border: 'border-sky-200', bg: 'bg-sky-50' },
  3: { label: 'Difficult Level', color: 'text-amber-800', border: 'border-amber-200', bg: 'bg-amber-50' },
};

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

  const silentRefreshMaps = async () => {
    try {
      const res = await api.getMaps();
      setMaps(res.data);
    } catch (err: any) {
      console.error('Failed to silently refresh maps:', err);
    }
  };

  useEffect(() => {
    fetchMaps();
  }, []);

  const openCreateModal = (seq = 1) => {
    setEditingMap(null);
    setTitle('');
    setOrderIndex(seq);
    setShowModal(true);
  };

  const openEditModal = (map: MapData) => {
    setEditingMap(map);
    setTitle(map.title);
    setOrderIndex(map.order_index);
    setShowModal(true);
  };

  const handleSaveMap = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingMap) {
        await api.updateMap(editingMap.id, { title, order_index: orderIndex });
        showToast('Stage title updated successfully!', 'success');
      } else {
        await api.createMap({ title, order_index: orderIndex });
        showToast('New stage created successfully!', 'success');
      }
      setShowModal(false);
      // Silent background refresh to get updated data
      silentRefreshMaps();
    } catch (err: any) {
      showToast(err.message || 'Failed to save stage', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishMap = async (mapId: number) => {
    setPublishingMapId(mapId);
    try {
      await api.publishMap(mapId);
      showToast('Stage published and active in the World Map!', 'success');
      // Optimistic update: update published status in state
      setMaps((prev) =>
        prev.map((m) => (m.id === mapId ? { ...m, published: true } : m))
      );
      // Silent background refresh to get updated data
      silentRefreshMaps();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish stage', 'error');
    } finally {
      setPublishingMapId(null);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading map stages...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Maps & Stages</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage the 3 progressive adventure kingdom stages on the unified World Map
          </p>
        </div>

        <button onClick={() => openCreateModal(maps.length + 1)} className="btn-primary cursor-pointer shadow-sm">
          <span>New Stage</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((seq) => {
          const map = maps.find((m) => m.order_index === seq);
          const isPublished = map?.published;
          const diff = STAGE_DIFFICULTIES[seq] || STAGE_DIFFICULTIES[1];

          return (
            <div
              key={seq}
              className={`surface-card p-5 rounded-2xl border border-slate-200 flex flex-col justify-between gap-4 transition-all hover:border-slate-300 hover:shadow-md bg-white shadow-xs ${
                !map ? 'opacity-60 border-dashed bg-slate-50/50' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono font-bold flex items-center justify-center border border-slate-200">
                    {seq}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${diff.bg} ${diff.color} ${diff.border}`}>
                    {diff.label}
                  </span>
                </div>

                {map && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isPublished
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isPublished ? 'Published' : 'Draft'}
                  </span>
                )}
              </div>

              {map ? (
                <div className="space-y-3.5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">{map.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                      <div className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{map.question_count || 0} Questions</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                        <Compass className="w-3.5 h-3.5" />
                        <span>World Map Zone {seq}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openEditModal(map)}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 flex-1 justify-center shadow-xs"
                    >
                      <span>Edit Title</span>
                    </button>

                    {!isPublished ? (
                      <button
                        onClick={() => handlePublishMap(map.id)}
                        disabled={publishingMapId === map.id}
                        className="btn-primary text-xs py-1.5 px-3 flex-1 justify-center font-semibold shadow-xs"
                      >
                        <span>{publishingMapId === map.id ? 'Saving...' : 'Publish'}</span>
                      </button>
                    ) : (
                      <div className="text-center py-1.5 px-2.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded-lg flex-1 border border-emerald-200">
                        Active
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-xs font-medium">Stage {seq} Not Configured</p>
                  <button
                    onClick={() => openCreateModal(seq)}
                    className="btn-secondary text-xs mt-3 py-1 px-3 shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-5 rounded-2xl border border-slate-200 space-y-4 bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">{editingMap ? 'Edit Stage' : 'Create Stage'}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMap} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stage Title *</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stage Sequence / Level</label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="minimal-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5 px-4 font-bold shadow-xs">
                  {saving ? 'Saving...' : 'Save Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
