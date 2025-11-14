# Vinyl Beats Radio

Pure house music 24/7. No commercials, just curated house sounds.

## Project Structure

```
vinylvibes/
├── index.html              # Main HTML file
├── CNAME                   # Domain configuration for GitHub Pages
├── robots.txt              # SEO robots file
├── .htaccess              # Apache server configuration (security & performance)
├── .gitignore             # Git ignore rules
├── README.md              # This file
│
└── assets/                 # All static assets
    ├── css/
    │   └── styles.css      # Main stylesheet
    ├── js/
    │   └── script.js       # Main JavaScript file
    ├── icons/              # Favicons and app icons (to be added)
    ├── images/             # Images (logo, OG images, etc. - to be added)
    ├── OTF/                # Font files (Clash Grotesk)
    │   ├── ClashGrotesk-Bold.otf
    │   ├── ClashGrotesk-Extralight.otf
    │   ├── ClashGrotesk-Light.otf
    │   ├── ClashGrotesk-Medium.otf
    │   ├── ClashGrotesk-Regular.otf
    │   └── ClashGrotesk-Semibold.otf
    └── manifest.json       # PWA manifest file
```

## Features

- 🎵 Multiple radio stations
- 🌓 Dark/Light mode with localStorage persistence
- 📱 Fully responsive design (mobile-first)
- 🎧 Fixed player (SoundCloud style)
- 🔒 Security headers and best practices
- 📈 SEO optimized
- ⚡ Performance optimized

## Setup

1. Clone the repository
2. Ensure all assets are in place
3. Configure your domain in `CNAME` if using GitHub Pages
4. Add favicon and logo files to `assets/icons/` and `assets/images/`

## Required Assets (To be added)

### Icons (`assets/icons/`)
- `favicon-32x32.png` (32x32px)
- `favicon-16x16.png` (16x16px)
- `apple-touch-icon.png` (180x180px)
- `android-chrome-192x192.png` (192x192px)
- `android-chrome-512x512.png` (512x512px)

### Images (`assets/images/`)
- `logo.png` - Main logo
- `og-image.jpg` (1200x630px) - Open Graph image
- `twitter-card.jpg` (1200x630px) - Twitter Card image

## Deployment

The site is configured for GitHub Pages. Ensure:
- `CNAME` file points to your domain
- Domain DNS is configured correctly
- SSL certificate is active (for HTTPS)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive Web App (PWA) compatible

## License

© 2025 Vinyl Beats Radio · Design and technology by javibeat

