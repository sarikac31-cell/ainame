import React, { useEffect, useRef, useState } from 'react';
import { Crop, Loader2, Trash2, Upload, X } from 'lucide-react';
import { uploadFileWithProgress } from '../../lib/firebase';
import { validateBrandingFile } from '../../utils/customization';

interface ImageCropUploadFieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: number; // e.g., 1 for square icons, 16/9 for covers, undefined for free aspect
  maxOutputWidth?: number;
  maxOutputHeight?: number;
  storageKeyPrefix: string;
}

export const ImageCropUploadField: React.FC<ImageCropUploadFieldProps> = ({
  label,
  hint,
  value,
  onChange,
  aspectRatio,
  maxOutputWidth = 1024,
  maxOutputHeight = 512,
  storageKeyPrefix,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Cropper modal state for PNG / WebP
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropImg, setCropImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [sourceFileName, setSourceFileName] = useState('asset.png');

  useEffect(() => {
    if (!cropImg || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const targetAspect = aspectRatio ?? Math.max(0.4, Math.min(4, cropImg.width / cropImg.height));
    const width = 360;
    const height = Math.round(width / targetAspect);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const coverScale = Math.max(width / cropImg.width, height / cropImg.height);
    const drawScale = coverScale * zoom;
    const drawW = cropImg.width * drawScale;
    const drawH = cropImg.height * drawScale;
    const cx = (width - drawW) / 2 + offsetX * 1.4;
    const cy = (height - drawH) / 2 + offsetY * 1.4;
    ctx.drawImage(cropImg, cx, cy, drawW, drawH);
  }, [cropImg, zoom, offsetX, offsetY, aspectRatio]);

  useEffect(() => {
    return () => {
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
    };
  }, [cropSourceUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateBrandingFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file.');
      return;
    }
    setError('');
    setSourceFileName(file.name);

    // SVG files upload directly without rasterizing
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      setUploading(true);
      setProgress(0);
      try {
        const url = await uploadFileWithProgress(
          `banners/branding/${storageKeyPrefix}-${Date.now()}.svg`,
          file,
          setProgress
        );
        onChange(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
      return;
    }

    // PNG / WebP open interactive crop & resize dialog
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setCropSourceUrl(objectUrl);
      setCropImg(img);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Could not decode image.');
    };
    img.src = objectUrl;
  };

  const handleApplyCropAndUpload = async () => {
    if (!cropImg) return;
    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const targetAspect = aspectRatio ?? Math.max(0.4, Math.min(4, cropImg.width / cropImg.height));
      let outW = Math.min(maxOutputWidth, cropImg.width);
      let outH = Math.round(outW / targetAspect);
      if (outH > maxOutputHeight) {
        outH = maxOutputHeight;
        outW = Math.round(outH * targetAspect);
      }
      outW = Math.max(64, outW);
      outH = Math.max(64, outH);

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable.');

      const coverScale = Math.max(outW / cropImg.width, outH / cropImg.height);
      const drawScale = coverScale * zoom;
      const drawW = cropImg.width * drawScale;
      const drawH = cropImg.height * drawScale;
      const ratioToPreview = outW / 360;
      const cx = (outW - drawW) / 2 + offsetX * 1.4 * ratioToPreview;
      const cy = (outH - drawH) / 2 + offsetY * 1.4 * ratioToPreview;
      ctx.drawImage(cropImg, cx, cy, drawW, drawH);

      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob((b) => resolve(b), 'image/png', 0.92)
      );
      if (!blob) throw new Error('Failed to encode PNG.');
      const cleanName = sourceFileName.replace(/\.[^.]+$/, '') || storageKeyPrefix;
      const uploadFile = new File([blob], `${cleanName}.png`, { type: 'image/png' });

      const url = await uploadFileWithProgress(
        `banners/branding/${storageKeyPrefix}-${Date.now()}.png`,
        uploadFile,
        setProgress
      );
      onChange(url);
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
      setCropSourceUrl(null);
      setCropImg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">{label}</p>
          {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
        </div>
        <span className="text-[10px] font-mono text-zinc-400">PNG · SVG · WebP ≤ 2MB</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900/90 p-1.5 dark:border-zinc-700">
          {value ? (
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-zinc-500">No asset</span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 min-w-[180px]">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://... or upload image"
            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.svg,.webp,image/png,image/svg+xml,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? `Uploading ${progress}%` : 'Upload & Crop'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-500 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-rose-500">{error}</p>}

      {/* Crop & Resize Modal */}
      {cropImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Crop className="h-4 w-4 text-[var(--kv-accent,#e50914)]" />
                <span>Crop &amp; Resize — {label}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
                  setCropSourceUrl(null);
                  setCropImg(null);
                }}
                className="rounded p-1 text-zinc-400 hover:text-white"
                aria-label="Close cropper"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-[repeating-conic-gradient(#1c1c24_0%_25%,#121218_0%_50%)] bg-[length:16px_16px] p-3">
              <canvas
                ref={previewCanvasRef}
                className="max-h-60 max-w-full rounded border border-zinc-700"
              />
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-center justify-between gap-3">
                <span className="w-20 text-zinc-400">Zoom ({zoom.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-[var(--kv-accent,#e50914)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="w-20 text-zinc-400">Pan X</span>
                <input
                  type="range"
                  min="-120"
                  max="120"
                  step="2"
                  value={offsetX}
                  onChange={(e) => setOffsetX(Number(e.target.value))}
                  className="flex-1 accent-[var(--kv-accent,#e50914)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="w-20 text-zinc-400">Pan Y</span>
                <input
                  type="range"
                  min="-120"
                  max="120"
                  step="2"
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                  className="flex-1 accent-[var(--kv-accent,#e50914)]"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
                  setCropSourceUrl(null);
                  setCropImg(null);
                }}
                className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCropAndUpload}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? `Uploading ${progress}%` : 'Apply & Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
