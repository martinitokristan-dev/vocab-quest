import React, { useState, useEffect, useRef } from 'react';
import {
  Crop,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  Check,
  Sliders,
  Image as ImageIcon,
  Copy,
  Info,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

type FitMode = 'cover' | 'blur' | 'color';

interface ResolutionPreset {
  label: string;
  w: number;
  h: number;
  desc: string;
}

const PRESETS: ResolutionPreset[] = [
  { label: '1280 × 720', w: 1280, h: 720, desc: '16:9 HD (Best)' },
  { label: '1920 × 1080', w: 1920, h: 1080, desc: 'Full HD 1080p' },
  { label: '1920 × 720', w: 1920, h: 720, desc: 'Ultrawide' },
  { label: '1000 × 563', w: 1000, h: 563, desc: 'Card Exact' },
];

export const ImageResizerPage: React.FC = () => {
  const { showToast } = useToast();
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(1280);
  const [targetHeight, setTargetHeight] = useState<number>(720);
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [format, setFormat] = useState<string>('image/jpeg');
  const [quality, setQuality] = useState<number>(98);
  const [hdSharpen, setHdSharpen] = useState<boolean>(true);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [fileSizeStr, setFileSizeStr] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load sample image on initial mount
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      setSourceImage(img);
    };
    img.src = 'https://res.cloudinary.com/espkpptn/image/upload/v1788950554/questions/images/clcr2gjrlirnoxpqc4sk.jpg';
  }, []);

  // Clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setZoom(1.0);
        setPanX(0);
        setPanY(0);
        showToast('Image loaded successfully!', 'success');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Re-render canvas on state change
  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const srcW = sourceImage.naturalWidth || sourceImage.width;
    const srcH = sourceImage.naturalHeight || sourceImage.height;

    if (fitMode === 'cover') {
      const scale = Math.max(targetWidth / srcW, targetHeight / srcH) * zoom;
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const drawX = (targetWidth - drawW) / 2 + panX;
      const drawY = (targetHeight - drawH) / 2 + panY;
      ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);
    } else if (fitMode === 'blur') {
      // Blurred backdrop
      ctx.save();
      ctx.filter = 'blur(28px) brightness(0.9)';
      const blurScale = Math.max(targetWidth / srcW, targetHeight / srcH) * 1.15;
      const bW = srcW * blurScale;
      const bH = srcH * blurScale;
      ctx.drawImage(sourceImage, (targetWidth - bW) / 2, (targetHeight - bH) / 2, bW, bH);
      ctx.restore();

      // Sharp centered image
      const scale = Math.min(targetWidth / srcW, targetHeight / srcH) * zoom;
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const drawX = (targetWidth - drawW) / 2 + panX;
      const drawY = (targetHeight - drawH) / 2 + panY;

      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 18;
      ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);
      ctx.shadowBlur = 0;
    } else if (fitMode === 'color') {
      // Auto-sample corner color
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(sourceImage, 0, 0, 1, 1, 0, 0, 1, 1);
        const pixel = tCtx.getImageData(0, 0, 1, 1).data;
        ctx.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      } else {
        ctx.fillStyle = '#F8FAFC';
      }
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const scale = Math.min(targetWidth / srcW, targetHeight / srcH) * zoom;
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const drawX = (targetWidth - drawW) / 2 + panX;
      const drawY = (targetHeight - drawH) / 2 + panY;
      ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);
    }

    // HD Sharpen filter
    if (hdSharpen) {
      applySharpen(ctx, targetWidth, targetHeight);
    }

    const dataUrl = canvas.toDataURL(format, quality / 100);
    setPreviewDataUrl(dataUrl);

    // Approximate size in KB
    const bytes = Math.round((dataUrl.length - 22) * 0.75);
    setFileSizeStr(`${(bytes / 1024).toFixed(1)} KB`);
  }, [sourceImage, targetWidth, targetHeight, fitMode, zoom, panX, panY, format, quality, hdSharpen]);

  const applySharpen = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const copy = new Uint8ClampedArray(d);
      const weights = [
         0,   -0.2,   0,
        -0.2,  1.8,  -0.2,
         0,   -0.2,   0
      ];

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const dst = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const src = ((y + ky) * w + (x + kx)) * 4 + c;
                const weight = weights[(ky + 1) * 3 + (kx + 1)];
                sum += copy[src] * weight;
              }
            }
            d[dst + c] = Math.min(255, Math.max(0, sum));
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Ignore cross-origin canvas security exceptions if any
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';

    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.download = `question_clue_HD_${targetWidth}x${targetHeight}.${ext}`;
          a.href = url;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          showToast('Image downloaded in HD!', 'success');
        },
        format,
        quality / 100
      );
    }
  };

  const handleCopy = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        showToast('Copied to clipboard!', 'success');
      }, 'image/png');
    } catch {
      showToast('Copy not supported by browser. Use download button.', 'info');
    }
  };

  const handleReset = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Crop className="w-5 h-5 text-emerald-600" />
            <span>Question Image Resizer</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Format, crop, and enhance images to <strong>16:9 widescreen landscape</strong> so they fill the question card cleanly without empty side bars.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Copy to clipboard"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy</span>
          </button>
          <button
            onClick={handleDownload}
            className="btn-primary py-2 px-4 text-xs flex items-center gap-2 cursor-pointer shadow-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Download HD Image</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Controls & Canvas */}
        <div className="space-y-5">
          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="p-6 bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 text-center cursor-pointer transition-colors shadow-xs group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center text-slate-500 group-hover:text-emerald-700 transition-colors mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-800">
              Click to choose image or drag & drop here
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports JPG, PNG, WebP • Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[10px]">Ctrl + V</kbd> to paste
            </p>
          </div>

          {/* Interactive Canvas */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                <span>Interactive Crop & Position</span>
              </span>
              <button
                onClick={handleReset}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset View</span>
              </button>
            </div>

            <div
              className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                setPanX(e.clientX - dragStart.x);
                setPanY(e.clientY - dragStart.y);
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain block"
              />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/75 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-full pointer-events-none">
                ✋ Drag to position | Zoom slider below
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-semibold text-slate-600 min-w-10">Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.02"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <span className="text-xs font-mono font-bold text-emerald-700 min-w-10 text-right">
                {zoom.toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Sizing & Options Panel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
            {/* Fit Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Fitting Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFitMode('cover')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center border ${
                    fitMode === 'cover'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Fill / Crop (16:9)
                </button>
                <button
                  type="button"
                  onClick={() => setFitMode('blur')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center border ${
                    fitMode === 'blur'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Blurred Backdrop
                </button>
                <button
                  type="button"
                  onClick={() => setFitMode('color')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center border ${
                    fitMode === 'color'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Extended Color
                </button>
              </div>
            </div>

            {/* Target Resolution */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Output Resolution
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((p) => {
                  const isSelected = targetWidth === p.w && targetHeight === p.h;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setTargetWidth(p.w);
                        setTargetHeight(p.h);
                      }}
                      className={`p-2 rounded-lg text-center border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{p.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* HD Enhancer Checkbox */}
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>HD Edge Clarifier (Unsharp Mask AI Filter)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Automatically sharpens lines and fine details when upscaling small photos
                </p>
              </div>
              <input
                type="checkbox"
                checked={hdSharpen}
                onChange={(e) => setHdSharpen(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0 ml-3"
              />
            </div>

            {/* Export Format & Quality */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="minimal-input text-xs py-2"
                >
                  <option value="image/jpeg">JPG (Ultra HD)</option>
                  <option value="image/png">PNG (Lossless HD)</option>
                  <option value="image/webp">WebP (HD)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Quality</label>
                  <span className="text-xs font-mono font-bold text-emerald-700">{quality}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg mt-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live In-Game Simulation */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Student Question Screen Mockup</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Exact Game Layout
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Shows <em>exactly</em> how your clue image will render inside the student's question card during gameplay.
            </p>

            {/* Simulated Game Card (Vocab Quest Blue sky container) */}
            <div className="bg-[#0284C7] p-4 sm:p-6 rounded-2xl shadow-inner">
              <div className="bg-white rounded-2xl p-4 sm:p-5 max-w-md mx-auto shadow-md">
                {/* Visual Clue Card */}
                <div className="w-full max-w-[420px] h-[210px] bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-xl overflow-hidden flex items-center justify-center mx-auto mb-3 p-1">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="Question Clue"
                      className="max-h-full max-w-full object-contain rounded-lg block"
                    />
                  ) : (
                    <div className="text-xs text-slate-400">Loading preview…</div>
                  )}
                </div>

                {/* Sentence Box */}
                <div className="bg-[#F8FAFC] border-[1.5px] border-[#E2E8F0] rounded-xl p-2.5 text-center text-xs font-bold text-slate-800 mb-3">
                  "The children had a <span className="bg-[#FEF08A] text-[#854D0E] px-1.5 py-0.5 rounded">race</span> during sports festival."
                </div>

                {/* Choices Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-2 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-[10px] shrink-0">A</span>
                    <span className="truncate">A running contest</span>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-2 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-[10px] shrink-0">B</span>
                    <span className="truncate">Waiting in line</span>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-2 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-[10px] shrink-0">C</span>
                    <span className="truncate">Playing games</span>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-2 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-[10px] shrink-0">D</span>
                    <span className="truncate">Standing still</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Output Info */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-2.5 text-xs text-slate-600">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Output Specifications</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dimensions</span>
                <span className="font-bold text-slate-800">{targetWidth} × {targetHeight} px</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Aspect Ratio</span>
                <span className="font-bold text-emerald-700">16:9 Landscape</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Format</span>
                <span className="font-bold text-slate-800">{format.replace('image/', '').toUpperCase()} ({quality}%)</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. Size</span>
                <span className="font-bold text-slate-800">{fileSizeStr || 'Calculating…'}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleDownload}
                className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download & Save Image</span>
              </button>
            </div>
          </div>

          {/* Quick Tip Card */}
          <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-900">Next Step:</strong> After clicking Download, switch back to the <strong>Questions</strong> tab on the sidebar, edit your question, and select the downloaded file to upload!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
