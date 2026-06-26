"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { ArrowRight, Zap, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FEATURES, PLACEHOLDERS, STEPS, SUGGESTIONS } from "@/lib/data";
import { PRICING_PLANS } from "@/lib/constants";
import {
  GENERATION_MODELS,
  readStoredGenerationModelId,
  writeStoredGenerationModelId,
} from "@/lib/generation-models";

export default function LandingPage() {
  const { isSignedIn, has } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [generationModelId, setGenerationModelId] = useState(
    readStoredGenerationModelId
  );

  useEffect(() => {
    writeStoredGenerationModelId(generationModelId);
  }, [generationModelId]);

  useEffect(() => {
    if (isFocused || prompt) return;
    const t = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(t);
  }, [isFocused, prompt]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [prompt]);

  const handleSubmit = () => {
    if (!prompt.trim() || !isSignedIn) return;
    router.push(`/workspace?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (s: string) => {
    setPrompt(s);
    textareaRef.current?.focus();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#E4F2FA] via-white to-[#FFE8D6] selection:bg-orange-200/40">
      {/* ── HERO ──────────────────────────────────────────────────────────*/}
      <section className="relative flex flex-col items-center px-4 pb-24 pt-32 text-center sm:pt-36">
        <Badge
          variant="outline"
          className="z-10 gap-2 border-neutral-200 bg-white/80 p-4 text-neutral-600 backdrop-blur-sm"
        >
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Powered by Agentic AI
        </Badge>

        <h1 className="z-10 mx-auto mt-6 max-w-3xl text-balance font-serif text-5xl leading-tight tracking-tight text-neutral-900 sm:text-6xl lg:text-7xl">
          <span className="text-neutral-900">Dreamera your dream</span>
          <br />
          <span className="bg-linear-to-br from-[#FF8A4C] via-[#FF6B2C] to-[#E85A1A] bg-clip-text font-serif text-transparent">
            from a single prompt.
          </span>
        </h1>

        <p className="z-10 mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-neutral-600 sm:text-lg">
          Describe what you want to build. AI writes the code, picks the
          packages, and renders a live preview all inside your browser.
        </p>

        <div className="relative mx-auto mt-12 w-full max-w-2xl">
          <div
            className={cn(
              "rounded-2xl border bg-white shadow-xl shadow-neutral-200/60 transition-all duration-200",
              isFocused
                ? "border-neutral-300 ring-2 ring-orange-200/50"
                : "border-neutral-200"
            )}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={PLACEHOLDERS[placeholderIndex]}
              rows={1}
              className="w-full resize-none bg-transparent px-5 pb-4 pt-5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none sm:text-base"
              style={{ minHeight: 56, maxHeight: 200 }}
            />

            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <select
                  value={generationModelId}
                  onChange={(e) => setGenerationModelId(e.target.value)}
                  className="h-7 max-w-[150px] shrink-0 truncate rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-[11px] text-neutral-600 outline-none transition-colors hover:border-neutral-300"
                  aria-label="Generation model"
                >
                  {GENERATION_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <span className="hidden truncate text-xs text-neutral-400 sm:inline">
                  Press ⏎ to generate · Shift+⏎ for new line
                </span>
              </div>

              {isSignedIn ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!prompt.trim()}
                  className="h-8 rounded-full bg-[#FF6B2C] px-5 font-semibold text-white hover:bg-[#E85A1A]"
                  variant={prompt.trim() ? "default" : "secondary"}
                >
                  Generate
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button className="h-8 rounded-full bg-[#FF6B2C] px-5 font-semibold text-white hover:bg-[#E85A1A]">
                    Generate
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-10 text-xs text-neutral-400">
          No credit card required · 10 free generations on sign up
        </p>
      </section>

      {/* BROWSER MOCKUP */}
      <section className="px-4 pb-32">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-200/50">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <div className="flex gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-3 w-3 rounded-full bg-neutral-200"
                />
              ))}
            </div>

            <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md bg-neutral-100 px-3">
              <span className="text-xs text-neutral-400">
                dreamera.app/workspace
              </span>
            </div>
          </div>

          <div className="flex h-105">
            {/* Chat panel */}
            <div className="flex w-80 flex-col border-r border-neutral-100 bg-neutral-50">
              <div className="border-b border-neutral-100 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Chat
                </p>
              </div>

              <div className="flex-1 space-y-4 px-4 py-4">
                <div className="flex justify-end">
                  <div className="max-w-55 rounded-2xl rounded-br-sm bg-neutral-900 px-3.5 py-2.5">
                    <p className="text-xs text-white/90">
                      Build a kanban board with 3 columns and drag-and-drop
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#FF6B2C]">
                    <Zap className="h-3 w-3 fill-white text-white" />
                  </div>

                  <div className="rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3.5 py-2.5">
                    <p className="text-xs text-neutral-600">
                      I&apos;ll build a Kanban board with Todo, In Progress, and
                      Done columns. I&apos;ll use{" "}
                      <code className="text-orange-600/80">@dnd-kit/core</code>{" "}
                      for smooth drag-and-drop…
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#FF6B2C]">
                    <Zap className="h-3 w-3 fill-white text-white" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3.5 py-3">
                    {[0, 0.15, 0.3].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-100 px-3 py-3">
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <span className="flex-1 text-xs text-neutral-400">
                    Ask AI to modify…
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-1 border-b border-neutral-100 px-4">
                <button className="border-b-2 border-[#FF6B2C] px-3 py-2.5 text-xs font-medium text-neutral-900">
                  Preview
                </button>
                <button className="px-3 py-2.5 text-xs text-neutral-400">
                  Code
                </button>
              </div>

              <div className="flex flex-1 gap-3 overflow-hidden bg-neutral-50 p-5">
                {["Todo", "In Progress", "Done"].map((col, ci) => (
                  <div key={col} className="flex w-1/3 flex-col gap-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-neutral-500">
                        {col}
                      </span>

                      <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500">
                        {[3, 2, 1][ci]}
                      </span>
                    </div>

                    {Array.from({ length: [3, 2, 1][ci] }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm"
                      >
                        <div
                          className="mb-1.5 h-2 rounded-full bg-neutral-200"
                          style={{ width: `${60 + i * 15}%` }}
                        />
                        <div className="h-1.5 w-3/4 rounded-full bg-neutral-100" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="px-4 pb-32">
        <div className="mx-auto mb-14 max-w-5xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#FF6B2C]">
            Everything you need
          </p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-black">
            From prompt
            <br />
            <span className="text-[#FF6B2C]">to production.</span>
          </h2>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="group rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 group-hover:border-orange-200 group-hover:bg-orange-50">
                <Icon className="h-4 w-4 text-neutral-600 group-hover:text-[#FF6B2C]" />
              </div>
              <p className="mb-2 text-sm font-semibold text-neutral-900">
                {label}
              </p>
              <p className="text-sm leading-relaxed text-neutral-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-4 pb-32">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#FF6B2C]">
            How it works
          </p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-black">
            Four steps
            <br />
            <span className="text-[#FF6B2C]">to a working app.</span>
          </h2>
        </div>

        <div className="mx-auto max-w-3xl">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm">
                  <span className="font-mono text-xs font-semibold text-neutral-500">
                    {step.number}
                  </span>
                </div>

                {i < STEPS.length - 1 && (
                  <div className="mt-2 h-full w-px bg-neutral-200" />
                )}
              </div>

              <div className="pb-10 pt-1.5">
                <p className="mb-1.5 text-sm font-semibold text-neutral-900 sm:text-base">
                  {step.label}
                </p>

                <p className="text-sm leading-relaxed text-neutral-500">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="px-4 pb-32">
        <div className="mx-auto mb-14 max-w-5xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#FF6B2C]">
            Simple pricing
          </p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-black">
            Start free,
            <br />
            <span className="text-[#FF6B2C]">scale when ready.</span>
          </h2>

          <p className="mx-auto mt-4 max-w-sm text-sm text-neutral-500">
            No credit card required. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const planOrder: Record<string, number> = {
              free: 0,
              starter: 1,
              pro: 2,
            };
            const activePlanKey = isSignedIn
              ? has?.({ plan: "pro" })
                ? "pro"
                : has?.({ plan: "starter" })
                  ? "starter"
                  : "free"
              : null;

            const isActive = isSignedIn && activePlanKey === plan.key;
            const isDowngrade =
              isSignedIn &&
              activePlanKey !== null &&
              !isActive &&
              planOrder[plan.key] < planOrder[activePlanKey];

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-7 transition-shadow",
                  plan.featured
                    ? "border-orange-200 bg-orange-50/50 shadow-md"
                    : "border-neutral-200 bg-white shadow-sm"
                )}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-medium text-[#FF6B2C]">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">
                    {plan.label}
                  </p>
                  {isActive && (
                    <span className="rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-[#FF6B2C]">
                      Active
                    </span>
                  )}
                </div>

                <p className="mb-6 text-xs leading-relaxed text-neutral-500">
                  {plan.description}
                </p>

                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-neutral-900">
                    {plan.price === 0 ? (
                      "$0"
                    ) : (
                      <span className="text-[#FF6B2C]">${plan.price}</span>
                    )}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-neutral-400">/mo</span>
                  )}
                </div>
                <p className="mb-6 text-xs text-neutral-400">
                  {plan.price === 0 ? "Always free" : "Only billed monthly"}
                </p>

                <div className="mb-8 space-y-3 border-t border-neutral-200 pt-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                          plan.featured ? "bg-orange-100" : "bg-neutral-100"
                        )}
                      >
                        <Check
                          className={cn(
                            "h-2.5 w-2.5",
                            plan.featured
                              ? "text-[#FF6B2C]"
                              : "text-neutral-500"
                          )}
                        />
                      </div>
                      <span className="text-xs text-neutral-600">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto">
                  {isActive ? (
                    <Button
                      disabled
                      className="w-full cursor-not-allowed rounded-full border border-neutral-200 bg-transparent text-sm font-semibold text-neutral-400 opacity-50"
                      variant="ghost"
                    >
                      ✓ Current plan
                    </Button>
                  ) : plan.price === 0 ? (
                    isSignedIn ? (
                      <Button
                        disabled
                        className="w-full cursor-not-allowed rounded-full border border-neutral-200 bg-transparent text-sm font-semibold text-neutral-400 opacity-50"
                        variant="ghost"
                      >
                        Default plan
                      </Button>
                    ) : (
                      <SignInButton mode="modal">
                        <Button
                          className="w-full rounded-full border border-neutral-200 bg-transparent text-sm font-semibold text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                          variant="ghost"
                        >
                          Get started free
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </SignInButton>
                    )
                  ) : isSignedIn ? (
                    <CheckoutButton
                      planId={plan.planId}
                      planPeriod="month"
                      checkoutProps={{
                        appearance: {
                          elements: {
                            drawerRoot: {
                              zIndex: 2000,
                            },
                          },
                        },
                      }}
                    >
                      <Button
                        className={cn(
                          "w-full rounded-full text-sm font-semibold transition-all",
                          plan.featured
                            ? "bg-[#FF6B2C] text-white hover:bg-[#E85A1A] active:scale-95"
                            : "border border-neutral-200 bg-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                        )}
                        variant="ghost"
                      >
                        {isDowngrade ? "Downgrade" : "Get started"}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </CheckoutButton>
                  ) : (
                    <SignInButton mode="modal">
                      <Button
                        className={cn(
                          "w-full rounded-full text-sm font-semibold transition-all",
                          plan.featured
                            ? "bg-[#FF6B2C] text-white hover:bg-[#E85A1A] active:scale-95"
                            : "border border-neutral-200 bg-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                        )}
                        variant="ghost"
                      >
                        Get started
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────*/}
      <section className="relative mx-4 mb-32 overflow-hidden rounded-3xl border border-neutral-200 bg-white px-10 py-24 text-center shadow-lg shadow-neutral-200/50 sm:mx-auto sm:max-w-5xl">
        <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-black">
          Start building,
          <br />
          <span className="text-[#FF6B2C]">for free.</span>
        </h2>

        <p className="mb-8 mt-4 text-sm leading-relaxed text-neutral-500">
          Get 10 free generations on sign up. No credit card required.
          <br />
          Upgrade when you&apos;re ready.
        </p>

        <SignInButton mode="modal">
          <Button
            size="lg"
            className="relative h-11 rounded-full bg-[#FF6B2C] px-8 text-white hover:bg-[#E85A1A]"
          >
            Get started free
            <ChevronRight className="h-4 w-4" />
          </Button>
        </SignInButton>
      </section>

      <footer className="relative z-10 mx-auto flex flex-wrap items-center justify-center border-t border-neutral-200 px-6 py-12 text-neutral-400">
        Made with ❤️ by MMERA
      </footer>
    </main>
  );
}
