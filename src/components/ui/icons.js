import React from 'react';
import { 
  FileText, Mail, Rss, Highlighter, Notebook, File, Book, MessageCircle, Video,
  Inbox, Clock, Star, Archive, Trash2
} from 'lucide-react';

export const CATEGORY_ICONS_SVG = {
  article: <FileText size={16} />,
  email: <Mail size={16} />,
  rss: <Rss size={16} />,
  highlight: <Highlighter size={16} />,
  note: <Notebook size={16} />,
  pdf: <File size={16} />,
  epub: <Book size={16} />,
  tweet: <MessageCircle size={16} />,
  video: <Video size={16} />,
};

export const LOCATION_ICONS_SVG = {
  new: <Inbox size={16} />,
  later: <Clock size={16} />,
  shortlist: <Star size={16} />,
  archive: <Archive size={16} />,
  feed: <Rss size={16} />,
  trash: <Trash2 size={16} />,
};

export const getCategoryIcon = (category, size = 16, className = '') => {
  const IconComponent = {
    article: FileText,
    email: Mail,
    rss: Rss,
    highlight: Highlighter,
    note: Notebook,
    pdf: File,
    epub: Book,
    tweet: MessageCircle,
    video: Video,
  }[category] || FileText;

  return <IconComponent size={size} className={className} />;
};

export const getLocationIcon = (location, size = 16, className = '') => {
  const IconComponent = {
    new: Inbox,
    later: Clock,
    shortlist: Star,
    archive: Archive,
    feed: Rss,
    trash: Trash2,
  }[location] || Inbox;

  return <IconComponent size={size} className={className} />;
};
