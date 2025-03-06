import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from 'date-fns'
import { memo } from "react"
import { Image, List, Calendar, Tag, ExternalLink } from "lucide-react"

// Updated interface to match sitemap.ts data structure
export interface PageData {
  url: string;
  title?: string;
  description?: string;
  type?: string;
  price?: string;
  images?: string[];
  timestamp?: string;
  error?: string;
  stock?: string;
  features?: string[];
  comments?: { author: string; content: string; date: string }[];
  breadcrumb?: string[];
  category?: string;
  date?: string;
  blogCategories?: string[];
  blogContent?: string;
}

// Optimized image cell component with preview
const ImageCell = memo(({ images }: { images?: string[] }) => {
  if (!images?.length) return <div className="text-gray-400">No images</div>;
  
  // Process image URLs to ensure they work correctly
  const processedImages = images.map(img => {
    if (img && !img.startsWith('http') && !img.startsWith('data:')) {
      // Convert relative URLs to absolute when needed
      return img.startsWith('/') ? `https://${new URL(location.href).host}${img}` : img;
    }
    return img;
  });
  
  return (
    <div className="flex flex-wrap gap-2">
      {processedImages.slice(0, 3).map((img, i) => (
        <div key={i} className="relative group">
          <img 
            src={img} 
            alt={`Preview ${i + 1}`}
            loading="lazy"
            className="h-10 w-10 object-cover rounded shadow-sm border border-gray-200"
            onError={(e) => {
              const imgEl = e.target as HTMLImageElement;
              // Use inline SVG as fallback instead of external file
              imgEl.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OSI+SW1hZ2U8L3RleHQ+PC9zdmc+';
            }}
          />
          <div className="hidden group-hover:flex absolute -top-2 -right-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-6 w-6 p-0 rounded-full"
              onClick={() => window.open(img, '_blank')}
            >
              <Image className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
      {processedImages.length > 3 && (
        <div className="h-10 w-10 bg-blue-50 rounded flex items-center justify-center text-xs font-medium text-blue-600 border border-blue-100">
          +{processedImages.length - 3}
        </div>
      )}
    </div>
  );
});
ImageCell.displayName = "ImageCell"; // Fixed TypeBadge to ImageCell

// Improved date formatting function that handles multiple formats
const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  
  try {
    // First check if it's a standard format that Date can parse
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
    
    // Handle DD-MM-YYYY format (common in many non-US sites)
    const ddmmyyyyRegex = /(\d{1,2})[.-](\d{1,2})[.-](\d{4})/;
    const ddmmyyyyMatch = dateStr.match(ddmmyyyyRegex);
    if (ddmmyyyyMatch) {
      const [_, day, month, year] = ddmmyyyyMatch;
      const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString();
      }
    }
    
    // If we have text like "24-10-2018" without proper parsing, just return it as is
    if (dateStr.match(/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/)) {
      return dateStr;
    }
    
    // Last resort: just return the original string
    return dateStr;
  } catch {
    return dateStr;
  }
};

// Features cell that actually displays the features
const FeaturesCell = memo(({ features }: { features?: string[] }) => {
  if (!features?.length) return <div className="text-gray-400">No features</div>;
  
  return (
    <div className="max-h-28 overflow-y-auto text-sm">
      <ul className="list-disc pl-4 space-y-1">
        {features.slice(0, 3).map((feature, i) => (
          <li key={i} className="text-gray-700">{feature}</li>
        ))}
        {features.length > 3 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-1 h-7 text-xs flex items-center gap-1"
          >
            <List className="h-3 w-3" /> +{features.length - 3} more
          </Button>
        )}
      </ul>
    </div>
  );
});
FeaturesCell.displayName = "FeaturesCell";

