import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, LmsOnboardingSettings, LmsCourse, LmsLessonProgress, LmsModule, LmsLesson } from '../lib/supabase';

export interface OnboardingState {
  loading: boolean;
  isUnlocked: boolean;
  requiredDays: number;
  requiredCourseIds: string[];
  courses: LmsCourse[];
  daysCompleted: number;
  coursesCompleted: number;
  completedCourseIds: string[];
  refresh: () => Promise<void>;
}

export function isTrainingOnly(path: string): boolean {
  return path === '/training' || path.startsWith('/training/') ||
         path === '/profile' || path.startsWith('/profile/');
}

export function useOnboarding(profile: Profile | null): OnboardingState {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LmsOnboardingSettings | null>(null);
  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [modules, setModules] = useState<LmsModule[]>([]);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);
  const [progress, setProgress] = useState<LmsLessonProgress[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => { setRefreshKey(k => k + 1); }, []);

  const privileged = profile ? ['admin', 'hr', 'manager'].includes(profile.role) : false;

  useEffect(() => {
    if (!profile) { setLoading(false); return; }
    if (privileged || profile.is_onboarding_complete) {
      setSettings(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      const [
        { data: s },
        { data: courseRows },
        { data: moduleRows },
        { data: lessonRows },
        { data: progRows },
      ] = await Promise.all([
        supabase.from('lms_onboarding_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('lms_courses').select('*').order('sort_order', { ascending: true }),
        supabase.from('lms_modules').select('*'),
        supabase.from('lms_lessons').select('*'),
        supabase.from('lms_lesson_progress').select('*').eq('user_id', profile!.id),
      ]);
      if (cancelled) return;
      setSettings(s as LmsOnboardingSettings | null);
      setCourses((courseRows as LmsCourse[]) ?? []);
      setModules((moduleRows as LmsModule[]) ?? []);
      setLessons((lessonRows as LmsLesson[]) ?? []);
      setProgress((progRows as LmsLessonProgress[]) ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profile, privileged, refreshKey]);

  if (!profile || privileged || profile.is_onboarding_complete) {
    return {
      loading: false, isUnlocked: true, requiredDays: 0, requiredCourseIds: [],
      courses: [], daysCompleted: 0, coursesCompleted: 0, completedCourseIds: [], refresh,
    };
  }

  const requiredDays = settings?.required_days ?? 0;
  const requiredCourseIds = settings?.required_course_ids ?? [];

  const completedLessonIds = new Set(
    progress.filter(p => p.completed).map(p => p.lesson_id)
  );

  // Distinct days with at least one completed lesson
  const distinctDays = new Set(
    progress
      .filter(p => p.completed && p.completed_at)
      .map(p => (p.completed_at as string).slice(0, 10))
  );
  const daysCompleted = distinctDays.size;

  // A course is completed when every lesson across all its modules is completed.
  const moduleByCourse = new Map<string, string[]>();
  modules.forEach(m => {
    const arr = moduleByCourse.get(m.course_id) ?? [];
    arr.push(m.id);
    moduleByCourse.set(m.course_id, arr);
  });
  const lessonsByModule = new Map<string, string[]>();
  lessons.forEach(l => {
    const arr = lessonsByModule.get(l.module_id) ?? [];
    arr.push(l.id);
    lessonsByModule.set(l.module_id, arr);
  });

  function isCourseComplete(courseId: string): boolean {
    const courseModuleIds = moduleByCourse.get(courseId) ?? [];
    if (courseModuleIds.length === 0) return false;
    for (const modId of courseModuleIds) {
      const lessonIds = lessonsByModule.get(modId) ?? [];
      if (lessonIds.length === 0) return false; // course with empty module => not complete
      for (const lid of lessonIds) {
        if (!completedLessonIds.has(lid)) return false;
      }
    }
    return true;
  }

  const completedCourseIds = courses.map(c => c.id).filter(isCourseComplete);

  const daysMet = requiredDays > 0 ? daysCompleted >= requiredDays : true;
  const coursesMet = requiredCourseIds.length > 0
    ? requiredCourseIds.every(cid => completedCourseIds.includes(cid))
    : true;
  const configured = requiredDays > 0 || requiredCourseIds.length > 0;
  const isUnlocked = configured ? (daysMet && coursesMet) : false;

  return {
    loading, isUnlocked, requiredDays, requiredCourseIds, courses,
    daysCompleted, coursesCompleted: completedCourseIds.length, completedCourseIds, refresh,
  };
}
