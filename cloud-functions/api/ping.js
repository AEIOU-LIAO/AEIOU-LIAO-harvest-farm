// 诊断用：不依赖任何其他代码的最小云函数。/api/ping 能返回 JSON，说明 EdgeOne 云函数已正常部署
export function onRequest(context) {
  return new Response(JSON.stringify({ ok: true, fn: 'ping', node: process.version, region: (context && context.server && context.server.region) || '', hasTursoUrl: !!(context && context.env && context.env.TURSO_DATABASE_URL), now: Date.now() }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
