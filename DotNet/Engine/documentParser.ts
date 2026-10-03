import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

export interface ExtractedDocument {
  text: string;
  pageCount?: number;
  wordCount: number;
}

/**
 * Extracts plain text from PDF, DOCX, or text files
 */
export async function extractDocumentText(
  buffer: Buffer,
  fileType: string
): Promise<ExtractedDocument> {
  const lowerType = fileType.toLowerCase().replace('.', '');

  if (lowerType === 'pdf') {
    try {
      const data = await (pdfParse as any)(buffer);
      const text = data.text.trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      return {
        text,
        pageCount: data.numpages || 1,
        wordCount,
      };
    } catch (err: any) {
      console.error('PDF parsing error, using raw fallback:', err);
      // Fallback: extract ASCII strings
      const rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
      return {
        text: rawText.slice(0, 5000),
        pageCount: 1,
        wordCount: rawText.split(/\s+/).length,
      };
    }
  }

  if (lowerType === 'docx' || lowerType === 'doc') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      return {
        text,
        wordCount,
      };
    } catch (err: any) {
      console.error('DOCX parsing error:', err);
      const rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      return {
        text: rawText.slice(0, 5000),
        wordCount: rawText.split(/\s+/).length,
      };
    }
  }

  // Text, Markdown, JSON, CSV
  const text = buffer.toString('utf-8');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    text,
    wordCount,
  };
}

/**
 * Splits document text into coherent chunks for vector embedding
 */
export function chunkDocumentText(
  text: string,
  targetChunkChars = 600,
  overlapChars = 100
): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + '\n\n' + para).length <= targetChunkChars) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    } else {
      if (currentChunk.length > 50) {
        chunks.push(currentChunk.trim());
      }
      // If the paragraph itself is huge, break it by sentences
      if (para.length > targetChunkChars) {
        const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para];
        let subChunk = '';
        for (const sentence of sentences) {
          if ((subChunk + ' ' + sentence).length <= targetChunkChars) {
            subChunk = subChunk ? subChunk + ' ' + sentence : sentence;
          } else {
            if (subChunk.trim()) chunks.push(subChunk.trim());
            subChunk = sentence;
          }
        }
        if (subChunk.trim()) currentChunk = subChunk.trim();
      } else {
        // Start next chunk with slight overlap
        const overlap = currentChunk.slice(-overlapChars);
        currentChunk = (overlap ? overlap + ' ' : '') + para;
      }
    }
  }

  if (currentChunk.trim().length > 30) {
    chunks.push(currentChunk.trim());
  }

  // Safety fallback if no chunks produced
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push(text.trim().slice(0, targetChunkChars));
  }

  return chunks;
}
