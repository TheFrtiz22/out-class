import { requireAuth } from "@/utils/auth";
import { communicationsSnapshot } from "@/lib/communications-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  let userId: string;
  try {
    const { user, impersonation } = await requireAuth();
    if (impersonation) return Response.json({ error: "Live updates unavailable during support sessions." }, { status: 403, headers });
    userId = user.id;
  } catch { return Response.json({ error: "Sign-in required." }, { status: 401, headers }); }
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false, previous = "";
      const started = Date.now();
      stop = () => { if (closed) return; closed = true; clearTimeout(timer); request.signal.removeEventListener("abort", stop); try { controller.close(); } catch {} };
      request.signal.addEventListener("abort", stop, { once: true });
      if (request.signal.aborted) { stop(); return; }
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      const tick = async () => {
        if (closed) return;
        try {
          const state = await communicationsSnapshot(userId);
          if (closed) return;
          if (state.revision !== previous) { controller.enqueue(encoder.encode(`event: communications\ndata: ${JSON.stringify(state)}\n\n`)); previous = state.revision; }
          else controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch { if (!closed) { controller.enqueue(encoder.encode("event: unavailable\ndata: {}\n\n")); stop(); } return; }
        if (Date.now() - started > 45000) { stop(); return; }
        timer = setTimeout(() => void tick(), 2000);
      };
      void tick();
    },
    cancel() { stop(); },
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" } });
}
