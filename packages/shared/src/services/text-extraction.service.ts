// Text Extraction Service for S-034
// Extracts text from PDF, DOCX, TXT, and MD files

import { franc } from 'franc';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { createStorageService, type StorageService } from '../storage/storage.service.js';

/**
 * Document structure information
 */
export interface DocumentStructure {
  hasHeadings: boolean;
  headingCount: number;
  hasBulletLists: boolean;
  hasNumberedLists: boolean;
  hasTables: boolean;
  tableCount: number;
  sections: SectionInfo[];
}

/**
 * Section information from the document
 */
export interface SectionInfo {
  title: string;
  level: number;
  startOffset: number;
  wordCount: number;
}

/**
 * Metadata from extraction process
 */
export interface ExtractionMetadata {
  pdfVersion?: string;
  author?: string;
  creationDate?: string;
  warnings?: string[];
}

/**
 * Result from text extraction
 */
export interface ExtractionResult {
  text: string;
  wordCount: number;
  pageCount: number;
  detectedLanguage: string;
  structure: DocumentStructure;
  metadata: ExtractionMetadata;
}

/**
 * MIME type mapping for file extensions
 */
const MIME_TYPE_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
};

/**
 * Service for extracting text from various document formats
 */
export class TextExtractionService {
  private storageService: StorageService;
  private bucket: string;

  constructor(storageService?: StorageService, bucket?: string) {
    this.storageService = storageService || createStorageService();
    this.bucket = bucket || process.env.S3_BUCKET || 'entropy-artifacts';
  }

