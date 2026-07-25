import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, Plus, ChevronRight, ChevronDown, PlayCircle, FileText,
  Music, Image as ImageIcon, Lock, Award, BarChart3, Clock, CheckCircle2,
  Layers, BookOpen, Video, PencilLine, Trash2, Save, Sparkles, Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type {
  LmsCategory, LmsCourse, LmsModule, LmsLesson, LmsCheckpoint, LmsFlashcard,
  LmsLessonProgress, LmsUserBadge, LmsContentKind,
  Profile,
} from '../lib/supabase';
import { useOnboarding } from '../hooks/useOnboarding';
import LessonVideo from '../components/lms/LessonVideo';
import AssetUploader from '../components/lms/AssetUploader';
import FlashcardDeck from '../components/lms/FlashcardDeck';

type View = 'portal' | 'course' | 'lesson' | 'builder' | 'analytics';

export default function TrainingPage() {
  const { profile } = useAuth();
  const onboarding = useOnboarding(profile);
  const isPrivileged = ['admin', 'hr', 'manager'].includes(profile?.role ?? '');

  const [view, setView] = useState<View>('portal');
  const [categories, setCategories] = useState<LmsCategory[]>([]);
  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [analyticsUserId, setAnalyticsUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPortal = useCallback(async () => {
    const [{ data: cats }, { data: crs }] = await Promise.all([
      supabase.from('lms_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('lms_courses').select('*').order('sort_order', { ascending: true }),
    ]);
    setCategories((cats as LmsCategory[]) ?? []);
    setCourses((crs as LmsCourse[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPortal(); }, [loadPortal]);

  // ── Portal ──────────────────────────────────────────────────────────────
  if (view === 'portal') {
    return (
      <PortalView
        categories={categories}
        courses={courses}
        loading={loading}
        isPrivileged={isPrivileged}
        onboarding={onboarding}
        onOpenCourse={(cid) => { setActiveCourseId(cid); setView('course'); }}
        onNewCourse={() => { setEditingCourseId(null); setView('builder'); }}
        onEditCourse={(cid) => { setEditingCourseId(cid); setView('builder'); }}
        onOpenAnalytics={() => { setAnalyticsUserId(null); setView('analytics'); }}
      />
    );
  }

  if (view === 'course' && activeCourseId) {
    return (
      <CourseView
        courseId={activeCourseId}
        userId={profile!.id}
        onBack={() => setView('portal')}
        onOpenLesson={(lid) => { setActiveLessonId(lid); setView('lesson'); }}
        onEditCourse={(cid) => { setEditingCourseId(cid); setView('builder'); }}
        isPrivileged={isPrivileged}
      />
    );
  }

  if (view === 'lesson' && activeLessonId) {
    return (
      <LessonView
        lessonId={activeLessonId}
        userId={profile!.id}
        onBack={() => setView('course')}
        onCompleted={onboarding.refresh}
      />
    );
  }

  if (view === 'builder' && isPrivileged) {
    return (
      <CourseBuilder
        courseId={editingCourseId}
        categories={categories}
        onSaved={() => { loadPortal(); setView('portal'); }}
        onBack={() => setView('portal')}
      />
    );
  }

  if (view === 'analytics' && isPrivileged) {
    return (
      <AnalyticsPanel
        initialUserId={analyticsUserId}
        onBack={() => setView('portal')}
      />
    );
  }

  return null;
}

// ── Portal View ──────────────────────────────────────────────────────────────
function PortalView({
  categories, courses, loading, isPrivileged, onboarding,
  onOpenCourse, onNewCourse, onEditCourse, onOpenAnalytics,
}: {
  categories: LmsCategory[];
  courses: LmsCourse[];
  loading: boolean;
  isPrivileged: boolean;
  onboarding: ReturnType<typeof useOnboarding>;
  onOpenCourse: (id: string) => void;
  onNewCourse: () => void;
  onEditCourse: (id: string) => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-gold-500" /> Training Portal
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {onboarding.isUnlocked
              ? 'Complete courses to earn badges and climb the leaderboard.'
              : 'Complete your onboarding training to unlock the rest of the app.'}
          </p>
        </div>
        {isPrivileged && (
          <div className="flex gap-2">
            <button onClick={onOpenAnalytics} className="btn-outline-gold flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4" /> Analytics
            </button>
            <button onClick={onNewCourse} className="btn-gold flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> New Course
            </button>
          </div>
        )}
      </div>

      {/* Onboarding progress banner for locked users */}
      {!onboarding.isUnlocked && !onboarding.loading && (
        <div className="glass-card p-5 border border-gold-500/20">
          <div className="flex items-center gap-2 text-gold-500 font-semibold text-sm mb-3">
            <Lock className="w-4 h-4" /> Onboarding Progress
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Training Days</div>
              <div className="text-white font-medium">
                {onboarding.daysCompleted} / {onboarding.requiredDays || 0} days
              </div>
              <div className="h-2 bg-surface-50 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-gold-500 rounded-full transition-all"
                  style={{ width: `${onboarding.requiredDays ? Math.min(100, (onboarding.daysCompleted / onboarding.requiredDays) * 100) : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Required Courses</div>
              <div className="text-white font-medium">
                {onboarding.coursesCompleted} / {onboarding.requiredCourseIds.length} courses
              </div>
              <div className="h-2 bg-surface-50 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${onboarding.requiredCourseIds.length ? Math.min(100, (onboarding.coursesCompleted / onboarding.requiredCourseIds.length) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => {
            const catCourses = courses.filter(c => c.category_id === cat.id);
            if (catCourses.length === 0 && !isPrivileged) return null;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-gold-500" />
                  <h2 className="text-white font-semibold">{cat.name}</h2>
                  <span className="text-white/30 text-xs">{cat.description}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catCourses.map(course => (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      className="glass-card p-4 cursor-pointer group hover:border-gold-500/30 transition-all"
                      onClick={() => onOpenCourse(course.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <BookOpen className="w-5 h-5 text-gold-500/70 group-hover:text-gold-500" />
                        {isPrivileged && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditCourse(course.id); }}
                            className="text-white/20 hover:text-gold-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <PencilLine className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="text-white font-medium mt-2">{course.title}</div>
                      <div className="text-white/40 text-xs mt-1 line-clamp-2">{course.description}</div>
                    </motion.div>
                  ))}
                  {catCourses.length === 0 && isPrivileged && (
                    <div className="glass-card p-4 border-dashed border-white/10 text-white/30 text-xs text-center">
                      No courses in this category yet.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Course View ──────────────────────────────────────────────────────────────
function CourseView({
  courseId, userId, onBack, onOpenLesson, onEditCourse, isPrivileged,
}: {
  courseId: string;
  userId: string;
  onBack: () => void;
  onOpenLesson: (lid: string) => void;
  onEditCourse: (id: string) => void;
  isPrivileged: boolean;
}) {
  const [course, setCourse] = useState<LmsCourse | null>(null);
  const [modules, setModules] = useState<LmsModule[]>([]);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);
  const [progress, setProgress] = useState<LmsLessonProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: c }] = await Promise.all([
      supabase.from('lms_courses').select('*').eq('id', courseId).maybeSingle(),
    ]);
    const { data: mods } = await supabase.from('lms_modules').select('*').eq('course_id', courseId).order('sort_order', { ascending: true });
    const modIds = ((mods as LmsModule[] | null) ?? []).map(m => m.id);
    const { data: lsns } = await supabase.from('lms_lessons').select('*').in('module_id', modIds).order('sort_order', { ascending: true });
    const { data: prog } = await supabase.from('lms_lesson_progress').select('*').eq('user_id', userId);
    setCourse(c as LmsCourse | null);
    setModules((mods as LmsModule[]) ?? []);
    setLessons((lsns as LmsLesson[]) ?? []);
    setProgress((prog as LmsLessonProgress[]) ?? []);
    setLoading(false);
  }, [courseId, userId]);

  useEffect(() => { load(); }, [load]);

  const completedLessonIds = useMemo(() => new Set(progress.filter(p => p.completed).map(p => p.lesson_id)), [progress]);
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter(l => completedLessonIds.has(l.id)).length;
  const coursePct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /></div>;
  }
  if (!course) return <div className="p-6 text-white/40">Course not found.</div>;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-white/40 hover:text-white text-sm flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Portal
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{course.title}</h1>
          <p className="text-white/40 text-sm mt-1">{course.description}</p>
        </div>
        {isPrivileged && (
          <button onClick={() => onEditCourse(course.id)} className="btn-outline-gold flex items-center gap-2 text-sm">
            <PencilLine className="w-4 h-4" /> Edit Course
          </button>
        )}
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-white/50">Course Progress</span>
          <span className="text-gold-500 font-semibold">{coursePct}% · {completedLessons}/{totalLessons} lessons</span>
        </div>
        <div className="h-2 bg-surface-50 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${coursePct}%` }} className="h-full bg-gradient-to-r from-gold-500 to-emerald-500 rounded-full" />
        </div>
      </div>

      {modules.map(mod => {
        const modLessons = lessons.filter(l => l.module_id === mod.id);
        if (modLessons.length === 0) return null;
        return (
          <div key={mod.id} className="glass-card p-4">
            <div className="text-white font-semibold mb-1">{mod.title}</div>
            {mod.description && <div className="text-white/40 text-xs mb-3">{mod.description}</div>}
            <div className="space-y-2">
              {modLessons.map(lesson => {
                const done = completedLessonIds.has(lesson.id);
                return (
                  <button
                    key={lesson.id}
                    onClick={() => onOpenLesson(lesson.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-50/30 hover:bg-surface-50/50 transition-all text-left group"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white/80 text-sm font-medium truncate">{lesson.title}</div>
                      <div className="flex items-center gap-3 text-white/30 text-xs mt-0.5">
                        {lesson.video_url || lesson.video_storage_path ? <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Video</span> : null}
                        {lesson.asset_type === 'pdf' && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF</span>}
                        {lesson.asset_type === 'mp3' && <span className="flex items-center gap-1"><Music className="w-3 h-3" /> Audio</span>}
                        {lesson.asset_type === 'image' && <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image</span>}
                        {lesson.unskippable && <span className="flex items-center gap-1 text-amber-400"><Lock className="w-3 h-3" /> Unskippable</span>}
                        {lesson.reflection_prompt && <span className="flex items-center gap-1"><PencilLine className="w-3 h-3" /> Reflection</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-gold-500 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lesson View (learner) ────────────────────────────────────────────────────
function LessonView({ lessonId, userId, onBack, onCompleted }: {
  lessonId: string;
  userId: string;
  onBack: () => void;
  onCompleted: () => Promise<void>;
}) {
  const [lesson, setLesson] = useState<LmsLesson | null>(null);
  const [checkpoints, setCheckpoints] = useState<LmsCheckpoint[]>([]);
  const [flashcards, setFlashcards] = useState<LmsFlashcard[]>([]);
  const [progress, setProgress] = useState<LmsLessonProgress | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: l }, { data: cps }, { data: fcs }, { data: prog }] = await Promise.all([
      supabase.from('lms_lessons').select('*').eq('id', lessonId).maybeSingle(),
      supabase.from('lms_checkpoints').select('*').eq('lesson_id', lessonId).order('timestamp_sec', { ascending: true }),
      supabase.from('lms_flashcards').select('*').eq('lesson_id', lessonId).order('sort_order', { ascending: true }),
      supabase.from('lms_lesson_progress').select('*').eq('lesson_id', lessonId).eq('user_id', userId).maybeSingle(),
    ]);
    setLesson(l as LmsLesson | null);
    setCheckpoints((cps as LmsCheckpoint[]) ?? []);
    setFlashcards((fcs as LmsFlashcard[]) ?? []);
    setProgress(prog as LmsLessonProgress | null);
    setReflectionText(prog?.reflection_text ?? '');
    setLoading(false);
  }, [lessonId, userId]);

  useEffect(() => { load(); }, [load]);

  const upsertProgress = useCallback(async (patch: Partial<LmsLessonProgress>) => {
    const base = {
      lesson_id: lessonId,
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    await supabase.from('lms_lesson_progress').upsert(base, { onConflict: 'lesson_id,user_id' });
  }, [lessonId, userId]);

  const fullyWatched = progress?.completed ?? false;
  const reflectionRequired = (lesson?.reflection_prompt ?? '').trim().length > 0;
  const reflectionSatisfied = !reflectionRequired || reflectionText.trim().length >= 20;
  const canComplete = fullyWatched && reflectionSatisfied;

  async function markComplete() {
    if (!canComplete || !lesson) return;
    setSaving(true);
    await upsertProgress({
      completed: true,
      completed_at: new Date().toISOString(),
      reflection_text: reflectionText,
    });
    setSaving(false);
    await onCompleted();
    onBack();
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /></div>;
  if (!lesson) return <div className="p-6 text-white/40">Lesson not found.</div>;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-white/40 hover:text-white text-sm flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Course
      </button>
      <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
      {lesson.description && <p className="text-white/40 text-sm">{lesson.description}</p>}

      <LessonVideo
        videoUrl={lesson.video_url}
        storagePath={lesson.video_storage_path}
        durationSec={lesson.video_duration_sec}
        unskippable={lesson.unskippable}
        checkpoints={checkpoints}
        userId={userId}
        onPositionUpdate={(sec) => upsertProgress({ video_position_sec: sec, time_spent_sec: Math.max(progress?.time_spent_sec ?? 0, sec) })}
        onFullyWatched={() => { if (!fullyWatched) { upsertProgress({ completed: true, completed_at: new Date().toISOString() }); setProgress(p => p ? { ...p, completed: true } : p); } }}
      />

      {/* Asset viewer */}
      {lesson.asset_url && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-gold-500 text-xs font-semibold uppercase tracking-wider mb-3">
            {lesson.asset_type === 'pdf' ? <FileText className="w-4 h-4" /> : lesson.asset_type === 'mp3' ? <Music className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            Lesson Asset
          </div>
          {lesson.asset_type === 'pdf' && (
            <iframe src={lesson.asset_url} className="w-full h-[600px] rounded-xl border border-white/10" title="PDF" />
          )}
          {lesson.asset_type === 'mp3' && (
            <audio src={lesson.asset_url} controls className="w-full" />
          )}
          {lesson.asset_type === 'image' && (
            <img src={lesson.asset_url} alt="Lesson visual" className="w-full rounded-xl border border-white/10" />
          )}
        </div>
      )}

      {/* Reflection box */}
      {reflectionRequired && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 text-gold-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <PencilLine className="w-4 h-4" /> Reflection Required
          </div>
          <p className="text-white/60 text-sm mb-3">{lesson.reflection_prompt}</p>
          <textarea
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            rows={4}
            placeholder="Write your summary here (at least 20 characters)…"
            className="input-dark w-full resize-none"
          />
          {!reflectionSatisfied && (
            <div className="text-xs text-amber-400 mt-2">Write at least 20 characters to unlock completion.</div>
          )}
        </div>
      )}

      {/* Flashcards */}
      {flashcards.length > 0 && (
        <div className="glass-card p-5">
          <FlashcardDeck cards={flashcards} />
        </div>
      )}

      {/* Mark complete */}
      <div className="flex items-center gap-3">
        <button
          onClick={markComplete}
          disabled={!canComplete || saving}
          className="btn-gold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Mark as Completed
        </button>
        {!canComplete && (
          <span className="text-white/30 text-xs">
            {!fullyWatched ? 'Finish watching the video first.' : 'Complete the reflection to continue.'}
          </span>
        )}
        {progress?.completed && (
          <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>
        )}
      </div>
    </div>
  );
}

// ── Course Builder (creator) ─────────────────────────────────────────────────
function CourseBuilder({ courseId, categories, onSaved, onBack }: {
  courseId: string | null;
  categories: LmsCategory[];
  onSaved: () => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? '');
  const [modules, setModules] = useState<LmsModule[]>([]);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);
  const [expandedMod, setExpandedMod] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!courseId) { setLoading(false); return; }
    const [{ data: c }, { data: mods }] = await Promise.all([
      supabase.from('lms_courses').select('*').eq('id', courseId).maybeSingle(),
      supabase.from('lms_modules').select('*').eq('course_id', courseId).order('sort_order', { ascending: true }),
    ]);
    if (c) { setTitle(c.title); setDescription(c.description); setCategoryId(c.category_id ?? ''); }
    setModules((mods as LmsModule[]) ?? []);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  async function saveCourseHeader() {
    setSaving(true);
    if (courseId) {
      await supabase.from('lms_courses').update({ title, description, category_id: categoryId || null }).eq('id', courseId);
    } else {
      const { data } = await supabase.from('lms_courses').insert({ title, description, category_id: categoryId || null }).select().single();
      if (data) { onSaved(); return; }
    }
    setSaving(false);
  }

  async function addModule() {
    if (!courseId) return;
    const { data } = await supabase.from('lms_modules')
      .insert({ course_id: courseId, title: 'New Module', description: '', sort_order: modules.length })
      .select().single();
    if (data) { setModules(prev => [...prev, data as LmsModule]); setExpandedMod((data as LmsModule).id); }
  }

  async function renameModule(mod: LmsModule, title: string) {
    await supabase.from('lms_modules').update({ title }).eq('id', mod.id);
    setModules(prev => prev.map(m => m.id === mod.id ? { ...m, title } : m));
  }

  async function deleteModule(mod: LmsModule) {
    if (!confirm('Delete this module and all its lessons?')) return;
    await supabase.from('lms_modules').delete().eq('id', mod.id);
    setModules(prev => prev.filter(m => m.id !== mod.id));
    setLessons(prev => prev.filter(l => l.module_id !== mod.id));
  }

  async function addLesson(mod: LmsModule) {
    const { data } = await supabase.from('lms_lessons')
      .insert({ module_id: mod.id, title: 'New Lesson', description: '', sort_order: 0 })
      .select().single();
    if (data) setLessons(prev => [...prev, data as LmsLesson]);
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-white/40 hover:text-white text-sm flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Portal
      </button>
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <PencilLine className="w-6 h-6 text-gold-500" /> {courseId ? 'Edit Course' : 'New Course'}
      </h1>

      {/* Course header */}
      <div className="glass-card p-5 space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-dark w-full" placeholder="Course title" />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-dark w-full resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-dark w-full">
            <option value="">— No category —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={saveCourseHeader} disabled={saving || !title} className="btn-gold flex items-center gap-2 text-sm">
          <Save className="w-4 h-4" /> {courseId ? 'Save Header' : 'Create Course'}
        </button>
      </div>

      {courseId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-gold-500" /> Modules</h2>
            <button onClick={addModule} className="btn-outline-gold flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Module
            </button>
          </div>
          {modules.map(mod => (
            <ModuleEditor
              key={mod.id}
              mod={mod}
              lessons={lessons.filter(l => l.module_id === mod.id)}
              expanded={expandedMod === mod.id}
              onToggle={() => setExpandedMod(expandedMod === mod.id ? null : mod.id)}
              onRename={(t) => renameModule(mod, t)}
              onDelete={() => deleteModule(mod)}
              onAddLesson={() => addLesson(mod)}
              onLessonsChanged={() => {
                supabase.from('lms_lessons').select('*').in('module_id', modules.map(m => m.id)).then(({ data }) => {
                  setLessons((data as LmsLesson[]) ?? []);
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleEditor({ mod, lessons, expanded, onToggle, onRename, onDelete, onAddLesson, onLessonsChanged }: {
  mod: LmsModule;
  lessons: LmsLesson[];
  expanded: boolean;
  onToggle: () => void;
  onRename: (t: string) => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onLessonsChanged: () => void;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
          {expanded ? <ChevronDown className="w-4 h-4 text-gold-500" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
          <input
            defaultValue={mod.title}
            onBlur={(e) => onRename(e.target.value)}
            className="bg-transparent text-white font-medium flex-1 outline-none focus:bg-white/5 rounded px-1"
          />
        </button>
        <button onClick={onDelete} className="text-white/20 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2">
          {lessons.map(l => <LessonEditor key={l.id} lesson={l} onSaved={onLessonsChanged} />)}
          <button onClick={onAddLesson} className="w-full p-2 rounded-xl border border-dashed border-white/10 text-white/40 hover:text-gold-500 hover:border-gold-500/30 text-xs flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Lesson
          </button>
        </div>
      )}
    </div>
  );
}

function LessonEditor({ lesson, onSaved }: { lesson: LmsLesson; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: lesson.title,
    description: lesson.description,
    content_kind: lesson.content_kind,
    video_url: lesson.video_url,
    video_duration_sec: lesson.video_duration_sec,
    unskippable: lesson.unskippable,
    asset_url: lesson.asset_url,
    asset_storage_path: lesson.asset_storage_path,
    asset_type: lesson.asset_type,
    reflection_prompt: lesson.reflection_prompt,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('lms_lessons').update({
      title: form.title,
      description: form.description,
      content_kind: form.content_kind,
      video_url: form.video_url,
      video_duration_sec: Number(form.video_duration_sec),
      unskippable: form.unskippable,
      asset_url: form.asset_url,
      asset_storage_path: form.asset_storage_path,
      asset_type: form.asset_type,
      reflection_prompt: form.reflection_prompt,
    }).eq('id', lesson.id);
    setSaving(false);
    onSaved();
  }

  async function deleteLesson() {
    if (!confirm('Delete this lesson?')) return;
    await supabase.from('lms_lessons').delete().eq('id', lesson.id);
    onSaved();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-surface-50/30">
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown className="w-4 h-4 text-gold-500" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
          <span className="text-white/80 text-sm font-medium">{form.title || 'Untitled Lesson'}</span>
        </button>
        <button onClick={deleteLesson} className="text-white/20 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {open && (
        <div className="p-3 pt-0 space-y-3">
          <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="input-dark w-full text-sm" placeholder="Lesson title" />
          <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input-dark w-full resize-none text-sm" placeholder="Description" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1 uppercase">Content Kind</label>
              <select value={form.content_kind} onChange={(e) => setForm(f => ({ ...f, content_kind: e.target.value as LmsContentKind }))} className="input-dark w-full text-sm">
                <option value="video">Video</option>
                <option value="asset">Asset (PDF/Audio/Image)</option>
                <option value="text">Text</option>
                <option value="interactive">Interactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1 uppercase">Duration (sec)</label>
              <input type="number" min={0} value={form.video_duration_sec} onChange={(e) => setForm(f => ({ ...f, video_duration_sec: Number(e.target.value) }))} className="input-dark w-full text-sm" />
            </div>
          </div>

          {/* Dual video engine */}
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase">External Video URL (YouTube / Vimeo / Google Drive)</label>
            <input value={form.video_url} onChange={(e) => setForm(f => ({ ...f, video_url: e.target.value }))} className="input-dark w-full text-sm" placeholder="https://youtube.com/watch?v=…" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase">Or upload a video file</label>
            <AssetUploader
              assetType={form.asset_type}
              assetUrl={form.asset_url}
              storagePath={form.asset_storage_path}
              onUploaded={(url, path) => setForm(f => ({ ...f, asset_url: url, asset_storage_path: path }))}
              onClear={() => setForm(f => ({ ...f, asset_url: null, asset_storage_path: null, asset_type: null }))}
            />
          </div>

          {/* Unskippable toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.unskippable} onChange={(e) => setForm(f => ({ ...f, unskippable: e.target.checked }))} className="w-4 h-4 rounded accent-gold-500" />
            <span className="text-sm text-white/70 flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-amber-400" /> Unskippable (reveal completion only after full playback)</span>
          </label>

          {/* Reflection */}
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase">Reflection Prompt (leave empty to skip)</label>
            <textarea value={form.reflection_prompt} onChange={(e) => setForm(f => ({ ...f, reflection_prompt: e.target.value }))} rows={2} className="input-dark w-full resize-none text-sm" placeholder="e.g. Summarize the 3-step closing technique you just learned." />
          </div>

          <button onClick={save} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
            <Save className="w-4 h-4" /> Save Lesson
          </button>
        </div>
      )}
    </div>
  );
}

// ── Analytics Panel ──────────────────────────────────────────────────────────
function AnalyticsPanel({ initialUserId, onBack }: { initialUserId: string | null; onBack: () => void }) {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId);
  const [progress, setProgress] = useState<LmsLessonProgress[]>([]);
  const [badges, setBadges] = useState<LmsUserBadge[]>([]);
  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [modules, setModules] = useState<LmsModule[]>([]);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('is_active', true).order('full_name').then(({ data }) => {
      setStaff((data as Profile[]) ?? []);
    });
    supabase.from('lms_courses').select('*').then(({ data }) => setCourses((data as LmsCourse[]) ?? []));
    supabase.from('lms_modules').select('*').then(({ data }) => setModules((data as LmsModule[]) ?? []));
    supabase.from('lms_lessons').select('*').then(({ data }) => setLessons((data as LmsLesson[]) ?? []));
  }, []);

  const loadUserData = useCallback(async () => {
    if (!selectedUserId) { setProgress([]); setBadges([]); setLoading(false); return; }
    const [{ data: prog }, { data: ub }] = await Promise.all([
      supabase.from('lms_lesson_progress').select('*').eq('user_id', selectedUserId),
      supabase.from('lms_user_badges').select('*, badge:lms_badges(*)').eq('user_id', selectedUserId),
    ]);
    setProgress((prog as LmsLessonProgress[]) ?? []);
    setBadges((ub as LmsUserBadge[]) ?? []);
    setLoading(false);
  }, [selectedUserId]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const moduleByCourse = useMemo(() => {
    const m = new Map<string, string[]>();
    modules.forEach(mod => { const a = m.get(mod.course_id) ?? []; a.push(mod.id); m.set(mod.course_id, a); });
    return m;
  }, [modules]);
  const lessonsByModule = useMemo(() => {
    const m = new Map<string, string[]>();
    lessons.forEach(l => { const a = m.get(l.module_id) ?? []; a.push(l.id); m.set(l.module_id, a); });
    return m;
  }, [lessons]);
  const completedLessonIds = useMemo(() => new Set(progress.filter(p => p.completed).map(p => p.lesson_id)), [progress]);

  const courseStats = courses.map(c => {
    const modIds = moduleByCourse.get(c.id) ?? [];
    const lessonIds = modIds.flatMap(mid => lessonsByModule.get(mid) ?? []);
    const done = lessonIds.filter(lid => completedLessonIds.has(lid)).length;
    const total = lessonIds.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { course: c, done, total, pct };
  });

  const totalTime = progress.reduce((s, p) => s + (p.time_spent_sec ?? 0), 0);
  const avgQuiz = progress.length ? progress.reduce((s, p) => s + (p.quiz_score ?? 0), 0) / progress.length : 0;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-white/40 hover:text-white text-sm flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Portal
      </button>
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-gold-500" /> LMS Analytics
      </h1>

      <div className="glass-card p-4">
        <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Filter by Staff Member</label>
        <select value={selectedUserId ?? ''} onChange={(e) => { setSelectedUserId(e.target.value || null); setLoading(true); }} className="input-dark w-full">
          <option value="">— Select staff —</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      {selectedUserId && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile icon={<CheckCircle2 className="w-4 h-4" />} label="Lessons Done" value={progress.filter(p => p.completed).length} />
            <StatTile icon={<Clock className="w-4 h-4" />} label="Time Spent" value={`${Math.floor(totalTime / 60)}m`} />
            <StatTile icon={<Award className="w-4 h-4" />} label="Badges" value={badges.length} />
            <StatTile icon={<Sparkles className="w-4 h-4" />} label="Avg Quiz" value={`${Math.round(avgQuiz)}%`} />
          </div>

          <div className="glass-card p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gold-500" /> Course Completion</h3>
            <div className="space-y-3">
              {courseStats.map(({ course, done, total, pct }) => (
                <div key={course.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-white/70">{course.title}</span>
                    <span className="text-white/40 text-xs">{done}/{total} · {pct}%</span>
                  </div>
                  <div className="h-2 bg-surface-50 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold-500 to-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
              {courseStats.length === 0 && <div className="text-white/30 text-sm text-center py-4">No courses.</div>}
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-gold-500" /> Badges Earned</h3>
            {badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {badges.map(ub => (
                  <span key={ub.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold-500/10 text-gold-500 text-xs font-medium border border-gold-500/20">
                    <span>{ub.badge?.icon ?? '🏅'}</span> {ub.badge?.name ?? 'Badge'}
                  </span>
                ))}
              </div>
            ) : <div className="text-white/30 text-sm">No badges earned yet.</div>}
          </div>

          <div className="glass-card p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><PencilLine className="w-4 h-4 text-gold-500" /> Reflection Logs</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {progress.filter(p => p.reflection_text).map(p => {
                const lesson = lessons.find(l => l.id === p.lesson_id);
                return (
                  <div key={p.id} className="p-3 rounded-xl bg-surface-50/30">
                    <div className="text-white/60 text-xs font-medium mb-1">{lesson?.title ?? 'Lesson'}</div>
                    <div className="text-white/70 text-sm">{p.reflection_text}</div>
                    <div className="text-white/30 text-xs mt-1">{p.completed_at ? new Date(p.completed_at).toLocaleString('en-IN') : ''}</div>
                  </div>
                );
              })}
              {progress.filter(p => p.reflection_text).length === 0 && <div className="text-white/30 text-sm">No reflections logged.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass-card p-4">
      <div className="text-gold-500 mb-2">{icon}</div>
      <div className="text-white text-xl font-bold">{value}</div>
      <div className="text-white/40 text-xs">{label}</div>
    </div>
  );
}
