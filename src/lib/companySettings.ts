import { storage, STORAGE_SINGLETONS } from './storage'
import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from '../types/companySettings'

export async function loadCompanySettings(): Promise<CompanySettings> {
  const data = await storage.getSingleton(STORAGE_SINGLETONS.company)
  if (!data) {
    return { ...DEFAULT_COMPANY_SETTINGS }
  }
  const partial = data as Partial<CompanySettings>
  return {
    ...DEFAULT_COMPANY_SETTINGS,
    ...partial,
    name: partial.name?.trim() || DEFAULT_COMPANY_SETTINGS.name,
    nif: partial.nif?.trim() || DEFAULT_COMPANY_SETTINGS.nif,
    address: partial.address?.trim() || DEFAULT_COMPANY_SETTINGS.address,
    phone: partial.phone?.trim() || DEFAULT_COMPANY_SETTINGS.phone,
    email: partial.email?.trim() || DEFAULT_COMPANY_SETTINGS.email,
    mdrNote: partial.mdrNote?.trim() || DEFAULT_COMPANY_SETTINGS.mdrNote,
    ivaNote: partial.ivaNote?.trim() || DEFAULT_COMPANY_SETTINGS.ivaNote,
    iban: partial.iban?.trim() || DEFAULT_COMPANY_SETTINGS.iban,
    bankName: partial.bankName?.trim() || DEFAULT_COMPANY_SETTINGS.bankName,
    accountHolder:
      partial.accountHolder?.trim() || DEFAULT_COMPANY_SETTINGS.accountHolder,
  }
}

export async function saveCompanySettings(
  settings: CompanySettings,
): Promise<void> {
  await storage.setSingleton(STORAGE_SINGLETONS.company, { ...settings })
}
