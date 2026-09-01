import PDFDocument from 'pdfkit'
import type { PatentDocument } from '@/lib/agents'

/**
 * Builds a patent PDF (PDFKit) from a structured PatentDocument plus
 * schematic image (base64 PNG) + genes + hardware tables.
 *
 * Returns a Promise<Buffer> containing the PDF bytes.
 *
 * Fonts used:
 *  - Liberation Serif (headings + body — patent-like serif look)
 *  - Liberation Mono (code / repo names / metrics)
 *  - Liberation Sans (UI labels, captions)
 *
 * All fonts are pre-registered on Linux servers under /usr/share/fonts/truetype/liberation.
 */
export async function buildPatentPdf(args: {
  doc: PatentDocument
  genes: Array<{
    techName: string
    category: string
    role: string
    need?: string
    githubUrl?: string | null
    ahiScore: number
    autonomy: number
    ethics: number
    decentral: number
  }>
  hardware: Array<{
    name: string
    category: string
    vendor?: string | null
    role: string
    rationale?: string
    estimatedCost?: string | null
    alternatives?: string | null
    recommended: boolean
  }>
  ahi: {
    autonomy: number
    ethics: number
    decentral: number
    score: number
    reasoning: string
  }
  schematicImageBase64?: string | null
  originalPrompt: string
}): Promise<Buffer> {
  const { doc, genes, hardware, ahi, schematicImageBase64, originalPrompt } = args

  // Register fonts (Liberation has full Latin-1 + Polish diacritics coverage)
  const FONT_DIR = '/usr/share/fonts/truetype/liberation'
  const SERIF = `${FONT_DIR}/LiberationSerif-Regular.ttf`
  const SERIF_BOLD = `${FONT_DIR}/LiberationSerif-Bold.ttf`
  const SERIF_ITALIC = `${FONT_DIR}/LiberationSerif-Italic.ttf`
  const SANS = `${FONT_DIR}/LiberationSans-Regular.ttf`
  const SANS_BOLD = `${FONT_DIR}/LiberationSans-Bold.ttf`
  const MONO = `${FONT_DIR}/LiberationMono-Regular.ttf`

  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: 64, bottom: 64, left: 64, right: 64 },
    info: {
      Title: doc.title,
      Author: 'Enter — Gene-Driven Invention & Patent Pipeline',
      Subject: doc.abstract.slice(0, 200),
      Keywords: genes.map((g) => g.techName).slice(0, 10).join(', '),
    },
  })

  pdf.registerFont('serif', SERIF)
  pdf.registerFont('serif-bold', SERIF_BOLD)
  pdf.registerFont('serif-italic', SERIF_ITALIC)
  pdf.registerFont('sans', SANS)
  pdf.registerFont('sans-bold', SANS_BOLD)
  pdf.registerFont('mono', MONO)

  // Helpers
  const PAGE_W = pdf.page.width
  const PAGE_H = pdf.page.height
  const MARGIN = 64
  const CONTENT_W = PAGE_W - MARGIN * 2

  // Track current y for paginating — every helper checks + adds new page if needed
  let y = pdf.page.margins.top

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      pdf.addPage()
      y = MARGIN
    }
  }

  const writeHeading = (text: string, size = 14) => {
    ensureSpace(size + 14)
    pdf.font('serif-bold').fontSize(size).fillColor('#0a0a0a')
    pdf.text(text, MARGIN, y, { width: CONTENT_W })
    y = pdf.y + 6
    // Underline
    pdf.strokeColor('#0ea5e9')
    pdf.lineWidth(0.6)
    pdf.moveTo(MARGIN, y).lineTo(MARGIN + 40, y).stroke()
    y += 8
  }

  const writeSubHeading = (text: string, size = 11) => {
    ensureSpace(size + 10)
    pdf.font('sans-bold').fontSize(size).fillColor('#0a0a0a')
    pdf.text(text, MARGIN, y, { width: CONTENT_W })
    y = pdf.y + 4
  }

  const writeParagraph = (text: string, size = 10) => {
    if (!text) return
    pdf.font('serif').fontSize(size).fillColor('#262626')
    const opts = { width: CONTENT_W, align: 'left' as const, lineGap: 3 }
    const height = pdf.heightOfString(text, opts)
    ensureSpace(height + 6)
    pdf.text(text, MARGIN, y, opts)
    y = pdf.y + 8
  }

  const writeBullet = (text: string, size = 10, marker = '•') => {
    if (!text) return
    pdf.font('serif').fontSize(size).fillColor('#262626')
    const opts = { width: CONTENT_W - 16, align: 'left' as const, lineGap: 2 }
    const height = pdf.heightOfString(text, opts)
    ensureSpace(height + 3)
    // Marker
    pdf.font('sans-bold').fillColor('#0ea5e9')
    pdf.text(marker, MARGIN, y, { width: 16, align: 'left' })
    // Body
    pdf.font('serif').fillColor('#262626')
    pdf.text(text, MARGIN + 16, y, opts)
    y = pdf.y + 4
  }

  const writeNumberedItem = (idx: number, text: string, size = 10) => {
    if (!text) return
    pdf.font('serif').fontSize(size).fillColor('#262626')
    const opts = { width: CONTENT_W - 24, align: 'left' as const, lineGap: 2 }
    const height = pdf.heightOfString(text, opts)
    ensureSpace(height + 3)
    pdf.font('sans-bold').fillColor('#0a0a0a')
    pdf.text(`${idx}.`, MARGIN, y, { width: 24, align: 'left' })
    pdf.font('serif').fillColor('#262626')
    pdf.text(text, MARGIN + 24, y, opts)
    y = pdf.y + 5
  }

  const writeKeyValue = (key: string, value: string, size = 10) => {
    if (!value) return
    pdf.font('sans-bold').fontSize(size).fillColor('#525252')
    pdf.text(`${key}: `, MARGIN, y, { width: CONTENT_W, continued: true })
    pdf.font('serif').fillColor('#262626')
    pdf.text(value, { width: CONTENT_W })
    y = pdf.y + 4
  }

  const writeDivider = () => {
    ensureSpace(14)
    pdf.strokeColor('#d4d4d4')
    pdf.lineWidth(0.5)
    pdf.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke()
    y += 10
  }

  // === Page numbering ===
  let pageCount = 1
  pdf.on('pageAdded', () => {
    pageCount++
  })
  const range = pdf.bufferedPageScope ? pdf.bufferedPageScope() : null

  // === COVER ===
  // Logo bar
  pdf.font('sans-bold').fontSize(9).fillColor('#0ea5e9')
  pdf.text('ENTER · GENE-DRIVEN INVENTION & PATENT PIPELINE', MARGIN, MARGIN, {
    width: CONTENT_W,
    align: 'left',
  })

  pdf.font('sans').fontSize(8).fillColor('#71717a')
  const dateStr = new Date().toLocaleString(doc.language === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  pdf.text(doc.language === 'pl' ? `Data: ${dateStr}` : `Date: ${dateStr}`, MARGIN, pdf.y + 4, {
    width: CONTENT_W,
    align: 'right',
  })

  // Spacer
  y = pdf.y + 60

  // Title (large)
  pdf.font('serif-bold').fontSize(28).fillColor('#0a0a0a')
  const titleHeight = pdf.heightOfString(doc.title, { width: CONTENT_W, align: 'center', lineGap: 4 })
  ensureSpace(titleHeight + 30)
  pdf.text(doc.title, MARGIN, y, { width: CONTENT_W, align: 'center', lineGap: 4 })
  y = pdf.y + 30

  // Language tag
  pdf.font('sans-bold').fontSize(8).fillColor('#0ea5e9')
  pdf.text(
    doc.language === 'pl' ? 'PATENT DOCUMENT · PL' : 'PATENT DOCUMENT · EN',
    MARGIN,
    y,
    { width: CONTENT_W, align: 'center' }
  )
  y = pdf.y + 50

  // Abstract on cover
  writeSubHeading(doc.language === 'pl' ? 'Streszczenie (Abstract)' : 'Abstract', 12)
  writeParagraph(doc.abstract, 10)

  // Page break before TOC
  pdf.addPage()
  y = MARGIN

  // === TABLE OF CONTENTS ===
  writeHeading(doc.language === 'pl' ? 'Spis treści' : 'Table of Contents', 16)
  const tocItems = doc.language === 'pl'
    ? [
        '1. Tło wynalazku (Background)',
        '2. Streszczenie (Summary)',
        '3. Krótki opis rysunków (Drawings)',
        '4. Szczegółowy opis (Detailed Description)',
        '5. Geny technologiczne (DNA wynalazku)',
        '6. Hardware (Bill of Materials)',
        '7. Claims patentowe',
        '8. Analiza AHI',
        '9. Plusy i minusy',
        '10. Czas wdrożenia',
        '11. Obecne potrzeby',
        '12. Szansa na sukces techniczny',
        '13. Ryzyka',
        '14. Następne kroki',
        '15. Schemat',
      ]
    : [
        '1. Background',
        '2. Summary',
        '3. Brief Description of Drawings',
        '4. Detailed Description',
        '5. Technological Genes (Invention DNA)',
        '6. Hardware (Bill of Materials)',
        '7. Patent Claims',
        '8. AHI Analysis',
        '9. Pros and Cons',
        '10. Time to Implement',
        '11. Current Needs',
        '12. Technical Success Chance',
        '13. Risks',
        '14. Next Steps',
        '15. Schematic',
      ]
  for (const item of tocItems) {
    writeBullet(item, 11, '·')
  }

  pdf.addPage()
  y = MARGIN

  // === 1. BACKGROUND ===
  writeHeading(tocItems[0], 14)
  writeParagraph(doc.background)

  // === 2. SUMMARY ===
  writeHeading(tocItems[1], 14)
  writeParagraph(doc.summary)

  // === 3. BRIEF DESCRIPTION OF DRAWINGS ===
  writeHeading(tocItems[2], 14)
  writeParagraph(doc.briefDescriptionOfDrawings)

  // === 4. DETAILED DESCRIPTION ===
  writeHeading(tocItems[3], 14)
  writeParagraph(doc.detailedDescription)

  // === 5. GENES TABLE ===
  writeHeading(tocItems[4], 14)
  for (const g of genes) {
    writeSubHeading(`${g.techName}`, 11)
    writeKeyValue(
      doc.language === 'pl' ? 'Kategoria' : 'Category',
      g.category
    )
    writeKeyValue(doc.language === 'pl' ? 'Rola' : 'Role', g.role)
    if (g.need) writeKeyValue(doc.language === 'pl' ? 'Potrzeba' : 'Need', g.need)
    if (g.githubUrl) {
      pdf.font('sans-bold').fontSize(10).fillColor('#525252')
      pdf.text(
        `${doc.language === 'pl' ? 'Repo' : 'Repo'}: `,
        MARGIN,
        y,
        { width: CONTENT_W, continued: true }
      )
      pdf.font('mono').fillColor('#0ea5e9')
      pdf.text(g.githubUrl, { width: CONTENT_W, link: g.githubUrl })
      y = pdf.y + 4
    }
    writeKeyValue(
      'AHI',
      `${doc.language === 'pl' ? 'autonomia' : 'autonomy'}=${g.autonomy}, ${
        doc.language === 'pl' ? 'etyka' : 'ethics'
      }=${g.ethics}, ${doc.language === 'pl' ? 'decentral' : 'decentral'}=${g.decentral} → ${
        g.ahiScore
      }`
    )
    writeDivider()
  }

  // === 6. HARDWARE BOM ===
  writeHeading(tocItems[5], 14)
  if (hardware.length === 0) {
    writeParagraph(
      doc.language === 'pl'
        ? 'Brak propozycji hardware dla tego wynalazku.'
        : 'No hardware proposed for this invention.'
    )
  } else {
    for (const h of hardware) {
      const prefix = h.recommended ? '★ ' : ''
      writeSubHeading(`${prefix}${h.name}`, 11)
      if (h.vendor) writeKeyValue(doc.language === 'pl' ? 'Producent' : 'Vendor', h.vendor)
      writeKeyValue(doc.language === 'pl' ? 'Kategoria' : 'Category', h.category)
      writeKeyValue(doc.language === 'pl' ? 'Rola' : 'Role', h.role)
      if (h.estimatedCost)
        writeKeyValue(
          doc.language === 'pl' ? 'Szacowany koszt' : 'Estimated cost',
          h.estimatedCost
        )
      if (h.alternatives)
        writeKeyValue(
          doc.language === 'pl' ? 'Alternatywy' : 'Alternatives',
          h.alternatives
        )
      if (h.rationale) {
        pdf.font('sans-bold').fontSize(10).fillColor('#525252')
        pdf.text(
          `${doc.language === 'pl' ? 'Uzasadnienie' : 'Rationale'}: `,
          MARGIN,
          y,
          { width: CONTENT_W, continued: true }
        )
        pdf.font('serif-italic').fillColor('#525252')
        pdf.text(h.rationale, { width: CONTENT_W })
        y = pdf.y + 4
      }
      if (h.recommended) {
        pdf
          .font('sans-bold')
          .fontSize(9)
          .fillColor('#0ea5e9')
          .text(
            doc.language === 'pl'
              ? '→ KOMPONENT KLUCZOWY'
              : '→ KEY COMPONENT',
            MARGIN,
            y,
            { width: CONTENT_W }
          )
        y = pdf.y + 4
      }
      writeDivider()
    }
  }

  // === 7. CLAIMS ===
  writeHeading(tocItems[6], 14)
  if (doc.claims.length === 0) {
    writeParagraph(
      doc.language === 'pl' ? 'Brak claims patentowych.' : 'No patent claims defined.'
    )
  } else {
    for (let i = 0; i < doc.claims.length; i++) {
      writeNumberedItem(i + 1, doc.claims[i], 10)
    }
  }

  // === 8. AHI ANALYSIS ===
  writeHeading(tocItems[7], 14)
  // Big score box
  ensureSpace(80)
  pdf
    .roundedRect(MARGIN, y, CONTENT_W, 70, 6)
    .fill('#f0f9ff')
    .stroke('#0ea5e9')
  pdf.font('serif-bold').fontSize(36).fillColor('#0ea5e9')
  pdf.text(`${ahi.score}`, MARGIN + 20, y + 16, { width: 100, align: 'left' })
  pdf.font('sans').fontSize(8).fillColor('#525252')
  pdf.text('/100', MARGIN + 75, y + 32, { width: 40 })
  pdf.font('sans-bold').fontSize(10).fillColor('#0a0a0a')
  pdf.text('AHI SCORE', MARGIN + 130, y + 14, { width: 200 })
  pdf.font('sans').fontSize(9).fillColor('#525252')
  pdf.text(
    `${doc.language === 'pl' ? 'Autonomia' : 'Autonomy'}: ${ahi.autonomy}   ·   ${
      doc.language === 'pl' ? 'Etyka' : 'Ethics'
    }: ${ahi.ethics}   ·   ${doc.language === 'pl' ? 'Decentralizacja' : 'Decentralization'}: ${ahi.decentral}`,
    MARGIN + 130,
    y + 32,
    { width: CONTENT_W - 150 }
  )
  y += 80
  writeSubHeading(doc.language === 'pl' ? 'Uzasadnienie audytora' : 'Auditor rationale', 11)
  writeParagraph(ahi.reasoning)

  // === 9. PROS & CONS ===
  writeHeading(tocItems[8], 14)
  // Two columns
  const colW = (CONTENT_W - 16) / 2
  const colX1 = MARGIN
  const colX2 = MARGIN + colW + 16

  ensureSpace(30)
  pdf.font('sans-bold').fontSize(10).fillColor('#16a34a')
  pdf.text(
    doc.language === 'pl' ? '✓ ZALETY' : '✓ PROS',
    colX1,
    y,
    { width: colW }
  )
  pdf.font('sans-bold').fontSize(10).fillColor('#dc2626')
  pdf.text(
    doc.language === 'pl' ? '✗ WADY' : '✗ CONS',
    colX2,
    y,
    { width: colW }
  )
  y += 18

  const pros = doc.prosCons.pros.length > 0 ? doc.prosCons.pros : []
  const cons = doc.prosCons.cons.length > 0 ? doc.prosCons.cons : []
  const maxRows = Math.max(pros.length, cons.length)

  for (let i = 0; i < maxRows; i++) {
    const proText = pros[i] || ''
    const conText = cons[i] || ''
    const proHeight = proText ? pdf.heightOfString(`• ${proText}`, { width: colW - 14, lineGap: 2 }) : 0
    const conHeight = conText ? pdf.heightOfString(`• ${conText}`, { width: colW - 14, lineGap: 2 }) : 0
    const rowH = Math.max(proHeight, conHeight) + 4
    ensureSpace(rowH)
    if (proText) {
      pdf.font('sans-bold').fontSize(9).fillColor('#16a34a')
      pdf.text('•', colX1, y, { width: 14 })
      pdf.font('serif').fontSize(9).fillColor('#262626')
      pdf.text(proText, colX1 + 14, y, { width: colW - 14, lineGap: 2 })
    }
    if (conText) {
      pdf.font('sans-bold').fontSize(9).fillColor('#dc2626')
      pdf.text('•', colX2, y, { width: 14 })
      pdf.font('serif').fontSize(9).fillColor('#262626')
      pdf.text(conText, colX2 + 14, y, { width: colW - 14, lineGap: 2 })
    }
    y += rowH
  }
  y += 6

  // === 10. TIME TO IMPLEMENT ===
  writeHeading(tocItems[9], 14)
  if (doc.timeToImplement) {
    writeParagraph(doc.timeToImplement)
  }

  // === 11. CURRENT NEEDS ===
  writeHeading(tocItems[10], 14)
  for (const need of doc.currentNeeds) {
    writeBullet(need, 10, '▸')
  }

  // === 12. TECHNICAL SUCCESS CHANCE ===
  writeHeading(tocItems[11], 14)
  ensureSpace(80)
  const score = doc.technicalSuccessChance.score
  const scoreColor =
    score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : score >= 40 ? '#ea580c' : '#dc2626'
  pdf
    .roundedRect(MARGIN, y, CONTENT_W, 70, 6)
    .fill('#fafafa')
    .stroke(scoreColor)
  pdf.font('serif-bold').fontSize(36).fillColor(scoreColor)
  pdf.text(`${score}%`, MARGIN + 20, y + 16, { width: 140, align: 'left' })
  pdf.font('sans-bold').fontSize(10).fillColor('#0a0a0a')
  pdf.text(
    doc.language === 'pl' ? 'SZANSA NA SUKCES TECHNICZNY' : 'TECHNICAL SUCCESS CHANCE',
    MARGIN + 170,
    y + 14,
    { width: CONTENT_W - 190 }
  )
  // Verdict
  let verdict = ''
  if (doc.language === 'pl') {
    if (score >= 80) verdict = 'Realistyczne do zbudowania teraz'
    else if (score >= 60) verdict = 'Wymaga iteracyjnego R&D'
    else if (score >= 40) verdict = 'Ryzykowne — wymaga prototypowania'
    else verdict = 'Sci-fi / eksperymentalne'
  } else {
    if (score >= 80) verdict = 'Buildable now'
    else if (score >= 60) verdict = 'Requires iterative R&D'
    else if (score >= 40) verdict = 'Risky — requires prototyping'
    else verdict = 'Sci-fi / experimental'
  }
  pdf.font('sans').fontSize(9).fillColor('#525252')
  pdf.text(verdict, MARGIN + 170, y + 32, { width: CONTENT_W - 190 })
  y += 80
  writeParagraph(doc.technicalSuccessChance.rationale)

  // === 13. RISKS ===
  writeHeading(tocItems[12], 14)
  for (const risk of doc.risks) {
    writeBullet(risk, 10, '⚠')
  }

  // === 14. NEXT STEPS ===
  writeHeading(tocItems[13], 14)
  for (let i = 0; i < doc.nextSteps.length; i++) {
    writeNumberedItem(i + 1, doc.nextSteps[i], 10)
  }

  // === 15. SCHEMATIC IMAGE ===
  writeHeading(tocItems[14], 14)
  if (schematicImageBase64) {
    try {
      const imgBuffer = Buffer.from(schematicImageBase64, 'base64')
      // Compute scaled image dimensions
      const maxW = CONTENT_W
      const maxH = PAGE_H - MARGIN * 2 - 40
      // PDFKit can read PNG metadata via the image() method; we set scale to fit
      // We pass {width: maxW} which auto-scales height proportionally
      // But first check it doesn't overflow page height — if it does, add a new page
      ensureSpace(80)
      // Try fitting — PDFKit .image() returns the doc, and pdf.y is updated to bottom
      const startY = y
      pdf.image(imgBuffer, MARGIN, startY, { width: maxW, height: undefined as unknown as number, scale: 1 })
      // pdf.y is now updated; if image overflowed, pdfkit may have created overflow
      y = pdf.y + 12
    } catch (e) {
      writeParagraph(
        doc.language === 'pl'
          ? `[Błąd osadzania schematu: ${(e as Error).message}]`
          : `[Schematic embedding failed: ${(e as Error).message}]`
      )
    }
  } else {
    writeParagraph(
      doc.language === 'pl'
        ? 'Brak wygenerowanego schematu.'
        : 'No schematic was generated.'
    )
  }

  // === FOOTER ===
  // Add a final page footer with original prompt
  pdf.addPage()
  y = MARGIN
  writeHeading(doc.language === 'pl' ? 'Oryginalny problem (Appendix)' : 'Original Problem (Appendix)', 14)
  writeParagraph(originalPrompt)

  // Final sign-off
  y += 20
  writeDivider()
  pdf
    .font('sans')
    .fontSize(8)
    .fillColor('#71717a')
    .text(
      doc.language === 'pl'
        ? 'Wygenerowano przez Enter — gene-driven invention & patent pipeline · 8 warstw, 7 agentów AI'
        : 'Generated by Enter — gene-driven invention & patent pipeline · 8 layers, 7 AI agents',
      MARGIN,
      y,
      { width: CONTENT_W, align: 'center' }
    )

  // Page numbers on every page (use buffered pages)
  const pages = pdf.bufferedPageRange()
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    pdf.switchToPage(i)
    pdf
      .font('sans')
      .fontSize(8)
      .fillColor('#a3a3a3')
      .text(
        `${i + 1} / ${pages.count}`,
        MARGIN,
        PAGE_H - MARGIN + 20,
        { width: CONTENT_W, align: 'right' }
      )
  }

  // Get the PDF bytes as a Buffer
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)
    pdf.end()
  })
}
