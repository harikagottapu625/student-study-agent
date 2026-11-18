import { createScheduler, createWorker } from 'tesseract.js';
import { PDFParse } from 'pdf-parse';

const OCR_WORKERS = 3;
const MAX_OCR_PAGES = 150;
const RENDER_BATCH = 6;
// 2x rendering roughly doubles accuracy on handwritten notes compared with 1.25x.
const RENDER_SCALE = 2;

// OCR reads bullets as stray symbols ("«+ Inheritance", "+ Polymorphism") and
// section numbers as "3·1"; normalise them and keep line breaks so headings and
// topics survive.
export const cleanOcrText = (text) =>
  String(text || '')
    .split(/\r?\n/)
    .map((line) => line
      .replace(/(\d)\s*[·•]\s*(\d)/g, '$1.$2')
      .replace(/^\s*[«»•·*+©®~=]{1,3}\s*(?=[A-Za-z(])/, '• ')
      .replace(/[ \t]+/g, ' ')
      .trim())
    .filter((line) => /[a-z0-9]{2,}/i.test(line))
    .join('\n');

export const recognizeImageText = async (buffer) => {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    const text = cleanOcrText(result.data.text);
    if (!text) {
      const error = new Error('No readable text was found in the image.');
      error.status = 422;
      throw error;
    }
    return text;
  } finally {
    await worker.terminate();
  }
};

// Scanned or handwritten PDFs: render pages in small batches (to keep memory
// low) and OCR them in parallel. Output uses the same "-- N of M --" page
// markers as pdf-parse, placed after each page's text, so page references keep
// working downstream. onProgress(pagesDone, totalPages) is called per page.
export const recognizePdfText = async (buffer, { onProgress } = {}) => {
  const parser = new PDFParse({ data: buffer });
  const scheduler = createScheduler();

  try {
    const workers = await Promise.all(Array.from({ length: OCR_WORKERS }, () => createWorker('eng')));
    workers.forEach((worker) => scheduler.addWorker(worker));

    const texts = [];
    let total = null;
    let done = 0;
    for (let first = 1; total === null || (first <= total && first <= MAX_OCR_PAGES); first += RENDER_BATCH) {
      const last = Math.min(first + RENDER_BATCH - 1, MAX_OCR_PAGES, total ?? Infinity);
      const pageNumbers = Array.from({ length: last - first + 1 }, (_, index) => first + index);
      const screenshots = await parser.getScreenshot({ imageBuffer: true, imageDataUrl: false, scale: RENDER_SCALE, partial: pageNumbers });
      total ??= screenshots.total || screenshots.pages.length;
      onProgress?.(done, Math.min(total, MAX_OCR_PAGES));

      const batch = await Promise.all(screenshots.pages.map((page) => scheduler.addJob('recognize', page.data).then((result) => {
        done += 1;
        onProgress?.(done, Math.min(total, MAX_OCR_PAGES));
        return cleanOcrText(result.data.text);
      })));
      texts.push(...batch);
      if (!screenshots.pages.length) break;
    }

    if (!texts.some(Boolean)) {
      const error = new Error('No readable text was found in the PDF pages.');
      error.status = 422;
      throw error;
    }
    const note = total > MAX_OCR_PAGES ? `\n\n[Only the first ${MAX_OCR_PAGES} of ${total} pages were read.]` : '';
    return texts.map((pageText, index) => `${pageText}\n\n-- ${index + 1} of ${total} --\n`).join('\n') + note;
  } finally {
    await scheduler.terminate();
    await parser.destroy();
  }
};
