/**
 * Shared TypeScript types for API request/response contracts.
 * Keep in sync with backend DTOs (DTOs.java).
 */

// ─── Auth ───────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  bio?: string;
  profilePictureUrl?: string;
  bannerImageUrl?: string;
  dateOfBirth?: string;
  motherId?: number | null;
  fatherId?: number | null;
  claimPersonId?: number | null;
}

// ─── User / Profile ────────────────────────────────────────

export interface ProfileDto {
  id: number;
  personId?: number | null;
  hasAccount?: boolean;
  username?: string;
  email?: string;
  displayName: string;
  prefix?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  bio?: string;
  profilePictureUrl?: string;
  bannerImageUrl?: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  location?: string;
  userRole?: string;
  motherId?: number | null;
  fatherId?: number | null;
  motherName?: string;
  fatherName?: string;
  parents?: PersonSummaryDto[];
  children?: PersonSummaryDto[];
  siblings?: PersonSummaryDto[];
  spouses?: PersonSummaryDto[];
}

export interface PersonSummaryDto {
  id: number;
  personId?: number;
  firstName: string;
  lastName: string;
  displayName?: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  deceased?: boolean;
  relation?: string;
}

// ─── People ─────────────────────────────────────────────────

export interface CreatePersonRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
}

export interface LinkChildRequest {
  childPersonId?: number;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  relation: ParentRelationType;
}

export type ParentRelationType =
  | 'BIOLOGICAL_MOTHER'
  | 'BIOLOGICAL_FATHER'
  | 'STEP_MOTHER'
  | 'STEP_FATHER'
  | 'ADOPTIVE_MOTHER'
  | 'ADOPTIVE_FATHER'
  | 'FOSTER_MOTHER'
  | 'FOSTER_FATHER'
  | 'GUARDIAN';

// ─── Family Tree ────────────────────────────────────────────

export interface FamilyNodeDto {
  id: number;
  name: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  avatarUrl?: string;
  userId?: number | null;
  children?: FamilyNodeDto[];
  spouse?: FamilyNodeDto | null;
  deceased?: boolean;
  parentRelation?: string | null;
}

// ─── Blog ───────────────────────────────────────────────────

export interface BlogPost {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  authorId?: number;
  authorPersonId?: number;
  authorName?: string;
  likeCount: number;
  likedByMe: boolean;
  dislikeCount: number;
  dislikedByMe: boolean;
  commentCount: number;
}

export interface CommentDto {
  id: number;
  postId: number;
  authorId: number;
  authorPersonId?: number;
  authorName: string;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  dislikeCount: number;
  dislikedByMe: boolean;
}

// ─── Admin ──────────────────────────────────────────────────

