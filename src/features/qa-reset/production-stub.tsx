/**
 * Stub de producción para `@/features/qa-reset`.
 * En builds no-dev, next.config aliasa el feature a este módulo:
 * la UI no monta wipe y no se empaquetan los servicios destructivos.
 */
export const isQaResetToolAvailable = (): boolean => false;

export function QaResetConfirmDialog(_props: {
  open?: boolean;
  onClose?: () => void;
}): null {
  void _props;
  return null;
}
