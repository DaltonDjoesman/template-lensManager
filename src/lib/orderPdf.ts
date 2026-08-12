import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from 'pdfmake/interfaces'
import { formatEur, formatOrderDate } from './orders'
import {
  computeLineNetContributions,
  computeOrderTotals,
  formatDiopterTwoDecimals,
  formatLineDiscountLabel,
  type Order,
} from '../types/order'

export type OrderDocumentKind = 'pedido' | 'proforma'

/** Colors aligned with the order document layout. */
const COLORS = {
  navy: '#1B3A5F',
  teal: '#0D9488',
  muted: '#64748B',
  border: '#CBD5E1',
  panelBg: '#F1F5F9',
  headerText: '#FFFFFF',
  body: '#0F172A',
  disclaimer: '#B45309',
}

type PdfMakeApi = {
  addVirtualFileSystem: (vfs: unknown) => void
  createPdf: (doc: TDocumentDefinitions) => {
    download: (filename?: string) => Promise<void>
  }
}

let pdfReady: Promise<PdfMakeApi> | null = null

function resolvePdfMake(mod: unknown): PdfMakeApi {
  const record = mod as Record<string, unknown>
  const candidate = (record.default ?? record) as PdfMakeApi
  if (typeof candidate?.createPdf !== 'function') {
    throw new Error('Failed to load pdfmake (createPdf missing).')
  }
  return candidate
}

function resolveVfs(mod: unknown): unknown {
  const record = mod as Record<string, unknown>
  const vfs = record.default ?? record
  if (
    vfs &&
    typeof vfs === 'object' &&
    'pdfMake' in vfs &&
    (vfs as { pdfMake?: { vfs?: unknown } }).pdfMake?.vfs
  ) {
    return (vfs as { pdfMake: { vfs: unknown } }).pdfMake.vfs
  }
  return vfs
}

async function loadPdfMake(): Promise<PdfMakeApi> {
  if (!pdfReady) {
    pdfReady = (async () => {
      const pdfMakeMod = await import('pdfmake/build/pdfmake')
      const fontsMod = await import('pdfmake/build/vfs_fonts')
      const pdfMake = resolvePdfMake(pdfMakeMod)
      const vfs = resolveVfs(fontsMod)

      if (typeof pdfMake.addVirtualFileSystem === 'function') {
        pdfMake.addVirtualFileSystem(vfs)
      } else {
        throw new Error(
          'Failed to load pdfmake (addVirtualFileSystem missing).',
        )
      }

      return pdfMake
    })()
  }
  return pdfReady
}

function money(value: number): string {
  return formatEur(value)
}

function labeledLine(label: string, value: string): Content {
  return {
    text: [
      { text: `${label} `, bold: true, color: COLORS.navy },
      { text: value || '—', color: COLORS.body },
    ],
    fontSize: 9,
    margin: [0, 1, 0, 1],
  }
}

function panelLayout() {
  return {
    hLineWidth: () => 1,
    vLineWidth: () => 1,
    hLineColor: () => COLORS.border,
    vLineColor: () => COLORS.border,
    paddingLeft: () => 10,
    paddingRight: () => 10,
    paddingTop: () => 8,
    paddingBottom: () => 8,
  }
}

