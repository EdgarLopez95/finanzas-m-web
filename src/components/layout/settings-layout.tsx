type SettingsLayoutProps = {
  /** Hero de identidad (y, en Personal, resumen del Hogar unificado). */
  profileBlock: React.ReactNode;
  /** Bloque Hogar opcional. Si es null, el hero ya lo absorbió. */
  householdBlock?: React.ReactNode;
  preferencesBlock: React.ReactNode;
  organizationBlock: React.ReactNode;
  footerBlock: React.ReactNode;
};

export function SettingsLayout({
  profileBlock,
  householdBlock,
  preferencesBlock,
  organizationBlock,
  footerBlock,
}: SettingsLayoutProps) {
  return (
    <div className="w-full space-y-6">
      {profileBlock}

      {householdBlock ? householdBlock : null}

      <div className="grid items-stretch gap-6 md:grid-cols-2">
        <div className="h-full min-w-0">{preferencesBlock}</div>
        <div className="h-full min-w-0">{organizationBlock}</div>
      </div>

      <div className="pt-2">{footerBlock}</div>
    </div>
  );
}
