/** Storage collection key: clients/{clientId} */
export const CLIENTS_COLLECTION = 'clients' as const

export const DEFAULT_DELIVERY_LOCATION_LABEL = 'Primary delivery' as const

export interface ClientBilling {
  name: string
  nif: string
  contactName: string
  phone: string
  email: string
  address: string
}

/** Named Ship To destination embedded on a client document. */
export interface ClientDeliveryLocation {
  id: string
  label: string
  recipient: string
  careOf: string
  phone: string
  address: string
  postalCode: string
  isPrimary: boolean
}

/** Either percent, amount, both, or neither */
export interface DefaultDiscount {
  percent?: number
  amountEur?: number
}

export interface Client {
  id: string
  billing: ClientBilling
  deliveryLocations: ClientDeliveryLocation[]
  defaultDiscount: DefaultDiscount
}

export type ClientInput = Omit<Client, 'id'>

export const EMPTY_CLIENT_BILLING: ClientBilling = {
  name: '',
  nif: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
}

export const EMPTY_DEFAULT_DISCOUNT: DefaultDiscount = {}

export function createDeliveryLocation(
  overrides: Partial<ClientDeliveryLocation> = {},
): ClientDeliveryLocation {
  return {
    id: crypto.randomUUID(),
    label: '',
    recipient: '',
    careOf: '',
    phone: '',
    address: '',
    postalCode: '',
    isPrimary: false,
    ...overrides,
  }
}

export function emptyClientInput(): ClientInput {
  return {
    billing: { ...EMPTY_CLIENT_BILLING },
    deliveryLocations: [],
    defaultDiscount: { ...EMPTY_DEFAULT_DISCOUNT },
  }
}
