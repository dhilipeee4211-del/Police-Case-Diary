import { loadPdfJs } from '../clientOcr';
import { Logger } from './Logger';

class PdfReaderClass {
  private tesseractWorker: any = null;

  public async getPageCount(file: File): Promise<number> {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    // Explicitly destroy the loading task to free memory
    await pdf.destroy();
    return numPages;
  }

  /**
   * Fast text layer extraction with OCR fallback for a single page.
   */
  public async extractPageText(
    file: File,
    pageNum: number,
    onProgress: (step: string) => void
  ): Promise<string> {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNum);

    try {
      // 1. Fast text layer search
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');

      if (pageText && pageText.trim().length > 100) {
        Logger.log(`Page ${pageNum}: Extracted text layer directly (${pageText.length} chars).`, 'OCR');
        await pdf.destroy();
        return pageText;
      }

      // 2. OCR Fallback for scanned/image pages
      onProgress(`Page ${pageNum} is scanned. Initializing English + Tamil OCR...`);
      Logger.log(`Page ${pageNum}: Direct text layer missing or empty. Bootstrapping local OCR...`, 'OCR');

      if (!this.tesseractWorker) {
        const { createWorker } = await import('tesseract.js');
        this.tesseractWorker = await createWorker('eng+tam');
      }

      onProgress(`Rendering Page ${pageNum} into local canvas...`);
      const viewport = page.getViewport({ scale: 2.0 }); // Render at 2x scale for higher OCR accuracy
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (!context) {
        throw new Error('Failed to create 2D canvas context for page rendering.');
      }

      await page.render({ canvasContext: context, viewport }).promise;

      onProgress(`Running local OCR scan on Page ${pageNum}...`);
      const { data: { text: ocrText } } = await this.tesseractWorker.recognize(canvas);

      Logger.log(`Page ${pageNum}: OCR completed successfully (${ocrText.length} chars extracted).`, 'SUCCESS');
      
      // Clear canvas elements
      canvas.width = 0;
      canvas.height = 0;

      await pdf.destroy();
      return ocrText;
    } catch (err) {
      await pdf.destroy();
      throw err;
    }
  }

  /**
   * Slices a single page from the PDF file using pdf-lib and returns the base64 PDF bytes.
   */
  public async extractPagePdfBytes(file: File, pageNum: number): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const { PDFDocument } = await import('pdf-lib');
    const srcDoc = await PDFDocument.load(arrayBuffer);
    
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, [pageNum - 1]);
    newDoc.addPage(copiedPages[0]);
    
    const newPdfBytes = await newDoc.save();
    
    let binary = '';
    const len = newPdfBytes.byteLength;
    for (let k = 0; k < len; k++) {
      binary += String.fromCharCode(newPdfBytes[k]);
    }
    
    // Clean up pdf documents from memory
    srcDoc.flush();
    newDoc.flush();
    
    return window.btoa(binary);
  }

  /**
   * Slices a range of pages from the PDF file using pdf-lib and returns the base64 PDF bytes.
   */
  public async extractPagesRangePdfBytes(file: File, startPage: number, endPage: number): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const { PDFDocument } = await import('pdf-lib');
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = srcDoc.getPageCount();
    
    const newDoc = await PDFDocument.create();
    const pagesToCopy = Array.from(
      { length: Math.min(endPage - startPage + 1, pageCount - (startPage - 1)) },
      (_, idx) => startPage - 1 + idx
    );
    
    const copiedPages = await newDoc.copyPages(srcDoc, pagesToCopy);
    copiedPages.forEach(p => newDoc.addPage(p));
    
    const newPdfBytes = await newDoc.save();
    
    let binary = '';
    const len = newPdfBytes.byteLength;
    for (let k = 0; k < len; k++) {
      binary += String.fromCharCode(newPdfBytes[k]);
    }
    
    srcDoc.flush();
    newDoc.flush();
    
    return window.btoa(binary);
  }

  /**
   * Terminate Tesseract worker to free up resources.
   */
  public async disposeOCRWorker(): Promise<void> {
    if (this.tesseractWorker) {
      Logger.log('Dismantling Tesseract OCR worker...', 'SYSTEM');
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
}

export const PdfReader = new PdfReaderClass();
