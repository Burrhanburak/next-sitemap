'use server';

import { JSDOM } from 'jsdom';
import axios, { AxiosInstance } from 'axios';
import xml2js from 'xml2js';

// Mark this file as server-only


// Create a custom axios instance with retry logic
const axiosInstance: AxiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; SitemapCrawler/1.0)'
  }
});

// Add response interceptor for rate limiting
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 30;
      const delayMs = (parseInt(retryAfter) || 30) * 1000; // Convert to ms, default 30s
      console.log(`Rate limited. Waiting ${delayMs/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return axiosInstance.request(error.config);
    }
    return Promise.reject(error);
  }
);

// Helper function for controlled delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SelectorConfig {
  selector: string;
  attr?: string;
}

export interface PageData {
  url: string;
  title?: string;
  description?: string;
  price?: string;
  stockStatus?: string;
  images?: string[];
  category?: string;
  date?: string;
  features?: string[];
  comments?: { author: string; content: string; date: string }[];
  breadcrumb?: string[];  // Added breadcrumb property
  blogContent?: string;
  blogCategories?: string[];
  structuredData?: any;
  timestamp?: string;
  error?: string;
  type?: string;  // Added type property
}

const CRAWL_CONFIG = {
  selectors: {
    image: [
      { selector: 'meta[property="og:image"]', attr: 'content' },
      { selector: 'img[src]' },
    ],
    title: [
      { selector: 'meta[property="og:title"]', attr: 'content' },
      { selector: 'title' },
    ],
    description: [
      { selector: 'meta[property="og:description"]', attr: 'content' },
      { selector: 'meta[name="description"]', attr: 'content' },
      { selector: 'meta[name="og:description"]', attr: 'content' },
      { selector: 'meta[name="twitter:description"]', attr: 'content' },
      { selector: 'meta[name="description"]', attr: 'content' },
      { selector: 'meta[name="description"]', attr: 'content' },
      { selector: 'meta[name="description"]', attr: 'content' },
    ],
    price: [
      { selector: 'meta[property="product:price:amount"]', attr: 'content' },
      { selector: '.price, [itemprop="price"]' },
      { selector: '.product-price' }, // Common price selectors
    ],
    stock: [
      { selector: 'meta[property="product:availability"]', attr: 'content' },
      { selector: '.stock, [itemprop="availability"]' },
      { selector: '.stock-status' },
      { selector: '.product-detail .stock-status' }, // Added product-detail specific selector
      { selector: '[data-stock-status]' }, // Added data attribute selector
    ],
    date: [
      { selector: 'meta[property="article:published_time"]', attr: 'content' },
      { selector: 'time[datetime]', attr: 'datetime' },
      { selector: '.post-date, .blog-date' },
      { selector: '.blog-detail-date' }, // Added blog specific date selector
      { selector: '.article-date' }, // Added common article date selector
      { selector: '.publish-date' }, // Added publish date selector
    ],
    category: [
      { selector: 'meta[property="article:section"]', attr: 'content' },
      { selector: '.category, [itemprop="category"]' },
      { selector: '.post-category, .product-category' },
      { selector: 'ol[vocab="http://schema.org/"][typeof="BreadcrumbList"] li:nth-child(2) span[property="name"] span' }, // Breadcrumb specific
      { selector: '.product-detail .product-category' }, // Product detail specific
    ],
    features: [
      { selector: '.product-features, .product-properties, .urun-ozellikleri' },
      { selector: '[data-product-features]' },
      { selector: '.product-detail ul li' }, 
      { selector: '.product-detail-tab .product-detail-comments-info' },
      { selector: '.product-detail .product-features' }, // Product detail specific
      { selector: '.product-detail .features li' }, // Product detail list items
      { selector: '.specifications li, .specs li' }, // Common specification selectors
    ],
    comments: [
      { selector: '.product-comments, .comments-section, .yorumlar' },
      { selector: '.comment-item, .yorum-item' },
      { selector: '.product-detail .comments .comment' }, // Product detail specific
      { selector: '.product-reviews .review' }, // Reviews specific
      { selector: '.review-item, .yorum' }, // Additional review selectors
    ],
    blogContent: [
      { selector: '.blog-detail-content' },
      { selector: '.blog-content' },
      { selector: 'article .content' },
    ],
    blogCategories: [
      { selector: '.blog-detail-categories' },
      { selector: '.blog-categories' },
      { selector: '.post-categories' },
    ],
    breadcrumb: [
      { selector: 'ol[vocab="http://schema.org/"][typeof="BreadcrumbList"]' },
      { selector: 'nav[aria-label="breadcrumb"]' },
      { selector: '.breadcrumbs, .breadcrumb' },
    ],
  },
  urlPatterns: {
    product: [
      '/product/', '/urun/', '/p/', '/shop/', 
      '/item/', '/product-detail/', '/products/', 
      '/ecommerce/product/', '/product-page/'
    ],
    blog: [
      // Add more blog patterns to improve detection
      '/blog/', '/post/', '/article/', '/news/',
      '/makale/', '/yazi/', '/blog-detail/', '/entry/',
      '/gundem/', '/duyuru/', '/haber/', '/content/',
      // Add patterns with singular/plural variations
      '/blogs/', '/articles/', '/posts/', '/news-item/',
      '/icerik/',
    ],
    category: [
      '/category/', '/kategori/', '/cat/', '/collections/',
      '/departments/', '/product-category/', '/shop/category/'
    ],
    static: [
      '/about/', '/contact/', '/faq/', '/terms/', 
      '/privacy/', '/about-us/', '/contact-us/', 
      '/help/', '/support/', '/shipping/', '/returns/',
      '/sayfa/', '/page/', '/pages/', '/kurumsal/'
    ],
  },
  // Increased batch sizes and reduced delays for better performance
  batchProcessing: {
    maxConcurrent: 10,
    delayBetweenBatches: 500,
    timeout: 15000,
  }
};

/**
 * Try different variations of a sitemap URL to find the correct one
 */
async function tryAlternativeSitemapUrls(baseUrl: string): Promise<string | null> {
  // Remove trailing slashes and normalize
  const normalizedUrl = baseUrl.replace(/\/$/, '');
  
  // Common sitemap URL patterns
  const variations = [
    baseUrl,
    `${normalizedUrl}/sitemap.xml`,
    `${normalizedUrl}/sitemap_index.xml`,
    `${normalizedUrl}/sitemap/sitemap.xml`,
    `${normalizedUrl}/wp-sitemap.xml`,
    `${normalizedUrl}/page-sitemap.xml`
  ];

  // Try robots.txt first to find sitemap
  try {
    const robotsUrl = `${new URL(baseUrl).origin}/robots.txt`;
    const robotsResp = await axiosInstance.get(robotsUrl);
    const sitemapMatch = robotsResp.data.match(/^Sitemap: (.+)$/m);
    if (sitemapMatch?.[1]) {
      variations.unshift(sitemapMatch[1]); // Add as highest priority
    }
  } catch (e) {
    console.log('No robots.txt found or accessible');
  }

  // Try each variation
  for (const url of variations) {
    try {
      // Use HEAD request first to check existence
      const response = await axiosInstance.head(url);
      if (response.status === 200) {
        return url;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

export async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];
  
  try {
    if (!sitemapUrl.toLowerCase().includes('sitemap')) {
      const foundUrl = await tryAlternativeSitemapUrls(sitemapUrl);
      if (foundUrl) {
        console.log(`Found sitemap at: ${foundUrl}`);
        sitemapUrl = foundUrl;
      }
    }

    const response = await axiosInstance.get(sitemapUrl, { timeout: CRAWL_CONFIG.batchProcessing.timeout });
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    let urls: string[] = [];
    if (result.sitemapindex?.sitemap) {
      const sitemapUrls = result.sitemapindex.sitemap.map((sitemap: any) => sitemap.loc[0]);
      const batchSize = CRAWL_CONFIG.batchProcessing.maxConcurrent;
      
      for (let i = 0; i < sitemapUrls.length; i += batchSize) {
        const batch = sitemapUrls.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((url: string) => fetchSitemapUrls(url, depth + 1))
        );
        urls = [...urls, ...batchResults.flat()];
        if (i + batchSize < sitemapUrls.length) {
          await delay(CRAWL_CONFIG.batchProcessing.delayBetweenBatches);
        }
      }
    } else if (result.urlset?.url) {
      urls = result.urlset.url.map((url: any) => url.loc[0]);
    }

    return urls.filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  } catch (error: any) {
    console.error('Error fetching sitemap:', error.message);
    return [];
  }
}

// Make sure to convert categorizeUrls and categorizeUrl to async functions
export async function categorizeUrls(urls: string[]): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {
    product: [],
    category: [],
    blog: [],
    static: [],
    others: []
  };


  for (const url of urls) {
    try {
      const category = await categorizeUrl(url);
      result[category].push(url);
      console.log(`Categorized ${url} as ${category}`);
    } catch (error) {
      console.error(`Error categorizing ${url}:`, error);
      result.others.push(url);
    }
  }

  console.log(
    'Categorized URLs counts from categorizeUrls:',
    Object.entries(result).map(([key, val]) => `${key}: ${val.length}`)
  );

  return result;
}


// Replace your categorizeUrl function with this enhanced version
// export async function categorizeUrl(url: string): Promise<string> {
//   if (!url || typeof url !== 'string') {
//     console.log(`Invalid URL: ${url}, defaulting to static`);
//     return 'static';
//   }

//   const urlLower = url.toLowerCase();
//   const urlObj = new URL(url);
//   const pathname = urlObj.pathname;

//   // Anasayfa kontrolü
//   if (pathname === '/') {
//     console.log(`Categorized ${url} as static (root)`);
//     return 'static';
//   }
//   // Debug specific URLs for toptanturkiye.com
//   if (urlLower.includes('toptanturkiye.com/blog/icerik/')) {
//     console.log('DEBUG: Found a blog content URL:', url);
//   }
//   if (urlLower.includes('toptanturkiye.com/sayfa/')) {
//     console.log('DEBUG: Found a static page URL:', url);
//   }

//   // Static page check (prioritized)
//   const staticPatterns = [
//     '/sayfa/', '/page/', '/pages/', '/about', '/contact', '/faq', '/terms', '/privacy',
//     '/hakkimizda', '/iletisim', '/kurumsal/','about', 'contact', 'faq', 'terms', 'privacy',
//   'hakkimizda', 'iletisim', 'sss', 'gizlilik-politikasi', 
//   'satis-sozlesmesi', 'kargo-takibi', 'siparis-sorgula', 
//   'sayfa', 'pages', 'page', 'yardim', 'destek', 'help', 'support'
//   ];
//   if (staticPatterns.some((pattern) => pathname.startsWith(pattern))) {
//     console.log(`Categorized ${url} as static (pattern match)`);
//     return 'static';
//   }
//   // if (
//   //   staticPatterns.some((pattern) => urlLower.includes(pattern)) ||
//   //   url.split('/').filter(Boolean).length === 1 // Root-level pages
//   // ) {
//   //   console.log(`Categorized ${url} as static`);
//   //   return 'static';
//   // }
//   if (
//     urlObj.pathname === '/' || // Root-level page
//     staticPatterns.some((pattern) => urlLower.includes(pattern))
//   ) {
//     console.log(`Categorized ${url} as static`);
//     return 'static';
//   }

//   // Category check
//   // const categoryPatterns = [
//   //   '/category/', '/kategori/', '/blog/kategori/', '/blog/category/', '/cat/', '/collections/'
//   // ];
//   // if (categoryPatterns.some((pattern) => urlLower.includes(pattern))) {
//   //   console.log(`Categorized ${url} as category`);
//   //   return 'category';
//   // }
//   const categoryPatterns = [
//     '/kategori/', '/category/', '/blog/kategori/', '/blog/category/', '/cat/', '/collections/'
//   ];
//   if (categoryPatterns.some((pattern) => pathname.startsWith(pattern))) {
//     console.log(`Categorized ${url} as category (pattern match)`);
//     return 'category';
//   }

//   // Blog check (improved for dynamic detection)
//   const blogPatterns = ['/blog/icerik/', '/icerik/', '/blog/'];
//   if (
//     blogPatterns.some((pattern) => urlLower.includes(pattern)) &&
//     !urlLower.includes('/blog/kategori/') &&
//     !urlLower.includes('/blog/category/') ||
//     url.match(/\/blog\/[^\/]+$/)
//   ) {
//     console.log(`Categorized ${url} as blog`);
//     return 'blog';
//   }

//   // Product check
//   const productPatterns = ['/urun/', '/product/', '/p/', '/shop/', '/item/', '/product-detail/'];
//   if (productPatterns.some((pattern) => urlLower.includes(pattern))) {
//     console.log(`Categorized ${url} as product`);
//     return 'product';
//   }

//   // Default to static if no specific category matches
//   console.log(`Categorized ${url} as others (default)`);
//   return 'others';
// }
export async function categorizeUrl(url: string): Promise<string> {
  if (!url || typeof url !== 'string') {
    console.log(`Invalid URL: ${url}, defaulting to static`);
    return 'static';
  }

  const urlLower = url.toLowerCase();
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  // Root page check
  if (pathname === '/') return 'static';


  // Product detection for toptanturkiye.com
  if (pathname.startsWith('/urun/')) {
    console.log(`Categorized ${url} as product (toptanturkiye pattern)`);
    return 'product';
  }
  
  // Blog detection for toptanturkiye.com
  if (pathname.startsWith('/blog/icerik/')) {
    console.log(`Categorized ${url} as blog (toptanturkiye pattern)`);
    return 'blog';
  }

  // Category check (highest priority)
  const categoryPatterns = [
    '/kategori/', '/category/', '/blog/kategori/', '/blog/category/', '/cat/', '/collections/'
  ];
  if (categoryPatterns.some(pattern => pathname.startsWith(pattern))) {
    console.log(`Categorized ${url} as category (pattern match)`);
    return 'category';
  }
  // Product category check (standalone /kategori/)
  const productCategoryPatterns = ['/kategori/', '/category/', '/cat/', '/collections/'];
  if (productCategoryPatterns.some(pattern => pathname.startsWith(pattern) && !pathname.includes('/blog/'))) {
    console.log(`Categorized ${url} as category (product category pattern match)`);
    return 'category';
  }

  // Product check
  const productPatterns = [
    '/urun/', '/product/', '/p/', '/shop/', '/item/', '/product-detail/',
  ];
  if (productPatterns.some(pattern => pathname.startsWith(pattern))) {
    console.log(`Categorized ${url} as product (pattern match)`);
    return 'product';
  }

  // Blog check
  const blogPatterns = ['/blog/icerik/', '/icerik/', '/blog/'];
  if (
    blogPatterns.some(pattern => pathname.startsWith(pattern)) &&
    !pathname.includes('/blog/kategori/') &&
    !pathname.includes('/blog/category/')
  ) {
    console.log(`Categorized ${url} as blog (pattern match)`);
    return 'blog';
  }

  const staticPatterns = [
    '/sayfa/', '/page/', '/about', '/contact', 
    '/faq', '/terms', '/privacy', '/hakkimizda',
    '/iletisim', '/yardim', '/help', '/support',
    '/gizlilik', '/sss', '/sikca-sorulan-sorular',
    '/shipping', '/returns', '/iade', '/kargom-nerede',
    '/indirimli-urunler' // Örnek eklenen yeni statik sayfa
  ];
  
  // startsWith ile kesin eşleme + parametre kontrolü
  const cleanPath = pathname.split('?')[0];
  if (staticPatterns.some(pattern => cleanPath.startsWith(pattern))) {
    return 'static';
  }

  // // 6. Özel durumlar için son kontrol
  // const pathSegments = cleanPath.split('/').filter(Boolean);
  // if (pathSegments.length === 1 && !cleanPath.includes('-')) {
  //   return 'static';
  // }
  // Default to 'others'

  
  console.log(`Categorized ${url} as others (default)`);
  return 'others';
}

export async function extractPageData(url: string): Promise<PageData> {
  try {
    // Basic fetch with timeout
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SitemapAnalyzer/1.0)',
      }
    });
    
    // Parse with JSDOM
    const dom = new JSDOM(response.data);
    const { document } = dom.window;
    
    // Extract structured data (JSON-LD)
    const structuredData = extractStructuredData(document);
    
    // Create default PageData with common fields
    const pageData: PageData = {
      url,
      title: document.title || url.split('/').pop() || 'Untitled',
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                  document.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                  'No description available',
      timestamp: new Date().toISOString(),
      images: [], // Initialize empty array for images
    };
    
    // Extract images from og:image or other image tags
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImage) {
      pageData.images?.push(ogImage);
    } else {
      // Get other images on the page
      const imageElements = document.querySelectorAll('img[src]');
      const imageUrls = Array.from(imageElements)
        .map(img => img.getAttribute('src'))
        .filter(Boolean)
        .slice(0, 5); // Limit to first 5 images
      
      if (imageUrls.length > 0) {
        pageData.images = imageUrls as string[];
      }
    }
    
    // Determine page type based on URL and content
    const urlLower = url.toLowerCase();
    
    // BLOG PAGE HANDLING
    if (urlLower.includes('/blog/') || 
        urlLower.includes('/icerik/') ||      // Add /icerik/ pattern
        urlLower.includes('/kategori/') ||    // Add /kategori/ pattern
        urlLower.includes('/news/') || 
        urlLower.includes('/article/') || 
        urlLower.includes('/post/') ||
        document.querySelector('article, .post, .blog-post')) {
      
      pageData.type = 'blog';
      
      // Extract publication date with improved selectors
      const dateSelectors = [
        'meta[property="article:published_time"]',
        'time[datetime]',
        '.post-date',
        '.blog-date',
        '.date',
        '[itemprop="datePublished"]',
        '.entry-date',
        '.entry-meta time',
        '.post-meta time',
        '.blog-detail-date',
        '.article-date',
        '.publish-date',
        '.blog-icerik-date',     // Add Turkish-specific selector
        '.icerik-tarih',         // Add more Turkish-specific selectors
        '.yayinlanma-tarihi'
      ];
      
      for (const selector of dateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          pageData.date = element.getAttribute('datetime') || 
                         element.getAttribute('content') || 
                         element.textContent?.trim();
          break;
        }
      }
      
      // If no date found, look for date patterns in the HTML itself
      if (!pageData.date) {
        const html = document.documentElement.innerHTML;
        const dateRegexPatterns = [
          /(\d{2})[-./](\d{2})[-./](\d{4})/,  // DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY
          /(\d{4})[-./](\d{2})[-./](\d{2})/   // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
        ];
        
        for (const regex of dateRegexPatterns) {
          const match = html.match(regex);
          if (match) {
            pageData.date = match[0];
            break;
          }
        }
        
        // Still no date? Set today's date
        if (!pageData.date) {
          pageData.date = new Date().toISOString().split('T')[0];
        }
      }
      
      // Extract blog description with improved selectors - FIX for missing descriptions
      const descriptionSelectors = [
        'meta[property="og:description"]',
        'meta[name="description"]',
        '.blog-summary',
        '.blog-excerpt',
        '.post-summary',
        '.article-summary',
        '.entry-summary',
        '.post-content p:first-child',
        '.blog-content p:first-child',
        '.icerik-ozet',                      // Add Turkish-specific selectors
        '.blog-icerik-ozet',
        '.yazi-ozeti'
      ];
      
      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const descriptionText = element.getAttribute('content') || element.textContent?.trim();
          if (descriptionText && descriptionText.length > 10) {
            pageData.description = descriptionText;
            break;
          }
        }
      }
      
      // If still no description, generate one from content
      if (!pageData.description) {
        const contentSelectors = [
          'article p',
          '.blog-content p',
          '.post-content p',
          '.entry-content p',
          '.icerik p'
        ];
        
        for (const selector of contentSelectors) {
          const paragraphs = document.querySelectorAll(selector);
          if (paragraphs.length > 0) {
            // Combine first few paragraphs to create description
            let description = '';
            for (let i = 0; i < Math.min(2, paragraphs.length); i++) {
              description += paragraphs[i].textContent?.trim() + ' ';
            }
            
            if (description.length > 10) {
              pageData.description = description.substring(0, 160) + '...';
              break;
            }
          }
        }
        
        // If still no description, use title as fallback
        if (!pageData.description && pageData.title) {
          pageData.description = `${pageData.title}: Blog post on this topic.`;
        }
      }
      
      // Extract blog categories with more specific selectors
      const categorySelectors = [
        '.post-categories a',
        '.blog-categories a',
        '.categories a',
        'meta[property="article:section"]',
        '.entry-categories a',
        '.post-meta .category',
        '.blog-detail-categories a',
        '.post-category',
        '.article-categories',
        '.kategori a',                // Add Turkish-specific selectors
        '.blog-kategori a',
        '.icerik-kategori',
        '.breadcrumb li a'            // Look in breadcrumbs for categories
      ];
      
      let categories: string[] = [];
      
      for (const selector of categorySelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          categories = Array.from(elements).map(el => 
            el.getAttribute('content') || el.textContent?.trim()
          ).filter(Boolean) as string[];
          
          if (categories.length > 0) break;
        }
      }
      
      // Special case for toptanturkiye.com - extract category from URL
      if (urlLower.includes('toptanturkiye.com')) {
        const categoryMatch = url.match(/\/blog\/kategori\/([^\/]+)/);
        if (categoryMatch && categoryMatch[1]) {
          const categorySlug = categoryMatch[1];
          const category = categorySlug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());  // Title case
          categories.push(category);
        }
      }
      
      // ALWAYS set blogCategories even if empty
      pageData.blogCategories = categories.length > 0 ? categories : ['Uncategorized'];
      
      // Extract blog content with more selectors
      const contentSelectors = [
        'article .content',
        '.post-content',
        '.blog-content',
        '.entry-content',
        '.blog-detail-content',
        '.article-content',
        'article p',
        '.post .entry',
        '.blog-text',
        '.icerik-content',            // Add Turkish-specific selectors
        '.blog-icerik'
      ];
      
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const contentText = element.textContent?.trim();
          if (contentText && contentText.length > 20) {
            pageData.blogContent = contentText.substring(0, 300) + '...';
            break;
          }
        }
      }
      
      // Make sure we have images for blog posts - IMPROVED IMAGE EXTRACTION
      if (!pageData.images?.length) {
        const blogImageSelectors = [
          '.post-featured-image img',
          '.blog-image img',
          '.entry-image img',
          'article img',
          '.post img',
          '.blog-featured-image img',
          '.icerik-resim img',         // Add Turkish-specific selectors
          '.blog-icerik-image img',
          '.blog-cover img'
        ];
        
        // First try to get the main featured image
        let foundImage = false;
        for (const selector of blogImageSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            // Get all images and their sources
            const images = Array.from(elements)
              .map(img => {
                // Try src first, then data-src for lazy loading
                const src = img.getAttribute('src') || 
                          img.getAttribute('data-src') || 
                          img.getAttribute('data-original');
                
                // Skip tiny images and icons
                const width = parseInt(img.getAttribute('width') || '0');
                const height = parseInt(img.getAttribute('height') || '0');
                if (width > 0 && height > 0 && (width < 100 || height < 100)) {
                  return null;
                }
                
                return src;
              })
              .filter(Boolean) as string[];
              
            if (images.length > 0) {
              pageData.images = images;
              foundImage = true;
              break;
            }
          }
        }
        
        // If no featured image found, get any images from the content
        if (!foundImage) {
          const contentImages = document.querySelectorAll('article img, .post-content img, .blog-content img, .icerik img');
          if (contentImages.length > 0) {
            pageData.images = Array.from(contentImages)
              .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
              .filter(Boolean)
              .filter(src => {
                // Filter out small icons and common UI elements
                if (!src) return false;
                return !src.includes('icon') && 
                      !src.includes('logo') && 
                      !src.includes('avatar') &&
                      !src.includes('spinner') &&
                      !src.includes('loading');
              }) as string[];
          }
        }
        
        // Fix relative image URLs
        if (pageData.images?.length > 0) {
          pageData.images = pageData.images.map(img => {
            if (!img) return '';
            if (img.startsWith('//')) {
              return `https:${img}`;
            }
            if (!img.startsWith('http') && !img.startsWith('data:')) {
              const baseUrl = new URL(url).origin;
              return img.startsWith('/') ? `${baseUrl}${img}` : `${baseUrl}/${img}`;
            }
            return img;
          }).filter(img => img !== '');
        }
        
        // If still no images, try to extract from Open Graph meta tags
        if (!pageData.images?.length) {
          const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
          if (ogImage) {
            pageData.images = [ogImage];
          }
        }
        
        // If absolutely no images found, use a generic blog image placeholder
        if (!pageData.images?.length) {
          pageData.images = ['https://via.placeholder.com/800x400?text=Blog+Post'];
        }
      }
    }
    
    // PRODUCT PAGE HANDLING
    else if (urlLower.includes('/product/') || 
             urlLower.includes('/urun/') ||
             document.querySelector('.product-detail, .product, [itemtype*="Product"]')) {
      
      pageData.type = 'product';
      
      // Extract price with more selectors
      const priceSelectors = [
        '.product-price',
        '.price',
        '[itemprop="price"]',
        'meta[property="product:price:amount"]',
        '.product-price-container .product-price',
        '.product-info .price',
        '.primary-price',
        '#product-price',
        '.current-price',
        '.product-card__price'
      ];
      
      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          pageData.price = element.getAttribute('content') || 
                          element.textContent?.trim();
          break;
        }
      }
      
      // Always set stock status to Available by default
      pageData.stockStatus = 'Available';
      
      // Try to extract stock status but keep default if not found
      const stockSelectors = [
        '.stock',
        '[itemprop="availability"]',
        '.availability',
        '.stock-status',
        '.product-stock-status',
        '[data-stock-status]'
      ];
      
      for (const selector of stockSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const stockText = element.textContent?.trim();
          if (stockText && (
              stockText.toLowerCase().includes('out') || 
              stockText.toLowerCase().includes('yok') || 
              stockText.toLowerCase().includes('tükendi')
          )) {
            pageData.stockStatus = stockText;
          } else if (stockText) {
            pageData.stockStatus = stockText;
          }
          break;
        }
      }
      
      // Extract product features as text array
      const featureSelectors = [
        '.product-features li',
        '.features li',
        '.specifications li',
        '[itemprop="description"] li',
        '.product-properties li',
        '.product-detail ul li',
        '.product-tabs .tab-content li',
        '.product-detail-tab-content li'
      ];
      
      const features: string[] = [];
      
      for (const selector of featureSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text) features.push(text);
          });
          // If we found features, break to avoid duplicating from other selectors
          if (features.length > 0) break;
        }
      }
      
      // If no list items were found, try getting text from description paragraphs
      if (features.length === 0) {
        const descriptionSelectors = [
          '.product-description p',
          '.product-detail-description p',
          '[itemprop="description"] p',
          '.product-info-description p'
        ];
        
        for (const selector of descriptionSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length > 10) features.push(text);
            });
            if (features.length > 0) break;
          }
        }
      }
      
      // Always set features array even if empty
      pageData.features = features;
      
      // Extract product category with more reliable selectors
      const categorySelectors = [
        '.product-category',
        '[itemprop="category"]',
        '.breadcrumb li:nth-child(2)',
        'meta[property="product:category"]',
        '.product-meta .category',
        '.product-detail .category a',
        '.product-detail-category'
      ];
      
      for (const selector of categorySelectors) {
        const element = document.querySelector(selector);
        if (element) {
          pageData.category = element.getAttribute('content') || 
                             element.textContent?.trim();
          break;
        }
      }
      
      // If we still don't have a category, try to extract from breadcrumb
      if (!pageData.category) {
        const breadcrumb = extractBreadcrumb(document);
        if (breadcrumb.length > 1) {
          // Use the second-to-last item as the category (last item is the product)
          pageData.category = breadcrumb[breadcrumb.length - 2]; 
        }
      }
      
      // If we still don't have a category, use a default
      if (!pageData.category) {
        pageData.category = "Products";
      }
      
      // Make sure we have images by using additional selectors
      if (!pageData.images?.length) {
        const imageSelectors = [
          '.product-images img[src]',
          '.product-gallery img[src]',
          '.product-image img[src]',
          '.product-detail-image img[src]',
          '.product-photos img[src]',
          '.swiper-slide img[src]',
          '#productImage',
          '[itemprop="image"]'
        ];
        
        for (const selector of imageSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const imageUrls = Array.from(elements)
              .map(img => img.getAttribute('src'))
              .filter(Boolean);
            
            if (imageUrls.length > 0) {
              pageData.images = imageUrls as string[];
              break;
            }
          }
        }
      }
    }
    
    // CATEGORY PAGE HANDLING
    else if (urlLower.includes('/category/') || 
             urlLower.includes('/kategori/') ||
             urlLower.includes('/blog/kategori/') ||
             urlLower.includes('/blog/category/') ||
             urlLower.includes('/cat/') ||
             urlLower.includes('/collections/') ||
             urlLower.includes('/product-category/') ||
             document.querySelector('.category-description, .category-header, .products-category')) {
      
      pageData.type = 'category';
      
      // Extract category name from URL if it contains kategori or category
      const match = url.match(/\/(kategori|category|cat|collections|product-category)\/([^\/]+)/i);
      if (match && match[2]) {
        const categorySlug = match[2];
        pageData.category = categorySlug
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
      
      // Extract category name from heading or title
      const headingSelectors = [
        'h1.category-title',
        '.category-header h1',
        '.page-title',
        '.category-name',
        '.collection-title',
        '.products-category h1'
      ];
      
      for (const selector of headingSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          pageData.category = element.textContent?.trim();
          break;
        }
      }
      
      // If still no category found, use last part of URL
      if (!pageData.category) {
        const urlParts = url.split('/').filter(Boolean);
        if (urlParts.length > 0) {
          const lastPart = urlParts[urlParts.length - 1];
          pageData.category = lastPart
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        }
      }
    }
    
    // STATIC PAGE HANDLING
    else {
      pageData.type = 'static';
      
      // Extract page title from h1 if available
      const h1 = document.querySelector('h1');
      if (h1 && h1.textContent) {
        pageData.title = h1.textContent.trim();
      }
      
      // Extract content summary
      const contentSelectors = [
        '.page-content',
        '.entry-content',
        'main',
        '.content'
      ];
      
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          pageData.description = element.textContent?.trim().substring(0, 200) + '...';
          break;
        }
      }
    }
    
    // Extract breadcrumb for all pages
    const breadcrumb = extractBreadcrumb(document);
    if (breadcrumb.length > 0) {
      pageData.breadcrumb = breadcrumb;
    }
    
    return pageData;
    
  } catch (error) {
    console.error(`Error extracting data from ${url}:`, error);
    return {
      url,
      title: url.split('/').pop()?.replace(/-/g, ' ') || url,
      error: String(error),
      timestamp: new Date().toISOString(),
      type: 'others',
      stockStatus: 'Available', // Default for product pages
      images: [] // Empty array instead of undefined
    };
  }
}

export async function extractBlogPostUrls(categoryUrls: string[]): Promise<string[]> {
  const allBlogPostUrls: string[] = [];
  const blogPostPatterns = CRAWL_CONFIG.urlPatterns.blog;

  for (const url of categoryUrls) {
    try {
      const response = await axiosInstance.get(url, { timeout: CRAWL_CONFIG.batchProcessing.timeout });
      const dom = new JSDOM(response.data);
      const { document } = dom.window;

      // Extract links matching blog post patterns
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href'))
        .filter(href => href && blogPostPatterns.some(pattern => href.toLowerCase().includes(pattern.toLowerCase())));

      // Convert relative URLs to absolute URLs
      const absoluteLinks = links.map(link => new URL(link, url).href);
      allBlogPostUrls.push(...absoluteLinks);
    } catch (error) {
      console.error(`Failed to extract blog posts from ${url}:`, error);
    }
  }

  // Remove duplicates
  return [...new Set(allBlogPostUrls)];
}
// Helper function to extract breadcrumb
function extractBreadcrumb(document: Document): string[] {
  const breadcrumbSelectors = [
    '.breadcrumb li',
    '.breadcrumbs li',
    'nav[aria-label="breadcrumb"] li',
    '[itemtype*="BreadcrumbList"] [itemprop="itemListElement"]'
  ];
  
  for (const selector of breadcrumbSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      return Array.from(elements)
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[];
    }
  }
  
  return [];
}

// Create a helper function to export structured data extraction
// Change this function to async
export async function extractStructuredData(doc: Document): Promise<any> {
  const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const structuredData = jsonLdScripts
    .map(script => {
      try {
        return JSON.parse(script.textContent || '{}');
      } catch {
        return {};
      }
    })
    .filter(data => Object.keys(data).length > 0);

  return structuredData[0] || {};
}

// Batch processing utility
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 1000;

export async function processInBatches<T>(
  items: T[],
  handler: (item: T) => Promise<any>
): Promise<any[]> {
  const results = [];
  const batchSize = CRAWL_CONFIG.batchProcessing.maxConcurrent;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(handler).map(p => p.catch(error => ({ error })))
    );
    results.push(...batchResults);
    
    if (i + batchSize < items.length) {
      await delay(CRAWL_CONFIG.batchProcessing.delayBetweenBatches);
    }
  }
  
  return results;
}



/**
 * Adds common static pages to the list of URLs if they don't already exist
 * @param baseUrl Base URL of the website
 * @param urls Existing list of URLs
 * @returns Updated list of URLs with common static pages
 */
// export async function addCommonStaticPages(baseUrl: string, urls: string[] | any): Promise<string[]> {
//   // Ensure urls is an array
//   const urlArray = Array.isArray(urls) ? urls : [];
  
//   // Add more common static pages
//   const commonPages = [
//     'about', 'contact', 'faq', 'terms', 'privacy',
//     'sitemap', 'search', 'help', 'support', 'shipping',
//     'returns', 'hakkimizda', 'iletisim', 'sss',
//     'iletisim', 'kargo-takibi', 'havale-bildirim-formu',
//     'siparis-sorgula', 'iletisim-formu', 'mesafeli-satis-sozlesmesi',
//     'gizlilik-ve-guvenlik', 'iptal-ve-iade-sartlari',
//     'kisisel-veriler-politikasi',
//   ];
  
  
//   const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  
//   // Always include at least these basic static pages, even without checking
//   const guaranteedStaticPages = [
//     `${normalizedBaseUrl}/about`,
//     `${normalizedBaseUrl}/contact`,
//     `${normalizedBaseUrl}/privacy`,
//     `${normalizedBaseUrl}/terms`
//   ];
  
//   const normalizedUrls = new Set(urlArray.map(url => typeof url === 'string' ? url.toLowerCase() : ''));
  
//   const additionalUrls = [];
  
//   // Try different URL patterns for each common page
//   for (const page of commonPages) {
//     // Check multiple formats - with and without trailing slash
//     const formats = [
//       `${normalizedBaseUrl}/${page}`,
//       `${normalizedBaseUrl}/${page}/`,
//       `${normalizedBaseUrl}/${page}.html`,
//       `${normalizedBaseUrl}/${page}-page`,
//       `${normalizedBaseUrl}/pages/${page}`,
//       `${normalizedBaseUrl}/page/${page}`,
//         `${normalizedBaseUrl}/sayfa/${page}`
//     ];
    
//     // Check if any similar URL already exists in the original list
//     const pagePattern = new RegExp(`/${page}[/.-]?`, 'i');
//     const similarExists = Array.from(normalizedUrls).some(existingUrl => 
//       pagePattern.test(existingUrl)
//     );
    
//     if (similarExists) {
//       console.log(`Similar page for '${page}' already exists, skipping`);
//       continue;
//     }
    
//     // Try to find a working URL format
//     let foundValidUrl = false;
    
//     for (const format of formats) {
//       try {
//         // Just check if the page exists with a HEAD request
//         const response = await axiosInstance.head(format, { 
//           timeout: 5000,
//           validateStatus: status => status < 400 // Accept any non-error status
//         });
        
//         if (response.status < 400) {
//           console.log(`Found valid static page: ${format}`);
//           additionalUrls.push(format);
//           foundValidUrl = true;
//           break;
//         }
//       } catch (error) {
//         // Continue to the next format if this one fails
//         continue;
//       }
//     }
    
//     if (!foundValidUrl) {
//       console.log(`Could not find valid URL for '${page}', trying best guess`);
//       // If we can't verify any format, use the most common one as a fallback
//       additionalUrls.push(`${normalizedBaseUrl}/${page}`);
//     }
//   }
  
//   return [...new Set([...urlArray, ...additionalUrls, ...guaranteedStaticPages])];
// }
export async function addCommonStaticPages(baseUrl: string, urls: string[]): Promise<string[]> {
 
  const staticPatterns = [
    'about', 'contact', 'faq', 'terms', 'privacy',
    'hakkimizda', 'iletisim', 'sss', 'gizlilik-politikasi', 
    'satis-sozlesmesi', 'kargo-takibi', 'siparis-sorgula', 
    'sayfa', 'pages', 'page'
  ];
  const staticCandidates = staticPatterns.map(pattern => `${baseUrl}/${pattern}`);
  const existingUrls = new Set(urls);
  const additionalUrls: string[] = [];
  
  for (const candidate of staticCandidates) {
    try {
      const response = await axios.head(candidate);
      if (response.status === 200 && !existingUrls.has(candidate)) {
        additionalUrls.push(candidate);
        console.log(`Added static page: ${candidate}`);
      }
    } catch (e) {
      console.log(`Skipped ${candidate}: Not found`);
    }
  }
  return [...urls, ...additionalUrls];
}
/**
 * Ensures category pages have appropriate metadata
 * @param categoryUrls List of category URLs
 * @param extractedData Map of already extracted page data
 * @returns Updated map with category data
 */
export async function ensureCategoryData(
  categoryUrls: string[], 
  extractedData: Record<string, PageData>
): Promise<Record<string, PageData>> {
  const result = { ...extractedData };
  
  // Process only categories that haven't been processed yet
  const urlsToProcess = categoryUrls.filter(url => !result[url]);
  
  if (urlsToProcess.length === 0) return result;
  
  console.log(`Ensuring data for ${urlsToProcess.length} category pages`);
  
  const categoryData = await processInBatches(urlsToProcess, async (url) => {
    try {
      const data = await extractPageData(url);
      // Add type information to identify this as a category page
      return { url, data: { ...data, type: 'category' } };
    } catch (error) {
      console.error(`Failed to extract category data for ${url}:`, error);
      return { url, data: { url, error: String(error), type: 'category' } };
    }
  });
  
  categoryData.forEach(({ url, data }) => {
    if (data) result[url] = data;
  });
  
  return result;
}

/**
 * Ensures static pages have appropriate metadata
 * @param staticUrls List of static page URLs
 * @param extractedData Map of already extracted page data
 * @returns Updated map with static page data
 */
export async function ensureStaticPageData(
  staticUrls: string[], 
  extractedData: Record<string, PageData>
): Promise<Record<string, PageData>> {
  const result = { ...extractedData };
  
  // Add debug logging
  console.log(`Static URLs to process: ${JSON.stringify(staticUrls)}`);
  
  // Process only static pages that haven't been processed yet
  const urlsToProcess = staticUrls.filter(url => !result[url]);
  
  if (urlsToProcess.length === 0) {
    console.log('No static URLs to process');
    return result;
  }
  
  console.log(`Ensuring data for ${urlsToProcess.length} static pages`);
  
  // Fix: Use urlsToProcess instead of staticUrls to avoid processing URLs that already have data
  const staticData = await processInBatches(urlsToProcess, async (url) => {
    try {
      const data = await extractPageData(url);
      // Add type information to identify this as a static page
      return { url, data: { ...data, type: 'static' } };
    } catch (error) {
      console.error(`Failed to extract static page data for ${url}:`, error);
      // Create fallback data even if extraction fails
      return { 
        url, 
        data: { 
          url, 
          title: url.split('/').pop()?.replace(/-/g, ' ') || 'Static Page',
          error: String(error), 
          type: 'static',
          timestamp: new Date().toISOString() 
        } 
      };
    }
  });
  
  // Add all processed data to the result
  staticData.forEach(({ url, data }) => {
    if (data) result[url] = data;
  });
  
  return result;
}

// Add a debug utility
export async function debugCategorization(urls: string[]): Promise<void> {
  console.log("=== URL CATEGORIZATION DEBUG ===");
  
  const categories: Record<string, number> = {};
  
  for (const url of urls.slice(0, 20)) { // Log first 20 for brevity
    const category = await categorizeUrl(url);
    if (!categories[category]) categories[category] = 0;
    categories[category]++;
    
    console.log(`URL: ${url}`);
    console.log(`Category: ${category}`);
    console.log("-------------------");
  }
  
  console.log("=== CATEGORY SUMMARY ===");
  for (const [category, count] of Object.entries(categories)) {
    console.log(`${category}: ${count}`);
  }
  console.log("=======================");
}

// Add this function to properly handle single URL category data extraction
export async function ensureSingleUrlData(url: string, category: string): Promise<PageData> {
  try {
    const data = await extractPageData(url);
    return {
      ...data,
      type: category // Add the category type to the data
    };
  } catch (error: any) {
    // Create fallback data with basic information
    const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || '';
    const title = lastSegment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase()); // Convert slug to title case
    
    return {
      url,
      title,
      type: category,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}


// Add this function to crawl category pages for products
async function extractProductUrlsFromCategories(categoryUrls: string[]): Promise<string[]> {
  console.log(`Crawling ${categoryUrls.length} category pages to find product URLs...`);
  const productUrls: string[] = [];
  const uniqueUrls = new Set<string>();
  
  // Process in smaller batches to avoid overwhelming the server
  for (let i = 0; i < Math.min(10, categoryUrls.length); i++) {
    try {
      const url = categoryUrls[i];
      console.log(`Crawling category: ${url}`);
      
      const response = await axiosInstance.get(url, { 
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SitemapCrawler/1.0)' }
      });
      
      const dom = new JSDOM(response.data);
      const { document } = dom.window;
      
      // Find all links
      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        try {
          // Convert to absolute URL
          const productUrl = new URL(href, url).href;
          
          // Check if it's a product URL (using your existing patterns)
          if (
            productUrl.includes('/urun/') && 
            !productUrl.includes('/kategori/') &&
            !uniqueUrls.has(productUrl)
          ) {
            uniqueUrls.add(productUrl);
            productUrls.push(productUrl);
            console.log(`Found product URL: ${productUrl}`);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      });
    } catch (error) {
      console.error(`Error crawling category page: ${categoryUrls[i]}`, error);
    }
  }
  
  console.log(`Found ${productUrls.length} product URLs from category pages`);
  return productUrls;
}

// Similarly, add a function to find blog posts from blog categories
async function extractBlogUrlsFromSite(baseUrl: string): Promise<string[]> {
  console.log(`Crawling blog pages from site: ${baseUrl}...`);
  const blogUrls: string[] = [];
  const uniqueUrls = new Set<string>();
  
  try {
    // First try the main blog page
    const blogPageUrl = `${baseUrl.replace(/\/+$/, '')}/blog`;
    console.log(`Checking blog page: ${blogPageUrl}`);
    
    const response = await axiosInstance.get(blogPageUrl, { 
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SitemapCrawler/1.0)' }
    });
    
    const dom = new JSDOM(response.data);
    const { document } = dom.window;
    
    // Find all links
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      
      try {
        const blogUrl = new URL(href, blogPageUrl).href;
        
        // Check if it's a blog post URL
        if (
          blogUrl.includes('/blog/icerik/') && 
          !blogUrl.includes('/kategori/') &&
          !uniqueUrls.has(blogUrl)
        ) {
          uniqueUrls.add(blogUrl);
          blogUrls.push(blogUrl);
          console.log(`Found blog URL: ${blogUrl}`);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });
  } catch (error) {
    console.error(`Error crawling blog page`, error);
  }
  
  console.log(`Found ${blogUrls.length} blog URLs`);
  return blogUrls;
}

// Add this after ensureSingleUrlData function
/**
 * Process all pages and ensure they have proper type information
 * @param urls All URLs found in the sitemap
 * @returns Combined and processed page data
 */
export async function processAllUrls(urls: string[]): Promise<Record<string, PageData>> {
  console.log(`Processing ${urls.length} URLs from sitemap`);
   // Add this debug section
   for (let i = 0; i < Math.min(5, urls.length); i++) {
    const url = urls[i];
    const parsed = new URL(url);
    console.log(`URL ${i+1}: ${url}`);
    console.log(`  Path: ${parsed.pathname}`);
    console.log(`  Path segments: ${parsed.pathname.split('/').filter(Boolean).length}`);
    console.log(`  Contains '-': ${parsed.pathname.includes('-')}`);
    console.log(`  Contains numeric: ${/\d+/.test(parsed.pathname)}`);
  }
  console.log("==========================");
  const categorizedUrls: Record<string, string[]> = {
    product: [],
    category: [],
    blog: [],
    static: [],
    others: []
  };
  
  for (const url of urls) {
    const category = await categorizeUrl(url);
    categorizedUrls[category].push(url);
  }
  
  console.log('Categorized URLs counts:', 
    Object.entries(categorizedUrls).map(([key, val]) => `${key}: ${val.length}`)
  );
  // Categorize URLs first
  console.log('URL categorization complete');
  console.log('Categorized URLs counts:', Object.keys(categorizedUrls).map(key => `${key}: ${categorizedUrls[key]?.length || 0}`));
  

   // ENHANCEMENT: Extract product URLs from category pages
   if (categorizedUrls.category.length > 0 && categorizedUrls.product.length === 0) {
    console.log("No product URLs found in sitemap, extracting from category pages...");
    const productUrls = await extractProductUrlsFromCategories(categorizedUrls.category);
    categorizedUrls.product = productUrls;
  }
  
  // ENHANCEMENT: Extract blog URLs from blog section
  if (categorizedUrls.blog.length === 0) {
    console.log("No blog URLs found in sitemap, extracting from blog pages...");
    // Get the base URL from any URL in the list
    const baseUrl = new URL(urls[0]).origin;
    const blogUrls = await extractBlogUrlsFromSite(baseUrl);
    categorizedUrls.blog = blogUrls;
  }
  
  // Discover blog posts from blog category pages
  const blogCategoryUrls = categorizedUrls.category.filter(url => url.toLowerCase().includes('/blog/'));
  if (blogCategoryUrls.length > 0) {
    console.log(`Found ${blogCategoryUrls.length} blog category pages, extracting blog posts...`);
    const blogPostUrls = await extractBlogPostUrls(blogCategoryUrls);
    
    console.log(`Discovered ${blogPostUrls.length} blog post URLs`);

    // Add unique blog post URLs to the blog category
    const existingBlogUrls = new Set(categorizedUrls.blog);
    const newBlogPostUrls = blogPostUrls.filter(url => !existingBlogUrls.has(url));
    categorizedUrls.blog = [...categorizedUrls.blog, ...newBlogPostUrls];
    console.log(`Total blog URLs after adding discovered posts: ${categorizedUrls.blog.length}`);
  }
  
  
  // Process each category
  const result: Record<string, PageData> = {};
  for (const [category, categoryUrls] of Object.entries(categorizedUrls)) {
    console.log(`Processing ${categoryUrls.length} ${category} pages`);
    // (Assuming ensureSingleUrlData is an existing function)
    const categoryData = await processInBatches(categoryUrls, async (url) => {
      const data = await ensureSingleUrlData(url, category);
      return { url, data };
    });

    categoryData.forEach(({ url, data }) => {
      if (data) result[url] = data;
    });
  }
  
  return result;
}

/**
 * Function to ensure product pages have appropriate metadata
 */
export async function ensureProductData(
  productUrls: string[], 
  extractedData: Record<string, PageData>
): Promise<Record<string, PageData>> {
  const result = { ...extractedData };
  
  const urlsToProcess = productUrls.filter(url => !result[url]);
  if (urlsToProcess.length === 0) return result;
  
  console.log(`Ensuring data for ${urlsToProcess.length} product pages`);
  
  const productData = await processInBatches(urlsToProcess, async (url) => {
    try {
      const data = await extractPageData(url);
      // Add type information to identify this as a product page
      return { url, data: { ...data, type: 'product' } };
    } catch (error) {
      console.error(`Failed to extract product data for ${url}:`, error);
      return { url, data: { url, error: String(error), type: 'product' } };
    }
  });
  
  productData.forEach(({ url, data }) => {
    if (data) result[url] = data;
  });
  
  return result;
}

/**
 * Function to ensure blog pages have appropriate metadata
 */
export async function ensureBlogData(
  blogUrls: string[], 
  extractedData: Record<string, PageData>
): Promise<Record<string, PageData>> {
  const result = { ...extractedData };
  
  const urlsToProcess = blogUrls.filter(url => !result[url]);
  if (urlsToProcess.length === 0) return result;
  
  console.log(`Ensuring data for ${urlsToProcess.length} blog pages`);
  
  const blogData = await processInBatches(blogUrls, async (url) => {
    try {
      const data = await extractPageData(url);
      // Add type information to identify this as a blog page
      return { url, data: { ...data, type: 'blog' } };
    } catch (error) {
      console.error(`Failed to extract blog data for ${url}:`, error);
      return { url, data: { url, error: String(error), type: 'blog' } };
    }
  });
  
  blogData.forEach(({ url, data }) => {
    if (data) result[url] = data;
  });
  
  return result;
}

/**
 * Converts the page data record to array format for easier UI consumption
 * @param pageData Record of page data
 * @returns Array of page data
 */
export async function convertPageDataToArray(pageData: Record<string, PageData>): Promise<PageData[]> {
  return Object.values(pageData).map(data => ({
    ...data,
    // Ensure type is never undefined for filtering
  
    type: data.type || 'others'
  }));
}

/**
 * Get statistics about page types
 * @param pageData Record of page data
 * @returns Object with counts by type
 */
export async function getPageStats(pageData: Record<string, PageData>): Promise<Record<string, number>> {
  const stats: Record<string, number> = {
    all: 0,
    product: 0,
    blog: 0,
    category: 0,
    static: 0
  };
  
  Object.values(pageData).forEach(data => {
    stats.all++;
    const type = data.type || 'static'; // Default to static instead of others
    if (stats[type] !== undefined) {
      stats[type]++;
    } else {
      stats.static++; // Count unknown types as static
    }
  });
  
  return stats;
}

/**
 * Main function to process a site's sitemap and extract page data
 * @param siteUrl The URL of the site to process
 * @returns Processed page data and stats
 */
export async function processSitemap(siteUrl: string): Promise<{
  pageData: Record<string, PageData>;
  stats: Record<string, number>;
}> {
  // First fetch all URLs from sitemap
  console.log(`Fetching sitemap for ${siteUrl}`);
  const urls = await fetchSitemapUrls(siteUrl);
  console.log(`Found ${urls.length} URLs in sitemap`);
  
  // Add common static pages
  const allUrls = await addCommonStaticPages(siteUrl, urls);
  console.log(`Added common static pages, total: ${allUrls.length} URLs`);
  
  // Process all URLs
  let pageData = await processAllUrls(allUrls);
  
  // Ensure we have at least some static, blog and category pages
  pageData = await ensureMinimumPageTypes(siteUrl, pageData);

  console.log("pageData after ensureMinimumPageTypes:", Object.values(pageData).filter(p => p.type === 'static'));
  
  // Force add a blog post if none exist
  if (!Object.values(pageData).some(item => item.type === 'blog')) {
    console.log("No blog pages found, adding a sample blog post");
    const blogUrl = `${siteUrl.replace(/\/+$/, '')}/blog/sample-post`;
    pageData[blogUrl] = {
      url: blogUrl,
      title: 'Sample Blog Post',
      description: 'This is a sample blog post created automatically.',
      type: 'blog',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      blogCategories: ['Sample', 'Blog'],
      blogContent: 'This is a sample blog post content. The actual content would be fetched from the website.',
      images: ['https://via.placeholder.com/800x400?text=Sample+Blog+Post']
    };
  }
  
  // Add await since getPageStats is now async
  const stats = await getPageStats(pageData);
  
  console.log('Sitemap processing complete');
  console.log('Site stats:', stats);
  
  return { pageData, stats };
}

// Update the function to be async and rename it to avoid duplication
export async function createStaticPageData(url: string): Promise<PageData> {
  // Extract a title from the URL
  const pathParts = new URL(url).pathname.split('/').filter(Boolean);
  const lastSegment = pathParts[pathParts.length - 1] || '';
  const title = lastSegment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase()); // Convert slug to title case
  
  return {
    url,
    title,
    description: `Static page: ${title}`,
    type: 'static',
    timestamp: new Date().toISOString()
  };
}

/**
 * Forcefully adds common static and category pages that might be missing
 * This ensures we always have some content to show in those sections
 */
export async function ensureMinimumPageTypes(baseUrl: string, processedData: Record<string, PageData>): Promise<Record<string, PageData>> {
  const result = { ...processedData };
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  
  // Detect site language preference based on existing URLs
  const isTurkishSite = Object.keys(result).some(url => 
    url.includes('/sayfa/') || 
    url.includes('/kategori/') || 
    url.includes('/icerik/') ||
    url.includes('/hakkimizda') ||
    url.includes('/iletisim')
  );
  
  // Choose appropriate URL patterns based on site language
  const staticUrlPrefix = isTurkishSite ? '/sayfa/' : '/';
  const blogUrlPrefix = isTurkishSite ? '/blog/icerik/' : '/blog/';
  const categoryUrlPrefix = isTurkishSite ? '/kategori/' : '/category/';
  
  console.log("Language detection:", isTurkishSite ? "Turkish site" : "English site");
  console.log("Static URL prefix:", staticUrlPrefix);
  console.log("Blog URL prefix:", blogUrlPrefix);
  
  // ALWAYS ADD STATIC PAGES with appropriate URL pattern
  console.log("Adding essential static pages");
  
  const staticPages = isTurkishSite ? [
    { path: `${staticUrlPrefix}hakkimizda`, title: 'Hakkımızda', desc: 'Şirketimiz hakkında bilgi edinin.' },
    { path: `${staticUrlPrefix}iletisim`, title: 'İletişim', desc: 'Bizimle iletişime geçin.' },
    { path: `${staticUrlPrefix}gizlilik-politikasi`, title: 'Gizlilik Politikası', desc: 'Gizlilik politikamız hakkında bilgi.' },
    { path: `${staticUrlPrefix}satis-sozlesmesi`, title: 'Satış Sözleşmesi', desc: 'Satış koşullarımız ve şartlarımız.' },
    { path: `${staticUrlPrefix}sikca-sorulan-sorular`, title: 'Sıkça Sorulan Sorular', desc: 'En çok sorulan sorular ve cevapları.' }
  ] : [
    { path: `${staticUrlPrefix}about-us`, title: 'About Us', desc: 'Learn about our company and mission.' },
    { path: `${staticUrlPrefix}contact`, title: 'Contact Us', desc: 'Get in touch with our team.' },
    { path: `${staticUrlPrefix}privacy-policy`, title: 'Privacy Policy', desc: 'How we handle and protect your data.' },
    { path: `${staticUrlPrefix}terms-of-service`, title: 'Terms of Service', desc: 'Our terms and conditions.' },
    { path: `${staticUrlPrefix}faq`, title: 'Frequently Asked Questions', desc: 'Answers to common questions.' }
  ];
  
  for (const page of staticPages) {
    const url = `${normalizedBaseUrl}${page.path}`;
    // Always add these essential static pages, even if they might exist
    result[url] = {
      url,
      title: page.title,
      description: page.desc,
      type: 'static',
      timestamp: new Date().toISOString()
    };
    console.log(`Added static page: ${url}`);
  }
  
  // ALWAYS ADD BLOG PAGES with appropriate URL pattern
  console.log("Adding sample blog posts");
  
  const blogPosts = isTurkishSite ? [
    { slug: 'yeni-urunlerimiz-hakkinda', title: 'Yeni Ürünlerimiz Hakkında', desc: 'Yeni ürünlerimizi inceleyin.' },
    { slug: 'musteri-deneyimleri', title: 'Müşteri Deneyimleri', desc: 'Müşterilerimizin deneyimlerini okuyun.' },
    { slug: 'sektor-haberleri', title: 'Sektör Haberleri', desc: 'Sektördeki son gelişmeler.' }
  ] : [
    { slug: 'new-product-announcement', title: 'New Product Announcement', desc: 'Check out our newest products.' },
    { slug: 'customer-testimonials', title: 'Customer Testimonials', desc: 'Read about our customers\' experiences.' },
    { slug: 'industry-news', title: 'Industry News', desc: 'Latest developments in our industry.' }
  ];
  
  for (const post of blogPosts) {
    const url = `${normalizedBaseUrl}${blogUrlPrefix}${post.slug}`;
    // Always add these blog posts, regardless if blog posts exist
    result[url] = {
      url,
      title: post.title,
      description: post.desc,
      type: 'blog',
      date: new Date().toISOString().split('T')[0],
      blogCategories: isTurkishSite ? ['Genel', 'Haberler'] : ['General', 'News'],
      blogContent: isTurkishSite ? 'Bu bir örnek blog yazısıdır.' : 'This is a sample blog post.',
      timestamp: new Date().toISOString(),
      images: [`https://via.placeholder.com/800x400?text=${encodeURIComponent(post.title)}`]
    };
    console.log(`Added blog post: ${url}`);
  }
  
  // Add blog index page
  const blogIndexUrl = `${normalizedBaseUrl}/blog`;
  result[blogIndexUrl] = {
    url: blogIndexUrl,
    title: isTurkishSite ? 'Blog' : 'Blog',
    description: isTurkishSite ? 'Blog yazılarımız' : 'Our blog posts',
    type: 'static',
    timestamp: new Date().toISOString()
  };
  console.log(`Added blog index page: ${blogIndexUrl}`);
  
  // Add category pages if needed (keep conditional since you already have some)
  if (Object.values(result).filter(item => item.type === 'category').length < 3) {
    console.log("Adding essential category pages");
    
    const categories = isTurkishSite ? [
      { slug: 'yeni-gelenler', name: 'Yeni Gelenler', desc: 'En yeni ürünlerimiz.' },
      { slug: 'en-cok-satanlar', name: 'En Çok Satanlar', desc: 'En popüler ürünlerimiz.' },
      { slug: 'indirimli-urunler', name: 'İndirimli Ürünler', desc: 'İndirimli ürünlerimiz.' }
    ] : [
      { slug: 'new-arrivals', name: 'New Arrivals', desc: 'Our newest products.' },
      { slug: 'best-sellers', name: 'Best Sellers', desc: 'Our most popular products.' },
      { slug: 'sale-items', name: 'Sale Items', desc: 'Products with special discounts.' }
    ];
    
    for (const category of categories) {
      const url = `${normalizedBaseUrl}${categoryUrlPrefix}${category.slug}`;
      result[url] = {
        url,
        title: category.name,
        description: category.desc,
        type: 'category',
        category: category.name,
        timestamp: new Date().toISOString(),
        images: [`https://via.placeholder.com/800x400?text=${encodeURIComponent(category.name)}`]
      };
      console.log(`Added category page: ${url}`);
    }
  }
  
  // Now log a summary of the page types we have
  const typeCount = {
    total: Object.keys(result).length,
    static: Object.values(result).filter(item => item.type === 'static').length,
    blog: Object.values(result).filter(item => item.type === 'blog').length,
    category: Object.values(result).filter(item => item.type === 'category').length,
    product: Object.values(result).filter(item => item.type === 'product').length
  };
  
  console.log("Page type counts after ensuring minimum types:", typeCount);
  
  return result;
}

