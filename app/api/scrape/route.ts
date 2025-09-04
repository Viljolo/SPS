import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

interface PricingData {
  domain: string
  planName: string
  price: string
  pricingModel: string
  url: string
  scrapedAt: string
}

interface DomainResult {
  domain: string
  url: string
  plans: PricingData[]
  scrapedAt: string
  status: 'success' | 'error' | 'no_pricing'
  errorMessage?: string
}

// Common pricing-related keywords in multiple languages
const PRICING_KEYWORDS = {
  en: ['pricing', 'price', 'plan', 'subscription', 'billing', 'cost', 'monthly', 'yearly', 'annual', 'premium', 'pro', 'basic', 'enterprise', 'starter', 'business', 'personal', 'team', 'individual', 'package', 'tier', 'level'],
  es: ['precio', 'plan', 'suscripción', 'facturación', 'costo', 'mensual', 'anual', 'premium', 'básico', 'empresa', 'personal', 'equipo', 'paquete', 'nivel'],
  fr: ['prix', 'plan', 'abonnement', 'facturation', 'coût', 'mensuel', 'annuel', 'premium', 'basique', 'entreprise', 'personnel', 'équipe', 'forfait', 'niveau'],
  de: ['preis', 'plan', 'abonnement', 'abrechnung', 'kosten', 'monatlich', 'jährlich', 'premium', 'grundlegend', 'unternehmen', 'persönlich', 'team', 'paket', 'stufe'],
  it: ['prezzo', 'piano', 'abbonamento', 'fatturazione', 'costo', 'mensile', 'annuale', 'premium', 'base', 'azienda', 'personale', 'squadra', 'pacchetto', 'livello'],
  pt: ['preço', 'plano', 'assinatura', 'faturamento', 'custo', 'mensal', 'anual', 'premium', 'básico', 'empresa', 'pessoal', 'equipe', 'pacote', 'nível'],
  ru: ['цена', 'план', 'подписка', 'биллинг', 'стоимость', 'месячный', 'годовой', 'премиум', 'базовый', 'бизнес', 'личный', 'команда', 'пакет', 'уровень'],
  ja: ['価格', 'プラン', 'サブスクリプション', '請求', 'コスト', '月額', '年額', 'プレミアム', 'ベーシック', 'ビジネス', '個人', 'チーム', 'パッケージ', 'レベル'],
  zh: ['价格', '计划', '订阅', '计费', '成本', '月费', '年费', '高级', '基础', '商业', '个人', '团队', '套餐', '级别'],
  ko: ['가격', '플랜', '구독', '청구', '비용', '월간', '연간', '프리미엄', '기본', '비즈니스', '개인', '팀', '패키지', '레벨'],
  fi: ['hinta', 'suunnitelma', 'tilaus', 'laskutus', 'kustannus', 'kuukausi', 'vuosi', 'vuosittain', 'premium', 'perus', 'yritys', 'henkilökohtainen', 'tiimi', 'paketti', 'taso']
}

