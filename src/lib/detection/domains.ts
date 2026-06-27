// Top targeted domains for typosquatting detection.
// Covers the most impersonated brands across finance, crypto, cloud, social, and more.
export const TOP_DOMAINS: readonly string[] = [
  // Search & productivity
  'google', 'youtube', 'gmail', 'drive', 'docs', 'sheets', 'slides', 'calendar', 'maps',
  'microsoft', 'office', 'outlook', 'onedrive', 'teams', 'live', 'hotmail',
  'apple', 'icloud', 'itunes',
  'yahoo', 'bing', 'duckduckgo',

  // Social media
  'facebook', 'instagram', 'twitter', 'linkedin', 'reddit', 'tiktok',
  'snapchat', 'pinterest', 'discord', 'telegram', 'whatsapp',
  'signal', 'skype', 'line', 'wechat', 'viber',
  'tumblr', 'quora', 'medium', 'substack', 'mastodon', 'bluesky',

  // Finance & banking
  'paypal', 'stripe', 'square', 'wise', 'revolut', 'venmo', 'zelle', 'cashapp',
  'chase', 'bankofamerica', 'wellsfargo', 'citibank', 'capitalone', 'usbank',
  'hsbc', 'barclays', 'santander', 'lloyds', 'natwest', 'ing', 'bnp',
  'tdbank', 'pnc', 'ally', 'schwab', 'fidelity', 'vanguard', 'etrade', 'robinhood', 'webull',
  'americanexpress', 'discover', 'visa', 'mastercard',

  // Crypto exchanges & wallets
  'coinbase', 'binance', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex',
  'gemini', 'nexo', 'blockchain', 'metamask', 'phantom', 'ledger', 'trezor',
  'uniswap', 'opensea', 'rarible', 'blur',

  // Shopping & e-commerce
  'amazon', 'ebay', 'etsy', 'shopify', 'walmart', 'target', 'bestbuy', 'costco',
  'aliexpress', 'alibaba', 'temu', 'shein', 'wish',
  'wayfair', 'chewy', 'newegg', 'ikea', 'homedepot', 'lowes', 'macys', 'nordstrom',

  // Streaming & entertainment
  'netflix', 'spotify', 'twitch', 'hulu', 'disneyplus', 'hbomax', 'paramount',
  'peacock', 'crunchyroll', 'primevideo', 'appletv',
  'soundcloud', 'tidal', 'deezer', 'bandcamp',
  'steam', 'epicgames', 'roblox', 'ubisoft', 'blizzard', 'ea', 'activision',
  'playstation', 'xbox', 'nintendo',

  // Developer tools & cloud
  'github', 'gitlab', 'bitbucket', 'stackoverflow',
  'npm', 'pypi', 'docker', 'kubernetes',
  'cloudflare', 'digitalocean', 'linode', 'vultr', 'hetzner', 'ovh',
  'heroku', 'vercel', 'netlify', 'render', 'railway',
  'aws', 'azure', 'gcp', 'oracle',
  'atlassian', 'jira', 'confluence', 'trello',
  'datadog', 'sentry', 'grafana', 'newrelic', 'hashicorp',

  // SaaS & enterprise
  'salesforce', 'hubspot', 'zendesk', 'intercom', 'freshdesk',
  'notion', 'figma', 'canva', 'miro', 'airtable',
  'slack', 'zoom', 'webex',
  'monday', 'asana', 'clickup', 'basecamp', 'todoist',
  'dropbox', 'box', 'evernote',
  'adobe', 'workday', 'servicenow', 'sap',

  // Security & privacy
  'lastpass', 'onepassword', 'dashlane', 'bitwarden', 'keeper',
  'nordvpn', 'expressvpn', 'protonvpn', 'mullvad', 'surfshark',
  'avast', 'norton', 'kaspersky', 'malwarebytes', 'bitdefender', 'eset', 'mcafee',
  'protonmail', 'tutanota', 'fastmail',

  // Tech hardware & brands
  'samsung', 'sony', 'hp', 'dell', 'lenovo', 'asus', 'acer', 'lg',
  'nvidia', 'intel', 'amd', 'qualcomm',
  'motorola', 'huawei', 'xiaomi', 'oneplus',

  // Travel & transport
  'airbnb', 'booking', 'expedia', 'tripadvisor', 'kayak', 'skyscanner',
  'uber', 'lyft', 'doordash', 'grubhub', 'instacart', 'deliveroo',

  // Domains, hosting & site builders
  'godaddy', 'namecheap', 'bluehost', 'siteground', 'hostgator',
  'wordpress', 'wix', 'squarespace', 'webflow',

  // Education
  'coursera', 'udemy', 'edx', 'pluralsight', 'duolingo', 'khanacademy',

  // News & media
  'bbc', 'cnn', 'nytimes', 'theguardian', 'reuters', 'bloomberg',
  'techcrunch', 'theverge', 'wired', 'arstechnica',
]

export const SUSPICIOUS_TLDS = new Set([
  '.tk', '.ml', '.ga', '.cf', '.gq',   // free TLDs historically abused
  '.xyz', '.top', '.pw', '.cc', '.su',
  '.click', '.link', '.online', '.site', '.website',
])
