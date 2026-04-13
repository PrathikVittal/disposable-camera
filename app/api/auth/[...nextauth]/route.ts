import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

// #region agent log
const _dbg = (msg: string, data: Record<string, unknown>) => {
  const payload = { sessionId:'c92e9e', location:'api/auth/[...nextauth]/route.ts', message: msg, data, timestamp: Date.now() };
  console.error('[DEBUG-c92e9e]', JSON.stringify(payload));
  fetch('http://127.0.0.1:7696/ingest/33456479-982a-4e91-8238-58d9843d95dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c92e9e'},body:JSON.stringify(payload)}).catch(()=>{});
};
// #endregion

// #region agent log
export async function GET(req: NextRequest) {
  _dbg('GET-entry', {
    url: req.url,
    hypothesisA_AUTH_SECRET: !!process.env.AUTH_SECRET,
    hypothesisB_host: req.headers.get('host'),
    hypothesisC_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID,
    hypothesisC_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET,
    hypothesisD_AUTH_URL: process.env.AUTH_URL ?? 'NOT_SET',
    hypothesisD_NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'NOT_SET',
  });
  try {
    const res = await handlers.GET(req);
    _dbg('GET-success', { status: res.status });
    return res;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    _dbg('GET-error', { hypothesisAll: true, error: errMsg, stack: errStack });
    throw err;
  }
}
// #endregion

// #region agent log
export async function POST(req: NextRequest) {
  _dbg('POST-entry', { url: req.url, AUTH_SECRET_exists: !!process.env.AUTH_SECRET });
  try {
    const res = await handlers.POST(req);
    _dbg('POST-success', { status: res.status });
    return res;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    _dbg('POST-error', { error: errMsg, stack: errStack });
    throw err;
  }
}
// #endregion
