import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from 'pdfmake/interfaces'
import { formatEur, formatOrderDate, formatOrderDateTime } from './orders'
import { paymentTermsLabel, normalizePaymentTerms } from '../types/client'
import { DEFAULT_COMPANY_SETTINGS } from '../types/companySettings'
import {
  computeLineNetContributions,
  computeOrderTotals,
  formatDiopterTwoDecimals,
  formatLineDiscountLabel,
  type Order,
} from '../types/order'

export type OrderDocumentKind = 'pedido' | 'proforma'

/** Light paper palette — navy / ice (no teal). */
const COLORS = {
  navy: '#1B3A5F',
  muted: '#64748B',
  ice: '#94A3B8',
  border: '#CBD5E1',
  panelBg: '#F1F5F9',
  headerText: '#FFFFFF',
  body: '#0F172A',
  disclaimer: '#B45309',
}

const SKONTO_RATE = 0.03
const LOGO_FIT: [number, number] = [36, 36]

type PdfMakeApi = {
  addVirtualFileSystem: (vfs: unknown) => void
  createPdf: (doc: TDocumentDefinitions) => {
    download: (filename?: string) => Promise<void>
  }
}

let pdfReady: Promise<PdfMakeApi> | null = null
let logoDataUrlReady: Promise<string | null> | null = null

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

