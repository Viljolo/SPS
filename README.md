# Website Pricing Scraper

A modern web application that scrapes pricing plans from websites with a beautiful dark theme UI. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Dark Theme UI** - Modern and sleek dark interface
- 🔍 **Single Domain Scraping** - Enter individual domains to scrape
- 📁 **Bulk CSV Upload** - Upload CSV files with multiple domains
- 📊 **Real-time Results** - View scraped pricing data instantly
- 📥 **CSV Export** - Download results as CSV files
- ⚡ **Fast & Responsive** - Built with Next.js for optimal performance
- 🚀 **Vercel Ready** - Easy deployment to Vercel

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom dark theme
- **Icons**: Lucide React
- **Scraping**: Cheerio, Axios
- **CSV Handling**: PapaParse
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd website-pricing-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Single Domain Scraping

1. Enter a domain in the input field (e.g., `example.com` or `https://example.com`)
2. Click "Scrape Domain"
3. View the results in the right panel
4. Download the CSV file if needed

### Bulk CSV Upload

1. Prepare a CSV file with domains in the first column:
```csv
example.com
another-site.com
third-website.com
```

2. Click "Choose CSV File" and select your file
3. The app will automatically process all domains
4. View results and download the combined CSV

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically or manually

The app includes a `vercel.json` configuration file for optimal deployment.

## How It Works

The scraper uses intelligent pattern matching to find pricing information:

1. **Common Selectors**: Looks for elements with pricing-related class names
2. **Text Analysis**: Searches for price patterns ($XX.XX) and plan names
3. **Feature Extraction**: Identifies and lists plan features
4. **Error Handling**: Gracefully handles failed requests and missing data

## API Endpoints

### POST /api/scrape

Scrapes pricing data from provided domains.

**Request Body:**
```json
{
  "domains": ["example.com", "another-site.com"]
}
```

**Response:**
```json
{
  "results": [
    {
      "domain": "example.com",
      "planName": "Pro Plan",
      "price": "$29.99",
      "features": ["Feature 1", "Feature 2"],
      "url": "https://example.com",
      "scrapedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Customization

### Styling

The app uses Tailwind CSS with a custom dark theme. Modify `tailwind.config.js` and `app/globals.css` to customize the appearance.

### Scraping Logic

Edit `app/api/scrape/route.ts` to modify the scraping logic, add new selectors, or change the data extraction patterns.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please open an issue on GitHub.
