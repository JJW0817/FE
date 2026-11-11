/** 명세 응답 타입 (docs/api-spec.md). 시각은 ISO 8601 UTC 문자열, 금액은 원 단위 정수. null 가능 필드는 `| null` */
export type Iso = string;
export type Role = 'BUYER' | 'SELLER' | 'ADMIN';

/* 페이지 래퍼 — 상품 계열은 items, 주문·문의·운영자는 content, 알림은 content에 totalPages 없음 */
export interface ItemsPage<T> { items: T[]; page: number; size: number; totalElements: number; totalPages: number }
export interface ContentPage<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }
export interface NotificationPage<T> { content: T[]; page: number; size: number; totalElements: number }

/* ── 인증·회원 ── */
export interface CsrfToken { headerName: string; token: string }
export interface ChallengeDto { challengeId: string; expiresAt: Iso; resendAvailableAt: Iso }
export interface VerificationTokenDto { verificationToken: string; expiresAt: Iso }
export interface ResetTokenDto { resetToken: string; expiresAt: Iso }
export interface LoginDto { accessToken: string; tokenType: 'Bearer'; expiresAt: Iso; accountId: string; roles: Role[] }
export interface SignupDto { accountId: string; email: string; name: string; emailVerifiedAt: Iso; status: string; roles: Role[] }
export interface SignupOptionsDto { categories: { code: string; label: string }[]; notificationTypes: string[]; marketingConsentRequiredForPromotionalNotifications: boolean }
export interface AccountDto {
  accountId: string; email: string; name: string; roles: Role[]; interestCategories: string[];
  notificationSettings: { saleStart: boolean; personalizedRecommendation: boolean };
  marketingConsent: { agreed: boolean; agreedAt: Iso | null; withdrawnAt: Iso | null; updatedAt: Iso };
}
export interface WithdrawalEligibilityDto { verified: boolean; canWithdraw: boolean; activeOrders: number | null; activeSales: number | null; pendingSettlements: number | null }
export interface AddressDto { addressId: string; label: string; recipientName: string; recipientPhone: string; postalCode: string; roadAddress: string; detailAddress: string | null; deliveryMemo: string | null; defaultAddress: boolean; createdAt: Iso; updatedAt: Iso }

/* ── 상품(공개) ── */
export interface ImageDto { id: string; objectKey: string; url: string | null; contentType: string; position: number; representative: boolean }
export interface StockDto { initialQuantity: number; confirmedQuantity: number; availableQuantity: number; approximate: boolean }
export type SaleStatus = 'UPCOMING' | 'ON_SALE' | 'SOLD_OUT' | 'ENDED';
export interface ProductSummaryDto { id: string; name: string; brandOrStore: string; category: string; price: number; image: ImageDto | null; status: SaleStatus; startsAt: Iso; endsAt: Iso; soldOutAt: Iso | null; stock: StockDto; metadata: { version: number; occurredAt: Iso; projectedAt: Iso } }
export interface ProductOptionDto { id: string; label: string; selections: Record<string, string>; availableQuantity: number }
export interface ProductFaqDto { id: string; question: string; answer: string; confirmedAt: Iso }
export interface ProductDetailDto extends Omit<ProductSummaryDto, 'image'> {
  sellerId: string; description: string; sourceUrl: string; shippingFee: number; dispatchBusinessDays: number; perAccountLimit: number;
  shippingNotice: string | null; purchaseNotice: string | null; disposalReason: string | null;
  attributes: { name: string; value: string }[]; dimensions: { name: string; values: string[] }[];
  options: ProductOptionDto[]; images: ImageDto[]; faqs: ProductFaqDto[]; canAttemptPurchase: boolean; serverTime: Iso;
}
export interface ScheduleDto { from: string; to: string; zone: string; days: { date: string; productCount: number; firstStartsAt: Iso }[]; serverTime: Iso }
export interface ProductInquiryDto { id: string; question: string; answer: string | null; createdAt: Iso; answeredAt: Iso | null; projectedAt?: Iso }

