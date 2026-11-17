import { describe, expect, it } from 'vitest';
import { getPdf, MAX_PDF_BYTES, savePdf } from './files';

const pdf = (body: string, name = 'a.pdf', type = 'application/pdf') => new File([body], name, { type });

describe('사업자등록증 PDF 첨부', () => {
  it('서버와 같은 검사: %PDF-로 시작하고 끝에 %%EOF', async () => {
    await expect(savePdf(pdf(' %PDF-1.4\n%%EOF'))).rejects.toThrow('올바른 PDF');
    await expect(savePdf(pdf('%PDF-1.4\n잘림'))).rejects.toThrow('올바른 PDF');
    await expect(savePdf(pdf('%PDF-1.4', 'a.hwp'))).rejects.toThrow('PDF 파일로');
    await expect(savePdf(new File([new Uint8Array(MAX_PDF_BYTES + 1)], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow('5MB');
  });
  it('IndexedDB가 없어도(앱 안 브라우저 등) 첨부되고, 제출용 파일은 application/pdf', async () => {
    const doc = await savePdf(pdf('%PDF-1.4\n%%EOF\n', 'a.pdf', ''));
    const blob = await getPdf(doc.id);
    expect(blob.type).toBe('application/pdf'); expect(await blob.text()).toBe('%PDF-1.4\n%%EOF\n');
  });
});