// Price patterns for different currencies
const PRICE_PATTERNS = [
  /\$[\d,]+(?:\.\d{2})?/, // USD
  /€[\d,]+(?:\.\d{2})?/, // EUR
  /£[\d,]+(?:\.\d{2})?/, // GBP
  /¥[\d,]+(?:\.\d{2})?/, // JPY
  /₹[\d,]+(?:\.\d{2})?/, // INR
  /₽[\d,]+(?:\.\d{2})?/, // RUB
  /₩[\d,]+(?:\.\d{2})?/, // KRW
  /[\d,]+\s*(?:USD|EUR|GBP|JPY|INR|RUB|KRW|元|円|₽|₹|₩)/i, // Currency codes
  /[\d,]+\s*(?:dollars?|euros?|pounds?|yen|rupees?|rubles?|won)/i, // Currency names
  /[\d,]+\s*(?:per\s+month|per\s+year|monthly|yearly|annual)/i, // Time periods
  /[\d,]+\s*(?:€|EUR|euro)/i, // Euro variations
  /[\d,]+\s*(?:£|GBP|pound)/i, // Pound variations
  /[\d,]+\s*(?:¥|JPY|yen)/i, // Yen variations
  /[\d,]+\s*(?:₹|INR|rupee)/i, // Rupee variations
  /[\d,]+\s*(?:₽|RUB|ruble)/i, // Ruble variations
  /[\d,]+\s*(?:₩|KRW|won)/i, // Won variations
  /[\d,]+\s*(?:kr|SEK|NOK|DKK)/i, // Scandinavian currencies
  /[\d,]+\s*(?:CHF|franc)/i, // Swiss franc
  /[\d,]+\s*(?:CAD|canadian\s+dollar)/i, // Canadian dollar
  /[\d,]+\s*(?:AUD|australian\s+dollar)/i, // Australian dollar
  /[\d,]+\s*(?:NZD|new\s+zealand\s+dollar)/i, // New Zealand dollar
  /[\d,]+\s*(?:BRL|real)/i, // Brazilian real
  /[\d,]+\s*(?:MXN|peso)/i, // Mexican peso
  /[\d,]+\s*(?:ZAR|rand)/i, // South African rand
  /[\d,]+\s*(?:TRY|lira)/i, // Turkish lira
  /[\d,]+\s*(?:PLN|zloty)/i, // Polish zloty
  /[\d,]+\s*(?:CZK|koruna)/i, // Czech koruna
  /[\d,]+\s*(?:HUF|forint)/i, // Hungarian forint
  /[\d,]+\s*(?:RON|leu)/i, // Romanian leu
  /[\d,]+\s*(?:BGN|lev)/i, // Bulgarian lev
  /[\d,]+\s*(?:HRK|kuna)/i, // Croatian kuna
  /[\d,]+\s*(?:RSD|dinar)/i, // Serbian dinar
  /[\d,]+\s*(?:UAH|hryvnia)/i, // Ukrainian hryvnia
  /[\d,]+\s*(?:BYN|ruble)/i, // Belarusian ruble
  /[\d,]+\s*(?:KZT|tenge)/i, // Kazakhstani tenge
  /[\d,]+\s*(?:UZS|som)/i, // Uzbekistani som
  /[\d,]+\s*(?:KGS|som)/i, // Kyrgyzstani som
  /[\d,]+\s*(?:TJS|somoni)/i, // Tajikistani somoni
  /[\d,]+\s*(?:TMT|manat)/i, // Turkmenistani manat
  /[\d,]+\s*(?:GEL|lari)/i, // Georgian lari
  /[\d,]+\s*(?:AMD|dram)/i, // Armenian dram
  /[\d,]+\s*(?:AZN|manat)/i, // Azerbaijani manat
  /[\d,]+\s*(?:MDL|leu)/i, // Moldovan leu
  /[\d,]+\s*(?:ALL|lek)/i, // Albanian lek
  /[\d,]+\s*(?:MKD|denar)/i, // Macedonian denar
  /[\d,]+\s*(?:BAM|marka)/i, // Bosnia and Herzegovina convertible mark
  /[\d,]+\s*(?:MNT|tugrik)/i, // Mongolian tugrik
  /[\d,]+\s*(?:LAK|kip)/i, // Lao kip
  /[\d,]+\s*(?:KHR|riel)/i, // Cambodian riel
  /[\d,]+\s*(?:MMK|kyat)/i, // Myanmar kyat
  /[\d,]+\s*(?:THB|baht)/i, // Thai baht
  /[\d,]+\s*(?:VND|dong)/i, // Vietnamese dong
  /[\d,]+\s*(?:IDR|rupiah)/i, // Indonesian rupiah
  /[\d,]+\s*(?:MYR|ringgit)/i, // Malaysian ringgit
  /[\d,]+\s*(?:SGD|dollar)/i, // Singapore dollar
  /[\d,]+\s*(?:PHP|peso)/i, // Philippine peso
  /[\d,]+\s*(?:TWD|dollar)/i, // Taiwan dollar
  /[\d,]+\s*(?:HKD|dollar)/i, // Hong Kong dollar
  /[\d,]+\s*(?:CNY|yuan)/i, // Chinese yuan
  /[\d,]+\s*(?:KRW|won)/i, // Korean won
  /[\d,]+\s*(?:JPY|yen)/i, // Japanese yen
  /[\d,]+\s*(?:INR|rupee)/i, // Indian rupee
  /[\d,]+\s*(?:PKR|rupee)/i, // Pakistani rupee
  /[\d,]+\s*(?:BDT|taka)/i, // Bangladeshi taka
  /[\d,]+\s*(?:LKR|rupee)/i, // Sri Lankan rupee
  /[\d,]+\s*(?:NPR|rupee)/i, // Nepalese rupee
  /[\d,]+\s*(?:BTN|ngultrum)/i, // Bhutanese ngultrum
  /[\d,]+\s*(?:MVR|rufiyaa)/i, // Maldivian rufiyaa
  /[\d,]+\s*(?:AFN|afghani)/i, // Afghan afghani
  /[\d,]+\s*(?:IRR|rial)/i, // Iranian rial
  /[\d,]+\s*(?:IQD|dinar)/i, // Iraqi dinar
  /[\d,]+\s*(?:JOD|dinar)/i, // Jordanian dinar
  /[\d,]+\s*(?:KWD|dinar)/i, // Kuwaiti dinar
  /[\d,]+\s*(?:LBP|pound)/i, // Lebanese pound
  /[\d,]+\s*(?:OMR|rial)/i, // Omani rial
  /[\d,]+\s*(?:QAR|riyal)/i, // Qatari riyal
  /[\d,]+\s*(?:SAR|riyal)/i, // Saudi riyal
  /[\d,]+\s*(?:SYP|pound)/i, // Syrian pound
  /[\d,]+\s*(?:AED|dirham)/i, // UAE dirham
  /[\d,]+\s*(?:YER|rial)/i, // Yemeni rial
  /[\d,]+\s*(?:BHD|dinar)/i, // Bahraini dinar
  /[\d,]+\s*(?:EGP|pound)/i, // Egyptian pound
  /[\d,]+\s*(?:LYD|dinar)/i, // Libyan dinar
  /[\d,]+\s*(?:MAD|dirham)/i, // Moroccan dirham
  /[\d,]+\s*(?:TND|dinar)/i, // Tunisian dinar
  /[\d,]+\s*(?:DZD|dinar)/i, // Algerian dinar
  /[\d,]+\s*(?:SDG|pound)/i, // Sudanese pound
  /[\d,]+\s*(?:ETB|birr)/i, // Ethiopian birr
  /[\d,]+\s*(?:KES|shilling)/i, // Kenyan shilling
  /[\d,]+\s*(?:NGN|naira)/i, // Nigerian naira
  /[\d,]+\s*(?:GHS|cedi)/i, // Ghanaian cedi
  /[\d,]+\s*(?:UGX|shilling)/i, // Ugandan shilling
  /[\d,]+\s*(?:TZS|shilling)/i, // Tanzanian shilling
  /[\d,]+\s*(?:ZMW|kwacha)/i, // Zambian kwacha
  /[\d,]+\s*(?:MWK|kwacha)/i, // Malawian kwacha
  /[\d,]+\s*(?:BWP|pula)/i, // Botswana pula
  /[\d,]+\s*(?:NAD|dollar)/i, // Namibian dollar
  /[\d,]+\s*(?:LSL|loti)/i, // Lesotho loti
  /[\d,]+\s*(?:SZL|lilangeni)/i, // Eswatini lilangeni
  /[\d,]+\s*(?:MUR|rupee)/i, // Mauritian rupee
  /[\d,]+\s*(?:SCR|rupee)/i, // Seychellois rupee
  /[\d,]+\s*(?:DJF|franc)/i, // Djiboutian franc
  /[\d,]+\s*(?:SOS|shilling)/i, // Somali shilling
  /[\d,]+\s*(?:ERN|nakfa)/i, // Eritrean nakfa
  /[\d,]+\s*(?:SSP|pound)/i, // South Sudanese pound
  /[\d,]+\s*(?:CDF|franc)/i, // Congolese franc
  /[\d,]+\s*(?:RWF|franc)/i, // Rwandan franc
  /[\d,]+\s*(?:BIF|franc)/i, // Burundian franc
  /[\d,]+\s*(?:XAF|franc)/i, // Central African CFA franc
  /[\d,]+\s*(?:XOF|franc)/i, // West African CFA franc
  /[\d,]+\s*(?:XPF|franc)/i, // CFP franc
  /[\d,]+\s*(?:KMF|franc)/i, // Comorian franc
  /[\d,]+\s*(?:GMD|dalasi)/i, // Gambian dalasi
  /[\d,]+\s*(?:GNF|franc)/i, // Guinean franc
  /[\d,]+\s*(?:LRD|dollar)/i, // Liberian dollar
  /[\d,]+\s*(?:SLE|leone)/i, // Sierra Leonean leone
  /[\d,]+\s*(?:GIP|pound)/i, // Gibraltar pound
  /[\d,]+\s*(?:FKP|pound)/i, // Falkland Islands pound
  /[\d,]+\s*(?:SHP|pound)/i, // Saint Helena pound
  /[\d,]+\s*(?:JEP|pound)/i, // Jersey pound
  /[\d,]+\s*(?:GGP|pound)/i, // Guernsey pound
  /[\d,]+\s*(?:IMP|pound)/i, // Isle of Man pound
  /[\d,]+\s*(?:GBP|pound)/i, // British pound
  /[\d,]+\s*(?:EUR|euro)/i, // Euro
  /[\d,]+\s*(?:USD|dollar)/i, // US dollar
]

