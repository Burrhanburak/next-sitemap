import { NextResponse } from 'next/server';
import { 
  fetchSitemapUrls, 
  categorizeUrls, 
  processAllUrls,
  convertPageDataToArray
} from '@/utils/sitemap';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sitemapUrl = searchParams.get('sitemapUrl');

    if (!sitemapUrl) {
      return NextResponse.json(
        { error: 'sitemapUrl parameter is required' },
        { status: 400 }
      );
    }

    // URL formatını doğrula
    try {
      new URL(sitemapUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format. Please provide a complete URL including http:// or https://' },
        { status: 400 }
      );
    }

    // URL'leri getir
    let urls: string[] = [];
    try {
      urls = await fetchSitemapUrls(sitemapUrl);
    } catch (error: any) {
      const status = error.response?.status || 500;
      let message = 'Failed to fetch sitemap';

      if (status === 404) {
        message = 'Sitemap not found. The URL might be incorrect, or the sitemap might be in a different location.';
      } else if (status === 403) {
        message = 'Access to sitemap is forbidden. The site might require authentication.';
      } else if (status === 429) {
        message = 'Rate limited by the server. Please try again later.';
      }

      return NextResponse.json({
        error: message,
        details: error.response?.data || error.message,
        status
      });
    }

    if (!urls || urls.length === 0) {
      return NextResponse.json({
        warning: 'No URLs found in sitemap. The sitemap might be empty.',
        urls: []
      });
    }

    // URL'leri kategorize et
    const categorized = await categorizeUrls(urls);
    return NextResponse.json(categorized);

  } catch (error: any) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: error.response?.data || error.stack
      },
      { status: error.response?.status || 500 }
    );
  }
}
export async function POST(request: Request) {
  try {
    const { sitemapUrl, maxUrls } = await request.json();

    if (!sitemapUrl) {
      return NextResponse.json(
        { error: 'sitemapUrl parameter is required' },
        { status: 400 }
      );
    }

    // URL'leri getir
    const urls = await fetchSitemapUrls(sitemapUrl);
    const limitedUrls = maxUrls === 'all' ? urls : urls.slice(0, parseInt(maxUrls as string));

    // URL'leri kategorize et
    const categorizedUrls = await categorizeUrls(limitedUrls);
    

    console.log("URL kategorizasyon özeti:");
    Object.entries(categorizedUrls).forEach(([category, urls]) => {
      console.log(`${category}: ${urls.length} URL`);
    });

    // URL'leri işle
    const pageData = await processAllUrls(limitedUrls);

    console.log("İşlenmiş sayfa verisi özeti:");
    const typeCount: Record<string, number> = {};
    Object.values(pageData).forEach(page => {
      const type = page.type || 'others';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    console.log(typeCount);

    const pageDataArray = await convertPageDataToArray(pageData);

    // İstatistikleri hesapla
    const stats = {
      total: pageDataArray.length,
      crawled: pageDataArray.length,
      failed: 0,
      product: pageDataArray.filter(page => page.type === 'product').length,
      blog: pageDataArray.filter(page => page.type === 'blog').length,
      category: pageDataArray.filter(page => page.type === 'category').length,
      static: pageDataArray.filter(page => page.type === 'static').length,
      others: pageDataArray.filter(page => page.type === 'others').length
    };

    console.log("Son istatistikler:", stats);

    // Güncellenmiş kategorize edilmiş veriyi oluştur (isteğe bağlı)
    const updatedCategorized: Record<string, string[]> = {
      product: [],
      blog: [],
      category: [],
      static: [],
      others: []
    };
    pageDataArray.forEach(page => {
      const type = page.type || 'others';
      updatedCategorized[type].push(page.url);
    });
    

    return NextResponse.json({ 
      results: pageDataArray,
      categorized: updatedCategorized, // Güncellenmiş kategorize edilmiş veriyi döndür
      stats
    });

  } catch (error: any) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: error.stack
      },
      { status: 500 }
    );
  }
}