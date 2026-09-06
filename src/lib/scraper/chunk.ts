import { JSDOM } from "jsdom";

export type TextChunk = {
  content: string;
  heading: string | null;
  order: number;
  isBoilerplate?: boolean;
};

const MAX_CHARS = 1500;
const OVERLAP = 200;
const MIN_PARAGRAPH_WORDS = 15;
const BOILERPLATE_PATTERNS = [
  /subscribe/i,
  /sign up/i,
  /cookie/i,
  /donate/i,
  /accept all/i,
  /newsletter/i,
  /advertisement/i,
  /support us/i,
  /help us/i,
  /join our/i,
  /follow us/i,
];
/**
 * Detect if a paragraph is likely boilerplate (donation asks, cookie notices, etc.)
 */
function isBoilerplateParagraph(text: string): boolean {
  // Check for known boilerplate phrases only
  for (const pattern of BOILERPLATE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter out boilerplate paragraphs from HTML content
 */
function filterBoilerplateFromHtml(html: string): { filteredHtml: string; removedCount: number } {
  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;
  let removedCount = 0;
  
  const processNode = (node: Node) => {
    if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      
      if (tag === "p" || tag === "li" || tag === "div") {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text && isBoilerplateParagraph(text)) {
          el.remove();
          removedCount++;
          return;
        }
      }
      
      // Process children
      const children = Array.from(el.childNodes);
      for (const child of children) {
        processNode(child);
      }
    }
  };
  
  processNode(body);
  return { filteredHtml: body.innerHTML, removedCount };
}

export function chunkDocument(markdown: string): TextChunk[] {
  if (!markdown?.trim()) return [];
  return chunkMarkdown(markdown);
}

function chunkMarkdown(markdown: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentHeading: string | null = null;
  let order = 0;

  // Split by markdown headings (H1-H3)
  const sections = markdown.split(/\n(?=#{1,3}\s+)/);

  for (let section of sections) {
    section = section.trim();
    if (!section) continue;

    // Detect heading
    const headingMatch = section.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
      // Remove heading line from content to avoid duplication, 
      // or keep it to provide context. Let's keep it.
    }

    // Process blocks inside the section
    const blocks = section.split(/\n\n+/);
    let buffer = "";

    const flush = () => {
      const text = buffer.trim();
      if (!text) return;
      const isBoilerplate = isBoilerplateParagraph(text);
      
      // If a single block somehow exceeds max, hard split it
      for (const piece of splitWithOverlap(text, MAX_CHARS, OVERLAP)) {
        chunks.push({ content: piece, heading: currentHeading, order: order++, isBoilerplate });
      }
      buffer = "";
    };

    for (const block of blocks) {
      const cleaned = block.trim();
      if (!cleaned) continue;

      if (buffer.length + cleaned.length + 2 > MAX_CHARS) {
        if (buffer) flush();
      }
      
      buffer += (buffer ? "\n\n" : "") + cleaned;
    }
    
    if (buffer) flush();
  }

  return chunks;
}



function splitWithOverlap(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];

  const parts: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(" "), slice.lastIndexOf("\n"));
      if (lastBreak > maxChars * 0.4) {
        end = start + lastBreak + 1;
      }
    }
    parts.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }

  return parts.filter(Boolean);
}
