import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { webrader } from "@/api/webraderClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  // Post-login destination (defaults to "/realtime")
  const returnTo = safeReturnTo("/realtime");

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = returnTo || "/realtime";
    }
  }, [isAuthenticated, returnTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await webrader.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo || "/realtime";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    webrader.auth.loginWithProvider("google", returnTo || "/realtime");
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Need lifetime access?{" "}
          <Link
            to="/#pricing"
            className="text-primary font-medium hover:underline"
          >
            Get the $5 Lifetime Deal
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-10 sm:h-11 text-xs sm:text-sm font-medium mb-3 sm:mb-5 rounded-xl border-border hover:bg-muted"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-4 h-4 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-3 sm:mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[10px] sm:text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground font-medium">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9 h-10 sm:h-11 text-sm rounded-xl"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 h-10 sm:h-11 text-sm rounded-xl"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-10 sm:h-11 font-semibold text-sm rounded-xl mt-1" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
