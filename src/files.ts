import type { DocumentFile } from './domain';
import { uid } from './domain';
import { SERVER_DOC, fetchApplicationCertificate } from './api/seller';
let dbPromise: Promise<IDBDatabase> | undefined;
/** 서버 certificate 최대 크기(5MB, AccountService multipart max-file-size) */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
const memory = new Map<string, Blob>();
function db() { return dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('stockdrop-files', 1); request.onupgradeneeded = () => { request.result.createObjectStore('documents'); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('파일 저장 공간을 열 수 없습니다.')); }); }
export async function savePdf(file: File): Promise<DocumentFile> {
  if (!/\.pdf$/i.test(file.name) || file.type && file.type !== 'application/pdf') throw new Error('사업자등록증은 PDF 파일로 첨부해 주세요.');
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF는 5MB 이하로 첨부해 주세요.');
  // 서버(AccountService)와 같은 검사: 맨 앞 5바이트가 %PDF-, 끝 1024바이트 안에 %%EOF. 다르면 서버가 SELLER_INVALID_CERTIFICATE로 거절한다
  const head = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()), tail = new TextDecoder().decode(await file.slice(Math.max(0, file.size - 1024)).arrayBuffer());
  if (head !== '%PDF-' || !tail.includes('%%EOF')) throw new Error('올바른 PDF 파일이 아닙니다. 사업자등록증을 ‘PDF로 저장(인쇄)’해 다시 첨부해 주세요.');
  const id = uid('pdf-'), pdf = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
  memory.set(id, pdf);
  // IndexedDB를 못 쓰는 환경(앱 안 브라우저·시크릿 창 등)은 메모리 사본만으로 이어서 제출한다. shortcut: 새로고침하면 다시 첨부해야 함
  try { const database = await db(); await new Promise<void>((resolve, reject) => { const transaction = database.transaction('documents', 'readwrite'); transaction.objectStore('documents').put(pdf, id); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); } catch { /* 메모리 사본 사용 */ }
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
  if (id.startsWith(SERVER_DOC)) return fetchApplicationCertificate(id.slice(SERVER_DOC.length)); // 서버에 제출된 사업자등록증
  // 같은 세션이면 메모리 사본을 먼저 쓴다(IndexedDB에서 꺼낸 Blob이 사파리 업로드에서 빠지는 문제도 피한다)
  const kept = memory.get(id); if (kept) return kept;
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
/** PDF 새 탭: 클릭 직후 열어(모바일 사파리 팝업 차단 회피) 빈 화면(about:blank) 대신 불러오는 중 안내를 먼저 보여 준다 */
export function openPendingTab(): Window | null {
  const tab = window.open('', '_blank');
  if (tab) { try { tab.document.title = '서류 열람 · STOCKDROP'; tab.document.body.style.cssText = 'margin:0;padding:32px 24px;font:15px/1.6 -apple-system,system-ui,sans-serif;color:#333'; tab.document.body.textContent = '서류를 불러오고 있어요…'; } catch { /* 안내 없이 진행 */ } }
  return tab;
}
/** 불러오기 실패를 그 탭에 표시한다(사유는 글자로만 넣는다) */
export function failTab(tab: Window | null, reason: string) {
  if (!tab || tab.closed) return;
  try { const b = tab.document.body; b.textContent = ''; const h = tab.document.createElement('p'); h.style.fontWeight = '700'; h.textContent = '서류를 불러오지 못했어요.'; const p = tab.document.createElement('p'); p.textContent = `${reason} 이 탭을 닫고 다시 시도해 주세요.`; b.append(h, p); } catch { tab.close(); }
}
