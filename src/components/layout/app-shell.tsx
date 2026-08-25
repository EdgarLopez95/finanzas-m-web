"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { useFocusTrap } from "@/features/household/hooks/use-focus-trap";
import { resolveInitialDrawerFocus } from "@/lib/a11y/dialog-focus";

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
  userPhotoURL?: string | null;
  movementCount?: number;
  context?: "personal" | "household";
};

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  userName,
  userEmail,
  userPhotoURL,
  movementCount,
  context,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useFocusTrap(mobileDrawerRef, mobileNavOpen, () => setMobileNavOpen(false));

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const container = mobileDrawerRef.current;
    if (!container) return;

    const initialElement = resolveInitialDrawerFocus(container);
    initialElement?.focus();
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    <div className="finance-shell-noise min-h-screen" data-fm-context={context}>
      {/* Drawer móvil accesible */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop con desenfoque */}
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Panel lateral móvil */}
          <div
            ref={mobileDrawerRef}
            aria-label="Navegación principal"
            aria-modal="true"
            className="fixed inset-y-0 left-0 z-50 flex h-full w-[280px] max-w-[85vw] flex-col shadow-2xl transition-transform"
            id="mobile-navigation"
            role="dialog"
          >
            <Sidebar
              isMobile
              movementCount={movementCount}
              onClose={() => setMobileNavOpen(false)}
              onNavigate={() => setMobileNavOpen(false)}
              userEmail={userEmail}
              userName={userName}
              userPhotoURL={userPhotoURL}
            />
          </div>
        </div>
      )}

      <div
        ref={shellRef}
        className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]"
      >
        <div data-shell-sidebar className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
          <Sidebar movementCount={movementCount} userEmail={userEmail} userName={userName} userPhotoURL={userPhotoURL} />
        </div>

        <div className="min-w-0 flex flex-col min-h-screen">
          <div data-shell-topbar className="sticky top-0 z-40">
            <TopBar
              actions={actions}
              context={context}
              isMenuOpen={mobileNavOpen}
              onMenuClick={() => setMobileNavOpen((prev) => !prev)}
              subtitle={subtitle}
              title={title}
            />
          </div>
          <main
            id="main-content"
            data-shell-content
            className="flex-1 space-y-5 px-4 py-4 md:px-6 lg:px-8 lg:py-5 flex flex-col min-h-0"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
