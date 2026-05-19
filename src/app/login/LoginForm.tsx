"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getBrowserSupabase();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      setError(signInErr.message);
      setLoading(false);
      return;
    }

    // Fetch profile to determine where to send the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign-in succeeded but no session was created. Try again.");
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("app_users")
      .select("role, is_active, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      setError("Your account exists in auth but has no profile. Contact admin.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    if (!profile.is_active) {
      setError("Account deactivated. Contact admin.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const next = params.get("next");
    if (next && next.startsWith("/")) {
      router.push(next);
    } else {
      router.push(profile.role === "admin" ? "/admin" : "/manager");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1"
        />
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
