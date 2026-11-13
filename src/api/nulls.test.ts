import { describe, expect, it } from 'vitest';
import { mySettingsFromApi } from './account';
import { inquiryFromCard, orderInquiryFromApi } from './inquiries';
import { orderFromApi } from './mappers';
import { notificationFromApi } from './notifications';
import { orderFromListItem } from './orders';
import { productFromApi, productSummaryFromApi } from './products';
import { applicationFromApi, sellerSettingsFromApi } from './seller';
import { sellerProductFromApi } from './sellerProducts';

/** 서버가 목록·글자·객체 자리에 null을 줘도 변환 함수가 멈추지 않고 빈 값으로 바꾸는지 */
const n = null as never;

describe('서버 null 응답 → 빈 값', () => {
  it('내 설정(계정)', () => {
    expect(mySettingsFromApi({ name: n, interestCategories: n, notificationSettings: n, marketingConsent: n } as never, [])).toEqual({ name: '', interests: [], saleStart: false, personalizedRecommendation: false, marketing: false });
  });
  it('판매자 프로필(설정 화면)', () => {
    const s = sellerSettingsFromApi({ sellerDisplayName: n, bankAccount: n, dispatchAddress: n, returnAddress: n } as never);
    expect(s).toMatchObject({ displayName: '', bank: '', account: '', holder: '', shippingAddress: '', returnAddress: '', shippingDetail: '' });
  });
  it('입점 신청·보완 요청 항목', () => {
    const a = applicationFromApi({ applicationId: 'a', status: 'PENDING', submittedAt: '2026-01-01T00:00:00Z', dispatchAddress: n, returnAddress: n, sellerDisplayName: n } as never, 'u', { items: n, deadline: '2026-01-02T00:00:00Z' } as never);
    expect(a).toMatchObject({ displayName: '', shippingAddress: '', returnAddress: '' });
  });
  it('공개 상품 상세·요약', () => {
    const p = productFromApi({ id: 'p', startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T03:00:00Z', description: n, sourceUrl: n, images: n, options: n, dimensions: [{ name: '색상', values: n }], attributes: n, faqs: n, stock: n, soldOutAt: null } as never);
    expect(p).toMatchObject({ description: '', originalUrl: '', images: [], options: [], extras: [], faqs: [], dimensions: [{ name: '색상', values: '' }], live: { initial: 0, available: 0 } });
    expect(productSummaryFromApi({ id: 'p', image: null, stock: n, startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T03:00:00Z', soldOutAt: null } as never).live).toEqual({ initial: 0, available: 0 });
  });
  it('판매자 상품(편집 원본)', () => {
    const p = sellerProductFromApi({ id: 'p', sellerId: 's', version: 1, status: 'DRAFT', options: n, optionDimensions: [{ name: 'a', values: n }], attributes: n, faqs: n, name: null, description: null, sourceUrl: null, category: null, price: null, shippingFee: null, dispatchBusinessDays: null, perAccountLimit: null, shippingNotice: null, purchaseNotice: null, disposalReason: null, startsAt: null, endsAt: null, reviewReason: null, brandOrStore: null, dispatchAddress: null, returnAddress: null, addressesCapturedAt: null } as never);
    expect(p).toMatchObject({ options: [], extras: [], faqs: [], dimensions: [{ name: 'a', values: '' }], shippingNotice: '' });
  });
  it('주문 상세·목록', () => {
    const base = { orderId: 'o', productId: 'p', items: n, productName: n, brandOrStore: n, unitPrice: n, shippingFee: n, totalAmount: n, address: null, state: 'CONFIRMED', delivery: null, createdAt: '2026-01-01T00:00:00Z', shippedAt: null, deliveredAt: null, carrier: null, trackingNumber: null } as never;
    expect(orderFromApi(base, 'u')).toMatchObject({ lines: [], product: { name: '', brand: '', price: 0 }, shipping: 0, total: 0 });
    expect(orderFromListItem(base, 'u')).toMatchObject({ lines: [], product: { name: '', brand: '' } });
  });
  it('문의(주문 문의·문의함)', () => {
    expect(orderInquiryFromApi({ id: 'q', orderId: 'o', category: n, messages: n, imageIds: n, createdAt: '2026-01-01T00:00:00Z' } as never, 'u')).toMatchObject({ kind: '', question: '', messages: [], imageIds: [] });
    expect(inquiryFromCard({ id: 'q', orderId: 'o', productId: 'p', productName: n, category: n, lastMessage: n, awaitingSeller: true, createdAt: '2026-01-01T00:00:00Z' } as never, 'u')).toMatchObject({ productName: '', kind: '', question: '' });
  });
  it('알림', () => {
    expect(notificationFromApi({ id: 'n', type: n, title: n, body: n, targetType: 'PRODUCT', targetId: 'p', occurredAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', readAt: null } as never)).toMatchObject({ kind: '상품', title: '', desc: '' });
  });
});
