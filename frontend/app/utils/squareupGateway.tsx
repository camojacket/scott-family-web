/**
 * Square payment integration.
 *
 * This project uses the Square Checkout API (payment links) instead of the
 * Web Payments SDK. Square handles the entire checkout UI on their hosted page.
 *
 * Flow:
 *   1. Frontend creates PENDING records via Spring Boot API
 *   2. Next.js API route (/api/square/dues-checkout or /api/square/order-checkout)
 *      calls Square's CreatePaymentLink to create a hosted checkout page
 *   3. User is redirected to Square's checkout page
 *   4. After payment, Square fires a webhook to Spring Boot (/api/webhooks/square)
 *      which transitions PENDING → COMPLETED/PAID
 *   5. User is redirected back; frontend polls until confirmation is visible
 *
 * Environment variables (server-side only, in .env.local):
 *   SQUARE_ACCESS_TOKEN   — Square API access token
 *   SQUARE_LOCATION_ID    — Square location ID
 *   SQUARE_ENVIRONMENT    — 'sandbox' or 'production'
 *
 * See: https://developer.squareup.com/docs/checkout-api
 */
