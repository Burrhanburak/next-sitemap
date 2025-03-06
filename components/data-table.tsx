'use client';

import React, { useState, useEffect } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  VisibilityState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Search,
  ArrowUpDown,
  Filter,
  Eye
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageData } from './columns';

interface DataTableProps<TData, TValue> {
  contentType: 'blog' | 'product' | 'category' | 'static' | 'all'
  data: TData[]
}

export function DataTable<TData, TValue>({
  contentType,
  data,
}: DataTableProps<TData, TValue>) {
  // Add debugging to see incoming data
  console.log(`DataTable rendering for type: ${contentType}`);
  console.log(`Data sample:`, data[0]);
  
  const [columns, setColumns] = useState<ColumnDef<TData, TValue>[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load appropriate columns based on contentType
  useEffect(() => {
    const loadColumns = async () => {
      try {
        setIsLoading(true);
        
        // Import all column types
        const { 
          defaultColumns, 
          productColumns, 
          blogColumns, 
          categoryColumns, 
          staticColumns,
        } = await import('./columns');
        
        console.log(`Loaded column definitions for ${contentType}`);
        
        // Select columns based on content type
        let columnsToUse: ColumnDef<TData, TValue>[];
        
        switch (contentType) {
          case 'product':
            columnsToUse = productColumns as unknown as ColumnDef<TData, TValue>[];
            console.log("Using product columns:", productColumns.map(c => (c as any).accessorKey));
            break;
          case 'blog':
            columnsToUse = blogColumns as unknown as ColumnDef<TData, TValue>[];
            console.log("Using blog columns:", blogColumns.map(c => (c as any).accessorKey));
            break;
          case 'category':
            columnsToUse = categoryColumns as unknown as ColumnDef<TData, TValue>[];
            console.log("Using category columns:", categoryColumns.map(c => (c as any).accessorKey));
            break;
          case 'static':
            columnsToUse = staticColumns as unknown as ColumnDef<TData, TValue>[];
            console.log("Using static columns:", staticColumns.map(c => (c as any).accessorKey));
            break;
          case 'all':
          default:
            columnsToUse = defaultColumns as unknown as ColumnDef<TData, TValue>[];
            break;
        }
        
        // Set columns
        setColumns(columnsToUse);
        
        // Make all columns visible by default
        const allVisibleColumns = columnsToUse.reduce((acc, column) => {
          const key = (column as any).accessorKey || (column as any).id;
          acc[key] = true;
          return acc;
        }, {} as VisibilityState);
        
        setColumnVisibility(allVisibleColumns);
      } catch (error) {
        console.error("Error loading columns:", error);
        // Use default columns as fallback
        const { defaultColumns } = await import('./columns');
        setColumns(defaultColumns as unknown as ColumnDef<TData, TValue>[]);
      } finally {
        setIsLoading(false);
      }
    };

    loadColumns();
  }, [contentType]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Show loading indicator while columns are loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
        <span className="ml-3 text-gray-600">Loading data...</span>
      </div>
    );
  }

  // Show empty state if no data
  if (data.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-gray-400 text-xl mb-2">No {contentType} pages found</div>
        <p className="text-sm text-gray-500">Try analyzing more URLs or check the site structure</p>
      </div>
    );
  }

  // Handle case where columns didn't load properly
  if (columns.length === 0) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading columns for {contentType} pages. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            placeholder="Filter by URL or title..."
            value={(table.getColumn("url")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("url")?.setFilterValue(event.target.value)}
            className="max-w-xs"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Download data as CSV
                    const headers = columns
                      .map(col => (col as any).accessorKey || (col as any).header)
                      .filter(Boolean);
                    
                    const rows = data.map((row: any) => {
                      return headers.map(header => {
                        const value = row[header as keyof typeof row];
                        if (Array.isArray(value)) return JSON.stringify(value);
                        return value;
                      }).join(',');
                    });
                    
                    const csv = [headers.join(','), ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${contentType}-data.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download as CSV</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" /> Columns
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show/hide columns</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(column => column.getCanHide())
                .map(column => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div className={header.column.getCanSort() ? "cursor-pointer select-none flex items-center" : ""}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow 
                  key={row.id} 
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-between space-x-2 py-4 px-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {/* Pagination info */}
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{" "}
          of {table.getFilteredRowModel().rows.length} rows
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}