'use client'
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import { Loader2, Search, BarChart3, PieChart, LayoutDashboard, Activity, Link, FileText, Share2, Tag, Image, Eye, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import type { PageData } from "@/components/columns"
import { createStaticPageData } from "@/utils/sitemap"

// URL limit options
const URL_LIMITS = [
  { value: "100", label: "100 URLs" },
  { value: "500", label: "500 URLs (Default)" },
  { value: "1000", label: "1000 URLs" },
  { value: "2000", label: "2000 URLs" },
  { value: "5000", label: "5000 URLs" },
  { value: "all", label: "All URLs" },
]

// Updated form schema with URL limit
const formSchema = z.object({
  sitemapUrl: z.string().url({ message: "Please enter a valid URL" }),
  urlLimit: z.string().default("100"),
})

export default function Home() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  const [siteInfo, setSiteInfo] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("all")

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sitemapUrl: "",
      urlLimit: "500",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitting(true)
    setError(null)
    setResults(null)
    setSiteInfo(null)

    try {
      // Convert urlLimit to number (or use 'all')
      const maxUrls = values.urlLimit === 'all' ? 'all' : parseInt(values.urlLimit)
      
      const response = await fetch('/api/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sitemapUrl: values.sitemapUrl,
          maxUrls
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch sitemap')
      }

      const data = await response.json()
      setResults(data)
      
      // Also fetch site info for advanced analysis
      const siteInfoResponse = await fetch('/api/site-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: values.sitemapUrl }),
      })
      
      if (siteInfoResponse.ok) {
        const siteInfoData = await siteInfoResponse.json()
        setSiteInfo(siteInfoData)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="text-2xl">Website Content Analyzer</CardTitle>
          <CardDescription>
            Enter a website URL to analyze its structure and content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="sitemapUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter the website domain (e.g., https://example.com)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div>
                  <FormField
                    control={form.control}
                    name="urlLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URLs to Analyze</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select limit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {URL_LIMITS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose how many URLs to analyze
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full md:w-auto" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Analyze Website
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <div className="space-y-6">
          {/* Analytics Card - Enhanced with better visualization */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-8">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <span>Site Analysis Results</span>
              </CardTitle>
              <CardDescription>
                Summary of content types and SEO performance
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Stats overview - Enhanced */}
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                    <PieChart className="h-4 w-4 text-blue-500" /> 
                    URL Overview
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total URLs</span>
                      <Badge className="bg-blue-500">{results.stats?.total || 0}</Badge>
                    </div>
                    <Progress value={(results.stats?.crawled / results.stats?.total * 100) || 0} className="h-2" />
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Crawled: {results.stats?.crawled || 0}</span>
                      <span>Failed: {results.stats?.failed || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Content Distribution - Enhanced */}
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                    <LayoutDashboard className="h-4 w-4 text-green-500" /> 
                    Content Types
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(results.stats || {})
                      .filter(([key]) => !['total', 'crawled', 'failed'].includes(key))
                      .sort(([_, countA], [__, countB]) => (Number(countB) - Number(countA)))
                      .map(([category, count], index) => {
                        // Different colors for different categories
                        const colors = {
                          product: "bg-green-100 text-green-800",
                          blog: "bg-purple-100 text-purple-800",
                          category: "bg-blue-100 text-blue-800",
                          static: "bg-amber-100 text-amber-800",
                          others: "bg-gray-100 text-gray-800"
                        };
                        
                        const color = colors[category as keyof typeof colors] || colors.others;
                        
                        return (
                          <div key={category} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Badge className={color + " mr-2"}>
                                {count as number}
                              </Badge>
                              <span className="text-sm capitalize">{category}</span>
                            </div>
                            <Progress 
                              value={(Number(count) / results.stats.total * 100)} 
                              className="h-2 w-20" 
                              indicatorClassName={category === 'product' ? 'bg-green-500' : 
                                                 category === 'blog' ? 'bg-purple-500' :
                                                 category === 'category' ? 'bg-blue-500' :
                                                 category === 'static' ? 'bg-amber-500' : 'bg-gray-500'}
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Site health - New */}
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-red-500" /> 
                    Site Health
                  </h3>
                  
                  {siteInfo ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">SEO Score</span>
                        <div className="w-16 h-16 rounded-full flex items-center justify-center border-4"
                          style={{ 
                            borderColor: siteInfo.seoScore > 70 ? '#10b981' : 
                                        siteInfo.seoScore > 40 ? '#f59e0b' : '#ef4444' 
                          }}>
                          <span className="text-xl font-bold">{siteInfo.seoScore || 0}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div className="text-gray-600">Meta Title</div>
                        <div className={siteInfo.title ? "font-medium truncate" : "text-gray-400"}>
                          {siteInfo.title || "Missing"}
                        </div>
                        
                        <div className="text-gray-600">Meta Description</div>
                        <div className={siteInfo.description ? "font-medium truncate" : "text-gray-400"}>
                          {siteInfo.description || "Missing"}
                        </div>
                        
                        <div className="text-gray-600">Mobile Friendly</div>
                        <div className="font-medium">
                          {siteInfo.technicalMetadata?.mobileViewport ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      Site health data unavailable
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced site metadata */}
              {siteInfo && (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Links Analysis */}
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                      <Link className="h-4 w-4 text-blue-500" />
                      Link Analysis
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-3 rounded text-center">
                          <div className="text-2xl font-bold text-blue-700">{siteInfo.internalLinks || 0}</div>
                          <div className="text-xs text-blue-600">Internal Links</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded text-center">
                          <div className="text-2xl font-bold text-purple-700">{siteInfo.externalLinks || 0}</div>
                          <div className="text-xs text-purple-600">External Links</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-amber-50 p-3 rounded text-center">
                          <div className="text-2xl font-bold text-amber-700">{siteInfo.staticPageLinks?.length || 0}</div>
                          <div className="text-xs text-amber-600">Static Pages</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded text-center">
                          <div className="text-2xl font-bold text-green-700">{siteInfo.categoryStructure?.length || 0}</div>
                          <div className="text-xs text-green-600">Categories</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Page Information - Enhanced */}
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-green-500" /> 
                      Page Content
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-gray-500">Page Title</div>
                        <div className="text-sm font-medium truncate">{siteInfo.title || 'No title'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Meta Description</div>
                        <div className="text-sm truncate">{siteInfo.description || 'No description'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Heading Structure</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {siteInfo.headings?.h1?.length > 0 && (
                            <Badge variant="outline" className="text-xs bg-blue-50">H1: {siteInfo.headings.h1.length}</Badge>
                          )}
                          {siteInfo.headings?.h2?.length > 0 && (
                            <Badge variant="outline" className="text-xs bg-green-50">H2: {siteInfo.headings.h2.length}</Badge>
                          )}
                          {siteInfo.headings?.h3?.length > 0 && (
                            <Badge variant="outline" className="text-xs bg-yellow-50">H3: {siteInfo.headings.h3.length}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Social Media - New */}
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                      <Share2 className="h-4 w-4 text-pink-500" /> 
                      Social Media
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Open Graph</span>
                        {siteInfo.socialMetadata?.openGraphTitle ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">Available</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700">Missing</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Twitter Cards</span>
                        {siteInfo.socialMetadata?.twitterTitle ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">Available</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700">Missing</Badge>
                        )}
                      </div>
                      
                      {/* Social preview */}
                      {(siteInfo.socialMetadata?.openGraphImage || siteInfo.socialMetadata?.twitterImage) && (
                        <div className="mt-3 border rounded overflow-hidden">
                          <div className="h-20 bg-gray-100 relative">
                            <img 
                              src={siteInfo.socialMetadata.openGraphImage || siteInfo.socialMetadata.twitterImage} 
                              alt="Social preview" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <div className="text-white text-sm font-medium truncate">
                                {siteInfo.socialMetadata.openGraphTitle || siteInfo.title}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Keywords - Enhanced */}
              {siteInfo && siteInfo.keywords && siteInfo.keywords.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-indigo-500" />
                    Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {siteInfo.keywords.map((keyword: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-indigo-50 text-indigo-700 text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Image Gallery - Enhanced with better UI */}
              {siteInfo && siteInfo.images && siteInfo.images.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                    <Image className="h-4 w-4 text-rose-500" />
                    Images ({siteInfo.images.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {siteInfo.images.slice(0, 12).map((img: any, i: number) => (
                      <div key={i} className="group relative aspect-square bg-gray-100 rounded-md overflow-hidden border">
                        <img 
                          src={img.src} 
                          alt={img.alt || 'Site image'} 
                          className="object-cover w-full h-full transition-all group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#f0f0f0" width="100" height="100"/><path fill="#cccccc" d="M36 38L56 38L56 58L36 58Z"/><path fill="#cccccc" d="M30 30L62 30L62 40L30 40Z"/></svg>';
                          }}
                        />
                        {!img.alt && (
                          <div className="absolute bottom-0 right-0 bg-red-500 text-white text-xs px-1 py-0.5">
                            No ALT
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-white/90 hover:bg-white"
                            onClick={() => window.open(img.src, '_blank')}
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </div>
                      </div>
                    ))}
                    {siteInfo.images.length > 12 && (
                      <div className="aspect-square bg-gray-50 rounded-md border flex items-center justify-center">
                        <div className="text-gray-500 text-center">
                          <Plus className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                          <div className="text-sm font-medium">+{siteInfo.images.length - 12} more</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Content Sections - New */}
              {siteInfo && siteInfo.contentSections && siteInfo.contentSections.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-green-500" />
                    Content Sections
                  </h3>
                  <div className="space-y-4">
                    {siteInfo.contentSections.map((section: any, i: number) => (
                      <div key={i} className="bg-white p-4 rounded-lg border shadow-sm">
                        <h4 className="font-medium text-gray-700">{section.title || 'Untitled Section'}</h4>
                        <div className="text-sm text-gray-600 mt-1">{section.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Siteinfo footerlİnks and navlinks */}
              {siteInfo && siteInfo.staticPageLinks && (
  <>
    <div className="mt-6">
      <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
        <Link className="h-4 w-4 text-blue-500" />
        Footer Links
      </h3>
      <div className="flex flex-wrap gap-2">
        {siteInfo.staticPageLinks
          .filter((link: any) => link.section.toLowerCase().includes('footer'))
          .map((link: any, i: number) => (
            <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
              {link.title}
            </Badge>
          ))}
      </div>
    </div>
    <div className="mt-6">
      <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
        <Link className="h-4 w-4 text-blue-500" />
        Navigation Links
      </h3>
      <div className="flex flex-wrap gap-2">
        {siteInfo.staticPageLinks
          .filter((link: any) => link.section.toLowerCase().includes('nav') || link.section.toLowerCase().includes('header'))
          .map((link: any, i: number) => (
            <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
              {link.title}
            </Badge>
          ))}
      </div>
    </div>
  </>
)}
            </CardContent>
          </Card>
          
          {/* Content Analysis Tabs - FIXED */}
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="all">
                All Pages ({results.stats?.total || 0})
              </TabsTrigger>
              {Object.entries(results.stats || {})
                .filter(([key]) => !['total', 'crawled', 'failed'].includes(key))
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, count]) => (
                  <TabsTrigger key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)} ({count as number})
                  </TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>All Pages</CardTitle>
                  <CardDescription>
                    Complete list of all pages found on the site
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <DataTable 
                    contentType="all"
                    data={(results.results || []).map((item: any) => ({ 
                      ...item, 
                      type: item.type || "others" // Ensure type is never undefined

                    }))}
                  />
                </CardContent>
              </Card>
              
            </TabsContent>

            <TabsContent value="static"> 
              <Card>
                <CardHeader>
                  <CardTitle>Static Pages</CardTitle>
                  <CardDescription>
                    Found {results.stats?.static || 0} static pages
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <DataTable 
                    contentType="static"
                    data={(results.results || []).filter((item: any) => item.type === 'static')}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* FIXED: Handle categorized content safely */}
            {Object.keys(results.categorized || {}).map((category) => {
              // Extract the data for this category
              const categoryData = (results.results || []).filter((item: any) => 
                item.type === category || 
                (results.categorized[category] && results.categorized[category].includes(item.url))
              );
              
              // Debug output
              console.log(`Category ${category}: Found ${categoryData.length} items`);
              
              return (
                <TabsContent key={category} value={category}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="capitalize">{category} Pages</CardTitle>
                      <CardDescription>
                        Found {categoryData.length} {category} pages
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <DataTable 
                        contentType={category as any}
                        data={categoryData.map((item: any) => ({
                          ...item,
                          type: category || 'Uncategorized' // Ensure type is never undefined
                        }))}
                      />
                    </CardContent>
                  </Card>
                  
                    <Card>
                      <CardHeader>
                        <CardTitle>Static Pages</CardTitle>
                        <CardDescription>
                          Found {categoryData.length} static pages
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <DataTable 
                          contentType="static"
                          data={categoryData.map((item: any) => ({
                            ...item,
                            type: 'static' // Ensure type is never undefined
                          }))}
                        />
                      </CardContent>
                    </Card>

                </TabsContent>

              );
            })}
          </Tabs>
        </div>
      )}
    </div>
  )
}

