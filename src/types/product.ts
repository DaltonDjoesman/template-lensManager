/** Storage collection key: products/{productId} */
export const PRODUCTS_COLLECTION = 'products' as const

/** Catalog lens SKU with unit price and SPH/CYL amplitude ranges. */
export interface Product {
  id: string
  sku: string
  description: string
  unitPrice: number
  sphMin: number
  sphMax: number
  cylMin: number
  cylMax: number
}

export type ProductInput = Omit<Product, 'id'>

export function emptyProductInput(): ProductInput {
  return {
    sku: '',
    description: '',
    unitPrice: 0,
    sphMin: 0,
    sphMax: 0,
    cylMin: 0,
    cylMax: 0,
  }
}
