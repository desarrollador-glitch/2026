
import { Order, OrderStatus, UserRole, StaffMember, SleeveFont, SleeveIcon } from './types';

// --- SLEEVE OPTIONS ---
export const SLEEVE_FONTS: { id: SleeveFont; label: string; family: string }[] = [
    { id: 'TIMES', label: 'Times New Roman', family: '"Times New Roman", serif' },
    { id: 'ARIAL_ROUNDED', label: 'Arial Rounded', family: '"Arial Rounded MT Bold", "Arial", sans-serif' },
    { id: 'COMIC', label: 'Web Comic', family: '"Comic Sans MS", "Chalkboard SE", sans-serif' },
    { id: 'COLLEGE', label: 'College', family: '"Rockwell", "Courier New", serif' }, // Approx for college look
];

export const SLEEVE_ICONS: { id: SleeveIcon; label: string; icon: string }[] = [
    { id: 'NONE', label: 'Sin Icono', icon: '🚫' },
    { id: 'PAW', label: 'Patita', icon: '🐾' },
    { id: 'STAR', label: 'Estrella', icon: '⭐' },
    { id: 'BONE', label: 'Huesito', icon: '🦴' },
    { id: 'HEART', label: 'Corazón', icon: '❤️' },
    { id: 'CROWN', label: 'Corona', icon: '👑' },
];

// --- MOCK INITIAL DATA ---
export const INITIAL_ORDERS: Order[] = [
  // 1. SCENARIO: SUPER PACK (Hoodie + Jockey with Shared Photo)
  {
    id: '4001-PACK',
    customerName: 'Javiera Pack',
    email: 'javi@example.com',
    phone: '+569 0000 0000',
    shippingAddress: 'Calle Falsa 123',
    orderDate: '29/11/2025 10:00:00',
    status: OrderStatus.PENDING_UPLOAD,
    totalAmount: 65000,
    items: [
        {
            id: '4001-H',
            groupId: 'VOL-PACK1', // GROUP ID
            sku: 'hood-neg-m',
            productName: 'Hoodie Pack',
            price: 42500,
            quantity: 1,
            customizations: [{ id: 'S1', status: 'EMPTY', includeHalo: true, position: 'CENTER' }]
        },
        {
            id: '4001-J',
            groupId: 'VOL-PACK1', // SAME GROUP ID
            sku: 'jockey-bei',
            productName: 'Jockey Pack',
            price: 22500,
            quantity: 1,
            customizations: [{ id: 'S2', status: 'EMPTY', includeHalo: true, position: 'CENTER' }] // Status will sync with S1
        }
    ]
  },
  // 2. SCENARIO: MIXED ITEMS (3 Hoodies independent + 1 Sleeve Credit)
  {
    id: '3872',
    customerName: 'Rebeca Figueroa',
    email: 'rebecafigueroacisternas@gmail.com',
    phone: '+569 62438492',
    shippingAddress: 'Las Lomas de Maipú 1784',
    orderDate: '28/11/2025 10:54:00',
    status: OrderStatus.WAITING_FOR_DESIGN, 
    totalAmount: 139000,
    items: [
      {
        id: '3872-1', 
        sku: 'hood-neg-l',
        productName: 'Hoodie Independiente 1',
        quantity: 1,
        price: 45000,
        customizations: [
          { id: 'C1', status: 'APPROVED', includeHalo: false, position: 'CENTER_LEFT', photoUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80', petName: 'Rocky' },
        ],
        sleeve: { text: 'Rebeca', font: 'COMIC', icon: 'PAW' } // Consumed 1 credit
      },
      {
        id: '3872-2', 
        sku: 'hood-bei-m',
        productName: 'Hoodie Independiente 2',
        quantity: 1,
        price: 45000,
        customizations: [
           { id: 'C2', status: 'APPROVED', includeHalo: false, position: 'CENTER', photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80', petName: 'Luna' }
        ]
      },
      // Credit source
      {
          id: '3872-EXTRA',
          sku: 'extra-manga',
          productName: 'Nombre de tu regalón en Manga',
          price: 9900,
          quantity: 1, // Bought 1, Assigned to 3872-1. Balance = 0.
          customizations: []
      }
    ],
    technicalSheet: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 
    machineFile: 'data:application/octet-stream;base64,AAA'
  },
  // 3. Completed Order for Stats
  {
    id: '3850',
    customerName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+569 1111 2222',
    shippingAddress: 'Av Providencia 123',
    orderDate: '25/11/2025 14:00:00',
    status: OrderStatus.DISPATCHED,
    totalAmount: 25000,
    items: [
        {
            id: '3850-1',
            sku: 'cap-black',
            productName: 'Jockey Bordado',
            price: 25000,
            quantity: 1,
            customizations: [{ id: 'J1', status: 'APPROVED', includeHalo: false, position: 'CENTER' }]
        }
    ],
    finishedProductPhoto: 'https://images.unsplash.com/photo-1575424909138-46b05e5919ec?auto=format&fit=crop&w=500&q=80',
    packedProductPhoto: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=500&q=80'
  }
];

// --- MOCK STAFF FOR ASSIGNMENT LOGIC ---
export const STAFF_MEMBERS: StaffMember[] = [
    { id: 'DES-1', name: 'Ana Diseño', role: UserRole.DESIGNER, avatar: 'https://i.pravatar.cc/150?u=a' },
    { id: 'DES-2', name: 'Carlos Arte', role: UserRole.DESIGNER, avatar: 'https://i.pravatar.cc/150?u=b' },
    { id: 'EMB-1', name: 'Pedro Hilos', role: UserRole.EMBROIDERER, avatar: 'https://i.pravatar.cc/150?u=c' },
    { id: 'EMB-2', name: 'Maria Bordado', role: UserRole.EMBROIDERER, avatar: 'https://i.pravatar.cc/150?u=d' },
];

export const QUICK_EDITS = [
  "Quitar fondo",
  "Mejorar iluminación", 
  "Estilo retro",
  "Hacer estilo caricatura"
];
