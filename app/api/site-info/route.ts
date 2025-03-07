import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import axios from 'axios';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Fetch site data
    const startTime = Date.now();
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteAnalyzer/1.0)',
      },
    });

    const dom = new JSDOM(response.data);
    const { document } = dom.window;

    // Extract metadata
    const title = document.title || '';
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const keywordsTag = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
    const keywords = keywordsTag ? keywordsTag.split(',').map(k => k.trim()).filter(Boolean) : [];

    // Extract headings
    const headings = {
      h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim() || '').filter(Boolean),
      h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim() || '').filter(Boolean),
      h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim() || '').filter(Boolean),
    };

    // Count links
    const linkElements = document.querySelectorAll('a[href]');
    let internalLinks = 0;
    let externalLinks = 0;
    const hostName = parsedUrl.hostname;
    
    linkElements.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.hostname === hostName || href.startsWith('/')) {
          internalLinks++;
        } else if (linkUrl.protocol.startsWith('http')) {
          externalLinks++;
        }
      } catch {}
    });

    // Enhanced SEO score calculation
    let seoScore = 0;

    if (title) seoScore += (title.length > 10 && title.length < 60) ? 10 : 5;
    if (description) seoScore += (description.length > 50 && description.length < 160) ? 10 : 5;
    if (headings.h1.length === 1) seoScore += 10;
    if (headings.h2.length > 0) seoScore += 5;
    if (headings.h3.length > 0) seoScore += 5;
    if (keywords.length > 0 && keywords.length < 10) seoScore += 10;
    if (internalLinks > 0) seoScore += Math.min(internalLinks, 10);
    if (document.querySelector('meta[property^="og:"]')) seoScore += 10;
    if (document.querySelector('meta[name^="twitter:"]')) seoScore += 10;
    if (url.startsWith('https://')) seoScore += 10;
    if (document.querySelector('meta[name="viewport"]')) seoScore += 10;
    if (document.querySelector('link[rel="canonical"]')) seoScore += 10;

    // Additional SEO checks
    const images = document.querySelectorAll('img');
    const imagesWithAlt = Array.from(images).filter(img => img.hasAttribute('alt') && img.getAttribute('alt') !== '').length;
    if (images.length > 0 && imagesWithAlt / images.length > 0.8) seoScore += 10;
    if (document.querySelector('script[type="application/ld+json"]')) seoScore += 10;

    // Extract images (up to 20)
    const imageData = Array.from(document.querySelectorAll('img[src]'))
      .slice(0, 20)
      .map(img => {
        const src = img.getAttribute('src');
        if (!src || src.startsWith('data:')) return null;
        try {
          return {
            src: new URL(src, url).href,
            alt: img.getAttribute('alt') || '',
            width: img.getAttribute('width') || null,
            height: img.getAttribute('height') || null,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Enhanced category structure, static pages, and content sections
    const categoryStructure = extractCategoryStructure(document);
    const staticPageLinks = extractStaticPageLinks(document);
    const contentSections = extractContentSections(document);

    // Combine all links
   // Combine all links
const combinedLinks = [...categoryStructure, ...staticPageLinks];
    // Response object
    const siteInfo = {
      title,
      description,
      keywords,
      headings,
      internalLinks,
      externalLinks,
      seoScore,
      images: imageData,
      socialMetadata: {
        openGraphTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
        openGraphDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        openGraphImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '',
        twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '',
        twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '',
      },
      technicalMetadata: {
        contentType: response.headers['content-type'] || '',
        serverHeader: response.headers,
        loadTime: Date.now() - startTime,
      },
      categoryStructure,
      staticPageLinks : combinedLinks,
      headingStructure: headings,
      contentSections,
    };

    return NextResponse.json(siteInfo);
  } catch (error: any) {
    console.error('Site Analysis Error:', error.message, error.stack);
    const status = error.response?.status || 500;
    const message = error.code === 'ECONNABORTED' ? 'Request timed out' : error.message || 'Failed to analyze site';
    return NextResponse.json({ error: message }, { status });
  }
}

// Enhanced helper functions

// function extractCategoryStructure(doc: Document): any[] {
//   const categories: any[] = [];
//   const navElements = doc.querySelectorAll('nav, .navigation, .menu, ul');

//   navElements.forEach(nav => {
//     const links = nav.querySelectorAll('a');
//     links.forEach(link => {
//       const title = link.textContent?.trim();
//       const href = link.getAttribute('href');
//       if (!title || !href) return;

//       try {
//         const subcategories: string[] = [];
//         const parentLi = link.closest('li');
//         if (parentLi) {
//           const subUl = parentLi.querySelector('ul');
//           if (subUl) {
//             subcategories.push(
//               ...Array.from(subUl.querySelectorAll('a'))
//                 .map(subLink => subLink.textContent?.trim() || '')
//                 .filter(Boolean)
//             );
//           }
//         }
//         categories.push({
//           title,
//           url: href,
//           hasSubcategories: subcategories.length > 0,
//           subcategories,
//         });
//       } catch {}
//     });
//   });

//   return categories;
// }

// function extractStaticPageLinks(doc: Document): any[] {
//   const staticPages: any[] = [];
//   const selectors = [
//     'footer a',
//     '.footer-links a',
//     '.footer-menu a',
//     'nav a',
//     '#navigation',
//     '.main-nav a',
//     '.menu a',
//     '.sidebar a',
//     '.static-links a',
//     'header a',
//     'category-level-1',
//     'has-sub-category',
//     'footer-menu-container',
//     'footer-menu',
//     'footer-social'

//   ];

//   selectors.forEach(selector => {
//     const links = doc.querySelectorAll(selector);
//     links.forEach(link => {
//       const title = link.textContent?.trim();
//       const href = link.getAttribute('href');
//       if (!title || !href) return;

//       try {
//         const url = new URL(href, doc.location.href).href;
//         if (url.match(/facebook\.com|instagram\.com|twitter\.com/)) return;

//         staticPages.push({
//           title,
//           url,
//           section: link.closest('footer, nav, .sidebar')?.querySelector('h3, h4')?.textContent?.trim() || 'Unknown',
//         });
//       } catch {}
//     });
//   });

//   return staticPages;
// }

export function extractContentSections(doc: Document): any[] {
  const sections: any[] = [];
  const contentSelectors = ['main', '#content', '.content-area', '.main-content', 'article'];

  const mainContent = contentSelectors
    .map(selector => doc.querySelector(selector))
    .find(el => el) || doc.body;

  const headings = mainContent.querySelectorAll('h1, h2, h3');
  headings.forEach(heading => {
    let content = '';
    let current = heading.nextElementSibling;
    while (current && !current.matches('h1, h2, h3')) {
      content += current.textContent + ' ';
      current = current.nextElementSibling;
    }
    sections.push({
      title: heading.textContent?.trim() || '',
      level: heading.tagName.toLowerCase(),
      content: content.trim(),
    });
  });

  return sections;
}

// yeni link kontrolu 
export function extractStaticPageLinks(doc: Document): any[] {
  const staticPages: any[] = [];
  const uniqueUrls = new Set<string>();

  // Footer linkleri
  const footerMenus = doc.querySelectorAll('.footer-menu');
  footerMenus.forEach(menu => {
    const sectionTitleElement = menu.querySelector('.footer-menu-title');
    const sectionTitle = sectionTitleElement?.textContent?.trim() || 'Footer';

    const links = menu.querySelectorAll('a');
    links.forEach(link => {
      const title = link.textContent?.trim();
      const href = link.getAttribute('href');
      if (!title || !href) return;

      try {
        const url = new URL(href, doc.location.href).href;
        if (uniqueUrls.has(url)) return;
        uniqueUrls.add(url);

        if (url.match(/facebook\.com|instagram\.com|twitter\.com|pinterest\.com|youtube\.com|linkedin\.com|wa\.me/)) return;

        staticPages.push({
          title,
          url,
          section: sectionTitle
        });
      } catch {}
    });
  });

  // Navigation'daki statik sayfalar
  const navElement = doc.querySelector('nav#navigation');
  if (navElement) {
    const staticItems = navElement.querySelectorAll('li[data-selector="first-level-category"]');
    staticItems.forEach(item => {
      const link = item.querySelector('a');
      if (!link) return;

      const title = link.textContent?.trim();
      const href = link.getAttribute('href');
      if (!title || !href) return;

      try {
        const url = new URL(href, doc.location.href).href;
        if (uniqueUrls.has(url)) return;
        uniqueUrls.add(url);

        if (url.match(/facebook\.com|instagram\.com|twitter\.com|pinterest\.com|youtube\.com|linkedin\.com|wa\.me/)) return;

        staticPages.push({
          title,
          url,
          section: 'Navigation'
        });
      } catch {}
    });
  }

  return staticPages;
}
export function extractCategoryStructure(doc: Document): any[] {
  const categories: any[] = [];
  const navElement = doc.querySelector('nav#navigation');
  if (!navElement) return categories;

  const uniqueUrls = new Set<string>();
  const categoryItems = navElement.querySelectorAll('li[data-selector="first-level-navigation"], li[data-selector="first-level-category"]');
  
  categoryItems.forEach(item => {
    const link = item.querySelector('a');
    if (!link) return;

    const title = link.textContent?.trim();
    const href = link.getAttribute('href');
    if (!title || !href) return;

    try {
      const url = new URL(href, doc.location.href).href;
      if (uniqueUrls.has(url)) return;
      uniqueUrls.add(url);

      // Skip social media or external links in navigation
      if (url.match(/facebook\.com|instagram\.com|twitter\.com|pinterest\.com|youtube\.com|linkedin\.com|wa\.me/)) return;

      const subcategories: string[] = [];
      const subCategoryContainer = item.querySelector('.sub-category.category-level-2');
      if (subCategoryContainer) {
        const subLinks = subCategoryContainer.querySelectorAll('a');
        subLinks.forEach(subLink => {
          const subTitle = subLink.textContent?.trim();
          if (subTitle) subcategories.push(subTitle);
        });
      }

      categories.push({
        title,
        url,
        hasSubcategories: subcategories.length > 0,
        subcategories,
        section: 'Navigation'
      });
    } catch {}
  });

  return categories;
}

