export const NAV_ITEMS = [
  {
    to: '/pedidos',
    label: 'Orders',
    desktopLabel: 'Orders',
    icon: 'orders' as const,
  },
  {
    to: '/clientes',
    label: 'Clients',
    desktopLabel: 'Clients',
    icon: 'clients' as const,
  },
  {
    to: '/catalogo',
    label: 'Catalog',
    desktopLabel: 'Catalog',
    icon: 'catalog' as const,
  },
  {
    to: '/relatorios/vendas-por-sku',
    label: 'Reports',
    desktopLabel: 'Sales by SKU',
    icon: 'reports' as const,
  },
  {
    to: '/definicoes',
    label: 'Settings',
    desktopLabel: 'Settings',
    icon: 'settings' as const,
  },
] as const