const CommentsCell = memo(({ comments }: { comments?: { author: string; content: string; date: string }[] }) => {
  if (!comments?.length) return <div className="text-gray-400 italic text-sm">No reviews</div>;
  return (
    <div className="max-h-24 overflow-y-auto space-y-2">
      {comments.slice(0, 2).map((comment, i) => (
        <div key={i} className="text-sm border-l-2 border-gray-200 pl-2">
          <div className="font-medium">{comment.author || 'Anonymous'}</div>
          <div className="text-gray-600 truncate">{comment.content || 'No content'}</div>
          <div className="text-gray-400 text-xs">{formatDate(comment.date)}</div>
        </div>
      ))}
      {comments.length > 2 && (
        <div className="text-blue-600 text-sm font-medium">+{comments.length - 2} more reviews</div>
      )}
    </div>
  );
});
CommentsCell.displayName = "CommentsCell";

// Default columns to use when no specific columns are available
export const defaultColumns: ColumnDef<PageData>[] = [
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      const url = row.getValue("url") as string;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-xs"
        >
          {url.replace(/https?:\/\/(www\.)?/, '')}
        </a>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = (row.getValue("type") as string) || "others";
      
      let bgColor = "bg-gray-100";
      let textColor = "text-gray-800";
      
      switch (type) {
        case 'product':
          bgColor = "bg-green-100";
          textColor = "text-green-800";
          break;
        case 'blog':
          bgColor = "bg-purple-100";
          textColor = "text-purple-800";
          break;
        case 'category':
          bgColor = "bg-blue-100";
          textColor = "text-blue-800";
          break;
        case 'static':
          bgColor = "bg-yellow-100";
          textColor = "text-yellow-800";
          break;
        default:
          bgColor = "bg-gray-100";
          textColor = "text-gray-800";
      }
      
      return (
        <Badge className={`${bgColor} ${textColor}`}>
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      return <span className="font-medium truncate block max-w-xs">{title || "No title"}</span>;
    }
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const desc = row.getValue("description") as string;
      return <span className="text-sm text-gray-600 truncate block max-w-xs">{desc || "No description"}</span>;
    }
  },
  {
    accessorKey: "timestamp",
    header: "Last Updated",
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as string;
      return timestamp 
        ? <span className="text-sm text-gray-500">{formatDistanceToNow(new Date(timestamp))} ago</span>
        : <span className="text-sm text-gray-400">Unknown</span>;
    }
  }
];

// REORGANIZED: Product columns in the order you requested
export const productColumns: ColumnDef<PageData>[] = [
  // Per your request: images,price,stock,type,url,title,description,category,features,comments
  {
    accessorKey: "images",
    header: "Images",
    cell: ({ row }) => {
      const images = row.original.images || [];
      return <ImageCell images={images} />;
    }
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const price = row.original.price;
      return price 
        ? <span className="font-medium">{price}</span> 
        : <span className="text-gray-400">N/A</span>;
    }
  },
  {
    accessorKey: "stock",
    header: "Stock",
    cell: ({ row }) => {
      const stockInfo = row.original.stock || "Available";
      return (
        <Badge variant="outline" className={stockInfo !== "Out of Stock" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
          {stockInfo === "Unknown" ? "Available" : stockInfo}
        </Badge>
      );
    }
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = (row.getValue("type") as string) || "product";
      return (
        <Badge className="bg-green-100 text-green-800">
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      const url = row.getValue("url") as string;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-xs"
        >
          {url.replace(/https?:\/\/(www\.)?/, '')}
        </a>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      return <span className="font-medium truncate block max-w-xs">{title || "No title"}</span>;
    }
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const desc = row.getValue("description") as string;
      return <span className="text-sm text-gray-600 truncate block max-w-xs">{desc || "No description"}</span>;
    }
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const category = row.original.category || 
                     extractCategoryFromUrl(row.original.url || '') || 
                     (row.original.breadcrumb?.length ? row.original.breadcrumb[row.original.breadcrumb.length - 1] : '');
      
      return category 
        ? <Badge variant="outline" className="capitalize">{category}</Badge> 
        : <span className="text-gray-400">Uncategorized</span>;
    }
  },
  {
    accessorKey: "features",
    header: "Features",
    cell: ({ row }) => {
      const features = row.original.features || [];
      return <FeaturesCell features={features} />;
    }
  },
  {
    accessorKey: "comments",
    header: "Reviews",
    cell: ({ row }) => {
      const comments = row.original.comments || [];
      return <CommentsCell comments={comments} />;
    }
  }
];

