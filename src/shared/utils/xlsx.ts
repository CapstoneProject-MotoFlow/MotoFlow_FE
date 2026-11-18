function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function columnName(index: number) {
  let value = index + 1
  let name = ''
  while (value) {
    value--
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }
  return name
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function createXlsx(sheets: { name: string; rows: unknown[][] }[]) {
  const encoder = new TextEncoder()
  const xmlFiles = [
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xmlEscape(sheet.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
    },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.rows
        .map(
          (row, rowIndex) =>
            `<row r="${rowIndex + 1}">${row
              .map((cell, columnIndex) => {
                const ref = `${columnName(columnIndex)}${rowIndex + 1}`
                return typeof cell === 'number' && Number.isFinite(cell)
                  ? `<c r="${ref}"><v>${cell}</v></c>`
                  : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`
              })
              .join('')}</row>`,
        )
        .join('')}</sheetData></worksheet>`,
    })),
  ].map((file) => ({
    name: encoder.encode(file.name),
    bytes: encoder.encode(file.text),
  }))
  const now = new Date()
  const time =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2)
  const date =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const u16 = (view: DataView, at: number, value: number) =>
    view.setUint16(at, value, true)
  const u32 = (view: DataView, at: number, value: number) =>
    view.setUint32(at, value, true)
  for (const file of xmlFiles) {
    const crc = crc32(file.bytes)
    const local = new Uint8Array(30 + file.name.length)
    const localView = new DataView(local.buffer)
    u32(localView, 0, 0x04034b50)
    u16(localView, 4, 20)
    u16(localView, 6, 0x0800)
    u16(localView, 8, 0)
    u16(localView, 10, time)
    u16(localView, 12, date)
    u32(localView, 14, crc)
    u32(localView, 18, file.bytes.length)
    u32(localView, 22, file.bytes.length)
    u16(localView, 26, file.name.length)
    u16(localView, 28, 0)
    local.set(file.name, 30)
    localParts.push(local, file.bytes)
    const central = new Uint8Array(46 + file.name.length)
    const centralView = new DataView(central.buffer)
    u32(centralView, 0, 0x02014b50)
    u16(centralView, 4, 20)
    u16(centralView, 6, 20)
    u16(centralView, 8, 0x0800)
    u16(centralView, 10, 0)
    u16(centralView, 12, time)
    u16(centralView, 14, date)
    u32(centralView, 16, crc)
    u32(centralView, 20, file.bytes.length)
    u32(centralView, 24, file.bytes.length)
    u16(centralView, 28, file.name.length)
    u16(centralView, 30, 0)
    u16(centralView, 32, 0)
    u16(centralView, 34, 0)
    u16(centralView, 36, 0)
    u32(centralView, 38, 0)
    u32(centralView, 42, offset)
    central.set(file.name, 46)
    centralParts.push(central)
    offset += local.length + file.bytes.length
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  u32(endView, 0, 0x06054b50)
  u16(endView, 4, 0)
  u16(endView, 6, 0)
  u16(endView, 8, xmlFiles.length)
  u16(endView, 10, xmlFiles.length)
  u32(endView, 12, centralSize)
  u32(endView, 16, offset)
  u16(endView, 20, 0)
  const parts = [...localParts, ...centralParts, end]
  const archive = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  )
  let archiveOffset = 0
  for (const part of parts) {
    archive.set(part, archiveOffset)
    archiveOffset += part.length
  }
  return new Blob([archive.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