export interface AnnouncementDto {
  id: number;
  bannerText: string;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingUserDto {
  id: number;
  username: string;
  email: string;
  displayName: string;
  requestedAt: string;
  profilePictureUrl?: string;
}

export interface AdminUserItem {
  id: number;
  username: string;
  email: string;
  displayName: string;
  userRole: string;
  createdAt: string;
  approvedAt: string | null;
  bannedUntil: string | null;
  banReason: string | null;
  personId: number | null;
}

export interface PendingProfileChangeItem {
  id: number;
  userId: number;
  displayName: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface PersonRequestItem {
  id: number;
  action: 'ADD' | 'UPDATE' | 'LINK_CHILD';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  targetPersonId?: number;
  requestedBy: number;
  requestedByName?: string;
  createdAt: string;
  parentPersonId?: number;
  relation?: string;
  parentDisplayName?: string;
}

// ─── RSVP ───────────────────────────────────────────────────

export interface RsvpDto {
  userId: number;
  displayName: string;
  attending: boolean;
  extraGuests: number;
  notes?: string | null;
  updatedAt?: string | null;
}

export interface RsvpRequest {
  attending: boolean;
  extraGuests?: number;
  notes?: string | null;
}

export interface RsvpSummary {
  totalAttending: number;
  totalNotAttending: number;
  totalExtraGuests: number;
  totalHeadcount: number;
}

// ─── Payments ───────────────────────────────────────────────

export interface PaymentRequest {
  sourceId: string;
  amount: number;
  currency?: string;
}

// ─── Dues ───────────────────────────────────────────────────

export interface DuesPaymentDto {
  id: number;
  userId?: number;
  paidByUserId: number;
  displayName: string;
  guestName?: string;
  guestAge?: number;
  reunionYear: number;
  amountCents: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  squarePaymentId?: string;
  squareReceiptUrl?: string;
  batchId?: string;
  notes?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface DuesPageDto {
  reunionYear: number;
  duesAmountCents: number;
  selfPaid: boolean;
  selfPayment?: DuesPaymentDto;
  guestPayments: DuesPaymentDto[];
}

export interface DuesBatchDto {
  batchId: string;
  totalCents: number;
  personCount: number;
  payments: DuesPaymentDto[];
}

export interface DuesStatusDto {
  userId: number;
  displayName: string;
  dateOfBirth?: string;
  paid: boolean;
  paidAt?: string;
  amountCents: number;
}

export interface DuesSummaryDto {
  reunionYear: number;
  totalMembers: number;
  totalPaid: number;
  totalUnpaid: number;
  totalCollectedCents: number;
}

export interface DuePeriodDto {
  id: number;
  reunionYear: number;
  startDate: string;
  endDate: string;
}

export interface DuePeriodResponse {
  configured: boolean;
  active?: boolean;
  period?: DuePeriodDto;
}

// ─── Store ──────────────────────────────────────────────────

export interface ProductVariantDto {
  id: number;
  productId: number;
  size: string;
  color?: string;
  priceCents?: number;
  stock: number;
  active: boolean;
}

export interface ProductDto {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  basePriceCents: number;
  active: boolean;
  variants: ProductVariantDto[];
}

export interface CartItem {
  variantId: number;
  quantity: number;
  // Client-side enrichment
  productId: number;
  productName: string;
  imageUrl?: string;
  size: string;
  color?: string;
  unitPriceCents: number;
}

export interface OrderItemDto {
  id: number;
  variantId: number;
  quantity: number;
  unitPriceCents: number;
  productName: string;
  size: string;
  color?: string;
}

export interface OrderDto {
  id: number;
  userId: number;
  displayName: string;
  status: 'PENDING' | 'PAID' | 'FULFILLED' | 'CANCELLED';
  totalCents: number;
  squarePaymentId?: string;
  squareReceiptUrl?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  items: OrderItemDto[];
}

// ─── Assets ─────────────────────────────────────────────────

export type AssetKind = 'PROFILE' | 'BANNER' | 'POST_IMAGE' | 'STATIC' | 'PRODUCT';

export interface AssetUploadResponse {
  key: string;
  cdnUrl: string;
}

// ─── Profile Change Requests ────────────────────────────────

export interface Change {
  field: string;
  oldValue?: string;
  newValue?: string;
}

export interface ProfileChangeSubmitRequest {
  userId: number;
  changes: Change[];
}

// ─── Gallery ────────────────────────────────────────────────

export interface GalleryImage {
  id: number;
  blobKey: string;
  cdnUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  caption?: string | null;
  imageDate?: string | null; // ISO yyyy-MM-dd
  uploadedBy: number;
  uploadedAt: string;        // ISO datetime
  tags?: ImageTag[];
}

export interface ImageTag {
  personId: number;
  displayName: string;
}

export interface GalleryUploadResponse {
  uploaded: GalleryImage[];
  errors: string[];
}

export interface GalleryUpdateRequest {
  caption?: string | null;
  imageDate?: string | null;
}

/** Request body for POST /api/gallery/sas */
export interface GallerySasRequest {
  files: { fileName: string; contentType: string }[];
}

/** Response from POST /api/gallery/sas */
export interface GallerySasResponse {
  uploads: {
    blobKey: string;
    sasUrl: string;
    cdnUrl: string;
  }[];
}

/** Request body for POST /api/gallery/images/delete-batch */
export interface GalleryDeleteBatchRequest {
  ids: number[];
}

/** Request body for POST /api/gallery/images/register */
export interface GalleryRegisterRequest {
  images: {
    blobKey: string;
    cdnUrl: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    caption?: string | null;
    imageDate?: string | null;
  }[];
}

// ─── Newsletters ────────────────────────────────────────────
export interface NewsletterDto {
  id: number;
  name: string;
  pdfUrl: string;
  issueDate: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Family Artifacts ───────────────────────────────────────
export interface FamilyArtifactDto {
  id: number;
  name: string;
  pdfUrl: string;
  issueDate: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Obituaries ─────────────────────────────────────────────
export interface ObituaryTaggedPerson {
  personId: number;
  displayName: string;
}

export interface ObituaryDto {
  id: number;
  title: string;
  fileUrl: string;
  fileType: 'PDF' | 'IMAGE';
  taggedPeople: ObituaryTaggedPerson[];
  createdAt: string;
  updatedAt: string;
}
