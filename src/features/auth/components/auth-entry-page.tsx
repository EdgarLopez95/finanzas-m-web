"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { getAuthRedirectPath } from "@/features/auth/auth-routing";
import { forceGoogleAccountSelection, signInWithGoogle } from "@/features/auth/auth-service";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";

gsap.registerPlugin(useGSAP);

const HIGHLIGHTS = [
  { title: "Dinero propio", description: "Saldo real, no el bruto" },
  { title: "Cuentas y bolsillos", description: "Todo en un lugar" },
];

export function AuthEntryPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLElement | null>(null);
  const { status } = useAuthBootstrap();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const redirectPath = getAuthRedirectPath({ area: "public", status });
    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [router, status]);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            return;
          }

          gsap.from("[data-auth-panel]", {
            y: 26,
            autoAlpha: 0,
            duration: 0.78,
            ease: "power3.out",
            stagger: 0.08,
          });

          gsap.from("[data-auth-orbit]", {
            scale: 0.92,
            autoAlpha: 0,
            duration: 1.1,
            stagger: 0.14,
            ease: "power2.out",
          });
        },
      );

      return () => media.revert();
    },
    { scope: rootRef },
  );

  const handleSignIn = async (forceAccountSelection = false) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (forceAccountSelection) {
        forceGoogleAccountSelection();
      }
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudo iniciar sesion con Google. Intenta de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      id="main-content"
      ref={rootRef}
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(90deg,#111827_0%,#111827_49.9%,#0f1726_50%,#0f1726_100%)]"
    >
      <div className="absolute inset-y-0 left-1/2 hidden w-px bg-[rgba(228,179,99,0.22)] xl:block" />
      <div
        data-auth-orbit
        className="pointer-events-none absolute left-[20%] top-[-6%] hidden h-[25rem] w-[25rem] rounded-full border border-[rgba(228,179,99,0.14)] xl:block"
      />
      <div
        data-auth-orbit
        className="pointer-events-none absolute left-[26%] top-[34%] hidden h-[18rem] w-[18rem] rounded-full border border-[rgba(228,179,99,0.1)] xl:block"
      />
      <div
        data-auth-orbit
        className="pointer-events-none absolute bottom-[-18%] left-[-8%] hidden h-[28rem] w-[34rem] rounded-full border border-[rgba(148,163,184,0.08)] xl:block"
      />

      <div className="grid min-h-screen xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <section className="relative flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-12 xl:px-16 xl:py-12">
          <div className="space-y-16">
            <div data-auth-panel className="w-fit">
              <Image
                src="/brand/logo-white-text.svg"
                alt="Finanzas M"
                width={271}
                height={84}
                priority
                className="h-auto w-[15rem] sm:w-[16.5rem]"
              />
            </div>

            <div className="max-w-[38rem] space-y-8">
              <div data-auth-panel className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--fm-pending)]">
                  Claridad con tu plata
                </p>
                <h1 className="max-w-[12ch] font-[var(--font-display)] text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-[var(--fm-warm-paper)] sm:text-6xl xl:text-[5.2rem]">
                  Sabe cu&aacute;nto <span className="text-[var(--fm-pending)]">es realmente tuyo</span>, cada d&iacute;a.
                </h1>
                <p className="max-w-[33rem] text-lg leading-8 text-[var(--fm-text-soft)]">
                  Finanzas M te muestra tu dinero propio, en qu&eacute; se te va y d&oacute;nde est&aacute;, sin
                  n&uacute;meros que te enga&ntilde;en.
                </p>
              </div>

              <div data-auth-panel className="grid max-w-xl gap-6 sm:grid-cols-2">
                {HIGHLIGHTS.map((item, index) => (
                  <article
                    key={item.title}
                    className={`space-y-2 ${index === 0 ? "sm:border-r sm:border-[rgba(148,163,184,0.16)] sm:pr-6" : ""}`}
                  >
                    <p className="font-[var(--font-display)] text-[1.7rem] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                      {item.title}
                    </p>
                    <p className="text-sm text-[var(--fm-text-muted)]">{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <p data-auth-panel className="max-w-xl text-sm text-[var(--fm-text-muted)]">
            Tus datos viven en tu cuenta. Entra cuando quieras desde cualquier dispositivo.
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          {status === "loading" ? (
            <FinanceShimmer className="h-[31rem] w-full max-w-[28rem] rounded-[32px]" />
          ) : (
            <div
              data-auth-panel
              className="w-full max-w-[28rem] rounded-[32px] border border-[rgba(148,163,184,0.16)] bg-[linear-gradient(180deg,rgba(28,38,57,0.98),rgba(20,29,44,0.98))] px-7 py-8 shadow-[0_28px_80px_rgb(7_11_18/0.42)]"
            >
              <div className="mx-auto mb-8 h-1 w-12 rounded-full bg-[rgba(228,179,99,0.62)]" />

              <div className="space-y-3 text-center">
                <h2 className="font-[var(--font-display)] text-[2.15rem] font-semibold tracking-[-0.03em] text-[var(--fm-warm-paper)]">
                  Inicia sesi&oacute;n
                </h2>
                <p className="text-base text-[var(--fm-text-soft)]">
                  Entra o crea tu cuenta con Google.
                </p>
              </div>

              <div className="mt-8 space-y-5">
                <button
                  className="group flex min-h-14 w-full cursor-pointer items-center justify-between rounded-[20px] bg-[var(--fm-pending)] px-5 text-left text-[1.05rem] font-semibold text-[#25170a] shadow-[0_18px_36px_rgb(228_179_99/0.2)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting}
                  onClick={() => handleSignIn(false)}
                  type="button"
                >
                  <span className="flex items-center gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-[0_10px_24px_rgb(255_255_255/0.24)]">
                      <Image src="/brand/google-logo.svg" alt="" width={20} height={20} className="h-5 w-5" aria-hidden />
                    </span>
                    <span>{isSubmitting ? "Conectando..." : "Continuar con Google"}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                </button>

                <button
                  className="mx-auto flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--fm-text-soft)] transition-colors hover:text-[var(--fm-warm-paper)] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting}
                  onClick={() => handleSignIn(true)}
                  type="button"
                >
                  <span>Usar otra cuenta de Google</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {errorMessage ? (
                <div className="mt-6">
                  <EmptyState title="Error de acceso" description={errorMessage} />
                </div>
              ) : null}

              <div className="mt-7 border-t border-[rgba(148,163,184,0.14)] pt-6">
                <div className="flex items-start gap-3 text-sm text-[var(--fm-text-muted)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[var(--fm-account-savings)]" />
                  <p>
                    Solo necesitas tu cuenta de Google. No pedimos contrase&ntilde;as ni datos bancarios.
                  </p>
                </div>
              </div>

              <p className="mt-8 text-center text-xs leading-6 text-[var(--fm-text-muted)]">
                Al continuar aceptas los{" "}
                <span className="cursor-pointer underline underline-offset-4">T&eacute;rminos</span> y la{" "}
                <span className="cursor-pointer underline underline-offset-4">Pol&iacute;tica de privacidad</span>.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