  /**
   * Extract text from a buffer based on MIME type
   */
  async extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractPdf(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractDocx(buffer);
      case 'text/plain':
      case 'text/markdown':
        return this.extractText(buffer);
      default:
        throw new Error(`UNSUPPORTED_MIME_TYPE: ${mimeType}`);
    }
  }

  /**
   * Extract text from an S3 key
   */
  async extractFromS3(s3Key: string): Promise<ExtractionResult> {
    const result = await this.storageService.download(s3Key, this.bucket);
    if (!result) {
      throw new Error(`FILE_NOT_FOUND: ${s3Key}`);
    }

    const mimeType = this.inferMimeType(s3Key);
    return this.extract(result.content, mimeType);
  }

  /**
   * Save extracted text to S3 and return the key
   */
  async saveExtractedText(
    requirementId: string,
    projectId: string,
    clientId: string,
    result: ExtractionResult
  ): Promise<{ textKey: string; metadataKey: string }> {
    const basePath = `clients/${clientId}/projects/${projectId}/requirements/${requirementId}/processed`;

    // Save extracted text
    const textKey = `${basePath}/extracted_text.txt`;
    await this.storageService.upload(
      textKey,
      result.text,
      {
        contentType: 'text/plain; charset=utf-8',
        metadata: {
          wordCount: result.wordCount.toString(),
          pageCount: result.pageCount.toString(),
          detectedLanguage: result.detectedLanguage,
        },
      },
      this.bucket
    );

    // Save metadata as JSON
    const metadataKey = `${basePath}/extraction_metadata.json`;
    const metadataContent = {
      wordCount: result.wordCount,
      pageCount: result.pageCount,
      detectedLanguage: result.detectedLanguage,
      structure: result.structure,
      metadata: result.metadata,
      extractedAt: new Date().toISOString(),
    };
    await this.storageService.uploadJson(metadataKey, metadataContent, {}, this.bucket);

    return { textKey, metadataKey };
  }

  /**
   * Extract text from PDF buffer
   */
  private async extractPdf(buffer: Buffer): Promise<ExtractionResult> {
    let parser: PDFParse | null = null;
    try {
      // Create PDFParse instance with buffer converted to Uint8Array
      parser = new PDFParse({ data: new Uint8Array(buffer) });

      // Get text content
      const textResult = await parser.getText();
      const text = textResult.text || '';

      if (!text || text.trim().length === 0) {
        throw new Error('EMPTY_DOCUMENT');
      }

      // Get document info
      const infoResult = await parser.getInfo();
      const pageCount = textResult.pages?.length || 1;

      // Extract metadata safely - info is typed as 'any' in pdf-parse
      const info = infoResult.info as Record<string, unknown> | undefined;

      return {
        text,
        wordCount: this.countWords(text),
        pageCount,
        detectedLanguage: this.detectLanguage(text),
        structure: this.analyzeStructure(text),
        metadata: {
          pdfVersion: info?.PDFFormatVersion as string | undefined,
          author: info?.Author as string | undefined,
          creationDate: info?.CreationDate as string | undefined,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('password')) {
        throw new Error('PROTECTED_DOCUMENT');
      }
      if (errorMessage === 'EMPTY_DOCUMENT') {
        throw error;
      }
      throw new Error(`EXTRACTION_FAILED: ${errorMessage}`);
    } finally {
      // Clean up parser resources
      if (parser) {
        await parser.destroy().catch(() => {});
      }
    }
  }

  /**
   * Extract text from DOCX buffer
   */
  private async extractDocx(buffer: Buffer): Promise<ExtractionResult> {
    try {
      // Extract as raw text (more reliable than markdown)
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        throw new Error('EMPTY_DOCUMENT');
      }

      return {
        text,
        wordCount: this.countWords(text),
        pageCount: 1, // DOCX doesn't have reliable page count
        detectedLanguage: this.detectLanguage(text),
        structure: this.analyzeStructure(text),
        metadata: {
          warnings: result.messages.map((m: { message: string }) => m.message),
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage === 'EMPTY_DOCUMENT') {
        throw error;
      }
      throw new Error(`EXTRACTION_FAILED: ${errorMessage}`);
    }
  }

  /**
   * Extract text from plain text or markdown buffer
   */
  private async extractText(buffer: Buffer): Promise<ExtractionResult> {
    const text = buffer.toString('utf-8');

    if (!text || text.trim().length === 0) {
      throw new Error('EMPTY_DOCUMENT');
    }

    return {
      text,
      wordCount: this.countWords(text),
      pageCount: 1,
      detectedLanguage: this.detectLanguage(text),
      structure: this.analyzeMarkdownStructure(text),
      metadata: {},
    };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Detect language using franc
   */
  private detectLanguage(text: string): string {
    const sample = text.slice(0, 5000); // Use first 5000 chars for detection
    const detected = franc(sample);
    return detected === 'und' ? 'en' : detected;
  }

  /**
   * Analyze structure of plain text (PDF-style)
   */
  private analyzeStructure(text: string): DocumentStructure {
    const lines = text.split('\n');

    // Detect headings (lines that look like titles)
    const headingPatterns = [
      /^#+\s/, // Markdown headings
      /^[A-Z][A-Z\s]{5,}$/, // ALL CAPS lines
      /^\d+\.\s+[A-Z]/, // Numbered sections
      /^[A-Z][^.!?]*:?\s*$/, // Title case lines ending with colon or nothing
    ];

    const headings = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 && trimmed.length < 100 && headingPatterns.some((p) => p.test(trimmed))
      );
    });

    // Detect lists
    const hasBulletLists = /^[\s]*[-•*]\s/m.test(text);
    const hasNumberedLists = /^[\s]*\d+[.)]\s/m.test(text);

    // Detect tables (pipe-based markdown tables or aligned columns)
    const tableMatches = text.match(/\|.*\|/g);
    const hasTables = tableMatches !== null && tableMatches.length > 2;

    // Extract sections
    const sections = this.extractSections(text, lines, headings);

    return {
      hasHeadings: headings.length > 0,
      headingCount: headings.length,
      hasBulletLists,
      hasNumberedLists,
      hasTables,
      tableCount: hasTables ? Math.floor(tableMatches!.length / 3) : 0,
      sections,
    };
  }

  /**
   * Analyze structure of markdown text
   */
  private analyzeMarkdownStructure(text: string): DocumentStructure {
    const headingMatches = [...text.matchAll(/^(#{1,6})\s+(.+)$/gm)];
    const sections: SectionInfo[] = [];

    for (const match of headingMatches) {
      const title = match[2] ?? '';
      const hashes = match[1] ?? '';
      sections.push({
        title,
        level: hashes.length,
        startOffset: match.index || 0,
        wordCount: 0, // Would require more complex calculation
      });
    }

    // Detect lists
    const hasBulletLists = /^[\s]*[-*]\s/m.test(text);
    const hasNumberedLists = /^[\s]*\d+[.)]\s/m.test(text);

    // Detect tables
    const tableMatches = text.match(/^\|.*\|.*\|$/gm);
    const hasTables = tableMatches !== null && tableMatches.length > 2;

    return {
      hasHeadings: sections.length > 0,
      headingCount: sections.length,
      hasBulletLists,
      hasNumberedLists,
      hasTables,
      tableCount: hasTables ? Math.floor(tableMatches!.length / 3) : 0,
      sections,
    };
  }

  /**
   * Extract section information from text
   */
  private extractSections(text: string, _lines: string[], headings: string[]): SectionInfo[] {
    const sections: SectionInfo[] = [];

    for (const heading of headings) {
      const index = text.indexOf(heading);
      const level = this.inferHeadingLevel(heading);

      sections.push({
        title: heading
          .replace(/^#+\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .trim(),
        level,
        startOffset: index,
        wordCount: 0,
      });
    }

    return sections;
  }

  /**
   * Infer heading level from text
   */
  private inferHeadingLevel(heading: string): number {
    // Check for markdown-style headings
    const mdMatch = heading.match(/^(#+)/);
    if (mdMatch?.[1]) {
      return mdMatch[1].length;
    }

    // Check for numbered sections
    const numMatch = heading.match(/^(\d+)\.(\d+)?\.?(\d+)?/);
    if (numMatch) {
      if (numMatch[3]) return 3;
      if (numMatch[2]) return 2;
      return 1;
    }

    // Default based on formatting
    if (/^[A-Z][A-Z\s]+$/.test(heading.trim())) {
      return 1; // ALL CAPS = top level
    }

    return 2; // Default to level 2
  }

  /**
   * Infer MIME type from S3 key
   */
  private inferMimeType(s3Key: string): string {
    const ext = s3Key.split('.').pop()?.toLowerCase();
    return MIME_TYPE_MAP[ext || ''] || 'text/plain';
  }
}

/**
 * Create a text extraction service instance
 */
export function createTextExtractionService(
  storageService?: StorageService,
  bucket?: string
): TextExtractionService {
  return new TextExtractionService(storageService, bucket);
}
