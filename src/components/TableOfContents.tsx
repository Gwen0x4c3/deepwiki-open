"use client";

import React, { useEffect, useState } from "react";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  // Unicode-aware slugify to support non-ASCII (e.g., Chinese) headings
  const slugify = (input: string): string => {
    return input
      .toLowerCase()
      .trim()
      // keep unicode letters/numbers/spaces/hyphens
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  useEffect(() => {
    // Parse markdown content to extract headings (H1, H2, and H3)
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      
      // Skip if title is empty or too short
      if (!title || title.length < 1) continue;
      
      // Create a unicode-safe ID from the title
      const idCandidate = slugify(title);
      const id = idCandidate || slugify(encodeURIComponent(title));
      
      console.log('[TableOfContents] Generated TOC item:', { title, id, level });
      items.push({ id, title, level });
    }

    console.log('[TableOfContents] Total TOC items:', items.length);
    setTocItems(items);
  }, [content]);

  const handleClick = (id: string) => {
    console.log('[TableOfContents] Attempting to scroll to ID:', id);
    const element = document.getElementById(id);
    if (element) {
      console.log('[TableOfContents] Found element, scrolling...', element);
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      console.warn('[TableOfContents] Element not found for ID:', id);
      console.log('[TableOfContents] All heading IDs in document:', 
        Array.from(document.querySelectorAll('#wiki-content h1, #wiki-content h2, #wiki-content h3'))
          .map(el => ({ id: el.id, text: el.textContent }))
      );
    }
  };

  if (tocItems.length === 0) {
    return null;
  }

  return (
    // y 方向溢出滚动
    <nav className="w-[240px] xl:w-[280px] flex-shrink-0 hidden xl:block h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="sticky top-0 bg-[var(--card-bg)] rounded-lg p-5 border border-[var(--border-color)] shadow-sm">
        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4 font-serif flex items-center">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          Table of Contents
        </h4>
        <ul className="space-y-2 text-sm">
          {tocItems.map((item, index) => {
            const paddingLeft = `${(item.level - 1) * 0.75}rem`;
            
            return (
              <li key={`${item.id}-${index}`} style={{ paddingLeft }}>
                <button
                  onClick={() => handleClick(item.id)}
                  className="text-left w-full transition-all duration-200 py-1.5 px-2 rounded-md hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 text-[var(--muted)]"
                >
                  <span className="line-clamp-2 text-xs leading-relaxed">
                    {item.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
