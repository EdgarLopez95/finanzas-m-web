import { EmptyState } from "@/components/finance/empty-state";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-6">
      <EmptyState
        title="Login placeholder"
        description="La integracion real con Firebase Auth se implementara en una fase posterior."
      />
    </main>
  );
}