/* ── 주문·결제 ── */
export type OrderState = 'RESERVING' | 'HELD' | 'STARTING_PAYMENT' | 'APPROVING_PAYMENT' | 'VERIFYING_PAYMENT' | 'CONFIRMING_STOCK' | 'COMPENSATING_PAYMENT' | 'RELEASING_STOCK' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
export type DeliveryState = 'PREPARING' | 'SHIPPING' | 'DELIVERED';
export interface OrderItemDto { optionId: string; label: string | null; quantity: number }
export interface OrderAddressDto { recipientName: string; recipientPhone: string; postalCode: string; roadAddress: string; detailAddress: string | null; deliveryMemo: string | null }
export interface OrderListItemDto { orderId: string; orderNumber: string; productId: string; productName: string; brandOrStore: string; items: OrderItemDto[]; state: OrderState; delivery: DeliveryState | null; totalAmount: number; createdAt: Iso; sourceVersion: number }
export interface OrderDetailDto extends OrderListItemDto {
  address: OrderAddressDto | null; unitPrice: number; shippingFee: number; dispatchBusinessDays: number; expiresAt: Iso | null; confirmedAt: Iso | null;
  carrier: string | null; trackingNumber: string | null; shippedAt: Iso | null; deliveredAt: Iso | null;
}
/** Command 원본 응답(주문 생성·결제 요청·배송지 변경·checkout·fulfillment). RESERVING에서는 값이 null일 수 있다 */
export interface OrderCommandDto {
  orderId: string; orderNumber: string; version: number; state: OrderState; delivery: DeliveryState | null; productId: string | null; sellerId: string | null;
  productName: string | null; brandOrStore: string | null; items: OrderItemDto[]; address: OrderAddressDto | null; unitPrice: number | null; shippingFee: number | null; totalAmount: number | null;
  dispatchBusinessDays: number | null; expiresAt: Iso | null; serverTime: Iso; paymentAttemptId: string | null; confirmedAt: Iso | null; carrier: string | null; trackingNumber: string | null; failureCode: string | null; termsVersion: string | null;
}
export interface CheckoutTermsDto { version: string; title: string; content: string; effectiveAt: Iso; contentSha256: string }
export interface OrderInquiryDto { id: string; orderId: string; category: string; messages: { seller: boolean; body: string; createdAt: Iso }[]; imageIds: string[]; createdAt: Iso }
export interface InquiryCardDto { id: string; orderId: string; productId: string; productName: string; category: string; lastMessage: string; lastMessageAt: Iso; awaitingSeller: boolean; createdAt: Iso }
export interface ImageUploadDto { id: string; url: string | null; contentType: string; sizeBytes: number; expiresAt: Iso }

/* ── 알림 ── */
export interface NotificationDto { id: string; type: string; title: string; body: string; targetType: 'PRODUCT' | 'SELLER_APPLICATION' | 'SELLER_PRODUCT' | 'SELLER_PRODUCT_REVISION' | 'ORDER' | 'SELLER_ORDER'; targetId: string; relatedId: string | null; deadline: Iso | null; occurredAt: Iso; createdAt: Iso; readAt: Iso | null }

