# Astrology Scraping System Setup

## Overview
This system scrapes daily horoscopes from 10 randomly selected astrology websites, generates embeddings, clusters them using UMAP, and synthesizes lab-themed predictions using Hugging Face's free LLM API.

## Prerequisites
- Hugging Face API token (free): https://huggingface.co/settings/tokens
- GitHub repository with Actions enabled

## Setup Instructions

### 1. Add Hugging Face Token to GitHub Secrets
1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `HF_TOKEN`
4. Value: Your `hf_...` token
5. Click "Add secret"

### 2. Install Dependencies (for local testing)
```bash
npm install
```

### 3. Test Locally (Optional)
```bash
# Test the scraper
node .github/workflows/scripts/astrology_scraper.js

# Check the output
cat data/astrology_daily.json
```

### 4. Deploy
The GitHub Action will run automatically every day at 6am AEST (8pm UTC).

You can also trigger it manually:
1. Go to Actions tab
2. Select "Update Astrology Data"
3. Click "Run workflow"

## How It Works

### Daily Process
1. **Site Selection**: Randomly selects 10 sites from the pool of 15 (seeded by date for reproducibility)
2. **Scraping**: Fetches predictions for all 12 zodiac signs from each site
3. **Embedding**: Generates semantic embeddings using sentence-transformers
4. **UMAP**: Projects embeddings to 2D space for visualization
5. **Synthesis**: Uses Mistral-7B (via Hugging Face API) to create lab-themed predictions
6. **Commit**: Updates `data/astrology_daily.json` and pushes to repo

### File Structure
```
.github/workflows/
  ├── update-astrology.yml          # GitHub Actions workflow
  └── scripts/
      ├── astrology_scraper.js      # Main scraper script
      ├── astrology_sites.json      # Site configuration
      └── lab_terms.js              # Lab terminology mapping
data/
  └── astrology_daily.json          # Generated data (updated daily)
scripts/
  └── astrology.js                  # Frontend visualization
astrology.html                      # Astrology page
```

## Troubleshooting

### Scraper Fails
- Check GitHub Actions logs
- Verify HF_TOKEN is set correctly
- Some sites may have changed their HTML structure

### No Predictions Generated
- Hugging Face API may be rate limited (wait 1 hour)
- Check that HF_TOKEN has "read" permissions

### UMAP Not Displaying
- Check browser console for errors
- Verify `astrology_daily.json` is valid JSON
- Ensure D3.js is loaded

## Customization

### Add More Sites
Edit `.github/workflows/scripts/astrology_sites.json` and add new site configurations.

### Change Daily Selection Count
In `astrology_scraper.js`, modify:
```javascript
return shuffled.slice(0, 10);  // Change 10 to desired number
```

### Adjust LLM Prompt
In `astrology_scraper.js`, edit the `synthesizePrediction()` function.

## API Costs
- **Hugging Face**: FREE (1000 requests/day)
- **GitHub Actions**: FREE (2000 minutes/month)
- **Total**: $0/month

## License
MIT
