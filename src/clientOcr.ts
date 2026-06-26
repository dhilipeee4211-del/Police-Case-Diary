/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper to dynamically load pdf.js from CDN to avoid ESM/worker Vite build issues
export const loadPdfJs = async (): Promise<any> => {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js engine from CDN. Please check your internet connection.'));
    document.head.appendChild(script);
  });
};

/**
 * Extracts searchable text OR runs high-performance client-side OCR (Tamil + English) on PDF pages
 */
export const extractTextFromPdfClientSide = async (
  file: File, 
  onProgress: (percent: number, step: string) => void,
  startPageNum: number = 1
): Promise<string> => {
  onProgress(5, 'Initializing high-fidelity Client-Side PDF Engine...');
  const pdfjsLib = await loadPdfJs();
  
  onProgress(10, 'Reading file structure into memory buffer...');
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress(15, 'Decrypting PDF catalog & verifying metadata...');
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = '';

  onProgress(20, `Scanning document catalog: Found ${numPages} page(s).`);

  let tesseractWorker: any = null;

  for (let pageNum = startPageNum; pageNum <= numPages; pageNum++) {
    const pageProgressBase = 20 + Math.floor(((pageNum - 1) / numPages) * 75);
    onProgress(pageProgressBase, `Reading structural elements of Page ${pageNum} of ${numPages}...`);

    const page = await pdf.getPage(pageNum);
    
    // First: Attempt fast client-side text layer extraction (for searchable PDFs)
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    
    if (pageText && pageText.trim().length > 100) {
      console.log(`Page ${pageNum}: Fast text-layer extraction succeeded (${pageText.length} chars).`);
      fullText += `\n\n--- PAGE ${pageNum} ---\n\n` + pageText;
    } else {
      // Scanned PDF / Image PDF: Render the page to a canvas and perform dual Tamil/English client-side OCR!
      onProgress(
        pageProgressBase + 2, 
        `Page ${pageNum} is scanned. Bootstrapping English & Tamil OCR Engine...`
      );

      if (!tesseractWorker) {
        const { createWorker } = await import('tesseract.js');
        // Initialize dual-language OCR worker
        tesseractWorker = await createWorker('eng+tam');
      }

      onProgress(pageProgressBase + 8, `Rendering Page ${pageNum} at pixel-perfect scale onto local canvas...`);
      // Render page at scale (2.0) for extremely high OCR accuracy
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        
        onProgress(pageProgressBase + 12, `Performing local deep OCR scan on Page ${pageNum} (Zero cloud uploads)...`);
        const { data: { text: ocrText } } = await tesseractWorker.recognize(canvas);
        
        console.log(`Page ${pageNum}: OCR text extraction succeeded (${ocrText.length} chars extracted).`);
        fullText += `\n\n--- PAGE ${pageNum} (SCANNED OCR) ---\n\n` + ocrText;
      }
    }
  }

  if (tesseractWorker) {
    onProgress(98, 'Dismantling local OCR worker and freeing system memory...');
    await tesseractWorker.terminate();
  }

  onProgress(100, 'Client-side extraction completed!');
  return fullText;
};
