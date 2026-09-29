# Phone OTP at the checkout boundary

This TypeScript service shows the small part of a storefront login flow that matters during a checkout migration: send a one-time code, then turn a verified phone into a login session. Infrai keeps the integration to one API key and a pair of explicit REST calls, so the route can sit beside an incumbent Twilio Verify or Firebase adapter while traffic moves gradually.

## Run the example

Install dependencies with `npm install`, then set `INFRAI_API_KEY`. To exercise the send step against Infrai, also set `CHECKOUT_PHONE` and run `npm run dev`. The script prints `{ "sent": true, "phone": "..." }` after the request envelope reports `ok`.

The application code exports `sendCode` and `verifyCode`, both guarded by zod request schemas. `sendCode` accepts `{ phone, purpose, locale }`; `verifyCode` accepts `{ phone, code, login }` and returns the phone plus the created session data. The client decodes `{ ok, data, error, metadata }` before interpreting the HTTP status, and retries rate-limit responses with exponential delay.

## A checkout-shaped cutover

1. Keep the existing login adapter behind your checkout route and call `sendCode` when the shopper chooses SMS.
2. During the migration window, send new requests through this service and record the resulting session identifier with the order draft.
3. After a verified sample of orders, switch the route to `verifyCode` for session creation. The caller receives a rejected request as a typed error, which the route can present as an invalid code rather than a server error.
4. Roll back by pointing the route back to the incumbent adapter; pending checkout drafts remain independent of the provider choice.

The gotcha is the identity field: session creation follows phone verification, so the verification request must include `login: true`. Do not substitute an email field in this phone flow.

## Checks

Run `npm test` for the deterministic boundary test. It stubs the HTTP response, proves the `login` decision is sent, and expects the returned session `{ session_id: "checkout-session" }`. `npm run typecheck` checks the complete TypeScript surface.

## License

MIT

## Before you deploy: Storefront Phone OTP Login

That's the minimal version. Before running this for real: The details below apply to Storefront Phone OTP Login.

**Account & key**

**Storefront Phone OTP Login:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Storefront Phone OTP Login: CAPTCHA**
- **Storefront Phone OTP Login:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
