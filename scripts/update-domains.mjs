/**
 * Fetches the latest Tranco top-500 list (research-grade, combines Alexa,
 * Majestic, Umbrella, and Chrome CrUX data) and merges brand names into
 * src/data/top-domains.json.
 *
 * Run: node scripts/update-domains.mjs
 *
 * What Tranco is: https://tranco-list.eu/
 * Why Tranco over Alexa: https://tranco-list.eu/methodology
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOP_DOMAINS_PATH = resolve(__dirname, '../src/data/top-domains.json')

// Words that appear in top-500 but are not brand names — would cause false
// positives if added to the typosquatting brand list.
const GENERIC_WORDS = new Set([
  'online', 'services', 'network', 'media', 'news', 'web', 'digital',
  'global', 'group', 'mail', 'search', 'cloud', 'data', 'open', 'free',
  'live', 'video', 'music', 'stream', 'game', 'games', 'play', 'blog',
  'shop', 'store', 'market', 'city', 'world', 'info', 'guide', 'help',
  'pro', 'plus', 'app', 'site', 'page', 'hub', 'link', 'go', 'my',
  'get', 'now', 'new', 'best', 'top', 'fast', 'easy', 'smart', 'mega',
])

// Single-character or very short strings that look like brands but cause
// too many false positives in Levenshtein matching.
const MIN_BRAND_LENGTH = 3

async function fetchTrancoListId() {
  const res = await fetch('https://tranco-list.eu/api/lists/date/latest')
  if (!res.ok) throw new Error(`Tranco API error: ${res.status}`)
  const data = await res.json()
  return data.list_id
}

async function fetchTrancoTop(listId, n = 500) {
  const res = await fetch(`https://tranco-list.eu/download/${listId}/${n}`)
  if (!res.ok) throw new Error(`Tranco download error: ${res.status}`)
  const csv = await res.text()
  // CSV format: rank,domain  (no header)
  return csv
    .trim()
    .split('\n')
    .map(line => {
      const [, domain] = line.split(',')
      return domain?.trim() ?? ''
    })
    .filter(Boolean)
}

function extractBrandName(domain) {
  // Strip known TLDs and get the registrable label
  // e.g. "google.com" → "google", "bbc.co.uk" → "bbc"
  return domain
    .replace(/\.(com|net|org|io|co|gov|edu|me|app|dev|tv|fm|am|ly|gg|ai|cc|us|uk|de|fr|nl|au|ca|jp|kr|cn|br|in|ru|es|it|se|no|dk|fi|pl|ch|at|be|pt|cz|sk|ro|hu|gr|bg|hr|si|lt|lv|ee|ie|is|nz|sg|hk|tw|my|id|ph|th|vn|ar|mx|cl|co|pe|ve|ec|bo|py|uy|cr|pa|gt|sv|hn|ni|do|cu|pr|jm|tt|bb|bs|bm|ky|tc|vi|vc|lc|gd|dm|ag|kn|mq|gp|aw|cw|sx|bq|ai|ms|vg|io|sh|ac|st|cv|sn|gm|gn|sl|lr|ci|gh|tg|bj|ne|bf|ml|mr|gw|gq|ga|cg|cd|ao|zm|mw|tz|ke|ug|rw|bi|tz|sc|km|mg|mu|re|yt|so|dj|et|er|sd|ss|ly|tn|ma|dz|eg|ps|il|jo|lb|sy|iq|ir|sa|ye|om|ae|qa|bh|kw|tr|az|ge|am|ua|by|md|rs|me|mk|al|ba|xk|mt|cy|lb|af|pk|np|bd|lk|mv|bt|mn|mm|kh|la|tl|bn|pg|fj|ws|to|vu|ki|nr|pw|fm|mh|ck|nu|tk|wf|pf|nc|sb|as|gu|mp|um)(\.[a-z]{2})?$/, '')
    .split('.')[0]
    ?.toLowerCase() ?? ''
}

function isBrandName(name) {
  if (!name || name.length < MIN_BRAND_LENGTH) return false
  if (GENERIC_WORDS.has(name)) return false
  if (name.includes('-')) return false        // skip hyphenated compound names
  if (/^\d+$/.test(name)) return false        // skip purely numeric
  if (/[^a-z0-9]/.test(name)) return false   // skip anything with special chars
  return true
}

async function main() {
  console.log('Fetching latest Tranco list ID…')
  let listId
  try {
    listId = await fetchTrancoListId()
    console.log(`  List ID: ${listId}`)
  } catch (err) {
    console.error(`  Failed: ${err.message}`)
    console.error('  Tranco may be temporarily unavailable. No changes made.')
    process.exit(1)
  }

  console.log('Downloading Tranco top-500…')
  let trancoTop
  try {
    trancoTop = await fetchTrancoTop(listId, 500)
    console.log(`  Downloaded ${trancoTop.length} domains`)
  } catch (err) {
    console.error(`  Failed: ${err.message}`)
    process.exit(1)
  }

  const existing = JSON.parse(readFileSync(TOP_DOMAINS_PATH, 'utf8'))
  const existingSet = new Set(existing)

  const newBrands = []
  for (const domain of trancoTop) {
    const brand = extractBrandName(domain)
    if (isBrandName(brand) && !existingSet.has(brand)) {
      newBrands.push(brand)
    }
  }

  if (newBrands.length === 0) {
    console.log('No new brands to add — list is already up to date.')
    return
  }

  const merged = [...new Set([...existing, ...newBrands])].sort()
  writeFileSync(TOP_DOMAINS_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log(`Added ${newBrands.length} new brands: ${newBrands.slice(0, 10).join(', ')}${newBrands.length > 10 ? ` … (+${newBrands.length - 10} more)` : ''}`)
  console.log(`top-domains.json now has ${merged.length} entries (was ${existing.length}).`)
  console.log('\nCommit the updated file and push — installed users will sync within 24 h.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
