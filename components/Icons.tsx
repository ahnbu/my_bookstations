import React from 'react';
import { Search, X, Download, Plus, Trash2, RefreshCcw, User, Lock, CheckCircle, XCircle, Star, ArrowLeft, BookOpen, Check, AlertCircle, Book, Copy } from 'lucide-react';

export const SearchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Search {...props} />
);

export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <X {...props} />
);

export const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Download {...props} />
);

export const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Plus {...props} />
);

export const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Trash2 {...props} />
);

export const RefreshIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <RefreshCcw {...props} />
);

export const GoogleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 48 48" {...props}>
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A8 8 0 0 1 24 36c-5.222 0-9.657-3.356-11.303-7.918l-6.573 4.818C9.657 39.663 16.318 44 24 44z"></path>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.616 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
    </svg>
);

export const UserIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <User {...props} />
);

export const LockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Lock {...props} />
);

export const CheckCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <CheckCircle {...props} />
);

export const XCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <XCircle {...props} />
);

export const StarIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Star {...props} />
);

export const ArrowLeftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <ArrowLeft {...props} />
);

export const BookOpenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <BookOpen {...props} />
);

export const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Check {...props} />
);

export const AlertCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <AlertCircle {...props} />
);

export const BookIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Book {...props} />
);

export const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <Copy {...props} />
);