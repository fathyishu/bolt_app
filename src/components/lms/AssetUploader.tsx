import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, Music, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LmsAssetType } from '../../lib/supabase';

interface AssetUploaderProps {
  assetType: LmsAssetType;
  assetUrl: string | null;
  storagePath: string | null;
  onUploaded: (url: string, path: string, type: LmsAssetType) => void;
  onClear: () => void;
}

const ACCEPT: Record<Exclude<LmsAssetType, null>, string> = {
  pdf: 'application/pdf',
  mp3: 'audio/mpeg,audio/mp3',
  image: 'image/*',
};

const ICON: Record<Exclude<LmsAssetType, null>, React.ReactNode> = {
  pdf: <FileText className="w-4 h-4" />,
  mp3: <Music className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
};

function detectType(file: File): Exclude<LmsAssetType, null> | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('audio/')) return 'mp3';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

export default function AssetUploader({ assetType, assetUrl, storagePath, onUploaded, onClear }: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const type = detectType(file);
    if (!type) {
      setError('Unsupported file. Upload a PDF, MP3, or image.');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${type}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('lms-assets')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('lms-assets').getPublicUrl(path);
      onUploaded(pub.publicUrl, path, type);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const effectiveType = assetType ?? 'pdf';

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[effectiveType] ?? undefined}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }}
      />
      {assetUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-emerald-400">{ICON[assetType ?? 'pdf']}</div>
          <div className="flex-1 min-w-0">
            <div className="text-emerald-400 text-xs font-medium">Asset attached</div>
            <a href={assetUrl} target="_blank" rel="noopener noreferrer" className="text-white/40 text-xs truncate block hover:text-white/60">
              {storagePath ?? assetUrl}
            </a>
          </div>
          <button type="button" onClick={onClear} className="p-1 rounded text-white/30 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all ${dragOver ? 'border-gold-500/60 bg-gold-500/5' : 'border-white/10 hover:border-white/20'}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-white/50">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/50">
              <UploadCloud className="w-6 h-6" />
              <div className="text-xs">
                <span className="text-gold-500 font-medium">Click to upload</span> or drag & drop
              </div>
              <div className="text-white/30 text-[11px]">PDF · MP3 · Image</div>
            </div>
          )}
        </div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
