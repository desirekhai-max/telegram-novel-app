import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const novelId = process.argv[2] || '2'
const source = process.argv[3]
const chapterTitleArg = process.argv[4]
if (!source) {
  console.error('Usage: node scripts/_patch-novel-chapters.mjs <novelId> <sdocxPath> [chapterTitle]')
  process.exit(1)
}

const novelsPath = path.join(__dirname, '..', 'src', 'data', 'novels.js')
const tmp = path.join(os.tmpdir(), `notes_extract_sdocx_${novelId}`)

function unzipSamsungNote(docPath) {
  fs.mkdirSync(tmp, { recursive: true })
  const zipPath = path.join(tmp, 'doc.zip')
  const extractDir = path.join(tmp, 'unzipped')
  fs.copyFileSync(docPath, zipPath)
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true })
  }
  fs.mkdirSync(extractDir, { recursive: true })
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
    { stdio: 'pipe' },
  )
  return extractDir
}

function extractDocxParagraphs(extractDir) {
  const docXml = path.join(extractDir, 'word', 'document.xml')
  if (!fs.existsSync(docXml)) return null
  const xml = fs.readFileSync(docXml, 'utf8')
  const paras = []
  for (const m of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const texts = [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((x) => x[1])
    const line = texts
      .join('')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
    if (!line || /^loading\.\.\.$/i.test(line)) continue
    paras.push(line)
  }
  return paras
}

function isStoryText(s) {
  return /[\u1780-\u17FF]/.test(s)
}

function isGarbageParagraph(s) {
  const t = String(s || '').trim()
  if (t.length < 15) return true
  const compact = t.replace(/\s/g, '')
  if (!compact) return true
  const unique = new Set(compact).size
  if (unique <= 4 && compact.length < 40) return true
  return false
}

function extractSamsungParagraphs(extractDir) {
  const notePath = path.join(extractDir, 'note.note')
  if (!fs.existsSync(notePath)) {
    throw new Error('note.note not found in Samsung Notes export')
  }
  const buf = fs.readFileSync(notePath)
  const chunks = extractKhmerChunks(buf)
  if (chunks.length) {
    return chunks.map(sanitizeParagraph).filter((p) => p && !isGarbageParagraph(p))
  }

  const runs = []
  let cur = ''
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const ch = buf.readUInt16LE(i)
    const printable = ch >= 0x20 && ch !== 0xfffd && (ch < 0xd800 || ch > 0xdfff)
    if (printable) {
      cur += String.fromCharCode(ch)
    } else if (cur.trim()) {
      runs.push(cur.trim())
      cur = ''
    }
  }
  if (cur.trim()) runs.push(cur.trim())

  const parts = runs.filter((r) => isStoryText(r) && !/^loading\.\.\.$/i.test(r))

  const merged = []
  for (const part of parts) {
    const prev = merged[merged.length - 1]
    if (prev && part.length <= 12 && !/^[\u1780-\u17FF]/.test(part[0])) {
      merged[merged.length - 1] = prev + part
    } else if (prev && part.length <= 8 && !/[.!?។]$/.test(prev)) {
      merged[merged.length - 1] = prev + part
    } else {
      merged.push(part)
    }
  }
  return merged.map(sanitizeParagraph).filter((p) => p && !isGarbageParagraph(p))
}

function sanitizeParagraph(text) {
  return text
    .replace(/[æÆ][\u1780-\u17FF\u0E00-\u0E7F\u4e00-\u9fff]*$/u, '')
    .replace(/[^\u1780-\u17FF0-9A-Za-z\s.,!?«»:;()\-…​។]+$/gu, '')
    .trim()
}

function extractParagraphs(docPath) {
  const extractDir = unzipSamsungNote(docPath)
  return extractDocxParagraphs(extractDir) || extractSamsungParagraphs(extractDir)
}

function readExistingChapterTitle(src, id) {
  const idMarker = `    id: '${id}',`
  const start = src.indexOf(idMarker)
  if (start < 0) return null
  const nextId = String(Number(id) + 1)
  const endMarker = `    id: '${nextId}',`
  const end = src.indexOf(endMarker, start)
  const block = end > start ? src.slice(start, end) : src.slice(start)
  const m = block.match(/title:\s*['"]([^'"]*)['"]/)
  const chapterM = block.match(/chapters:\s*\[[\s\S]*?\{\s*title:\s*['"]([^'"]*)['"]/)
  return chapterM?.[1] ?? m?.[1] ?? 'ភាគទី១'
}

function extractKhmerChunks(buf) {
  const chunks = []
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const c = buf.readUInt16LE(i)
    if (c < 0x1780 || c > 0x17ff) continue
    let s = ''
    let j = i
    while (j + 1 < buf.length) {
      const ch = buf.readUInt16LE(j)
      const ok =
        (ch >= 0x1780 && ch <= 0x17ff) ||
        ch === 0x20 ||
        ch === 0x0a ||
        ch === 0x0d ||
        ch === 0x2e ||
        ch === 0x2c ||
        ch === 0x21 ||
        ch === 0x3f ||
        ch === 0x3a ||
        ch === 0x3b ||
        ch === 0x28 ||
        ch === 0x29 ||
        ch === 0xab ||
        ch === 0xbb ||
        (ch >= 0x30 && ch <= 0x39) ||
        (ch >= 0x41 && ch <= 0x5a) ||
        (ch >= 0x61 && ch <= 0x7a)
      if (ok) {
        s += String.fromCharCode(ch)
        j += 2
      } else break
    }
    const trimmed = s.trim()
    if (trimmed.length > 10 && !/^loading\.\.\.$/i.test(trimmed)) {
      chunks.push(trimmed)
    }
    i = j
  }
  return chunks
}

const paras = extractParagraphs(source)
if (!paras.length) throw new Error('no paragraphs extracted')

const src = fs.readFileSync(novelsPath, 'utf8')
const startMarker = `    id: '${novelId}',`
const nextId = String(Number(novelId) + 1)
const endMarker = `    id: '${nextId}',`
const start = src.indexOf(startMarker)
if (start < 0) throw new Error(`novel id ${novelId} block not found`)

const end = src.indexOf(endMarker, start)
const isLastNovel = end < 0
if (!isLastNovel && end <= start) {
  throw new Error(`novel id ${novelId} block not found`)
}

const chapterTitle = chapterTitleArg || readExistingChapterTitle(src, novelId)
const chaptersArrayStart = src.indexOf('chapters:', start) + 'chapters:'.length
const tailStart = isLastNovel
  ? src.indexOf('\n]\n\nexport function', start)
  : src.lastIndexOf('\n  {', end)
if (tailStart < 0) throw new Error(`novel ${novelId} tail not found`)

const bodyLines = paras.map((p) => `          ${JSON.stringify(p)},`).join('\n')
const chapterBlock = `      {
        title: ${JSON.stringify(chapterTitle)},
        body: [
${bodyLines}
        ],
      }`

const patched =
  src.slice(0, chaptersArrayStart) +
  `
    [
${chapterBlock}
    ],
  },
` +
  src.slice(isLastNovel ? tailStart : tailStart + 1)

fs.writeFileSync(novelsPath, patched, 'utf8')
console.log(
  JSON.stringify({
    novelId,
    chapterTitle,
    source,
    paragraphs: paras.length,
    firstPreview: paras[0].slice(0, 80),
    lastPreview: paras[paras.length - 1].slice(-80),
  }),
)
