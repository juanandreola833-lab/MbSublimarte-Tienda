(() => {
  "use strict";

  const CFG = window.CONFIG;
  const PRODUCTOS = window.PRODUCTOS || [];
  const porId = new Map(PRODUCTOS.map((p) => [p.id, p]));
  const FONDOS = ["#ffd6e5", "#cdefe3", "#ffe1c8", "#d6e9ff", "#ece2f8", "#fff3c4"];

  const $ = (s, el = document) => el.querySelector(s);
  const pesos = (n) => "$" + n.toLocaleString("es-AR");
  const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fondo = (id) => FONDOS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % FONDOS.length];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- almacenamiento local (puede fallar en modo privado) ----------
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };

  // ---------- carrito ----------
  let carrito = {};
  for (const [id, q] of Object.entries(leer("mb-carrito", {}))) {
    const p = porId.get(id);
    const max = maximo(p);
    if (p && max > 0 && q > 0) carrito[id] = Math.min(q, max);
  }

  function maximo(p) {
    if (!p) return 0;
    return p.stock === null || p.stock === undefined ? 99 : p.stock;
  }
  function cantidad(id) { return carrito[id] || 0; }
  function totalUnidades() { return Object.values(carrito).reduce((a, b) => a + b, 0); }

  function calcular(n = totalUnidades()) {
    const { cantidad: c, precio: pc } = CFG.combo;
    const combos = Math.floor(n / c);
    const sueltos = n % c;
    const total = combos * pc + sueltos * CFG.precioUnitario;
    return { n, combos, sueltos, total, ahorro: n * CFG.precioUnitario - total };
  }

  function setCantidad(id, q) {
    const p = porId.get(id);
    q = Math.max(0, Math.min(q, maximo(p)));
    const antes = cantidad(id);
    if (q === 0) delete carrito[id]; else carrito[id] = q;
    guardar("mb-carrito", carrito);
    if (q > antes) {
      const fab = $("#abrir-carrito");
      fab.classList.remove("pop"); void fab.offsetWidth; fab.classList.add("pop");
    }
    if (q === maximo(p) && q > antes && p.stock != null) toast("¡Llegaste al stock disponible!");
    refrescar();
  }

  // ---------- catálogo ----------
  let categoria = "Todos";
  let busqueda = "";

  function pintarChips() {
    const cats = ["Todos", ...new Set(PRODUCTOS.map((p) => p.categoria))];
    $("#chips").innerHTML = cats
      .map((c) => `<button class="chip" role="tab" aria-selected="${c === categoria}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
  }

  function textoStock(p) {
    if (p.stock === null || p.stock === undefined) return '<span class="stock">A pedido</span>';
    if (p.stock === 0) return '<span class="stock stock-agotado">Agotado</span>';
    if (p.stock <= 5) return `<span class="stock stock-pocos">¡Quedan ${p.stock}!</span>`;
    return '<span class="stock">En stock</span>';
  }

  function controles(p) {
    const q = cantidad(p.id);
    if (maximo(p) === 0) return '<button class="btn-add" disabled>Agotado</button>';
    if (q === 0) return `<button class="btn-add" data-add="${p.id}">Agregar ＋</button>`;
    return `<div class="qty">
      <button data-menos="${p.id}" aria-label="Quitar uno">−</button>
      <span>${q}</span>
      <button data-mas="${p.id}" aria-label="Agregar uno" ${q >= maximo(p) ? "disabled" : ""}>+</button>
    </div>`;
  }

  function visibles() {
    const q = normalizar(busqueda.trim());
    return PRODUCTOS.filter((p) =>
      (categoria === "Todos" || p.categoria === categoria) &&
      (!q || normalizar(`${p.nombre} ${p.categoria} ${p.id}`).includes(q)));
  }

  function pintarGrilla() {
    const lista = visibles();
    $("#sin-resultados").hidden = lista.length > 0;
    $("#grid").innerHTML = lista.map((p, i) => `
      <article class="card ${maximo(p) === 0 ? "agotado" : ""}" style="animation-delay:${Math.min(i, 12) * 30}ms">
        ${p.nuevo ? '<span class="tag tag-nuevo">Nuevo</span>' : ""}
        <button class="card-img protect" style="--bg:${fondo(p.id)}" data-ver="${p.id}" aria-label="Ver ${esc(p.nombre)}">
          <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" draggable="false">
        </button>
        <div class="card-body">
          <h3 class="card-name">${esc(p.nombre)}</h3>
          <div class="card-meta"><span>${esc(p.categoria)}</span>${textoStock(p)}</div>
          <div class="card-foot" data-ctrl="${p.id}">${controles(p)}</div>
        </div>
      </article>`).join("");
  }

  function refrescarControles() {
    document.querySelectorAll("[data-ctrl]").forEach((el) => {
      el.innerHTML = controles(porId.get(el.dataset.ctrl));
    });
    if (visorId) pintarAccionesVisor();
  }

  // ---------- visor ampliado ----------
  let visorId = null;
  function abrirVisor(id) {
    const p = porId.get(id);
    visorId = id;
    $("#visor-img").src = p.imagen;
    $("#visor-img").alt = p.nombre;
    $(".visor-img").style.setProperty("--bg", fondo(id));
    $("#visor-nombre").textContent = p.nombre;
    $("#visor-meta").innerHTML = `${esc(p.categoria)} · ${p.id} · ${textoStock(p)}`;
    pintarAccionesVisor();
    abrirModal("#visor");
  }
  function pintarAccionesVisor() {
    $("#visor-actions").innerHTML = controles(porId.get(visorId));
  }

  // ---------- carrito / checkout ----------
  let paso = "carrito";
  const TITULOS = { carrito: "Tu pedido", datos: "Tus datos", pago: "Pagar" };

  function pintarCarrito() {
    const ids = Object.keys(carrito);
    $("#carrito-vacio").hidden = ids.length > 0;
    $("#cart-list").innerHTML = ids.map((id) => {
      const p = porId.get(id);
      return `<li class="cart-item">
        <div class="thumb protect" style="--bg:${fondo(id)}"><img src="${esc(p.imagen)}" alt="" draggable="false"></div>
        <div class="info"><b>${esc(p.nombre)}</b><small>${p.id}</small></div>
        <div class="qty">
          <button data-menos="${id}" aria-label="Quitar uno">−</button>
          <span>${carrito[id]}</span>
          <button data-mas="${id}" aria-label="Agregar uno" ${carrito[id] >= maximo(p) ? "disabled" : ""}>+</button>
        </div>
      </li>`;
    }).join("");

    const r = calcular();
    const c = CFG.combo.cantidad;
    let hint = "";
    if (r.n > 0 && r.sueltos > 0) {
      const faltan = c - r.sueltos;
      hint = `💡 Sumá ${faltan} sticker${faltan > 1 ? "s" : ""} más y completás ${r.combos ? "otro" : "un"} combo ${c} × ${pesos(CFG.combo.precio)}`;
    } else if (r.combos > 0) {
      hint = `🎉 ¡Armaste ${r.combos} combo${r.combos > 1 ? "s" : ""}! Ahorrás ${pesos(r.ahorro)}`;
    }
    $("#combo-hint").textContent = hint;

    $("#totales").innerHTML = r.n === 0 ? "" : `
      <div class="fila"><span>${r.n} sticker${r.n > 1 ? "s" : ""}</span><span>${pesos(r.n * CFG.precioUnitario)}</span></div>
      ${r.ahorro > 0 ? `<div class="fila ahorro"><span>Descuento combo</span><span>−${pesos(r.ahorro)}</span></div>` : ""}
      <div class="fila total"><span>Total</span><span>${pesos(r.total)}</span></div>`;
  }

  function irA(nuevo) {
    paso = nuevo;
    document.querySelectorAll(".step").forEach((s) => (s.hidden = s.dataset.step !== paso));
    $("#sheet-title").textContent = TITULOS[paso];
    $("#paso-atras").hidden = paso === "carrito";
    $("#btn-siguiente").hidden = paso === "pago";
    $("#btn-siguiente").textContent = paso === "carrito" ? "Continuar" : "Ver datos de pago";
    $("#btn-whatsapp").hidden = paso !== "pago";
    $("#btn-vaciar").hidden = paso !== "pago";
    if (paso === "pago") prepararPago();
    refrescarBoton();
  }

  function refrescarBoton() {
    $("#btn-siguiente").disabled = totalUnidades() === 0;
  }

  function pintarEntregas() {
    const elegida = leer("mb-entrega", CFG.entregas[0]);
    $("#entregas").innerHTML = CFG.entregas.map((e) => `
      <label><input type="radio" name="entrega" value="${esc(e)}" ${e === elegida ? "checked" : ""}> ${esc(e)}</label>`).join("");
    $("#form-datos").nombre.value = leer("mb-nombre", "");
  }

  function datosFormulario() {
    const f = $("#form-datos");
    return {
      nombre: f.nombre.value.trim(),
      entrega: (f.querySelector("input[name=entrega]:checked") || {}).value || CFG.entregas[0],
      notas: f.notas.value.trim(),
    };
  }

  function mensajePedido() {
    const d = datosFormulario();
    const r = calcular();
    const c = CFG.combo.cantidad;
    const lineas = Object.entries(carrito).map(([id, q]) => `• ${q} × ${porId.get(id).nombre} (${id})`);
    const detalle = [];
    if (r.combos) detalle.push(`${r.combos} combo${r.combos > 1 ? "s" : ""} ${c}×${pesos(CFG.combo.precio)} = ${pesos(r.combos * CFG.combo.precio)}`);
    if (r.sueltos) detalle.push(`${r.sueltos} suelto${r.sueltos > 1 ? "s" : ""} × ${pesos(CFG.precioUnitario)} = ${pesos(r.sueltos * CFG.precioUnitario)}`);
    return [
      `¡Hola ${CFG.marca}! 💜 Quiero hacer este pedido:`,
      "",
      ...lineas,
      "",
      `Stickers: ${r.n}`,
      ...detalle,
      `*TOTAL: ${pesos(r.total)}*`,
      "",
      `Nombre: ${d.nombre}`,
      `Entrega: ${d.entrega}`,
      ...(d.notas ? [`Notas: ${d.notas}`] : []),
      "",
      `Transfiero al alias ${CFG.alias} y te mando el comprobante 🙌`,
    ].join("\n");
  }

  function prepararPago() {
    const r = calcular();
    $("#pago-total").textContent = pesos(r.total);
    $("#pago-alias").textContent = CFG.alias;
    const extra = [];
    if (CFG.titular) extra.push(`Titular: ${CFG.titular}`);
    if (CFG.cbu) extra.push(`CBU: ${CFG.cbu}`);
    $("#pago-extra").textContent = extra.join(" · ");
    const msg = mensajePedido();
    $("#resumen-texto").textContent = msg;
    $("#btn-whatsapp").href = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  // ---------- modales ----------
  let modalAbierto = null;
  function abrirModal(sel) {
    if (modalAbierto && modalAbierto !== sel) $(modalAbierto).hidden = true;
    else if (!modalAbierto) history.pushState({ modal: true }, "");
    modalAbierto = sel;
    $(sel).hidden = false;
    document.body.style.overflow = "hidden";
  }
  function cerrarModal(desdeHistorial = false) {
    if (!modalAbierto) return;
    $(modalAbierto).hidden = true;
    if (modalAbierto === "#visor") visorId = null;
    modalAbierto = null;
    document.body.style.overflow = "";
    if (!desdeHistorial && history.state && history.state.modal) history.back();
  }
  window.addEventListener("popstate", () => cerrarModal(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal(); });

  // ---------- toast ----------
  let toastTimer;
  function toast(txt) {
    const t = $("#toast");
    t.textContent = txt;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- refresco general ----------
  function refrescar() {
    const r = calcular();
    $("#fab-count").textContent = r.n;
    $("#fab-total").textContent = pesos(r.total);
    refrescarControles();
    pintarCarrito();
    refrescarBoton();
    if (paso === "pago") {
      if (r.n === 0) irA("carrito"); else prepararPago();
    }
  }

  // ---------- eventos ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a, [data-cerrar]");
    if (!t) return;
    const d = t.dataset;
    if (d.add) { setCantidad(d.add, 1); toast("Agregado al carrito 💜"); }
    else if (d.mas) setCantidad(d.mas, cantidad(d.mas) + 1);
    else if (d.menos) setCantidad(d.menos, cantidad(d.menos) - 1);
    else if (d.ver) abrirVisor(d.ver);
    else if (d.cat !== undefined) {
      categoria = d.cat;
      pintarChips();
      pintarGrilla();
    } else if ("cerrar" in d) cerrarModal();
  });

  $("#buscar").addEventListener("input", (e) => { busqueda = e.target.value; pintarGrilla(); });

  $("#abrir-carrito").addEventListener("click", () => { irA("carrito"); abrirModal("#carrito"); });
  $("#paso-atras").addEventListener("click", () => irA(paso === "pago" ? "datos" : "carrito"));

  $("#btn-siguiente").addEventListener("click", () => {
    if (paso === "carrito") return irA("datos");
    const f = $("#form-datos");
    const d = datosFormulario();
    f.nombre.classList.toggle("error", !d.nombre);
    if (!d.nombre) { f.nombre.focus(); toast("Contanos tu nombre 🙂"); return; }
    guardar("mb-nombre", d.nombre);
    guardar("mb-entrega", d.entrega);
    irA("pago");
  });
  $("#form-datos").addEventListener("submit", (e) => { e.preventDefault(); $("#btn-siguiente").click(); });
  $("#form-datos").addEventListener("input", () => { if (paso === "pago") prepararPago(); });

  $("#copiar-alias").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CFG.alias);
    } catch (e) {
      const r = document.createRange();
      r.selectNodeContents($("#pago-alias"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      document.execCommand("copy");
    }
    toast("Alias copiado ✓");
  });

  $("#btn-whatsapp").addEventListener("click", () => {
    setTimeout(() => toast("¡Gracias! No te olvides de mandar el comprobante 💜"), 400);
  });

  $("#btn-vaciar").addEventListener("click", () => {
    if (!confirm("¿Vaciar el carrito?")) return;
    carrito = {};
    guardar("mb-carrito", carrito);
    irA("carrito");
    refrescar();
  });

  // Evita el menú "guardar imagen" sobre los stickers
  document.addEventListener("contextmenu", (e) => { if (e.target.closest(".protect")) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target.closest(".protect")) e.preventDefault(); });

  // ---------- arranque ----------
  $("#link-ig").href = `https://instagram.com/${CFG.instagram}`;
  $("#link-wa").href = `https://wa.me/${CFG.whatsapp}`;
  $("#precio-unit").textContent = pesos(CFG.precioUnitario);
  $("#precio-combo").textContent = `${CFG.combo.cantidad} × ${pesos(CFG.combo.precio)}`;
  $("#medida").textContent = `📏 ${CFG.medida} · combiná los diseños que quieras`;
  pintarEntregas();
  pintarChips();
  pintarGrilla();
  refrescar();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
