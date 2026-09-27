/*
 * Configuración de la tienda. Cambiá acá los datos de contacto, pago y precios.
 */
window.CONFIG = {
  marca: "MB Sublimarte",
  instagram: "mb.sublimarte",

  // WhatsApp en formato internacional, sin +, espacios ni guiones:
  // 54 (Argentina) + 9 (celular) + 11 (código de área) + número
  whatsapp: "5491133383215",

  // Datos para la transferencia
  alias: "maca.bustamante.1993",
  titular: "", // opcional, ej: "Macarena Bustamante"
  cbu: "", // opcional

  // Precios (en pesos)
  precioUnitario: 1000,
  combo: { cantidad: 3, precio: 2500 }, // se pueden combinar diseños distintos

  medida: "Aprox. 5 × 5 cm (proporcional según el diseño)",

  // Opciones de entrega que se muestran al finalizar el pedido
  entregas: ["Retiro (a coordinar)", "Envío (costo a coordinar)"]
};
