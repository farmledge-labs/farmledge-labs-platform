import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TokenRecord } from '@farmledge/shared'
import {
  formatBags,
  formatCommodity,
  formatDate,
  formatTokenId,
  formatWeight,
} from '../../utils/formatters.js'

export const generateWarehouseReceiptPdf = async (token: TokenRecord): Promise<Buffer> => {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const { width, height } = page.getSize()

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: rgb(0.12, 0.22, 0.42),
    borderWidth: 2,
  })

  page.drawText('Warehouse Receipt Certificate', {
    x: 56,
    y: height - 72,
    size: 24,
    font: boldFont,
    color: rgb(0.12, 0.22, 0.42),
  })

  page.drawText('Issued by FarmLedger Custodian', {
    x: 56,
    y: height - 102,
    size: 12,
    font: regularFont,
    color: rgb(0.35, 0.35, 0.35),
  })

  const rows = [
    ['Token ID', formatTokenId(token.token_id)],
    ['Farmer', token.farmer_id],
    ['Warehouse', token.warehouse_name],
    ['Commodity', formatCommodity(token.commodity)],
    ['Grade', token.grade],
    ['Bags', formatBags(token.bag_count, token.weight_per_bag_kg)],
    ['Total Weight', formatWeight(token.total_weight_kg)],
    ['Deposit Date', formatDate(token.deposit_date)],
    ['Status', token.status],
    ['Custodian Wallet', token.custodian_wallet],
    ['Transaction Hash', token.tx_hash],
    ['Explorer', token.stellar_explorer_link],
  ] as const

  let y = height - 150
  rows.forEach(([label, value]) => {
    page.drawText(`${label}:`, {
      x: 56,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    })
    page.drawText(value, {
      x: 180,
      y,
      size: 12,
      font: regularFont,
      color: rgb(0.2, 0.2, 0.2),
    })
    y -= 20
  })

  page.drawText('This certificate confirms the warehouse receipt token details above.', {
    x: 56,
    y: 120,
    size: 11,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  })

  page.drawText('Verified and issued through the FarmLedger platform.', {
    x: 56,
    y: 96,
    size: 11,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
