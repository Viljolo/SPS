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
  en: ['pricing', 'price', 'plan', 'subscription', 'billing', 'cost', 'monthly', 'yearly', 'annual', 'premium', 'pro', 'basic', 'enterprise', 'starter', 'business', 'personal', 'team', 'individual'],
  es: ['precio', 'plan', 'suscripción', 'facturación', 'costo', 'mensual', 'anual', 'premium', 'básico', 'empresa', 'personal', 'equipo'],
  fr: ['prix', 'plan', 'abonnement', 'facturation', 'coût', 'mensuel', 'annuel', 'premium', 'basique', 'entreprise', 'personnel', 'équipe'],
  de: ['preis', 'plan', 'abonnement', 'abrechnung', 'kosten', 'monatlich', 'jährlich', 'premium', 'grundlegend', 'unternehmen', 'persönlich', 'team'],
  it: ['prezzo', 'piano', 'abbonamento', 'fatturazione', 'costo', 'mensile', 'annuale', 'premium', 'base', 'azienda', 'personale', 'squadra'],
  pt: ['preço', 'plano', 'assinatura', 'faturamento', 'custo', 'mensal', 'anual', 'premium', 'básico', 'empresa', 'pessoal', 'equipe'],
  ru: ['цена', 'план', 'подписка', 'биллинг', 'стоимость', 'месячный', 'годовой', 'премиум', 'базовый', 'бизнес', 'личный', 'команда'],
  ja: ['価格', 'プラン', 'サブスクリプション', '請求', 'コスト', '月額', '年額', 'プレミアム', 'ベーシック', 'ビジネス', '個人', 'チーム'],
  zh: ['价格', '计划', '订阅', '计费', '成本', '月费', '年费', '高级', '基础', '商业', '个人', '团队'],
  ko: ['가격', '플랜', '구독', '청구', '비용', '월간', '연간', '프리미엄', '기본', '비즈니스', '개인', '팀']
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
    const pricingLinks = $('a[href*="pricing"], a[href*="price"], a[href*="plan"], a[href*="subscription"], a[href*="billing"]')
    
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
    
    // ID-based selectors
    '[id*="pricing"]',
    '[id*="plan"]',
    '[id*="price"]',
    '[id*="subscription"]',
    '[id*="billing"]',
    
    // Data attributes
    '[data-testid*="pricing"]',
    '[data-testid*="plan"]',
    '[data-testid*="price"]',
    '[data-cy*="pricing"]',
    '[data-cy*="plan"]',
    '[data-cy*="price"]',
    
    // Common pricing components
    '.pricing-table',
    '.pricing-card',
    '.plan-card',
    '.price-card',
    '.subscription-card',
    '.billing-card',
    '.tariff-card',
    '.rate-card',
    
    // Semantic elements
    'section[class*="pricing"]',
    'section[class*="plan"]',
    'section[class*="price"]',
    'div[class*="pricing"]',
    'div[class*="plan"]',
    'div[class*="price"]',
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
    
    if (text.length > 10 && text.length < 2000) {
      // Extract price using multiple patterns
      let price = ''
      for (const pattern of PRICE_PATTERNS) {
        const match = text.match(pattern)
        if (match) {
          price = match[0]
          break
        }
      }
      
      // Extract plan name using multiple languages
      let planName = 'Unknown Plan'
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
      
             // Extract pricing model (monthly, yearly, annual, one-time, etc.)
       let pricingModel = 'Unknown'
       const modelKeywords = [
         'monthly', 'yearly', 'annual', 'one-time', 'one time', 'per month', 'per year',
         'mensual', 'anual', 'mensuel', 'annuel', 'monatlich', 'jährlich', 'mensile', 'annuale',
         '月額', '年額', '月费', '年费', '월간', '연간'
       ]
       
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
              timeout: 15000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
              }
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