/** PWA icon already in this repo — never a company logo asset. */
async function loadLogoDataUrl(): Promise<string | null> {
  if (!logoDataUrlReady) {
    logoDataUrlReady = (async () => {
      try {
        const base = import.meta.env.BASE_URL ?? '/'
        const res = await fetch(`${base}icons/icon-192.png`)
        if (!res.ok) return null
        const blob = await res.blob()
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () =>
            reject(reader.error ?? new Error('Failed to read demo logo.'))
          reader.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    })()
  }
  return logoDataUrlReady
}

function money(value: number): string {
  return formatEur(value)
}

type TextLineOpts = {
  fontSize?: number
  color?: string
  bold?: boolean
  margin?: [number, number, number, number]
}

/** Omit empty optional fields instead of printing a dash placeholder. */
function lineIf(
  text: string | undefined | null,
  opts: TextLineOpts = {},
): Content | null {
  const value = text?.trim()
  if (!value) return null
  return {
    text: value,
    fontSize: opts.fontSize ?? 9,
    color: opts.color ?? COLORS.body,
    bold: opts.bold,
    margin: opts.margin ?? [0, 1, 0, 1],
  }
}

function compactStack(items: Array<Content | null | undefined>): Content[] {
  return items.filter((item): item is Content => item != null)
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

function buildBrandRow(order: Order, logoDataUrl?: string): Content {
  const c = order.company
  const contactBits = [
    c.nif ? `Tax ID: ${c.nif}` : '',
    c.email ? `Email: ${c.email}` : '',
    c.phone ? `Tel: ${c.phone}` : '',
  ]
    .filter(Boolean)
    .join('  |  ')

  const stack = compactStack([
    {
      text: c.name || DEFAULT_COMPANY_SETTINGS.name,
      fontSize: 13,
      bold: true,
      color: COLORS.navy,
    },
    lineIf(c.address, {
      fontSize: 8,
      color: COLORS.muted,
      margin: [0, 2, 0, 0],
    }),
    contactBits
      ? {
          text: contactBits,
          fontSize: 8,
          color: COLORS.muted,
          margin: [0, 1, 0, 0],
        }
      : null,
  ])

  if (!logoDataUrl) {
    return {
      stack,
      margin: [0, 0, 0, 10],
    }
  }

  return {
    columns: [
      {
        width: LOGO_FIT[0] + 6,
        image: 'logo',
        fit: LOGO_FIT,
        margin: [0, 1, 6, 0],
      },
      {
        width: '*',
        stack,
      },
    ],
    columnGap: 4,
    margin: [0, 0, 0, 10],
  }
}

function formatClientPo(clientPo: string | undefined): string | null {
  const raw = clientPo?.trim()
  if (!raw) return null
  return `PO${raw.replace(/^PO/i, '')}`
}

function buildIdentityStack(order: Order, kind: OrderDocumentKind): Content {
  const po = formatClientPo(order.clientPo)
  const termsLabel = paymentTermsLabel(normalizePaymentTerms(order.paymentTerms))

  if (kind === 'proforma') {
    const pfNumber = order.pfNumber ?? 'PF-…'
    const dateValue = order.pfIssuedAt
      ? formatOrderDateTime(order.pfIssuedAt)
      : formatOrderDate(order.orderDate)

    return {
      alignment: 'right',
      stack: compactStack([
        {
          text: [
            {
              text: 'PROFORMA',
              fontSize: 12,
              bold: true,
              color: COLORS.navy,
            },
            { text: '  ', fontSize: 12 },
            {
              text: pfNumber,
              fontSize: 16,
              bold: true,
              color: COLORS.navy,
            },
          ],
          margin: [0, 0, 0, 4],
        },
        {
          text: [
            { text: 'Issue date: ', bold: true, color: COLORS.navy },
            { text: dateValue, color: COLORS.body },
          ],
          fontSize: 9,
          margin: [0, 2, 0, 0],
        },
        po
          ? {
              text: [
                { text: 'Customer PO: ', bold: true, color: COLORS.navy },
                { text: po, color: COLORS.body },
              ],
              fontSize: 9,
              margin: [0, 2, 0, 0],
            }
          : null,
      ]),
      margin: [0, 0, 0, 14],
    }
  }

  const pedNumber = order.pedNumber?.trim() || 'Draft'
  const dateValue = order.confirmedAt
    ? formatOrderDateTime(order.confirmedAt)
    : formatOrderDate(order.orderDate)

  return {
    alignment: 'right',
    stack: compactStack([
      {
        text: 'ORDER',
        fontSize: 14,
        bold: true,
        color: COLORS.navy,
      },
      {
        text: [
          { text: 'Order No.: ', bold: true, color: COLORS.navy },
          { text: pedNumber, color: COLORS.body },
        ],
        fontSize: 9,
        margin: [0, 6, 0, 0],
      },
      {
        text: [
          { text: 'Issue date: ', bold: true, color: COLORS.navy },
          { text: dateValue, color: COLORS.body },
        ],
        fontSize: 9,
        margin: [0, 2, 0, 0],
      },
      {
        text: [
          { text: 'Payment: ', bold: true, color: COLORS.navy },
          { text: termsLabel, color: COLORS.body },
        ],
        fontSize: 9,
        margin: [0, 2, 0, 0],
      },
      po
        ? {
            text: [
              { text: 'Customer PO: ', bold: true, color: COLORS.navy },
              { text: po, color: COLORS.body },
            ],
            fontSize: 9,
            margin: [0, 2, 0, 0],
          }
        : null,
    ]),
    margin: [0, 0, 0, 14],
  }
}

function buildHeader(
  order: Order,
  kind: OrderDocumentKind,
  logoDataUrl?: string,
): Content {
  return {
    stack: [buildBrandRow(order, logoDataUrl), buildIdentityStack(order, kind)],
  }
}

function buildAddressColumns(order: Order): Content {
  const billingStack: Content[] = compactStack([
    {
      text: 'Billing',
      bold: true,
      fontSize: 9,
      color: COLORS.navy,
      margin: [0, 0, 0, 4],
    },
    lineIf(order.billing.name, { bold: true }),
    lineIf(order.billing.nif ? `Tax ID: ${order.billing.nif}` : null),
    lineIf(order.billing.contactName),
    lineIf(order.billing.phone),
    lineIf(order.billing.email),
    lineIf(order.billing.address),
  ])

  const shippingStack: Content[] = compactStack([
    {
      text: 'Delivery',
      bold: true,
      fontSize: 9,
      color: COLORS.navy,
      margin: [0, 0, 0, 4],
    },
    lineIf(order.shipping.recipient, { bold: true }),
    lineIf(order.shipping.careOf ? `C/O: ${order.shipping.careOf}` : null),
    lineIf(order.shipping.phone),
    lineIf(order.shipping.address),
    lineIf(order.shipping.postalCode),
  ])

  return {
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

function buildFooterNotesAndTotals(order: Order): Content {
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

function buildPaymentBankBlock(order: Order): Content {
  const totals = computeOrderTotals(order.lines, order.orderDiscount)
  const terms = normalizePaymentTerms(order.paymentTerms)
  const c = order.company
  const iban = c.iban?.trim() || DEFAULT_COMPANY_SETTINGS.iban
  const bankName = c.bankName?.trim() || DEFAULT_COMPANY_SETTINGS.bankName
  const accountHolder =
    c.accountHolder?.trim() || DEFAULT_COMPANY_SETTINGS.accountHolder
  const nif = c.nif?.trim() || DEFAULT_COMPANY_SETTINGS.nif
  const bankLine = `IBAN ${iban} | Bank: ${bankName} | Account holder: ${accountHolder} (Tax ID: ${nif})`
  const email = c.email?.trim() || DEFAULT_COMPANY_SETTINGS.email
  const phone = c.phone?.trim() || DEFAULT_COMPANY_SETTINGS.phone
  const docNumber = order.pfNumber ?? '—'
  const termsLabel = paymentTermsLabel(terms)

  const stack: Content[] = [
    {
      text: 'Payment terms and bank details',
      bold: true,
      fontSize: 9,
      color: COLORS.navy,
      margin: [0, 0, 0, 4],
    },
    {
      text: [
        { text: 'Payment terms: ', bold: true, color: COLORS.navy },
        { text: termsLabel, color: COLORS.body },
      ],
      fontSize: 8,
      margin: [0, 0, 0, 6],
    },
  ]

  if (terms === 'net_30') {
    const skontoNet = money(totals.subtotalNet * (1 - SKONTO_RATE))
    const skontoWithVat = money(totals.totalWithVat * (1 - SKONTO_RATE))
    stack.push(
      {
        text: [
          { text: 'Due: ', bold: true, color: COLORS.navy },
          {
            text: 'Net 30 from the issue date.',
            color: COLORS.body,
          },
        ],
        fontSize: 8,
        margin: [0, 0, 0, 3],
      },
      {
        text: [
          {
            text: 'Early payment (3% discount): ',
            bold: true,
            color: COLORS.navy,
          },
          {
            text: `Discounted amount: ${skontoNet} (ex. VAT) | ${skontoWithVat} (inc. VAT), if settled within 48h of this document.`,
            color: COLORS.body,
          },
        ],
        fontSize: 8,
        margin: [0, 0, 0, 3],
      },
      {
        text: [
          { text: 'Bank details: ', bold: true, color: COLORS.navy },
          { text: bankLine, color: COLORS.body },
        ],
        fontSize: 8,
        margin: [0, 0, 0, 3],
      },
      {
        text: `(Include this Proforma number (${docNumber}) in the transfer description and send the receipt to ${email})`,
        fontSize: 7.5,
        italics: true,
        color: COLORS.muted,
        margin: [0, 2, 0, 0],
      },
    )
  } else {
    stack.push(
      {
        text: [
          { text: 'Due: ', bold: true, color: COLORS.navy },
          {
            text: 'Due on receipt (settlement before dispatch).',
            color: COLORS.body,
          },
        ],
        fontSize: 8,
        margin: [0, 0, 0, 3],
      },
      {
        text: [
          { text: 'Amount due: ', bold: true, color: COLORS.navy },
          { text: money(totals.totalWithVat), color: COLORS.body },
        ],
        fontSize: 8,
        margin: [0, 0, 0, 3],
      },
      {
        text: [
          { text: 'Bank details: ', bold: true, color: COLORS.navy },
          { text: bankLine, color: COLORS.body },
        ],
        fontSize: 8,
        margin: [0, 0, 0, 3],
      },
      {
        text: `(Send the receipt to ${email} or WhatsApp ${phone} for immediate dispatch)`,
        fontSize: 7.5,
        italics: true,
        color: COLORS.muted,
        margin: [0, 2, 0, 0],
      },
    )
  }

  stack.push({
    text: 'This document is not a tax invoice.',
    bold: true,
    fontSize: 9,
    color: COLORS.disclaimer,
    margin: [0, 8, 0, 0],
  })

  return {
    table: {
      widths: ['*'],
      body: [[{ stack, fillColor: COLORS.panelBg }]],
    },
    layout: panelLayout(),
    margin: [0, 0, 0, 14],
  }
}

export function buildOrderPdfDefinition(
  order: Order,
  kind: OrderDocumentKind,
  logoDataUrl?: string,
): TDocumentDefinitions {
  const content: Content[] = [
    buildHeader(order, kind, logoDataUrl),
    buildAddressColumns(order),
    buildLineTable(order),
  ]

  if (kind === 'proforma') {
    content.push(buildPaymentBankBlock(order))
  }

  content.push(buildFooterNotesAndTotals(order))

  return {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 36],
    content,
    ...(logoDataUrl ? { images: { logo: logoDataUrl } } : {}),
    styles: {
      sectionTitle: {
        fontSize: 10,
        bold: true,
        color: COLORS.navy,
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
  const [pdfMake, logoDataUrl] = await Promise.all([
    loadPdfMake(),
    loadLogoDataUrl(),
  ])
  const definition = buildOrderPdfDefinition(
    order,
    kind,
    logoDataUrl ?? undefined,
  )
  const docNumber =
    kind === 'proforma'
      ? (order.pfNumber ?? 'proforma')
      : (order.pedNumber ?? `draft-${order.id.slice(0, 8)}`)
  const filename = `${kind === 'proforma' ? 'PF' : 'PED'}_${docNumber}.pdf`

  const pdf = pdfMake.createPdf(definition)
  await pdf.download(filename)
}
