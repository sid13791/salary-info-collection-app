"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function Header({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  const router = useRouter();

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex flex-col">
          <span className="font-semibold leading-tight">{title}</span>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </Link>
        <div className="flex items-center gap-2">
          {children}
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    </header>
  );
}
