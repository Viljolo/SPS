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

export default function Home() {
  const [domains, setDomains] = useState<string>('')
  const [results, setResults] = useState<PricingData[]>([])
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
      ...results.map(result => [
        result.domain,
        `"${result.planName}"`,
        result.price,
        `"${result.features.join('; ')}"`,
        result.url,
        result.scrapedAt
      ].join(','))
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
                {results.map((result, index) => (
                  <div key={index} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{result.domain}</h3>
                        <p className="text-sm text-gray-400">{result.url}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary-400">{result.price}</span>
                        <p className="text-sm text-gray-400">{result.planName}</p>
                      </div>
                    </div>
                    
                    {result.features.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Features:</h4>
                        <ul className="space-y-1">
                          {result.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="text-sm text-gray-400 flex items-center">
                              <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="mt-3 pt-3 border-t border-dark-700">
                      <p className="text-xs text-gray-500">
                        Scraped: {new Date(result.scrapedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
