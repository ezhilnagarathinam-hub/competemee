import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { downloadExcel, downloadPDF } from '@/lib/exportFile';

interface DownloadMenuProps {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  disabled?: boolean;
  size?: 'default' | 'sm';
  variant?: 'default' | 'outline';
  label?: string;
}

export function DownloadMenu({ filename, title, headers, rows, disabled, size = 'default', variant = 'outline', label = 'Download' }: DownloadMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}>
          <Download className={size === 'sm' ? 'w-3 h-3 mr-1' : 'w-4 h-4 mr-2'} />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadExcel(filename, headers, rows)}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-accent" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadPDF(filename, title, headers, rows)}>
          <FileText className="w-4 h-4 mr-2 text-primary" />
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
