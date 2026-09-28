// Worker de la tienda: sirve el sitio estático y, en POST /api/pedido,
// manda por mail una copia de cada pedido (Cloudflare Email Routing).
//
// Configuración necesaria en Cloudflare (ver README):
//   - Email Routing activado en mbsublimarte.com.ar, con la casilla de destino
//     verificada.
//   - Secreto MAIL_TO con esa casilla (Settings → Variables and Secrets).
import { EmailMessage } from "cloudflare:email";

const REMITENTE = "pedidos@mbsublimarte.com.ar";
const MAX_ITEMS = 300;
const VERSION = "2026-09-28c";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/pedido") {
      // GET = chequeo de configuración (no muestra la casilla)
      if (request.method === "GET") {
        // ?prueba=mbtest manda un pedido de prueba y muestra el resultado del envío
        if (url.searchParams.get("prueba") === "mbtest") {
          const falso = new Request(request.url, {
            method: "POST",
            body: JSON.stringify({
              numero: "PRUEBA", n: 1, total: 1000, ahorro: 0,
              datos: { nombre: "Prueba del sistema", entrega: "-", notas: "Mail de prueba: si llegó, el envío de pedidos funciona." },
              items: [{ id: "TEST-001", q: 1, nombre: "Sticker de prueba" }],
            }),
          });
          return recibirPedido(falso, env);
        }
        return json({ tienda: "ok", version: VERSION, envio_mail: Boolean(env.MAIL), destino_configurado: Boolean(env.MAIL_TO) });
      }
      if (request.method !== "POST") return json({ ok: false, error: "método" }, 405);
      return recibirPedido(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

async function recibirPedido(request, env) {
  if (!env.MAIL || !env.MAIL_TO) return json({ ok: false, error: "mail no configurado" }, 503);

  let p;
  try {
    const texto = await request.text();
    if (texto.length > 100_000) return json({ ok: false, error: "muy grande" }, 413);
    p = JSON.parse(texto);
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }

  const txt = (v, max = 200) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, max).trim();
  const num = (v) => (Number.isFinite(+v) ? Math.max(0, Math.round(+v)) : 0);

  const items = (Array.isArray(p.items) ? p.items : []).slice(0, MAX_ITEMS)
    .map((it) => ({ id: txt(it.id, 20), nombre: txt(it.nombre, 120), q: num(it.q) }))
    .filter((it) => it.id && it.q > 0);
  if (!items.length) return json({ ok: false, error: "sin items" }, 400);

  const numero = txt(p.numero, 30) || "sin número";
  const d = p.datos || {};
  const pesos = (n) => "$" + num(n).toLocaleString("es-AR");
  const unidades = items.reduce((a, it) => a + it.q, 0);

  const cuerpo = [
    `Pedido ${numero}`,
    `Fecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })}`,
    "",
    `Cliente: ${txt(d.nombre, 80)}`,
    `Entrega: ${txt(d.entrega, 80)}`,
    ...(txt(d.notas, 500) ? [`Notas: ${txt(d.notas, 500)}`] : []),
    "",
    `STICKERS (${unidades} unidades)`,
    ...items.map((it) => `  ${String(it.q).padStart(3)} x  ${it.id}  ${it.nombre}`),
    "",
    `Subtotal: ${pesos(num(p.total) + num(p.ahorro))}`,
    ...(num(p.ahorro) ? [`Descuento combo: -${pesos(p.ahorro)}`] : []),
    `TOTAL: ${pesos(p.total)}`,
    "",
    "Códigos para armar la plancha:",
    items.map((it) => `${it.id} x${it.q}`).join(", "),
    "",
    "--",
    "Pedido enviado desde mbsublimarte.com.ar. El cliente lo manda por WhatsApp",
    "y envía el comprobante de transferencia por ese medio.",
  ].join("\r\n");

  const asunto = `Pedido ${numero} · ${txt(d.nombre, 40)} · ${unidades} stickers · ${pesos(p.total)}`;
  const raw = [
    `From: MB Sublimarte <${REMITENTE}>`,
    `To: <${env.MAIL_TO}>`,
    `Subject: ${encabezadoUtf8(asunto)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@mbsublimarte.com.ar>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(cuerpo).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");

  try {
    await env.MAIL.send(new EmailMessage(REMITENTE, env.MAIL_TO, raw));
  } catch (e) {
    console.error("No se pudo enviar el mail del pedido", numero, e && e.message);
    return json({ ok: false, error: "envío: " + (e && e.message) }, 502);
  }
  console.log("Mail de pedido enviado", numero);
  return json({ ok: true });
}

function base64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function encabezadoUtf8(texto) {
  return `=?UTF-8?B?${base64(texto)}?=`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