function buildHeader(order: Order, kind: OrderDocumentKind): Content {
  const docNumber =
    kind === 'proforma'
      ? (order.pfNumber ?? 'PF-…')
      : (order.pedNumber ?? 'Draft')
  const title = kind === 'proforma' ? 'PROFORMA' : 'CUSTOMER ORDER'
  const c = order.company

  return {
    columns: [
      {
        width: '*',
        stack: [
          {
            text: c.name || 'Lens Manager Demo',
            fontSize: 13,
            bold: true,
            color: COLORS.navy,
          },
          {
            text: c.address || '',
            fontSize: 8,
            color: COLORS.muted,
            margin: [0, 3, 0, 0],
          },
          {
            text: [
              c.nif ? `Tax ID: ${c.nif}` : '',
              c.email ? `Email: ${c.email}` : '',
              c.phone ? `Tel: ${c.phone}` : '',
            ]
              .filter(Boolean)
              .join('  |  '),
            fontSize: 8,
            color: COLORS.muted,
            margin: [0, 2, 0, 0],
          },
        ],
      },
      {
        width: 200,
        alignment: 'right' as const,
        stack: [
          {
            text: title,
            fontSize: 14,
            bold: true,
            color: COLORS.teal,
          },
          {
            text: [
              { text: 'Order No.: ', bold: true, color: COLORS.navy },
              { text: docNumber, color: COLORS.body },
            ],
            fontSize: 9,
            margin: [0, 8, 0, 0],
          },
          {
            text: [
              { text: 'Date: ', bold: true, color: COLORS.navy },
              { text: formatOrderDate(order.orderDate), color: COLORS.body },
            ],
            fontSize: 9,
            margin: [0, 2, 0, 0],
          },
          {
            text: [
              { text: 'Customer PO: ', bold: true, color: COLORS.navy },
              {
                text: order.clientPo
                  ? `PO${order.clientPo.replace(/^PO/i, '')}`
                  : '—',
                color: COLORS.body,
              },
            ],
            fontSize: 9,
            margin: [0, 2, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 0, 0, 14],
  }
}

function buildClientDeliveryPanel(order: Order): Content {
  const billingStack: Content[] = [
    {
      text: 'BILLING DETAILS:',
      bold: true,
      fontSize: 9,
      color: COLORS.navy,
      margin: [0, 0, 0, 4],
    },
    labeledLine('Customer:', order.billing.name),
    labeledLine('Tax ID:', order.billing.nif),
    labeledLine('Contact (required):', order.billing.contactName),
    labeledLine('Phone:', order.billing.phone),
    labeledLine('Email:', order.billing.email),
    labeledLine('Address:', order.billing.address),
  ]

  const shippingStack: Content[] = [
    {
      text: 'DELIVERY LOCATION (SHIP TO):',
      bold: true,
      fontSize: 9,
      color: COLORS.navy,
      margin: [0, 0, 0, 4],
    },
    labeledLine('Recipient:', order.shipping.recipient),
    labeledLine('C/O:', order.shipping.careOf),
    labeledLine('Local phone:', order.shipping.phone),
    labeledLine('Address:', order.shipping.address),
    labeledLine('Postal code:', order.shipping.postalCode),
  ]

  return {
    stack: [
      {
        text: 'CUSTOMER & DELIVERY',
        style: 'sectionTitle',
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { stack: billingStack, border: [true, true, true, true] },
              { stack: shippingStack, border: [true, true, true, true] },
            ],
          ],
        },
        layout: panelLayout(),
      },
    ],
    margin: [0, 0, 0, 14],
  }
}

function buildLineTable(order: Order): Content {
  const headerCell = (
    text: string,
    alignment: 'left' | 'right' = 'left',
  ): TableCell => ({
    text,
    bold: true,
    fontSize: 8,
    color: COLORS.headerText,
    fillColor: COLORS.navy,
    alignment,
    margin: [0, 3, 0, 3],
  })

  const bodyCell = (
    text: string,
    alignment: 'left' | 'right' = 'left',
  ): TableCell => ({
    text,
    fontSize: 8,
    color: COLORS.body,
    alignment,
    margin: [0, 3, 0, 3],
  })

  const header: TableCell[] = [
    headerCell('SKU / Code'),
    headerCell('Lens description'),
    headerCell('SPH', 'right'),
    headerCell('CYL', 'right'),
    headerCell('Qty', 'right'),
    headerCell('Unit price', 'right'),
    headerCell('Disc. %', 'right'),
    headerCell('Subtotal', 'right'),
  ]

  const contributions = computeLineNetContributions(
    order.lines,
    order.orderDiscount,
  )

  const rows: TableCell[][] =
    contributions.length > 0
      ? contributions.map((contribution) => {
          const { line } = contribution
          return [
            bodyCell(line.lineSku || '—'),
            bodyCell(line.description || line.familySku || '—'),
            bodyCell(formatDiopterTwoDecimals(line.sph), 'right'),
            bodyCell(formatDiopterTwoDecimals(line.cyl), 'right'),
            bodyCell(String(line.qty), 'right'),
            bodyCell(money(line.unitPrice), 'right'),
            bodyCell(formatLineDiscountLabel(contribution, money), 'right'),
            bodyCell(money(contribution.net), 'right'),
          ]
        })
      : [
          [
            {
              text: 'No lines on this order.',
              colSpan: 8,
              alignment: 'center',
              color: COLORS.muted,
              fontSize: 9,
              margin: [0, 8, 0, 8],
            },
            {},
            {},
            {},
            {},
            {},
            {},
            {},
          ],
        ]

  return {
    stack: [
      {
        text: 'ORDER LINES (LENS ITEMS)',
        style: 'sectionTitle',
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 88, 34, 34, 26, 46, 40, 52],
          body: [header, ...rows],
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.4,
          vLineWidth: () => 0,
          hLineColor: () => COLORS.border,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
    ],
    margin: [0, 0, 0, 14],
  }
}

function buildFooterNotesAndTotals(
  order: Order,
  kind: OrderDocumentKind,
): Content {
  const totals = computeOrderTotals(order.lines, order.orderDiscount)

  const notes: Content[] = [
    {
      text: 'NOTES / REGULATORY REMARKS:',
      bold: true,
      fontSize: 8,
      color: COLORS.navy,
      margin: [0, 0, 0, 4],
    },
  ]

  if (order.company.mdrNote.trim()) {
    notes.push({
      text: `• ${order.company.mdrNote.trim()}`,
      fontSize: 7.5,
      color: COLORS.body,
      margin: [0, 0, 0, 2],
    })
  }
  if (order.company.ivaNote.trim()) {
    notes.push({
      text: `• ${order.company.ivaNote.trim()}`,
      fontSize: 7.5,
      color: COLORS.body,
      margin: [0, 0, 0, 2],
    })
  }
  notes.push({
    text: '• Estimated delivery: 24–48 business hours via express carrier, subject to stock availability.',
    fontSize: 7.5,
    color: COLORS.body,
    margin: [0, 0, 0, 2],
  })

  if (order.notes.trim()) {
    notes.push({
      text: `• Order notes: ${order.notes.trim()}`,
      fontSize: 7.5,
      color: COLORS.body,
      margin: [0, 4, 0, 0],
    })
  }

  if (kind === 'proforma') {
    notes.push({
      text: 'This document is not a tax invoice.',
      bold: true,
      fontSize: 9,
      color: COLORS.disclaimer,
      margin: [0, 8, 0, 0],
    })
  }

  const totalsRows: Content[] = [
    {
      columns: [
        {
          width: '*',
          text: 'Total pieces (lenses):',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
        {
          width: 72,
          text: String(totals.pieces),
          alignment: 'right',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
      ],
      margin: [0, 0, 0, 3],
    },
  ]

  if (totals.discountAmount > 0) {
    totalsRows.push({
      columns: [
        {
          width: '*',
          text: 'Discount:',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
        {
          width: 72,
          text: money(totals.discountAmount),
          alignment: 'right',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
      ],
      margin: [0, 0, 0, 3],
    })
  }

  totalsRows.push(
    {
      columns: [
        {
          width: '*',
          text: 'Subtotal (ex. VAT):',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
        {
          width: 72,
          text: money(totals.subtotalNet),
          alignment: 'right',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
      ],
      margin: [0, 0, 0, 3],
    },
    {
      columns: [
        {
          width: '*',
          text: 'VAT (6% reduced):',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
        {
          width: 72,
          text: money(totals.iva),
          alignment: 'right',
          fontSize: 9,
          color: COLORS.body,
          noWrap: true,
        },
      ],
      margin: [0, 0, 0, 6],
    },
    {
      columns: [
        {
          width: '*',
          text: 'ORDER TOTAL (inc. VAT):',
          bold: true,
          fontSize: 10,
          color: COLORS.navy,
          noWrap: true,
        },
        {
          width: 72,
          text: money(totals.totalWithVat),
          alignment: 'right',
          bold: true,
          fontSize: 10,
          color: COLORS.navy,
          noWrap: true,
        },
      ],
    },
  )

  return {
    columns: [
      {
        width: '*',
        stack: notes,
      },
      {
        width: 250,
        table: {
          widths: ['*'],
          body: [[{ stack: totalsRows, fillColor: COLORS.panelBg }]],
        },
        layout: panelLayout(),
      },
    ],
    columnGap: 16,
  }
}

export function buildOrderPdfDefinition(
  order: Order,
  kind: OrderDocumentKind,
): TDocumentDefinitions {
  const content: Content[] = [
    buildHeader(order, kind),
    buildClientDeliveryPanel(order),
    buildLineTable(order),
    buildFooterNotesAndTotals(order, kind),
  ]

  return {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 36],
    content,
    styles: {
      sectionTitle: {
        fontSize: 10,
        bold: true,
        color: COLORS.teal,
      },
    },
    defaultStyle: {
      fontSize: 9,
      color: COLORS.body,
    },
  }
}

/** Generate and download PDF from current order data (no Storage upload). */
export async function downloadOrderPdf(
  order: Order,
  kind: OrderDocumentKind,
): Promise<void> {
  const pdfMake = await loadPdfMake()
  const definition = buildOrderPdfDefinition(order, kind)
  const docNumber =
    kind === 'proforma'
      ? (order.pfNumber ?? 'proforma')
      : (order.pedNumber ?? `draft-${order.id.slice(0, 8)}`)
  const filename = `${kind === 'proforma' ? 'PF' : 'PED'}_${docNumber}.pdf`

  const pdf = pdfMake.createPdf(definition)
  await pdf.download(filename)
}
