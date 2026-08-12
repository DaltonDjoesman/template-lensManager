/** Storage singleton key for company settings. */
export const COMPANY_SETTINGS_PATH = {
  collection: 'settings',
  docId: 'company',
} as const

export interface CompanySettings {
  name: string
  nif: string
  address: string
  phone: string
  email: string
  mdrNote: string
  ivaNote: string
}

/** Neutral placeholders for the portfolio demo (no real company identity). */
export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: 'Lens Manager Demo',
  nif: 'PT 000000000',
  address: '123 Demo Street | 1000-000 Demo City',
  phone: '+351 000 000 000',
  email: 'demo@lensmanager.example',
  mdrNote:
    'Dispositivos Médicos de Classe I sob o Regulamento (UE) 2017/745 (MDR).',
  ivaNote:
    'Isenção/Redução de IVA aplicada: Taxa Reduzida de 6% (Verba 2.1 Lista I anexa ao CIVA).',
}
