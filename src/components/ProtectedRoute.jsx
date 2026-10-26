import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Button } from '@/components/ui/button';
import { Lock, Zap, LogOut, Loader2, ShieldCheck } from 'lucide-react';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

function PaymentRequiredModal({ user, logout }) {
  const [checkingOut, setCheckingOut] = useState(false);

  const handlePay = async () => {
    setCheckingOut(true);
    try {
      const res = await fetch('/api/dodoCheckout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, name: user?.full_name }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data.error || 'Failed to initialize checkout.');
      }
    } catch (err) {
      alert(err.message || 'Failed to launch Dodo Payments checkout. Please try again.');
      setCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
          <Lock className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
            Lifetime License Required
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Your account (<strong className="text-foreground">{user?.email || 'unregistered'}</strong>) has not purchased a Data Board Lifetime License yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Access to realtime 3D analytics, AI MCP server integration for Claude & Cursor, and uptime monitors requires a one-time $5 payment.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Button
            onClick={handlePay}
            disabled={checkingOut}
            className="w-full h-11 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-glow gap-2"
          >
            {checkingOut ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Redirecting to Dodo Payments...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-current" />
                <span>Pay $5 via Dodo Payments to Unlock</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => logout(true)}
            className="w-full h-10 text-xs font-medium rounded-xl gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Log out / Switch account</span>
          </Button>
        </div>

        <div className="border-t border-border/70 pt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>One-time payment · Lifetime access · No subscriptions</span>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { user, isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, logout } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // Strict payment gate: Only admin and verified lifetime_pro customers who paid via Dodo Payments are admitted
  const email = user?.email?.toLowerCase();
  const isPaidOrAdmin =
    user?.role === 'admin' ||
    user?.role === 'lifetime_pro' ||
    email === 'gurukalyanreddyd@gmail.com';

  if (!isPaidOrAdmin) {
    return <PaymentRequiredModal user={user} logout={logout} />;
  }

  return <Outlet />;
}