// Common pricing page paths
const PRICING_PATHS = [
  '/pricing',
  '/price',
  '/plans',
  '/plan',
  '/subscription',
  '/billing',
  '/cost',
  '/tariffs',
  '/rates',
  '/preise', // German
  '/prix', // French
  '/precio', // Spanish
  '/prezzo', // Italian
  '/preco', // Portuguese
  '/цена', // Russian
  '/価格', // Japanese
  '/价格', // Chinese
  '/가격', // Korean
  '/hinnat', // Finnish
  '/hinta', // Finnish
  '/suunnitelmat', // Finnish
  '/tilaukset', // Finnish
]

async function findPricingPage(baseUrl: string): Promise<string[]> {
  const pricingUrls: string[] = []
  
  try {
    // First check the root page
    const rootResponse = await axios.get(baseUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    const $ = cheerio.load(rootResponse.data)
    
    // Look for pricing links in navigation and content
    const pricingLinks = $('a[href*="pricing"], a[href*="price"], a[href*="plan"], a[href*="subscription"], a[href*="billing"], a[href*="premium"], a[href*="pro"], a[href*="basic"], a[href*="enterprise"], a[href*="hinta"], a[href*="hinnat"]')
    
    pricingLinks.each((_, element) => {
      const href = $(element).attr('href')
      if (href) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href
        pricingUrls.push(fullUrl)
      }
    })
    
    // Also check common pricing paths
    for (const path of PRICING_PATHS) {
      try {
        const pricingUrl = new URL(path, baseUrl).href
        const response = await axios.head(pricingUrl, { timeout: 5000 })
        if (response.status === 200) {
          pricingUrls.push(pricingUrl)
        }
      } catch (error) {
        // Path doesn't exist, continue
      }
    }
    
  } catch (error) {
    console.error(`Error finding pricing pages for ${baseUrl}:`, error)
  }
  
  return Array.from(new Set(pricingUrls)) // Remove duplicates
}

