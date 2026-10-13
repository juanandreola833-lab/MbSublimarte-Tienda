(() => {
  "use strict";

  const CFG = window.CONFIG;
  const ENC = CFG.encendedores || { precio: 0, medida: "" };
  const LINEAS = {
    stickers: { singular: "sticker", plural: "stickers" },
    encendedores: { singular: "encendedor", plural: "encendedores" },
  };
  const PRODUCTOS = [
    ...(window.PRODUCTOS || []).map((p) => ({ ...p, linea: "stickers" })),
    ...(window.ENCENDEDORES || []).map((p) => ({ ...p, linea: "encendedores" })),
  ];
  const hayEncendedores = PRODUCTOS.some((p) => p.linea === "encendedores");
  const cuantos = (n, linea) => `${n} ${n === 1 ? LINEAS[linea].singular : LINEAS[linea].plural}`;
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

  // Cada línea tiene su precio y su combo (los combos no se mezclan entre líneas).
  const PRECIOS = {
    stickers: { unidad: CFG.precioUnitario, combo: CFG.combo },
    encendedores: { unidad: ENC.precio, combo: ENC.combo },
  };

  function cuentaLinea(n, l) {
    const { unidad, combo } = PRECIOS[l];
    const combos = combo ? Math.floor(n / combo.cantidad) : 0;
    const sueltos = combo ? n % combo.cantidad : n;
    const total = combos * (combo ? combo.precio : 0) + sueltos * unidad;
    return { n, combos, sueltos, total, ahorro: n * unidad - total };
  }

  function calcular() {
    const cant = { stickers: 0, encendedores: 0 };
    for (const [id, q] of Object.entries(carrito)) cant[porId.get(id).linea] += q;
    const lin = { stickers: cuentaLinea(cant.stickers, "stickers"), encendedores: cuentaLinea(cant.encendedores, "encendedores") };
    const todas = Object.values(lin);
    return {
      n: todas.reduce((a, x) => a + x.n, 0),
      total: todas.reduce((a, x) => a + x.total, 0),
      ahorro: todas.reduce((a, x) => a + x.ahorro, 0),
      lin,
    };
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
  let linea = hayEncendedores && location.hash === "#encendedores" ? "encendedores" : "stickers";
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
    let total = 0;
    for (const p of PRODUCTOS) if (p.linea === linea) { cuenta[p.categoria] = (cuenta[p.categoria] || 0) + 1; total++; }
    const cats = Object.keys(cuenta).sort((a, b) => a.localeCompare(b, "es"));
    $("#chips").innerHTML = [["Todos", total], ...cats.map((c) => [c, cuenta[c]])]
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
      p.linea === linea &&
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
    $("#ver-mas").textContent = `Ver más ${LINEAS[linea].plural} (${resto})`;
    $("#contador").textContent = cuantos(todos.length, linea);
    $("#grid").innerHTML = lista.map((p, i) => `
      <article class="card ${maximo(p) === 0 ? "agotado" : ""}" style="animation-delay:${Math.max(0, Math.min(i - yaEstaban, 12)) * 30}ms">
        ${p.nuevo ? '<span class="tag tag-nuevo">Nuevo</span>' : ""}
        <button class="card-img protect ${p.linea === "encendedores" ? "enc" : ""}" style="--bg:${fondo(p.id)}" data-ver="${p.id}" aria-label="Ver ${esc(p.nombre)}">
          ${p.linea === "encendedores"
            ? mechero(p)
            : `<img src="${esc(p.mini || p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" draggable="false">`}
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

  // ---------- encendedores: el diseño puesto sobre un encendedor (SVG) ----------
  // Colores de capuchón y base como los de los encendedores reales (varía por diseño).
  const CAPUCHONES = ["#d3141c", "#5b2a9c", "#1d8a43", "#f2a40c", "#1f5fc9", "#e8467f"];
  // Encendedor de frente (proporciones de un descartable tipo Bic/Candela).
  function mechero(p, src = p.mini || p.imagen, pre = "g") {
    const k = pre + p.id.replace(/\W/g, "");
    const cap = CAPUCHONES[[...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % CAPUCHONES.length];
    const cuerpo = "M3 232 Q3 222 13 222 H335 Q345 222 345 232 V1146 Q345 1162 329 1162 H19 Q3 1162 3 1146 Z";
    return `<svg class="mechero" viewBox="0 -24 360 1204" role="img" aria-label="${esc(p.nombre)}">
      <defs>
        <clipPath id="c-${k}"><path d="${cuerpo}"/></clipPath>
        <linearGradient id="m-${k}" x1="0" x2="1">
          <stop offset="0" stop-color="#7d7d79"/><stop offset=".1" stop-color="#b9b8b3"/><stop offset=".3" stop-color="#d6d5d0"/>
          <stop offset=".55" stop-color="#a9a8a3"/><stop offset=".8" stop-color="#c4c3be"/><stop offset="1" stop-color="#777773"/>
        </linearGradient>
        <linearGradient id="mv-${k}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".12" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/>
        </linearGradient>
        <linearGradient id="b-${k}" x1="0" x2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".03" stop-color="#fff" stop-opacity=".22"/>
          <stop offset=".09" stop-color="#fff" stop-opacity="0"/><stop offset=".9" stop-color="#000" stop-opacity="0"/>
          <stop offset=".97" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity=".32"/>
        </linearGradient>
        <linearGradient id="r-${k}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#bdbcb7"/><stop offset=".4" stop-color="#7c7b77"/>
          <stop offset=".65" stop-color="#a8a7a2"/><stop offset="1" stop-color="#4f4f4c"/>
        </linearGradient>
        <linearGradient id="t-${k}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="p-${k}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".25" stop-color="#fff" stop-opacity=".05"/>
          <stop offset=".8" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".25"/>
        </linearGradient>
      </defs>
      <!-- ruedita: aro de metal que asoma en arco arriba del protector (a la derecha) -->
      <path d="M171 43 a49 49 0 1 0 98 0 a49 49 0 1 0 -98 0 Z M193 43 a27 27 0 1 1 54 0 a27 27 0 1 1 -54 0 Z" fill="url(#r-${k})" fill-rule="evenodd" stroke="#55595e" stroke-width="2.5"/>
      <path d="M265.0 43.0L271.0 43.0M264.1 51.9L269.9 53.2M261.3 60.5L266.8 62.9M256.8 68.3L261.6 71.8M250.8 75.0L254.8 79.4M243.5 80.2L246.5 85.4M235.3 83.9L237.1 89.6M226.5 85.8L227.1 91.7M217.5 85.8L216.9 91.7M208.7 83.9L206.9 89.6M200.5 80.2L197.5 85.4M193.2 75.0L189.2 79.4M187.2 68.3L182.4 71.8M182.7 60.5L177.2 62.9M179.9 51.9L174.1 53.2M179.0 43.0L173.0 43.0M179.9 34.1L174.1 32.8M182.7 25.5L177.2 23.1M187.2 17.7L182.4 14.2M193.2 11.0L189.2 6.6M200.5 5.8L197.5 0.6M208.7 2.1L206.9 -3.6M217.5 0.2L216.9 -5.7M226.5 0.2L227.1 -5.7M235.3 2.1L237.1 -3.6M243.5 5.8L246.5 0.6M250.8 11.0L254.8 6.6M256.8 17.7L261.6 14.2M261.3 25.5L266.8 23.1M264.1 34.1L269.9 32.8" stroke="#3f3f3c" stroke-width="3.2" stroke-linecap="round"/>
      <!-- palanca de gas, en forma de gancho -->
      <path d="M256 172 V92 Q256 72 276 72 H338 Q356 72 356 89 Q356 106 338 106 H303 V172 Z" fill="${cap}"/>
      <path d="M256 172 V92 Q256 72 276 72 H338 Q356 72 356 89 Q356 106 338 106 H303 V172 Z" fill="url(#p-${k})"/>
      <!-- protector metálico -->
      <path d="M10 168 V34 Q10 6 38 6 H228 Q256 6 256 34 V168 Z" fill="url(#m-${k})"/>
      <path d="M10 168 V34 Q10 6 38 6 H228 Q256 6 256 34 V168 Z" fill="url(#mv-${k})"/>
      <rect x="180" y="90" width="60" height="44" rx="6" fill="#7f848a"/>
      <rect x="186" y="96" width="48" height="32" rx="4" fill="#d9dcdf"/>
      <rect x="186" y="104" width="48" height="12" fill="#f3f4f5"/>
      <path d="M190 104 H230 M190 117 H230" stroke="#8d9298" stroke-width="2.5"/>
      <!-- capuchón -->
      <rect x="0" y="162" width="348" height="64" rx="7" fill="${cap}"/>
      <rect x="0" y="162" width="348" height="64" rx="7" fill="url(#p-${k})"/>
      <rect x="0" y="204" width="348" height="3" fill="#000" opacity=".12"/>
      <!-- cuerpo con el diseño -->
      <path d="${cuerpo}" fill="#fff"/>
      <image href="${esc(src)}" x="3" y="222" width="342" height="940" preserveAspectRatio="xMidYMid slice" clip-path="url(#c-${k})"/>
      <rect x="3" y="222" width="342" height="26" fill="url(#t-${k})" clip-path="url(#c-${k})"/>
      <path d="${cuerpo}" fill="url(#b-${k})"/>
      <!-- base -->
      <path d="M3 1140 H345 V1156 Q345 1176 325 1176 H23 Q3 1176 3 1156 Z" fill="${cap}"/>
      <path d="M3 1140 H345 V1156 Q345 1176 325 1176 H23 Q3 1176 3 1156 Z" fill="url(#p-${k})"/>
    </svg>`;
  }

  // ---------- pestañas: stickers / encendedores ----------
  function pintarLinea() {
    const enc = linea === "encendedores";
    document.querySelectorAll(".linea").forEach((b) => b.setAttribute("aria-selected", b.dataset.linea === linea));
    $("#hero-foto").hidden = !enc;
    $("#hero-kicker").textContent = enc ? "Nuevo en la tienda" : "Elegí tus favoritos";
    $("#hero-title").textContent = enc ? "Encendedores con onda" : "Stickers con mucho amor";
    $("#precio-unit").textContent = pesos(enc ? ENC.precio : CFG.precioUnitario);
    const combo = PRECIOS[linea].combo;
    $("#pill-combo").hidden = !combo;
    if (combo) $("#precio-combo").textContent = `${combo.cantidad} × ${pesos(combo.precio)}`;
    $("#medida").textContent = enc ? `🔥 ${ENC.medida}` : `📏 ${CFG.medida} · combiná los diseños que quieras`;
    $("#buscar").placeholder = `Buscar ${LINEAS[linea].plural}…`;
  }

  function cambiarLinea(nueva) {
    if (nueva === linea) return;
    linea = nueva;
    categoria = "Todos";
    busqueda = "";
    $("#buscar").value = "";
    history.replaceState(history.state, "", linea === "encendedores" ? "#encendedores" : location.pathname + location.search);
    pintarLinea();
    pintarChips();
    $("#grid").innerHTML = "";
    reiniciarGrilla();
  }

  window.addEventListener("hashchange", () => {
    if (hayEncendedores) cambiarLinea(location.hash === "#encendedores" ? "encendedores" : "stickers");
  });

  // ---------- visor ampliado ----------
  let visorId = null;
  function abrirVisor(id) {
    const p = porId.get(id);
    visorId = id;
    $("#visor-img").src = p.imagen;
    $("#visor-img").alt = p.nombre;
    $(".visor-img").style.setProperty("--bg", fondo(id));
    // Encendedores: el encendedor armado al lado del diseño completo
    const marco = $(".visor-img");
    marco.querySelectorAll(".mechero").forEach((el) => el.remove());
    marco.classList.toggle("enc", p.linea === "encendedores");
    if (p.linea === "encendedores") marco.insertAdjacentHTML("afterbegin", mechero(p, p.imagen, "v"));
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
    const hints = [];
    for (const [l, x] of Object.entries(r.lin)) {
      const combo = PRECIOS[l].combo;
      if (!combo || !x.n) continue;
      if (x.sueltos > 0) {
        const faltan = combo.cantidad - x.sueltos;
        hints.push(`💡 Sumá ${cuantos(faltan, l)} más y completás ${x.combos ? "otro" : "un"} combo ${combo.cantidad} × ${pesos(combo.precio)}`);
      } else {
        hints.push(`🎉 ¡Armaste ${x.combos} combo${x.combos > 1 ? "s" : ""} de ${LINEAS[l].plural}! Ahorrás ${pesos(x.ahorro)}`);
      }
    }
    $("#combo-hint").innerHTML = hints.join("<br>");
    $("#combo-hint").hidden = hints.length === 0;

    $("#totales").innerHTML = r.n === 0 ? "" : `
      ${Object.entries(r.lin).filter(([, x]) => x.n).map(([l, x]) =>
        `<div class="fila"><span>${cuantos(x.n, l)}</span><span>${pesos(x.n * PRECIOS[l].unidad)}</span></div>`).join("")}
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
    const lineas = Object.entries(carrito).map(([id, q]) => `• ${q} × ${porId.get(id).nombre} (${id})`);
    const detalle = [];
    for (const [l, x] of Object.entries(r.lin)) {
      const { unidad, combo } = PRECIOS[l];
      if (x.combos) detalle.push(`${x.combos} combo${x.combos > 1 ? "s" : ""} ${LINEAS[l].plural} ${combo.cantidad}×${pesos(combo.precio)} = ${pesos(x.combos * combo.precio)}`);
      if (x.sueltos) detalle.push(`${cuantos(x.sueltos, l)} suelto${x.sueltos > 1 ? "s" : ""} × ${pesos(unidad)} = ${pesos(x.sueltos * unidad)}`);
    }
    return [
      `¡Hola ${CFG.marca}! 💜 Quiero hacer este pedido:`,
      `*Pedido ${numeroPedido}*`,
      "",
      ...lineas,
      "",
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
    else if (d.linea) cambiarLinea(d.linea);
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
    enviarCopiaPorMail(pedido);
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

  // Copia del pedido por mail a la tienda (Worker de Cloudflare en /api/pedido).
  // Si falla (sin conexión, o en el link de respaldo de GitHub) no afecta al cliente.
  function enviarCopiaPorMail(p) {
    try {
      fetch("api/pedido", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          numero: p.numero, n: p.n, total: p.total, ahorro: p.ahorro, datos: p.datos,
          items: p.items.map(({ id, q, nombre }) => ({ id, q, nombre })),
        }),
      }).catch(() => {});
    } catch (e) {}
  }

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
      <div class="pedido-total"><span>${p.n} producto${p.n > 1 ? "s" : ""}${p.ahorro > 0 ? ` · ahorro ${pesos(p.ahorro)}` : ""}</span><span>${pesos(p.total)}</span></div>
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
      if (faltan) toast(`${faltan} producto${faltan > 1 ? "s ya no están" : " ya no está"} disponible${faltan > 1 ? "s" : ""}`);
    }
  });

  // Evita el menú "guardar imagen" sobre los stickers
  document.addEventListener("contextmenu", (e) => { if (e.target.closest(".protect")) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target.closest(".protect")) e.preventDefault(); });

  // ---------- arranque ----------
  $("#link-ig").href = `https://instagram.com/${CFG.instagram}`;
  $("#link-wa").href = `https://wa.me/${CFG.whatsapp}`;
  $(".lineas").hidden = !hayEncendedores;
  pintarLinea();
  pintarEntregas();
  pintarChips();
  pintarGrilla();
  refrescar();

  // ---------- avisar cuando hay una versión nueva ----------
  // Sirve sobre todo para la app instalada, que puede quedar abierta días en el
  // celu: al volver a abrirla se compara con el servidor y, si cambió el
  // catálogo o la tienda, aparece un aviso para actualizar (el carrito se conserva).
  const VIGILADOS = ["data/productos.js", "data/encendedores.js", "data/config.js", "assets/js/app.js", "assets/css/styles.css"];
  let firmaCargada = null;
  let ultimaRevision = 0;

  async function firmaServidor() {
    const partes = await Promise.all(VIGILADOS.map((u) =>
      fetch(u, { method: "HEAD", cache: "no-cache" })
        .then((r) => (r.ok ? r.headers.get("etag") || r.headers.get("last-modified") || "" : null))
        .catch(() => null)));
    return partes.includes(null) ? null : partes.join("|");
  }

  async function buscarActualizacion() {
    if (!firmaCargada || document.visibilityState !== "visible") return;
    if (Date.now() - ultimaRevision < 60 * 1000) return;
    ultimaRevision = Date.now();
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
    const actual = await firmaServidor();
    if (actual && actual !== firmaCargada) $("#aviso-version").hidden = false;
  }

  if (location.protocol.startsWith("http")) {
    firmaServidor().then((f) => { firmaCargada = f; });
    document.addEventListener("visibilitychange", buscarActualizacion);
    window.addEventListener("focus", buscarActualizacion);
    setInterval(buscarActualizacion, 10 * 60 * 1000);
  }
  $("#aviso-version-btn").addEventListener("click", () => location.reload());

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  }
})();
