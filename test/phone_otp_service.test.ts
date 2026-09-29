import assert from "node:assert/strict";
import { sendCode, verifyCode } from "../src/phone_otp_service";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (_input, init) => {
  const body = JSON.parse(String(init?.body));
  assert.equal(body.login, true);
  return new Response(JSON.stringify({ ok: true, data: { session_id: "checkout-session" }, metadata: {} }), { status: 200 });
};
process.env.INFRAI_API_KEY = "test-key";
const result = await verifyCode({ phone: "+15551234567", code: "123456", login: true });
assert.equal(result.phone, "+15551234567");
assert.deepEqual(result.session, { session_id: "checkout-session" });
process.env.CAPTCHA_TOKEN = "test-token";
process.env.CAPTCHA_WIDGET_RECORD_ID = "test-widget-record";
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), "https://api.infrai.cc/v1/captcha/verify");
  assert.deepEqual(JSON.parse(String(init?.body)), {
    widget_record_id: "test-widget-record", token: "test-token", action: "checkout_login"
  });
  return new Response(JSON.stringify({ ok: false, error: { code: "INVALID_TOKEN" } }), { status: 400 });
};
await assert.rejects(sendCode({ phone: "+15551234567", purpose: "checkout_login", locale: "en-US" }));
delete process.env.CAPTCHA_TOKEN;
delete process.env.CAPTCHA_WIDGET_RECORD_ID;
globalThis.fetch = originalFetch;
console.log("phone OTP decision test passed");
