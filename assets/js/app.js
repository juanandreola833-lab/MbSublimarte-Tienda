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
  const POR_PAGINA = 24;
  let categoria = "Todos";
  let busqueda = "";
  let orden = "destacados";
  let soloStock = false;
  let mostrar = POR_PAGINA;

  // "Destacados": primero los nuevos y después intercalando categorías,
  // así la primera pantalla muestra variedad.
  const DESTACADOS = (() => {
    const grupos = new Map();
    for (const p of PRODUCTOS) {
      if (!grupos.has(p.categoria)) grupos.set(p.categoria, []);
      grupos.get(p.categoria).push(p);
    }
    const colas = [...grupos.values()];
    const mezcla = [];
    for (let i = 0; mezcla.length < PRODUCTOS.length; i++) {
      for (const c of colas) if (c[i]) mezcla.push(c[i]);
    }
    return [...mezcla.filter((p) => p.nuevo), ...mezcla.filter((p) => !p.nuevo)];
  })();

  function pintarChips() {
    const cuenta = {};
    for (const p of PRODUCTOS) cuenta[p.categoria] = (cuenta[p.categoria] || 0) + 1;
    const cats = Object.keys(cuenta).sort((a, b) => a.localeCompare(b, "es"));
    $("#chips").innerHTML = [["Todos", PRODUCTOS.length], ...cats.map((c) => [c, cuenta[c]])]
      .map(([c, n]) => `<button class="chip" role="tab" aria-selected="${c === categoria}" data-cat="${esc(c)}">${esc(c)} <small>${n}</small></button>`)
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
    const base = orden === "destacados" ? DESTACADOS
      : [...PRODUCTOS].sort((a, b) => orden === "az"
        ? a.nombre.localeCompare(b.nombre, "es")
        : a.categoria.localeCompare(b.categoria, "es") || a.nombre.localeCompare(b.nombre, "es"));
    return base.filter((p) =>
      (categoria === "Todos" || p.categoria === categoria) &&
      (!soloStock || (p.stock !== null && p.stock > 0)) &&
      (!q || normalizar(`${p.nombre} ${p.categoria} ${p.id}`).includes(q)));
  }

  function reiniciarGrilla() {
    mostrar = POR_PAGINA;
    pintarGrilla();
  }

  function pintarGrilla() {
    const todos = visibles();
    const lista = todos.slice(0, mostrar);
    const yaEstaban = $("#grid").children.length;
    $("#sin-resultados").hidden = todos.length > 0;
    const resto = todos.length - lista.length;
    $("#ver-mas").hidden = resto <= 0;
    $("#ver-mas").textContent = `Ver más stickers (${resto})`;
    $("#contador").textContent = `${todos.length} sticker${todos.length === 1 ? "" : "s"}`;
    $("#grid").innerHTML = lista.map((p, i) => `
      <article class="card ${maximo(p) === 0 ? "agotado" : ""}" style="animation-delay:${Math.max(0, Math.min(i - yaEstaban, 12)) * 30}ms">
        ${p.nuevo ? '<span class="tag tag-nuevo">Nuevo</span>' : ""}
        <button class="card-img protect" style="--bg:${fondo(p.id)}" data-ver="${p.id}" aria-label="Ver ${esc(p.nombre)}">
          <img src="${esc(p.mini || p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" draggable="false">
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
  const TITULOS = { carrito: "Tu pedido", datos: "Tus datos", pago: "Pagar", enviado: "¡Listo!" };
  let numeroPedido = null;

  function nuevoNumero() {
    const h = new Date();
    const dd = String(h.getDate()).padStart(2, "0") + String(h.getMonth() + 1).padStart(2, "0");
    return `MB-${dd}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function pintarCarrito() {
    const ids = Object.keys(carrito);
    $("#carrito-vacio").hidden = ids.length > 0;
    $("#vaciar-carrito").hidden = ids.length === 0 || paso !== "carrito";
    $("#cart-list").innerHTML = ids.map((id) => {
      const p = porId.get(id);
      return `<li class="cart-item">
        <div class="thumb protect" style="--bg:${fondo(id)}"><img src="${esc(p.mini || p.imagen)}" alt="" draggable="false"></div>
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
    document.querySelectorAll("#carrito .step").forEach((s) => (s.hidden = s.dataset.step !== paso));
    $("#sheet-title").textContent = TITULOS[paso];
    $("#paso-atras").hidden = paso === "carrito" || paso === "enviado";
    $("#btn-siguiente").hidden = paso === "pago" || paso === "enviado";
    $("#btn-siguiente").textContent = paso === "carrito" ? "Continuar" : "Ver datos de pago";
    $("#btn-whatsapp").hidden = paso !== "pago";
    $("#btn-reenviar").hidden = paso !== "enviado";
    $("#btn-seguir").hidden = paso !== "enviado";
    $("#totales").hidden = paso === "enviado";
    $("#vaciar-carrito").hidden = paso !== "carrito" || totalUnidades() === 0;
    if (paso === "pago") {
      numeroPedido = numeroPedido || nuevoNumero();
      prepararPago();
    }
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
      `*Pedido ${numeroPedido}*`,
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
      $("#grid").innerHTML = "";
      reiniciarGrilla();
    } else if ("cerrar" in d) cerrarModal();
  });

  $("#buscar").addEventListener("input", (e) => { busqueda = e.target.value; $("#grid").innerHTML = ""; reiniciarGrilla(); });
  $("#orden").addEventListener("change", (e) => { orden = e.target.value; $("#grid").innerHTML = ""; reiniciarGrilla(); });
  $("#solo-stock").addEventListener("change", (e) => { soloStock = e.target.checked; $("#grid").innerHTML = ""; reiniciarGrilla(); });
  $("#ver-mas").addEventListener("click", () => { mostrar += POR_PAGINA * 2; pintarGrilla(); });

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
    // se guarda el pedido y se vacía el carrito después de abrir WhatsApp
    const pedido = {
      numero: numeroPedido,
      fecha: new Date().toISOString(),
      items: Object.entries(carrito).map(([id, q]) => {
        const p = porId.get(id);
        return { id, q, nombre: p.nombre, mini: p.mini || p.imagen };
      }),
      ...calcular(),
      datos: datosFormulario(),
      mensaje: mensajePedido(),
    };
    setTimeout(() => {
      const lista = leer("mb-pedidos", []);
      lista.unshift(pedido);
      guardar("mb-pedidos", lista.slice(0, 30));
      carrito = {};
      guardar("mb-carrito", carrito);
      numeroPedido = null;
      $("#form-datos").notas.value = "";
      $("#enviado-numero").textContent = pedido.numero;
      $("#enviado-detalle").innerHTML = tarjetaPedido(pedido, false);
      $("#btn-reenviar").href = linkWhatsApp(pedido.mensaje);
      irA("enviado");
      refrescar();
      toast("¡Gracias! No te olvides de mandar el comprobante 💜");
    }, 0);
  });

  $("#vaciar-carrito").addEventListener("click", () => {
    if (!confirm("¿Vaciar el carrito?")) return;
    carrito = {};
    guardar("mb-carrito", carrito);
    numeroPedido = null;
    refrescar();
    toast("Carrito vacío");
  });

  $("#btn-seguir").addEventListener("click", () => cerrarModal());

  // ---------- mis pedidos ----------
  function linkWhatsApp(msg) {
    return `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  function tarjetaPedido(p, conAcciones) {
    const fecha = new Date(p.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return `<article class="pedido">
      <div class="pedido-top"><b>${esc(p.numero)}</b><span>${fecha}</span></div>
      <ul class="pedido-items">${p.items.map((it) => `
        <li><div class="thumb protect" style="--bg:${fondo(it.id)}"><img src="${esc(it.mini)}" alt="" draggable="false" loading="lazy"></div>
          <span class="q">${it.q} ×</span><span>${esc(it.nombre)} <small>(${esc(it.id)})</small></span></li>`).join("")}
      </ul>
      <div class="pedido-total"><span>${p.n} sticker${p.n > 1 ? "s" : ""}${p.ahorro > 0 ? ` · ahorro ${pesos(p.ahorro)}` : ""}</span><span>${pesos(p.total)}</span></div>
      <p class="pedido-datos">${esc(p.datos.nombre)} · ${esc(p.datos.entrega)} · Alias ${esc(CFG.alias)}</p>
      ${conAcciones ? `<div class="pedido-acciones">
        <a class="wa" href="${linkWhatsApp(p.mensaje)}" target="_blank" rel="noopener">Reenviar por WhatsApp</a>
        <button data-repetir="${esc(p.numero)}">Volver a pedir</button>
        <button data-borrar="${esc(p.numero)}">Borrar</button>
      </div>` : ""}
    </article>`;
  }

  function pintarPedidos() {
    const lista = leer("mb-pedidos", []);
    $("#pedidos-vacio").hidden = lista.length > 0;
    $("#pedidos-lista").innerHTML = lista.map((p) => tarjetaPedido(p, true)).join("");
  }

  $("#abrir-pedidos").addEventListener("click", () => { pintarPedidos(); abrirModal("#pedidos"); });

  $("#pedidos-lista").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const lista = leer("mb-pedidos", []);
    if (b.dataset.borrar) {
      if (!confirm("¿Borrar este pedido de la lista?")) return;
      guardar("mb-pedidos", lista.filter((p) => p.numero !== b.dataset.borrar));
      pintarPedidos();
    } else if (b.dataset.repetir) {
      const p = lista.find((x) => x.numero === b.dataset.repetir);
      let faltan = 0;
      for (const it of p.items) {
        const prod = porId.get(it.id);
        if (!prod || maximo(prod) === 0) { faltan++; continue; }
        carrito[it.id] = Math.min(cantidad(it.id) + it.q, maximo(prod));
      }
      guardar("mb-carrito", carrito);
      refrescar();
      irA("carrito");
      abrirModal("#carrito");
      if (faltan) toast(`${faltan} sticker${faltan > 1 ? "s ya no están" : " ya no está"} disponible${faltan > 1 ? "s" : ""}`);
    }
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
