type SettingsLayoutProps = {
  /** Hero de identidad (y, en Personal, resumen del Hogar unificado). */
  profileBlock: React.ReactNode;
  /** Bloque Hogar opcional. Si es null, el hero ya lo absorbió. */
  householdBlock?: React.ReactNode;
  organizationBlock: React.ReactNode;
  /** Diagnóstico exclusivo de desarrollo/QA. `null` en producción. */
  qaBlock?: React.ReactNode;
  footerBlock: React.ReactNode;
};

export function SettingsLayout({
  profileBlock,
  householdBlock,
  organizationBlock,
  qaBlock,
  footerBlock,
}: SettingsLayoutProps) {
  return (
    <div className="w-full space-y-6">
      {profileBlock}

      {householdBlock ? householdBlock : null}

      <div className="min-w-0">{organizationBlock}</div>

      {qaBlock ? <div className="min-w-0">{qaBlock}</div> : null}

      <div className="pt-2">{footerBlock}</div>
    </div>
  );
}
