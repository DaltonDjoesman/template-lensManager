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
  return {
    ...DEFAULT_COMPANY_SETTINGS,
    ...(data as Partial<CompanySettings>),
  }
}

export async function saveCompanySettings(
  settings: CompanySettings,
): Promise<void> {
  await storage.setSingleton(STORAGE_SINGLETONS.company, { ...settings })
}