function extractPricingInfo($: cheerio.CheerioAPI, url: string): PricingData[] {
  const results: PricingData[] = []
  
  // Remove script and style elements
  $('script, style, noscript').remove()
  
  // Pricing model keywords
  const modelKeywords = [
    'monthly', 'yearly', 'annual', 'one-time', 'one time', 'per month', 'per year',
    'mensual', 'anual', 'mensuel', 'annuel', 'monatlich', 'jährlich', 'mensile', 'annuale',
    '月額', '年額', '月费', '年费', '월간', '연간', 'kuukausi', 'vuosi', 'vuosittain' // Finnish
  ]
  
  // Common pricing selectors (more comprehensive)
  const pricingSelectors = [
    // Class-based selectors
    '[class*="pricing"]',
    '[class*="plan"]',
    '[class*="price"]',
    '[class*="subscription"]',
    '[class*="billing"]',
    '[class*="tariff"]',
    '[class*="rate"]',
    '[class*="cost"]',
    '[class*="premium"]',
    '[class*="pro"]',
    '[class*="basic"]',
    '[class*="enterprise"]',
    '[class*="starter"]',
    '[class*="business"]',
    '[class*="personal"]',
    '[class*="team"]',
    '[class*="individual"]',
    
    // ID-based selectors
    '[id*="pricing"]',
    '[id*="plan"]',
    '[id*="price"]',
    '[id*="subscription"]',
    '[id*="billing"]',
    '[id*="premium"]',
    '[id*="pro"]',
    '[id*="basic"]',
    '[id*="enterprise"]',
    
    // Data attributes
    '[data-testid*="pricing"]',
    '[data-testid*="plan"]',
    '[data-testid*="price"]',
    '[data-cy*="pricing"]',
    '[data-cy*="plan"]',
    '[data-cy*="price"]',
    '[data-testid*="premium"]',
    '[data-testid*="pro"]',
    '[data-testid*="basic"]',
    
    // Common pricing components
    '.pricing-table',
    '.pricing-card',
    '.plan-card',
    '.price-card',
    '.subscription-card',
    '.billing-card',
    '.tariff-card',
    '.rate-card',
    '.premium-card',
    '.pro-card',
    '.basic-card',
    '.enterprise-card',
    '.starter-card',
    '.business-card',
    '.personal-card',
    '.team-card',
    
    // Semantic elements
    'section[class*="pricing"]',
    'section[class*="plan"]',
    'section[class*="price"]',
    'section[class*="premium"]',
    'section[class*="pro"]',
    'section[class*="basic"]',
    'div[class*="pricing"]',
    'div[class*="plan"]',
    'div[class*="price"]',
    'div[class*="premium"]',
    'div[class*="pro"]',
    'div[class*="basic"]',
    
    // Table-based pricing
    'table[class*="pricing"]',
    'table[class*="plan"]',
    'table[class*="price"]',
    'tr[class*="pricing"]',
    'tr[class*="plan"]',
    'tr[class*="price"]',
    'td[class*="pricing"]',
    'td[class*="plan"]',
    'td[class*="price"]',
    
    // List-based pricing
    'ul[class*="pricing"]',
    'ul[class*="plan"]',
    'ul[class*="price"]',
    'li[class*="pricing"]',
    'li[class*="plan"]',
    'li[class*="price"]',
    
    // Generic elements that might contain pricing
    'article',
    'main',
    'aside',
    'header',
    'footer'
  ]
  
  let pricingElements = $()
  
  // Try to find pricing elements using selectors
  for (const selector of pricingSelectors) {
    const elements = $(selector)
    if (elements.length > 0) {
      pricingElements = pricingElements.add(elements)
    }
  }
  
  // If no specific pricing elements found, look for elements containing pricing keywords
  if (pricingElements.length === 0) {
    const allElements = $('*')
    allElements.each((_, element) => {
      const $el = $(element)
      const text = $el.text().toLowerCase()
      
      // Check if element contains pricing-related keywords in any language
      const hasPricingKeywords = Object.values(PRICING_KEYWORDS).some(keywords =>
        keywords.some(keyword => text.includes(keyword))
      )
      
      // Check if element contains price patterns
      const hasPricePattern = PRICE_PATTERNS.some(pattern => pattern.test(text))
      
      if (hasPricingKeywords || hasPricePattern) {
        pricingElements = pricingElements.add(element)
      }
    })
  }
  
    // Extract pricing information from found elements
  pricingElements.each((_, element) => {
    const $el = $(element)
    const text = $el.text().trim()
    
    if (text.length > 10 && text.length < 3000) { // Increased max length
      // Extract price using multiple patterns
      let price = ''
      for (const pattern of PRICE_PATTERNS) {
        const match = text.match(pattern)
        if (match) {
          price = match[0]
          break
        }
      }
      
      // Extract plan name using multiple languages and more flexible matching
      let planName = 'Unknown Plan'
      
      // First try exact word matching
      for (const [lang, keywords] of Object.entries(PRICING_KEYWORDS)) {
        for (const keyword of keywords) {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i')
          if (regex.test(text)) {
            planName = keyword.charAt(0).toUpperCase() + keyword.slice(1)
            break
          }
        }
        if (planName !== 'Unknown Plan') break
      }
      
      // If no exact match, try partial matching
      if (planName === 'Unknown Plan') {
        for (const [lang, keywords] of Object.entries(PRICING_KEYWORDS)) {
          for (const keyword of keywords) {
            if (text.toLowerCase().includes(keyword.toLowerCase())) {
              planName = keyword.charAt(0).toUpperCase() + keyword.slice(1)
              break
            }
          }
          if (planName !== 'Unknown Plan') break
        }
      }
      
             // Extract pricing model (monthly, yearly, annual, one-time, etc.)
       let pricingModel = 'Unknown'
       
       for (const keyword of modelKeywords) {
        if (text.toLowerCase().includes(keyword)) {
          pricingModel = keyword.charAt(0).toUpperCase() + keyword.slice(1)
          break
        }
      }
      
      // Only add if we found meaningful information
      if (price || planName !== 'Unknown Plan') {
        results.push({
          domain: new URL(url).hostname,
          planName: planName,
          price: price,
          pricingModel: pricingModel,
          url: url,
          scrapedAt: new Date().toISOString()
        })
      }
    }
  })
  
  // If no results found with selectors, try a more aggressive approach
  if (results.length === 0) {
    const allText = $('body').text()
    const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    for (const line of lines) {
      if (line.length > 10 && line.length < 500) {
        // Check if line contains price patterns
        let hasPrice = false
        for (const pattern of PRICE_PATTERNS) {
          if (pattern.test(line)) {
            hasPrice = true
            break
          }
        }
        
        // Check if line contains pricing keywords
        let hasPricingKeyword = false
        for (const [lang, keywords] of Object.entries(PRICING_KEYWORDS)) {
          for (const keyword of keywords) {
            if (line.toLowerCase().includes(keyword.toLowerCase())) {
              hasPricingKeyword = true
              break
            }
          }
          if (hasPricingKeyword) break
        }
        
        if (hasPrice && hasPricingKeyword) {
          // Extract price
          let price = ''
          for (const pattern of PRICE_PATTERNS) {
            const match = line.match(pattern)
            if (match) {
              price = match[0]
              break
            }
          }
          
          // Extract plan name
          let planName = 'Unknown Plan'
          for (const [lang, keywords] of Object.entries(PRICING_KEYWORDS)) {
            for (const keyword of keywords) {
              if (line.toLowerCase().includes(keyword.toLowerCase())) {
                planName = keyword.charAt(0).toUpperCase() + keyword.slice(1)
                break
              }
            }
            if (planName !== 'Unknown Plan') break
          }
          
          // Extract pricing model
          let pricingModel = 'Unknown'
          for (const keyword of modelKeywords) {
            if (line.toLowerCase().includes(keyword)) {
              pricingModel = keyword.charAt(0).toUpperCase() + keyword.slice(1)
              break
            }
          }
          
          results.push({
            domain: new URL(url).hostname,
            planName: planName,
            price: price,
            pricingModel: pricingModel,
            url: url,
            scrapedAt: new Date().toISOString()
          })
        }
      }
    }
  }
  
  return results
}

