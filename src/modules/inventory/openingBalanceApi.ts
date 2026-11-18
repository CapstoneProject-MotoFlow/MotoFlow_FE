export type OpeningCostsResponse = {
  stockCountId: number
  complete: boolean
  missingSkus: string[]
  totalValue: number
  parts: {
    productId: number
    sku: string
    partName: string
    baseUnit: string
    initialUnitCost: number | null
    locked: boolean
    quantity: number
    value: number | null
    lots: {
      expiryDate: string | null
      quantity: number
      damagedQty: number
      value: number | null
    }[]
  }[]
}