/* ── 판매자 입점·마이페이지 ── */
export interface SellerAddressDto { postalCode: string; roadAddress: string; detailAddress: string | null }
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'EXPIRED';
export interface SellerApplicationDto {
  applicationId: string; accountId: string; attemptNumber: number; sellerDisplayName: string | null; contactName: string; contactEmail: string; contactPhone: string; bankName: string; maskedBankAccount: string;
  dispatchAddress: SellerAddressDto; returnAddress: SellerAddressDto; status: ApplicationStatus; submittedAt: Iso; reviewedAt: Iso | null; reviewedBy: string | null; rejectionReason: string | null;
  certificateReviewed: boolean; certificateRecheck: boolean; previousApplicationId: string | null;
}
export type CorrectionField = 'CERTIFICATE' | 'STORE_NAME' | 'CONTACT' | 'BANK_ACCOUNT' | 'DISPATCH_ADDRESS' | 'RETURN_ADDRESS';
export interface CorrectionRequestDto { id: string; applicationId: string; deadline: Iso; state: string; items: { field: CorrectionField; reason: string }[]; submittedApplicationId: string | null }
export interface SellerProfileDto {
  accountId: string; approvedApplicationId: string; sellerDisplayName: string; contactName: string; contactEmail: string; contactPhone: string;
  bankAccount: { bankName: string; maskedBankAccount: string; accountHolderName: string | null }; dispatchAddress: SellerAddressDto; returnAddress: SellerAddressDto; approvedAt: Iso; updatedAt: Iso;
}
export interface SellerAddressBookDto { id: string; type: 'DISPATCH' | 'RETURN'; label: string; contactName: string; contactPhone: string; address: SellerAddressDto; defaultAddress: boolean }
export interface SellerStoreDto { sellerDisplayName: string; introduction: string; hasLogo: boolean; updatedAt: Iso }

/* ── 판매자 상품·운영자 심사 ── */
export type ProductStatus = 'DRAFT' | 'IN_REVIEW' | 'REJECTED' | 'APPROVED';
export interface SellerProductDto {
  id: string; sellerId: string; version: number; status: ProductStatus; name: string | null; description: string | null; sourceUrl: string | null; category: string | null; price: number | null; shippingFee: number | null;
  dispatchBusinessDays: number | null; perAccountLimit: number | null; shippingNotice: string | null; purchaseNotice: string | null; disposalReason: string | null; startsAt: Iso | null; endsAt: Iso | null; reviewReason: string | null;
  options: { id: string; label: string; initialQuantity: number; reservedQuantity: number; confirmedQuantity: number; availableQuantity: number; selections: Record<string, string> }[];
  brandOrStore: string | null; attributes: { name: string; value: string }[]; optionDimensions: { name: string; values: string[] }[]; dispatchAddress: SellerAddressDto | null; returnAddress: SellerAddressDto | null; addressesCapturedAt: Iso | null;
  faqs: { id: string; question: string; answer: string; suggestionId: string | null; sourceInquiryId: string | null; confirmedBy: string; confirmedAt: Iso }[];
}
export interface ProductReviewListItemDto { id: string; name: string; status: ProductStatus; version: number; startsAt: Iso | null; endsAt: Iso | null; createdAt: Iso; updatedAt: Iso; submittedAt: Iso | null }
export interface ProductRevisionDto { id: string; productId: string; version: number; status: 'IN_REVIEW' | 'APPROVED' | 'REJECTED'; changes: Record<string, unknown>; shipping: { accountId: string; dispatchAddress: SellerAddressDto; returnAddress: SellerAddressDto }; submittedAt: Iso; reviewedAt: Iso | null; reason: string | null }
export interface ProductImageMetaDto { id: string; objectKey: string; contentType: string; sizeBytes: number; position: number; representative: boolean }

/* ── AI ── */
export interface AiAnalysisAcceptedDto { requestId: string; productId: string; fingerprint: string; completed: boolean }
export interface AiAnalysisDto {
  requestId: string; productId: string; productVersion: number; fingerprint: string; status: 'PENDING' | 'RUNNING' | 'RETRY' | 'COMPLETED'; attempts: number; nextAttemptAt: Iso | null;
  result: null | { requestId: string; productId: string; sellerId: string; fingerprint: string; outcome: 'RECOMMENDED' | 'NOT_APPLICABLE' | 'UNCLEAR'; recommendedCategory: string | null; questions: { suggestionId: string; checkCode: string; question: string; reason: string }[] };
}
