import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LmsCheckpoint, LmsCheckpointAnswer } from '../../lib/supabase';

interface LessonVideoProps {
  videoUrl: string;            // external embed (YouTube/Vimeo/Google Drive) OR storage public url
  storagePath: string | null;  // uploaded file path in lms-assets
  durationSec: number;
  unskippable: boolean;
  checkpoints: LmsCheckpoint[];
  userId: string;
  onPositionUpdate: (sec: number) => void;
  onFullyWatched: () => void;
}

// Convert common external URLs to embeddable form
function toEmbedUrl(url: string): { embed: string; isExternal: boolean } {
  if (!url) return { embed: '', isExternal: false };
  try {
    const u = new URL(url);
    // YouTube watch -> embed
    if (u.hostname.includes('youtube.com') && u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      if (v) return { embed: `https://www.youtube.com/embed/${v}`, isExternal: true };
    }
    if (u.hostname === 'youtu.be') {
      const v = u.pathname.slice(1);
      if (v) return { embed: `https://www.youtube.com/embed/${v}`, isExternal: true };
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const v = u.pathname.replace('/', '');
      if (v) return { embed: `https://player.vimeo.com/video/${v}`, isExternal: true };
    }
    // Google Drive file view -> preview
    if (u.hostname.includes('drive.google.com')) {
      const m = url.match(/\/file\/d\/([^/]+)/);
      if (m) return { embed: `https://drive.google.com/file/d/${m[1]}/preview`, isExternal: true };
    }
  } catch {}
  return { embed: url, isExternal: !!url };
}

export default function LessonVideo({
  videoUrl, storagePath, durationSec, unskippable,
  checkpoints, userId, onPositionUpdate, onFullyWatched,
}: LessonVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExternal, setIsExternal] = useState(false);
  const [embedSrc, setEmbedSrc] = useState('');
  const [storageSrc, setStorageSrc] = useState('');
  const [paused, setPaused] = useState(true);
  const [maxAllowed, setMaxAllowed] = useState(0); // for unskippable: furthest watched second
  const [activeCheckpoint, setActiveCheckpoint] = useState<LmsCheckpoint | null>(null);
  const [answeredCheckpoints, setAnsweredCheckpoints] = useState<Set<string>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Resolve source: storage upload takes precedence over external embed
  useEffect(() => {
    if (storagePath) {
      const { data } = supabase.storage.from('lms-assets').getPublicUrl(storagePath);
      setStorageSrc(data.publicUrl);
      setEmbedSrc('');
      setIsExternal(false);
    } else if (videoUrl) {
      const { embed, isExternal } = toEmbedUrl(videoUrl);
      setEmbedSrc(embed);
      setStorageSrc('');
      setIsExternal(isExternal);
    } else {
      setEmbedSrc(''); setStorageSrc(''); setIsExternal(false);
    }
  }, [storagePath, videoUrl]);

  // Time tracking + checkpoint triggers (native video only — external iframes cannot be controlled)
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const cur = Math.floor(v.currentTime);
    onPositionUpdate(cur);
    if (unskippable && cur > maxAllowed) setMaxAllowed(cur);

    // checkpoint trigger
    for (const cp of checkpoints) {
      if (answeredCheckpoints.has(cp.id)) continue;
      if (cur >= cp.timestamp_sec && cur < cp.timestamp_sec + 2) {
        v.pause();
        setPaused(true);
        setActiveCheckpoint(cp);
        setSelectedIdx(null);
        setAnswerFeedback(null);
        break;
      }
    }

    if (unskippable && durationSec > 0 && cur >= durationSec - 1) {
      onFullyWatched();
    } else if (!unskippable && durationSec > 0 && cur >= durationSec - 1) {
      onFullyWatched();
    }
  }, [checkpoints, answeredCheckpoints, maxAllowed, unskippable, durationSec, onPositionUpdate, onFullyWatched]);

  // Block seeking past maxAllowed when unskippable
  const onSeeking = useCallback(() => {
    const v = videoRef.current;
    if (!v || !unskippable) return;
    if (v.currentTime > maxAllowed + 2) {
      v.currentTime = maxAllowed;
    }
  }, [maxAllowed, unskippable]);

  async function submitCheckpoint() {
    if (!activeCheckpoint || selectedIdx === null) return;
    const correct = selectedIdx === activeCheckpoint.correct_option_index;
    setAnswerFeedback(correct ? 'correct' : 'wrong');
    if (correct) {
      const payload: Omit<LmsCheckpointAnswer, 'id' | 'answered_at'> = {
        checkpoint_id: activeCheckpoint.id,
        user_id: userId,
        selected_index: selectedIdx,
        is_correct: true,
      };
      await supabase.from('lms_checkpoint_answers').insert(payload);
      setAnsweredCheckpoints(prev => new Set(prev).add(activeCheckpoint.id));
      setTimeout(() => {
        setActiveCheckpoint(null);
        setSelectedIdx(null);
        setAnswerFeedback(null);
        videoRef.current?.play();
        setPaused(false);
      }, 900);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); }
    else { v.pause(); setPaused(true); }
  }

  const hasVideo = !!storageSrc || !!embedSrc;

  return (
    <div className="relative">
      {hasVideo ? (
        isExternal ? (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
            <iframe
              src={embedSrc}
              title="Lesson video"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {unskippable && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-amber-400 text-xs">
                <Lock className="w-3 h-3" /> Unskippable
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
            <video
              ref={videoRef}
              src={storageSrc}
              className="w-full h-full"
              controls={!unskippable}
              onTimeUpdate={onTimeUpdate}
              onSeeking={onSeeking}
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
            />
            {unskippable && paused && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                <Play className="w-14 h-14 text-white/90" />
              </button>
            )}
            {unskippable && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-amber-400 text-xs">
                <Lock className="w-3 h-3" /> Unskippable
              </div>
            )}
          </div>
        )
      ) : (
        <div className="w-full aspect-video rounded-xl bg-surface-50/30 border border-white/10 flex items-center justify-center text-white/30 text-sm">
          No video attached to this lesson.
        </div>
      )}

      {/* In-video knowledge checkpoint popup */}
      {activeCheckpoint && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4">
          <div className="glass-card gold-border w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-3 text-gold-500 text-xs font-semibold uppercase tracking-wider">
              <Pause className="w-4 h-4" /> Knowledge Checkpoint
            </div>
            <div className="text-white font-semibold mb-4">{activeCheckpoint.question}</div>
            <div className="space-y-2">
              {(activeCheckpoint.options ?? []).map((opt: string, i: number) => {
                const isSel = selectedIdx === i;
                const showCorrect = answerFeedback !== null && i === activeCheckpoint.correct_option_index;
                const showWrong = answerFeedback === 'wrong' && isSel;
                return (
                  <button
                    key={i}
                    onClick={() => answerFeedback === null && setSelectedIdx(i)}
                    disabled={answerFeedback !== null}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                      showCorrect ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : showWrong ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : isSel ? 'border-gold-500/50 bg-gold-500/10 text-gold-300'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span>{opt}</span>
                      {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {showWrong && <XCircle className="w-4 h-4 text-red-400" />}
                    </span>
                  </button>
                );
              })}
            </div>
            {answerFeedback === 'wrong' && (
              <div className="mt-3 text-xs text-red-400">Incorrect. Try again to continue.</div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={submitCheckpoint}
                disabled={selectedIdx === null || answerFeedback === 'correct'}
                className="btn-gold px-4 py-2 text-sm disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
