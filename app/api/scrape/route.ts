import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

interface PricingData {
  domain: string
  planName: string
  price: string
  features: string[]
  url: string
  scrapedAt: string
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

    const results: PricingData[] = []

    for (const domain of domains) {
      try {
        const url = domain.startsWith('http') ? domain : `https://${domain}`
        
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        const $ = cheerio.load(response.data)
        
        // Common pricing selectors
        const pricingSelectors = [
          '[class*="pricing"]',
          '[class*="plan"]',
          '[class*="price"]',
          '.pricing-table',
          '.pricing-card',
          '.plan-card',
          '.price-card',
          '[data-testid*="pricing"]',
          '[data-testid*="plan"]',
          '.subscription',
          '.billing'
        ]

        let pricingElements = $()
        
        // Try to find pricing elements
        for (const selector of pricingSelectors) {
          const elements = $(selector)
          if (elements.length > 0) {
            pricingElements = elements
            break
          }
        }

        // If no specific pricing elements found, look for common patterns
        if (pricingElements.length === 0) {
          // Look for elements containing price-related text
          $('*').each((_, element) => {
            const text = $(element).text().toLowerCase()
            if (text.includes('$') || text.includes('price') || text.includes('plan') || text.includes('monthly') || text.includes('yearly')) {
              pricingElements = pricingElements.add(element)
            }
          })
        }

        // Extract pricing information
        pricingElements.each((_, element) => {
          const $el = $(element)
          const text = $el.text().trim()
          
          if (text.length > 10 && text.length < 1000) {
            // Extract price using regex
            const priceMatch = text.match(/\$[\d,]+(?:\.\d{2})?/)
            const price = priceMatch ? priceMatch[0] : ''
            
            // Extract plan name
            const planMatch = text.match(/(?:basic|pro|premium|enterprise|starter|advanced|professional|business|personal|team|individual)/i)
            const planName = planMatch ? planMatch[0] : 'Unknown Plan'
            
            // Extract features (simple approach)
            const features = text.split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0 && line.length < 100)
              .slice(0, 5) // Limit to 5 features

            if (price || planName !== 'Unknown Plan') {
              results.push({
                domain: domain,
                planName: planName,
                price: price,
                features: features,
                url: url,
                scrapedAt: new Date().toISOString()
              })
            }
          }
        })

        // If no pricing found, add a basic entry
        if (results.filter(r => r.domain === domain).length === 0) {
          results.push({
            domain: domain,
            planName: 'No pricing found',
            price: 'N/A',
            features: ['No pricing information detected'],
            url: url,
            scrapedAt: new Date().toISOString()
          })
        }

      } catch (error) {
        console.error(`Error scraping ${domain}:`, error)
        results.push({
          domain: domain,
          planName: 'Error',
          price: 'N/A',
          features: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
          url: domain,
          scrapedAt: new Date().toISOString()
        })
      }
    }

    return NextResponse.json({ results })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
