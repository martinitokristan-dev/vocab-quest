import React, { useState, useEffect } from 'react';
import { api, type MapData } from '../services/api';
import { Map as MapIcon, Plus, CheckCircle2, AlertTriangle, Image as ImageIcon, UserCheck, Layers, Edit2 } from 'lucide-react';

export const MapsPage: React.FC = () => {
  const [maps, setMaps] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit Map Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMap, setEditingMap] = useState<MapData | null>(null);
  const [title, setTitle] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [bgUrl, setBgUrl] = useState('');
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Publish Diagnostic Modal State
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null);
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

  const openCreateModal = (seqOrder = 1) => {
    setEditingMap(null);
    setTitle('');
    setOrderIndex(seqOrder);
    setBgUrl('');
    setBgFile(null);
    setShowCreateModal(true);
  };

  const openEditModal = (map: MapData) => {
    setEditingMap(map);
    setTitle(map.title);
    setOrderIndex(map.order_index);
    setBgUrl(map.background_url || '');
    setBgFile(null);
    setShowCreateModal(true);
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
      } else {
        await api.createMap({
          title,
          order_index: orderIndex,
          background_url: bgUrl || undefined,
          background_image: bgFile,
        });
      }
      setShowCreateModal(false);
      setEditingMap(null);
      setTitle('');
      setBgUrl('');
      setBgFile(null);
      fetchMaps();
    } catch (err: any) {
      alert(err.message || 'Failed to save map');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishMap = async (mapId: number) => {
    setPublishErrors(null);
    setPublishingMapId(mapId);
    try {
      await api.publishMap(mapId);
      fetchMaps();
    } catch (err: any) {
      if (err.data && err.data.errors) {
        const errorList = Object.values(err.data.errors).flat() as string[];
        setPublishErrors(errorList);
      } else {
        setPublishErrors([err.message || 'Failed to publish map']);
      }
    } finally {
      setPublishingMapId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading map sequences...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white font-heading">Map Sequence Builder</h2>
          <p className="text-sm text-slate-400 mt-1">
            Build and customize 3 progressive difficulty maps (Map 1 → Map 2 → Map 3)
          </p>
        </div>
        <button
          onClick={() => openCreateModal(1)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          <span>New Map</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Map Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((seqOrder) => {
          const map = maps.find((m) => m.order_index === seqOrder);
          const isPublished = map?.published;

          return (
            <div
              key={seqOrder}
              className={`glass-panel p-6 flex flex-col justify-between relative overflow-hidden group ${
                map ? 'border-white/10' : 'border-dashed border-white/10 opacity-70'
              }`}
            >
              {/* Top Order & Status Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                    {seqOrder}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Map {seqOrder} in Sequence
                  </span>
                </div>

                {map && (
                  <span className={`badge ${isPublished ? 'badge-published' : 'badge-draft'}`}>
                    {isPublished ? 'Published' : 'Draft'}
                  </span>
                )}
              </div>

              {map ? (
                <div className="space-y-4 my-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                      {map.title}
                    </h3>
                    <button
                      onClick={() => openEditModal(map)}
                      title="Edit Map Title & Background Image"
                      className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Background Preview */}
                  <div className="h-32 rounded-xl bg-slate-950/80 border border-white/10 relative overflow-hidden flex items-center justify-center">
                    {map.background_url ? (
                      <img
                        src={map.background_url}
                        alt={map.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-500 text-xs gap-1">
                        <ImageIcon className="w-6 h-6" />
                        <span>No background image set</span>
                      </div>
                    )}
                  </div>

                  {/* Stats & Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-white/5 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>{map.question_count} Questions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-cyan-400" />
                      <span>{map.character ? map.character.name : 'No Character'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(map)}
                      className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Map</span>
                    </button>

                    {!isPublished ? (
                      <button
                        onClick={() => handlePublishMap(map.id)}
                        disabled={publishingMapId === map.id}
                        className="flex-1 btn-primary justify-center text-xs py-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{publishingMapId === map.id ? 'Validating...' : 'Publish Map'}</span>
                      </button>
                    ) : (
                      <div className="flex-1 text-center py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        Ready for Gameplay
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <MapIcon className="w-10 h-10 text-slate-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-300">Map {seqOrder} Slot Empty</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Create Map {seqOrder} to continue sequence</p>
                  <button
                    onClick={() => openCreateModal(seqOrder)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Map {seqOrder}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit Map Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-white/10 animate-fade-in">
            <h3 className="text-xl font-bold text-white font-heading mb-4">
              {editingMap ? `Edit Map ${editingMap.order_index}: ${editingMap.title}` : 'Create New Map'}
            </h3>
            <form onSubmit={handleSaveMap} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Map Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter map title (e.g. EPCES Adventure Entrance)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Sequence Position
                </label>
                <select
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="glass-input bg-zinc-900"
                >
                  <option value={1}>Map 1 (3 Questions)</option>
                  <option value={2}>Map 2 (5 Questions)</option>
                  <option value={3}>Map 3 (5 Questions)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Background Image
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBgFile(e.target.files?.[0] || null)}
                    className="glass-input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 text-xs text-slate-400 cursor-pointer w-full"
                  />
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>or paste Image URL:</span>
                  </div>
                  <input
                    type="url"
                    placeholder="https://example.com/map-bg.jpg"
                    value={bgUrl}
                    onChange={(e) => setBgUrl(e.target.value)}
                    className="glass-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs"
                >
                  {saving ? (editingMap ? 'Saving...' : 'Creating...') : (editingMap ? 'Save Changes' : 'Create Map')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Diagnostics Modal */}
      {publishErrors && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-rose-500/30 animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              <h3 className="text-lg font-bold font-heading text-white">Publish Diagnostic Checklist</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Map cannot be published yet. Please resolve the following requirements:
            </p>
            <ul className="space-y-2 mb-6">
              {publishErrors.map((err, idx) => (
                <li
                  key={idx}
                  className="text-xs text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 flex items-start gap-2"
                >
                  <span className="font-bold">•</span>
                  <span>{err}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => setPublishErrors(null)}
                className="btn-secondary text-xs"
              >
                Close & Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
