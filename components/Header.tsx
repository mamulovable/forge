import Link from "next/link";
import { UserButton, SignInButton, Show } from "@clerk/nextjs";
import Image from "next/image";
import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkUser } from "@/lib/checkUser";
import { PricingModal } from "@/components/PricingModal";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/types/plans";

export default async function Header() {
  const user = await checkUser();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 select-none">
          <Image
            src="/logo.png"
            alt="Dreamera"
            width={100}
            height={100}
            className="h-9 w-auto rounded-md"
          />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-5">
          <Show when="signed-in">
            <Link
              href="/projects"
              className="text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Projects
            </Link>

            {user && (
              <PricingModal>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-700">
                  <Zap className="h-3 w-3 fill-[#FF6B2C] text-[#FF6B2C]" />
                  {user.credits} credits
                </span>
              </PricingModal>
            )}

            <UserButton />
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button
                variant="ghost"
                size="sm"
                className="text-[13px] font-medium text-neutral-500 hover:bg-transparent hover:text-neutral-900"
              >
                Sign in
              </Button>
            </SignInButton>

            <SignInButton mode="modal">
              <Button
                size="sm"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FF6B2C] px-4 text-[13px] font-semibold text-white hover:bg-[#E85A1A] active:scale-95"
              >
                Get Started
                <ArrowRight className="h-3 w-3 opacity-80" />
              </Button>
            </SignInButton>
          </Show>
        </div>
      </nav>
    </header>
  );
}
