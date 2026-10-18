import type { DocumentFile } from './domain';
import { uid } from './domain';
let dbPromise: Promise<IDBDatabase> | undefined;
function db() { return dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('stockdrop-files', 1); request.onupgradeneeded = () => { request.result.createObjectStore('documents'); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('파일 저장 공간을 열 수 없습니다.')); }); }
export async function savePdf(file: File): Promise<DocumentFile> {
  if (!/\.pdf$/i.test(file.name) || file.type && file.type !== 'application/pdf') throw new Error('사업자등록증은 PDF 파일로 첨부해 주세요.');
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== '%PDF-') throw new Error('올바른 PDF 파일이 아닙니다.');
  const database = await db(), id = uid('pdf-');
  await new Promise<void>((resolve, reject) => { const transaction = database.transaction('documents', 'readwrite'); transaction.objectStore('documents').put(file, id); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(new Error('PDF를 저장하지 못했습니다. 다시 시도해 주세요.')); });
  return { id, name: file.name, size: file.size, uploadedAt: Date.now() };
}
export function samplePdf(): Blob {
  const text = 'BT /F1 16 Tf 50 780 Td (STOCKDROP - Sample uploaded document) Tj 0 -32 Td /F1 11 Tf (Preview file only. Not an official business certificate.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
  let pdf = '%PDF-1.4\n', offsets = [0];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
export async function getPdf(id: string): Promise<Blob> {
  if (id === 'sample') return samplePdf();
  const database = await db();
  return new Promise((resolve, reject) => { const request = database.transaction('documents').objectStore('documents').get(id); request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error('첨부 파일을 찾을 수 없습니다. 다시 첨부해 주세요.')); request.onerror = () => reject(new Error('파일을 열지 못했습니다.')); });
}
export async function viewPdf(doc: DocumentFile): Promise<string> { return URL.createObjectURL(await getPdf(doc.id)); }
export async function clearFiles() { const database = await db(); await new Promise<void>((resolve, reject) => { const transaction = database.transaction('documents', 'readwrite'); transaction.objectStore('documents').clear(); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(new Error('첨부 파일을 초기화하지 못했습니다.')); }); }
export function externalHref(url: string, productId: string) { try { if (new URL(url).hostname.endsWith('.example')) return `${window.location.origin}${window.location.pathname}#/external/${encodeURIComponent(productId)}?url=${encodeURIComponent(url)}`; } catch { return url; } return url; }
export async function imageData(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG·PNG·WEBP 이미지를 선택해 주세요.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d'); if (!context) throw new Error('이미지를 처리하지 못했습니다.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return canvas.toDataURL('image/webp', .72);
}
