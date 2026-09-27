/*
 * Catálogo de stickers de MB Sublimarte.
 *
 * Cada sticker tiene:
 *   id         código único (se usa en el pedido de WhatsApp)
 *   nombre     nombre visible
 *   categoria  para los filtros
 *   imagen     ruta a la foto con marca de agua (assets/img/stickers/...)
 *   stock      número de unidades físicas disponibles,
 *              0 = agotado, null = "a pedido" (se imprime cuando lo piden)
 *   nuevo      true para mostrar la etiqueta "Nuevo" (opcional)
 *
 * El precio es el mismo para todos y se configura en data/config.js.
 * Lo que está entre los corchetes [ ] tiene que ser JSON válido
 * (comillas dobles, sin coma después del último elemento).
 */
window.PRODUCTOS = [
  {
    "id": "FR-001",
    "nombre": "Good vibes",
    "categoria": "Frases",
    "imagen": "assets/img/stickers/frases-good-vibes.webp",
    "stock": 25,
    "nuevo": false
  },
  {
    "id": "FR-002",
    "nombre": "Mate y amigos",
    "categoria": "Frases",
    "imagen": "assets/img/stickers/frases-mate-y-amigos.webp",
    "stock": 12,
    "nuevo": false
  },
  {
    "id": "FR-003",
    "nombre": "Sé tu propia luz",
    "categoria": "Frases",
    "imagen": "assets/img/stickers/frases-se-tu-propia-luz.webp",
    "stock": 3,
    "nuevo": false
  },
  {
    "id": "KA-001",
    "nombre": "Bubble tea",
    "categoria": "Kawaii",
    "imagen": "assets/img/stickers/kawaii-bubble-tea.webp",
    "stock": null,
    "nuevo": true
  },
  {
    "id": "KA-002",
    "nombre": "Gatito feliz",
    "categoria": "Kawaii",
    "imagen": "assets/img/stickers/kawaii-gatito-feliz.webp",
    "stock": 18,
    "nuevo": false
  },
  {
    "id": "KA-003",
    "nombre": "Osito dormilón",
    "categoria": "Kawaii",
    "imagen": "assets/img/stickers/kawaii-osito-dormilon.webp",
    "stock": 0,
    "nuevo": false
  },
  {
    "id": "FL-001",
    "nombre": "Girasol",
    "categoria": "Flores",
    "imagen": "assets/img/stickers/flores-girasol.webp",
    "stock": 30,
    "nuevo": false
  },
  {
    "id": "FL-002",
    "nombre": "Margarita",
    "categoria": "Flores",
    "imagen": "assets/img/stickers/flores-margarita.webp",
    "stock": null,
    "nuevo": true
  },
  {
    "id": "FL-003",
    "nombre": "Tulipanes",
    "categoria": "Flores",
    "imagen": "assets/img/stickers/flores-tulipanes.webp",
    "stock": 8,
    "nuevo": false
  },
  {
    "id": "ES-001",
    "nombre": "Luna y estrellas",
    "categoria": "Espacio",
    "imagen": "assets/img/stickers/espacio-luna-y-estrellas.webp",
    "stock": 15,
    "nuevo": false
  },
  {
    "id": "ES-002",
    "nombre": "Planeta",
    "categoria": "Espacio",
    "imagen": "assets/img/stickers/espacio-planeta.webp",
    "stock": null,
    "nuevo": true
  },
  {
    "id": "MA-001",
    "nombre": "Huellita",
    "categoria": "Mascotas",
    "imagen": "assets/img/stickers/mascotas-huellita.webp",
    "stock": 6,
    "nuevo": false
  }
];