export async function POST(request: NextRequest) {
  try {
    const { domains } = await request.json()
    
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { error: 'Please provide a valid array of domains' },
        { status: 400 }
      )
    }

    const domainResults: DomainResult[] = []

    for (const domain of domains) {
      try {
        const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`
        const domainName = new URL(baseUrl).hostname
        const scrapedAt = new Date().toISOString()
        
        // First, try to find pricing pages
        const pricingUrls = await findPricingPage(baseUrl)
        
        // If no specific pricing pages found, use the root URL
        const urlsToScrape = pricingUrls.length > 0 ? pricingUrls : [baseUrl]
        
        const allPlans: PricingData[] = []
        
        for (const url of urlsToScrape) {
          try {
                         const response = await axios.get(url, {
               timeout: 20000, // Increased timeout
               headers: {
                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                 'Accept-Language': 'en-US,en;q=0.9,fi;q=0.8',
                 'Accept-Encoding': 'gzip, deflate, br',
                 'Connection': 'keep-alive',
                 'Upgrade-Insecure-Requests': '1',
                 'Sec-Fetch-Dest': 'document',
                 'Sec-Fetch-Mode': 'navigate',
                 'Sec-Fetch-Site': 'none',
                 'Sec-Fetch-User': '?1',
                 'Cache-Control': 'max-age=0',
               },
               maxRedirects: 5,
               validateStatus: (status) => status < 400
             })

            const $ = cheerio.load(response.data)
            const pricingData = extractPricingInfo($, url)
            
            if (pricingData.length > 0) {
              allPlans.push(...pricingData)
            }
          } catch (error) {
            console.error(`Error scraping ${url}:`, error)
          }
        }
        
        // Create domain result
        if (allPlans.length > 0) {
          domainResults.push({
            domain: domainName,
            url: baseUrl,
            plans: allPlans,
            scrapedAt: scrapedAt,
            status: 'success'
          })
        } else {
          domainResults.push({
            domain: domainName,
            url: baseUrl,
                       plans: [{
             domain: domainName,
             planName: 'No pricing found',
             price: 'N/A',
             pricingModel: 'Unknown',
             url: baseUrl,
             scrapedAt: scrapedAt
           }],
            scrapedAt: scrapedAt,
            status: 'no_pricing'
          })
        }

      } catch (error) {
        console.error(`Error processing ${domain}:`, error)
        domainResults.push({
          domain: domain,
          url: domain,
                     plans: [{
             domain: domain,
             planName: 'Error',
             price: 'N/A',
             pricingModel: 'Unknown',
             url: domain,
             scrapedAt: new Date().toISOString()
           }],
          scrapedAt: new Date().toISOString(),
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({ 
      results: domainResults,
      summary: {
        totalDomains: domainResults.length,
        successful: domainResults.filter(r => r.status === 'success').length,
        noPricing: domainResults.filter(r => r.status === 'no_pricing').length,
        errors: domainResults.filter(r => r.status === 'error').length
      }
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
