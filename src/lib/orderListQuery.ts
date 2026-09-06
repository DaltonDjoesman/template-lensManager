import {
  ORDER_STATUSES,
  computeOrderTotals,
  type Order,
  type OrderStatus,
} from '../types/order'

export interface OrderListFilters {
  statuses?: OrderStatus[]
  clientIds?: string[]
  dateFrom?: string
  dateTo?: string
  search?: string
}

export type OrderSortKey =
  | 'pedNumber'
  | 'clientName'
  | 'orderDate'
  | 'createdAt'
  | 'netTotal'
  | 'status'

export type OrderSortDirection = 'asc' | 'desc'

export interface OrderListSort {
  key: OrderSortKey
  direction: OrderSortDirection
}

export const DEFAULT_ORDER_LIST_SORT: OrderListSort = {
  key: 'createdAt',
  direction: 'desc',
}

export const ORDER_SORT_DEFAULT_DIRECTION: Record<
  OrderSortKey,
  OrderSortDirection
> = {
  pedNumber: 'asc',
  clientName: 'asc',
  orderDate: 'desc',
  createdAt: 'desc',
  netTotal: 'desc',
  status: 'asc',
}

export function filterOrders(
  orders: Order[],
  filters: OrderListFilters,
): Order[] {
  const search = (filters.search ?? '').trim().toLowerCase()
  const statuses = filters.statuses ?? []
  const clientIds = filters.clientIds ?? []

  return orders.filter((order) => {
    if (statuses.length > 0 && !statuses.includes(order.status)) return false
    if (clientIds.length > 0 && !clientIds.includes(order.clientId)) {
      return false
    }

    if (filters.dateFrom && order.orderDate < filters.dateFrom) return false
    if (filters.dateTo && order.orderDate > filters.dateTo) return false

    if (search) {
      const haystack = [
        order.clientName,
        order.clientNif,
        order.clientPo,
        order.pedNumber ?? '',
        order.pfNumber ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }

    return true
  })
}

function netTotal(order: Order): number {
  return computeOrderTotals(order.lines, order.orderDiscount).subtotalNet
}

function statusRank(status: OrderStatus): number {
  const index = ORDER_STATUSES.indexOf(status)
  return index < 0 ? ORDER_STATUSES.length : index
}

function compareValues(
  a: string | number,
  b: string | number,
): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  return String(a).localeCompare(String(b), 'en', { numeric: true })
}

function sortValue(order: Order, key: OrderSortKey): string | number {
  switch (key) {
    case 'pedNumber':
      return order.pedNumber ?? ''
    case 'clientName':
      return order.clientName
    case 'orderDate':
      return order.orderDate
    case 'createdAt':
      return order.createdAt
    case 'netTotal':
      return netTotal(order)
    case 'status':
      return statusRank(order.status)
  }
}

export function sortOrders(
  orders: Order[],
  sort: OrderListSort = DEFAULT_ORDER_LIST_SORT,
): Order[] {
  const dir = sort.direction === 'desc' ? -1 : 1
  return orders
    .map((order, index) => ({ order, index }))
    .sort((left, right) => {
      const cmp = compareValues(
        sortValue(left.order, sort.key),
        sortValue(right.order, sort.key),
      )
      if (cmp !== 0) return cmp * dir
      return left.index - right.index
    })
    .map((row) => row.order)
}

export function applyOrderListQuery(
  orders: Order[],
  filters: OrderListFilters,
  sort: OrderListSort = DEFAULT_ORDER_LIST_SORT,
): Order[] {
  return sortOrders(filterOrders(orders, filters), sort)
}
