/**
 * 根据 src/data/novels.js 生成 server/novels-catalog.json（无章节正文）。
 * 修改书目后执行：npm run export:novels-catalog
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { novels } from '../src/data/novels.js'
import { buildNovelsCatalogPayload } from '../src/lib/novelsCatalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'server', 'novels-catalog.json')
const payload = buildNovelsCatalogPayload(novels)
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`Wrote ${outPath} (${payload.novels.length} novels)`)
