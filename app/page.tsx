'use client'

import { useState, useRef } from 'react'
import { Upload, Download, Search, Globe, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface PricingData {
  domain: string
  planName: string
  price: string
  features: string[]
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

interface ScrapingSummary {
  totalDomains: number
  successful: number
  noPricing: number
  errors: number
}

export default function Home() {
  const [domains, setDomains] = useState<string>('')
  const [results, setResults] = useState<DomainResult[]>([])
  const [summary, setSummary] = useState<ScrapingSummary | null>(null)
  const [activeTab, setActiveTab] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSingleDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domains.trim()) {
      setError('Please enter a domain')
      return
    }

    await scrapeDomains([domains.trim()])
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string
        const lines = csv.split('\n').filter(line => line.trim())
        const domains = lines.map(line => line.split(',')[0].trim()).filter(domain => domain)
        
        if (domains.length === 0) {
          setError('No valid domains found in CSV file')
          return
        }

        await scrapeDomains(domains)
      } catch (error) {
        setError('Error reading CSV file')
      }
    }
    reader.readAsText(file)
  }

  const scrapeDomains = async (domainList: string[]) => {
    setIsLoading(true)
    setError('')
    setResults([])
    setSummary(null)
    setActiveTab('')

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains: domainList }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape websites')
      }

      setResults(data.results)
      setSummary(data.summary)
      
      // Set first successful domain as active tab
      const firstSuccess = data.results.find((r: DomainResult) => r.status === 'success')
      if (firstSuccess) {
        setActiveTab(firstSuccess.domain)
      } else if (data.results.length > 0) {
        setActiveTab(data.results[0].domain)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadCSV = () => {
    if (results.length === 0) return

    const headers = ['Domain', 'Plan Name', 'Price', 'Features', 'URL', 'Scraped At']
    const csvContent = [
      headers.join(','),
      ...results.flatMap(domainResult => 
        domainResult.plans.map(plan => [
          domainResult.domain,
          `"${plan.planName}"`,
          plan.price,
          `"${plan.features.join('; ')}"`,
          plan.url,
          plan.scrapedAt
        ].join(','))
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pricing-data-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-dark-950 text-gray-100">
      {/* Header */}
      <header className="bg-dark-900 border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Website Pricing Scraper</h1>
                <p className="text-gray-400 text-sm">Extract pricing plans from websites</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Single Domain
              </h2>
              <form onSubmit={handleSingleDomainSubmit} className="space-y-4">
                <div>
                  <label htmlFor="domain" className="block text-sm font-medium text-gray-300 mb-2">
                    Enter Domain
                  </label>
                  <input
                    type="text"
                    id="domain"
                    value={domains}
                    onChange={(e) => setDomains(e.target.value)}
                    placeholder="example.com or https://example.com"
                    className="input-field w-full"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {isLoading ? 'Scraping...' : 'Scrape Domain'}
                </button>
              </form>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Bulk Upload (CSV)
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Upload CSV File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="btn-secondary w-full flex items-center justify-center"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose CSV File
                  </button>
                </div>
                <p className="text-sm text-gray-400">
                  CSV should contain domains in the first column, one per row.
                </p>
              </div>
            </div>

            {error && (
              <div className="card bg-red-900/20 border-red-700">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                  <span className="text-red-400">{error}</span>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Results</h2>
              {results.length > 0 && (
                <button
                  onClick={downloadCSV}
                  className="btn-primary flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </button>
              )}
            </div>

            {/* Summary */}
            {summary && (
              <div className="flex items-center justify-center space-x-6 py-4 bg-dark-800 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary-400">{summary.totalDomains}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">{summary.successful}</div>
                  <div className="text-xs text-gray-400">Success</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-400">{summary.noPricing}</div>
                  <div className="text-xs text-gray-400">No Pricing</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-400">{summary.errors}</div>
                  <div className="text-xs text-gray-400">Errors</div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="card">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500 mr-3" />
                  <span className="text-lg">Scraping websites...</span>
                </div>
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="card">
                <div className="text-center py-8">
                  <Globe className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No results yet. Start scraping to see pricing data.</p>
                </div>
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <div className="space-y-4">
                {/* Domain Tabs */}
                <div className="flex flex-wrap gap-2">
                  {results.map((domainResult, index) => (
                    <button
                      key={domainResult.domain}
                      onClick={() => setActiveTab(domainResult.domain)}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === domainResult.domain
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span>{domainResult.domain}</span>
                        {domainResult.status === 'success' && (
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        )}
                        {domainResult.status === 'no_pricing' && (
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                        )}
                        {domainResult.status === 'error' && (
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Active Domain Content */}
                {activeTab && (
                  <div className="card">
                    {results
                      .filter(r => r.domain === activeTab)
                      .map((domainResult, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h3 className="text-xl font-semibold text-white">{domainResult.domain}</h3>
                              <p className="text-sm text-gray-400">{domainResult.url}</p>
                            </div>
                            <div className="text-right">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                domainResult.status === 'success' ? 'bg-green-900 text-green-300' :
                                domainResult.status === 'no_pricing' ? 'bg-yellow-900 text-yellow-300' :
                                'bg-red-900 text-red-300'
                              }`}>
                                {domainResult.status === 'success' ? 'Success' :
                                 domainResult.status === 'no_pricing' ? 'No Pricing' : 'Error'}
                              </span>
                            </div>
                          </div>

                          {domainResult.plans.map((plan, planIndex) => (
                            <div key={planIndex} className="mb-4 p-4 bg-dark-800 rounded-lg border border-dark-600">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-white text-lg">{plan.planName}</h4>
                                <span className="text-xl font-bold text-primary-400">{plan.price}</span>
                              </div>
                              
                              {plan.features.length > 0 && plan.features[0] !== 'No pricing information detected on this website' && (
                                <div className="space-y-2">
                                  {plan.features.slice(0, 5).map((feature, featureIndex) => (
                                    <div key={featureIndex} className="text-sm text-gray-300 flex items-start">
                                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                      <span>{feature}</span>
                                    </div>
                                  ))}
                                  {plan.features.length > 5 && (
                                    <p className="text-xs text-gray-500 italic">
                                      +{plan.features.length - 5} more features
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          {domainResult.errorMessage && (
                            <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                              <p className="text-red-400 text-sm">{domainResult.errorMessage}</p>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