// REORGANIZED: Blog columns in the order you requested
export const blogColumns: ColumnDef<PageData>[] = [
  // Per your request: title,description,date,category,images
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      return <span className="font-medium truncate block max-w-xs">{title || "No title"}</span>;
    }
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const desc = row.getValue("description") as string;
      return <span className="text-sm text-gray-600 truncate block max-w-xs">{desc || "No description"}</span>;
    }
  },
  {
    accessorKey: "date",
    header: "Published Date",
    cell: ({ row }) => {
      const date = row.original.date;
      return date 
        ? (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-gray-500" />
            <span className="text-sm">{formatDate(date)}</span>
          </div>
        ) 
        : <span className="text-gray-400">Unknown</span>;
    }
  },
  {
    accessorKey: "blogCategories",
    header: "Categories",
    cell: ({ row }) => {
      let categories = [];
      
      if (row.original.blogCategories && row.original.blogCategories.length) {
        categories = row.original.blogCategories;
      } else if (row.original.category) {
        categories = [row.original.category];
      }
      
      if (!categories.length) return <span className="text-gray-400">Uncategorized</span>;
      
      return (
        <div className="flex flex-wrap gap-1">
          {categories.slice(0, 2).map((cat, i) => (
            <Badge key={i} variant="outline" className="capitalize">
              {cat}
            </Badge>
          ))}
          {categories.length > 2 && (
            <Badge variant="outline">+{categories.length - 2}</Badge>
          )}
        </div>
      );
    }
  },
  {
    accessorKey: "images",
    header: "Images",
    cell: ({ row }) => {
      const images = row.original.images || [];
      return <ImageCell images={images} />;
    }
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      const url = row.getValue("url") as string;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-xs"
        >
          {url.replace(/https?:\/\/(www\.)?/, '')}
          <ExternalLink className="inline-block ml-1 h-3 w-3" />
        </a>
      );
    },
  }
];

// Category columns
export const categoryColumns: ColumnDef<PageData>[] = [
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      const url = row.getValue("url") as string;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-xs"
        >
          {url.replace(/https?:\/\/(www\.)?/, '')}
        </a>
      );
    },
  },
  {
    accessorKey: "title", 
    header: "Title",
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      return <span className="font-medium truncate block max-w-xs">{title || "No title"}</span>;
    }
  },
  {
    accessorKey: "category",
    header: "Category Name",
    cell: ({ row }) => {
      const category = row.getValue("category") as string;
      return category 
        ? <Badge variant="outline" className="capitalize">{category}</Badge> 
        : <span className="text-gray-400">Unnamed Category</span>;
    }
  },
  {
    accessorKey: "breadcrumb",
    header: "Category Path",
    cell: ({ row }) => {
      const breadcrumb = row.original.breadcrumb || [];
      
      return breadcrumb.length > 0 
        ? (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            {breadcrumb.join(" > ")}
          </div>
        ) 
        : <span className="text-gray-400">No path</span>;
    }
  }
];

// Static page columns
export const staticColumns: ColumnDef<PageData>[] = [
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      const url = row.getValue("url") as string;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-xs"
        >
          {url.replace(/https?:\/\/(www\.)?/, '')}
        </a>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      return <span className="font-medium truncate block max-w-xs">{title || "No title"}</span>;
    }
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const desc = row.getValue("description") as string;
      return <span className="text-sm text-gray-600 truncate block max-w-xs">{desc || "No description"}</span>;
    }
  },
  {
    accessorKey: "images",
    header: "Images",
    cell: ({ row }) => {
      const images = row.original.images || [];
      return <ImageCell images={images} />;
    }
  }
];

// Helper function to extract category name from URL
function extractCategoryFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      return lastPart
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return '';
  } catch {
    return '';
  }
}