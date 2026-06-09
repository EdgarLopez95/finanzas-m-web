"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/finance/empty-state";
import { FinanceButton } from "@/components/finance/finance-button";
import { FinanceCard } from "@/components/finance/finance-card";
import { FinanceShimmer } from "@/components/finance/finance-shimmer";
import { forceGoogleAccountSelection, signInWithGoogle } from "@/features/auth/auth-service";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useAuthBootstrap();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  const handleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      forceGoogleAccountSelection();
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex justify-center">
        <Image
          src="/brand/logo-white-text.svg"
          alt="Finanzas M"
          width={208}
          height={42}
          priority
          className="h-auto w-52"
        />
      </div>
      {status === "loading" ? (
        <FinanceShimmer className="h-56 w-full" />
      ) : (
        <FinanceCard className="w-full" title="Iniciar sesion" subtitle="Accede con tu cuenta de Google para continuar" variant="elevated">
          <div className="flex flex-col gap-4">
            <FinanceButton disabled={isSubmitting} onClick={handleSignIn} tone="filled">
              {isSubmitting ? "Conectando..." : "Continuar con Google"}
            </FinanceButton>
            {errorMessage ? <EmptyState title="Error de acceso" description={errorMessage} /> : null}
          </div>
        </FinanceCard>
      )}
    </main>
  );
}
