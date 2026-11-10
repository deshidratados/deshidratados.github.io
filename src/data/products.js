// Catálogo de demostración: se muestra mientras Supabase carga (y si no
// está configurado). Las imágenes son un SVG local de relleno: antes
// apuntaban a picsum.photos, que devuelve fotos ALEATORIAS (playas,
// paisajes, gente…) que se veían en el hero hasta que llegaban las reales.
const PLACEHOLDER = 'img-placeholder.svg';

export const products = [
  {
    id: 'mango',
    name: 'Mango Ataulfo',
    category: 'frutas',
    description: 'Láminas dulces y chiclosas, sin azúcar añadida. El favorito de la casa.',
    origin: 'Nayarit',
    rating: 4.9,
    reviews: 312,
    badge: 'Más vendido',
    image: PLACEHOLDER,
    variants: [
      { id: '50', label: '50 g', price: 27 },
      { id: '100', label: '100 g', price: 45 },
      { id: '250', label: '250 g', price: 99 }
    ]
  },
  {
    id: 'pina',
    name: 'Piña Golden',
    category: 'frutas',
    description: 'Trozos con acidez brillante, perfectos para snack y repostería.',
    origin: 'Veracruz',
    rating: 4.7,
    reviews: 198,
    image: PLACEHOLDER,
    variants: [
      { id: '50', label: '50 g', price: 25 },
      { id: '100', label: '100 g', price: 42 },
      { id: '250', label: '250 g', price: 92 }
    ]
  },
  {
    id: 'manzana',
    name: 'Manzana y Canela',
    category: 'frutas',
    description: 'Láminas crujientes espolvoreadas con canela de verdad.',
    origin: 'Chihuahua',
    rating: 4.8,
    reviews: 251,
    image: PLACEHOLDER,
    variants: [
      { id: '50', label: '50 g', price: 23 },
      { id: '100', label: '100 g', price: 38 },
      { id: '250', label: '250 g', price: 84 }
    ]
  },
  {
    id: 'tomate',
    name: 'Tomate Seco',
    category: 'verduras',
    description: 'Mitades intensas para pastas, antipasti y aceites aromatizados.',
    origin: 'Sinaloa',
    rating: 4.9,
    reviews: 289,
    badge: 'Favorito',
    image: PLACEHOLDER,
    variants: [
      { id: '50', label: '50 g', price: 33 },
      { id: '100', label: '100 g', price: 55 },
      { id: '250', label: '250 g', price: 121 }
    ]
  },
  {
    id: 'chile',
    name: 'Chile Ancho',
    category: 'verduras',
    description: 'Secado tradicional para guisos, moles y salsas con cuerpo.',
    origin: 'Zacatecas',
    rating: 4.7,
    reviews: 122,
    image: PLACEHOLDER,
    variants: [
      { id: '50', label: '50 g', price: 24 },
      { id: '100', label: '100 g', price: 40 },
      { id: '250', label: '250 g', price: 88 }
    ]
  },
  {
    id: 'mix',
    name: 'Mix Senderista',
    category: 'mixes',
    description: 'Mango, arándano, almendra y pepita. Energía de montaña.',
    origin: 'Casa Salud & Vida',
    rating: 4.9,
    reviews: 341,
    badge: 'Nuevo',
    image: PLACEHOLDER,
    variants: [
      { id: '50', label: '50 g', price: 37 },
      { id: '100', label: '100 g', price: 62 },
      { id: '250', label: '250 g', price: 136 }
    ]
  }
];

export const categories = [
  { id: 'todos', label: 'Todos' },
  { id: 'frutas', label: 'Frutas' },
  { id: 'verduras', label: 'Verduras' },
  { id: 'mixes', label: 'Mixes' }
];