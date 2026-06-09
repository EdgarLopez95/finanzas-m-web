"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

gsap.registerPlugin(useGSAP);

// La animación de entrada del shell solo debe correr en la primera carga de la
// sesión. Sin esto se reproducía completa en cada navegación entre secciones,
// dando la sensación de "demora al cambiar" antes de ver el contenido.
let shellIntroPlayed = false;

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  movementCount?: number;
};

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  userName,
  userEmail,
  movementCount,
}: AppShellProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);

  useGSAP(() => {
    if (shellIntroPlayed) {
      return;
    }
    shellIntroPlayed = true;

    const media = gsap.matchMedia();

    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        if (context.conditions?.reduceMotion) {
          return;
        }

        gsap.from("[data-shell-sidebar]", {
          x: -18,
          autoAlpha: 0,
          duration: 0.65,
          ease: "power3.out",
        });

        gsap.from("[data-shell-topbar]", {
          y: -18,
          autoAlpha: 0,
          duration: 0.6,
          ease: "power3.out",
          delay: 0.08,
        });

        gsap.from("[data-shell-content] > *", {
          y: 18,
          autoAlpha: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.06,
          delay: 0.14,
        });
      },
    );

    return () => media.revert();
  }, { scope: shellRef });

  return (
    <div className="finance-shell-noise min-h-screen">
      <div
        ref={shellRef}
        className="grid min-h-screen grid-cols-1 gap-4 px-3 py-3 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-0 lg:px-0 lg:py-0"
      >
        <div data-shell-sidebar className="lg:sticky lg:top-0 lg:h-screen">
          <Sidebar movementCount={movementCount} userName={userName} userEmail={userEmail} />
        </div>

        <div className="min-w-0 lg:px-4 lg:py-4">
          <div data-shell-topbar className="sticky top-3 z-40 lg:top-4">
            <TopBar actions={actions} subtitle={subtitle} title={title} />
          </div>
          <main
            id="main-content"
            data-shell-content
            className="space-y-5 px-1 py-4 md:px-1 lg:py-5"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
