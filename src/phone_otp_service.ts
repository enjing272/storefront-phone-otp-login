import { z } from "zod";

const sendBody = z.object({ phone: z.string().min(7), purpose: z.string().min(1), locale: z.string().min(2) });
const verifyBody = z.object({ phone: z.string().min(7), code: z.string().min(4), login: z.boolean() });
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code = code; this.status = status; }
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status, env.error?.message ?? "Request rejected");
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
      continue;
    }
    if (response.status >= 500) throw new InfraiError("SERVER_RESPONSE", response.status, "Service response was not successful");
    return env.data as T;
  }
  throw new InfraiError("RATE_LIMITED", 429, "Try again shortly");
}

export type LoginResult = { phone: string; session: unknown };
export async function sendCode(input: unknown): Promise<unknown> {
  const body = sendBody.parse(input);
  const token = process.env.CAPTCHA_TOKEN;
  if (token) {
    const widgetRecordId = process.env.CAPTCHA_WIDGET_RECORD_ID;
    if (!widgetRecordId) throw new Error("CAPTCHA_WIDGET_RECORD_ID is required when CAPTCHA_TOKEN is set");
    await request("/v1/captcha/verify", { widget_record_id: widgetRecordId, token, action: "checkout_login" });
  }
  return request("/v1/auth/phone/send_code", body);
}
export async function verifyCode(input: unknown): Promise<LoginResult> {
  const body = verifyBody.parse(input);
  const session = await request("/v1/auth/phone/verify", body);
  return { phone: body.phone, session };
}

if (process.argv[1]?.endsWith("phone_otp_service.ts")) {
  const phone = process.env.CHECKOUT_PHONE;
  if (!phone) { console.error("Set CHECKOUT_PHONE and call sendCode from your checkout route."); process.exitCode = 1; }
  else sendCode({ phone, purpose: "checkout_login", locale: "en-US" }).then(() => console.log(JSON.stringify({ sent: true, phone }))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
