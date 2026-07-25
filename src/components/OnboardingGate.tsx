import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding, isTrainingOnly } from '../hooks/useOnboarding';

/**
 * Wraps the protected layout. If the signed-in user has not completed onboarding,
 * only Training (+ Profile) are reachable — every other tab redirects to /training.
 * Privileged roles (admin/hr/manager) and users with is_onboarding_complete=true
 * are never locked. This guard is purely additive: existing routes keep working.
 */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const onboarding = useOnboarding(profile);
  const location = useLocation();

  if (onboarding.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (onboarding.isUnlocked) return <>{children}</>;

  if (!isTrainingOnly(location.pathname)) {
    return <Navigate to="/training" replace />;
  }

  return <>{children}</>;
}
