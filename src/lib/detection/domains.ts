import topDomainsData from '../../data/top-domains.json'

export const TOP_DOMAINS: readonly string[] = topDomainsData

export const SUSPICIOUS_TLDS = new Set([
  '.tk', '.ml', '.ga', '.cf', '.gq',
  '.xyz', '.top', '.pw', '.cc', '.su',
  '.click', '.link', '.online', '.site', '.website',
])

// Keywords that, when combined with a brand name in a domain (e.g. paypal-login.com),
// strongly indicate a phishing or social-engineering attempt.
export const PHISHING_KEYWORDS = new Set([
  'login', 'signin', 'secure', 'security', 'verify', 'verification',
  'account', 'accounts', 'password', 'support', 'help', 'service',
  'update', 'confirm', 'validation', 'wallet', 'recovery',
  'auth', 'authentication', 'banking', 'bank', 'official', 'safe',
  'trust', 'id', 'identity', 'portal', 'access', 'checkout',
  'pay', 'payment', 'billing', 'invoice', 'refund', 'alert',
  'notice', 'notification', 'urgent', 'suspend', 'suspended', 'limited',
])

// Compound public suffixes where eTLD+1 requires 3 labels, not 2.
// Covers the most common ccTLD compounds (co.uk, com.au, etc.).
// A full PSL (https://publicsuffix.org) can replace this if the extension grows.
export const COMPOUND_SUFFIXES = new Set([
  // UK
  'co.uk', 'me.uk', 'org.uk', 'net.uk', 'ltd.uk', 'plc.uk',
  'sch.uk', 'gov.uk', 'nhs.uk', 'ac.uk', 'police.uk',
  // Australia
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
  // Brazil
  'com.br', 'net.br', 'org.br', 'edu.br', 'gov.br',
  // New Zealand
  'co.nz', 'net.nz', 'org.nz', 'edu.nz', 'govt.nz',
  // South Africa
  'co.za', 'org.za', 'net.za', 'edu.za', 'gov.za',
  // Japan
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'ed.jp', 'go.jp',
  // South Korea
  'co.kr', 'or.kr', 'ne.kr', 'ac.kr', 'go.kr', 're.kr',
  // China
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'ac.cn',
  // India
  'co.in', 'net.in', 'org.in', 'gov.in', 'edu.in', 'ac.in',
  // Mexico
  'com.mx', 'net.mx', 'org.mx', 'edu.mx', 'gob.mx',
  // Argentina
  'com.ar', 'net.ar', 'org.ar', 'edu.ar', 'gov.ar',
  // Singapore
  'com.sg', 'net.sg', 'org.sg', 'edu.sg', 'gov.sg',
  // Hong Kong
  'com.hk', 'net.hk', 'org.hk', 'edu.hk', 'gov.hk',
  // Taiwan
  'com.tw', 'net.tw', 'org.tw', 'edu.tw', 'gov.tw',
  // Philippines
  'com.ph', 'net.ph', 'org.ph', 'edu.ph', 'gov.ph',
  // Malaysia
  'com.my', 'net.my', 'org.my', 'edu.my', 'gov.my',
  // Indonesia
  'co.id', 'net.id', 'or.id', 'ac.id', 'go.id',
  // Pakistan
  'com.pk', 'net.pk', 'org.pk', 'edu.pk', 'gov.pk',
  // Colombia
  'com.co', 'net.co', 'org.co', 'edu.co', 'gov.co',
  // Venezuela
  'com.ve', 'net.ve', 'org.ve', 'edu.ve', 'gov.ve',
  // Peru
  'com.pe', 'net.pe', 'org.pe', 'edu.pe', 'gob.pe',
])
