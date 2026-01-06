export enum UserRole {
  CLIENT = 'CLIENT',
  DESIGNER = 'DESIGNER',
  EMBROIDERER = 'EMBROIDERER',
  PACKER = 'PACKER',
  ADMIN = 'ADMIN'
}

export enum OrderStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD', // Cliente debe completar info/fotos
  ANALYZING_IMAGE = 'ANALYZING_IMAGE', // IA revisando
  ACTION_REQUIRED = 'ACTION_REQUIRED', // Alguna foto rechazada
  WAITING_FOR_DESIGN = 'WAITING_FOR_DESIGN', // Todo aprobado, esperando diseñador
  DESIGN_REVIEW = 'DESIGN_REVIEW', // Diseñador subió, cliente revisa
  DESIGN_REJECTED = 'DESIGN_REJECTED', // Cliente rechazó diseño
  READY_TO_EMBROIDER = 'READY_TO_EMBROIDER', // Aprobado, listo para bordar
  IN_PROGRESS = 'IN_PROGRESS', // Bordando
  ON_HOLD = 'ON_HOLD', // DETENIDO POR INCIDENCIA
  READY_FOR_DISPATCH = 'READY_FOR_DISPATCH', // Terminado, esperando foto y empaque
  DISPATCHED = 'DISPATCHED' // Enviado
}

export type EmbroideryPosition =
  | 'CENTER'
  | 'LEFT_CHEST'
  | 'RIGHT_CHEST'
  | 'SLEEVE_LEFT'
  | 'SLEEVE_RIGHT'
  | 'BACK_NECK'
  | 'CENTER_LEFT'
  | 'CENTER_RIGHT'
  | 'FAR_LEFT'
  | 'FAR_RIGHT';

export type GarmentType = 'HOODIE' | 'CREWNECK' | 'TSHIRT' | 'CAP';

// --- SLEEVE CONFIGURATION TYPES ---
export type SleeveFont = 'TIMES' | 'ARIAL_ROUNDED' | 'COMIC' | 'COLLEGE' | 'CAIRO' | 'ALTHE';
export type SleeveIcon = 'PAW' | 'STAR' | 'BONE' | 'HEART' | 'CROWN' | 'NONE';

export interface SleeveConfig {
  text: string;
  font: SleeveFont;
  icon: SleeveIcon;
}
// ----------------------------------

export interface EmbroiderySlot {
  id: string; // Unique ID for this specific pet slot
  petName?: string; // Optional, user can input
  photoUrl?: string; // Base64 (Local) -> Mapped to 'photo_url' in Supabase Storage
  position?: EmbroideryPosition;
  includeHalo: boolean; // ¿Tiene aureola?

  // AI Status specific to this photo
  status: 'EMPTY' | 'ANALYZING' | 'APPROVED' | 'REJECTED';
  aiReason?: string;
  createdAt?: string; // Used for deterministic sorting in packs

  // NEW WIZARD FIELDS
  fontId?: string; // e.g. 'CAIRO', 'ALTHE'
  wizardStep: number; // 1, 2, 3
  sleeveIconId?: string; // Optional icon for this specific pet/manga
  includeName?: boolean; // NEW: Should the name be included in the embroidery?
}

export interface OrderItem {
  id: string;
  groupId?: string; // Mapped to DB column 'pack'. Used to sync photos across items.
  sku: string;
  productName: string; // e.g. "Hoodie con 2 regalones"
  quantity: number;
  price?: number; // Analytics (DB: unit_price)

  // Product Attributes
  garmentType?: string; // Mapped to DB 'prenda'
  color?: string;       // Mapped to DB 'color'
  size?: string;        // Mapped to DB 'talla'

  customizationType?: 'PORTRAIT' | 'TEXT_ONLY'; // Mapped to DB column 'customization_type'
  customizations: EmbroiderySlot[]; // If product has 2 pets, this array has 2 entries

  // Optional Sleeve Configuration (If assigned)
  sleeve?: SleeveConfig; // Mapped to DB column 'sleeve_config' (JSONB)

  // NEW CUSTOMIZATION CATEGORY
  customizationCategory?: 'COLOR' | 'COLLEGE' | 'GRANDE' | 'LINEAL';

  // Design Fields (Per item)
  designImage?: string;
  technicalSheet?: string;
  machineFile?: string;
  designHistory?: DesignVersion[];
  designFeedback?: string;
  designStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface DesignVersion {
  imageUrl: string;
  technicalSheet?: string; // Snapshot of the sheet for this version
  machineFile?: string;    // Snapshot of the machine file for this version
  createdAt: string;
  feedback?: string;
}

export interface Order {
  id: string;
  customerId?: string; // Link to registered customer
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  orderDate: string;
  status: OrderStatus;

  totalAmount?: number; // Analytics: Total order value (DB: total_amount)
  items: OrderItem[];

  // Staff Assignment
  assignedDesignerId?: string;
  assignedEmbroidererId?: string;

  // Design Level
  designImage?: string;
  designHistory?: DesignVersion[]; // Historial de versiones anteriores

  // Production Files (Uploaded by Designer at same time as designImage)
  technicalSheet?: string;
  machineFile?: string;

  // Production Evidence
  productionIssue?: string; // Razón de la incidencia (si está ON_HOLD)
  finishedProductPhoto?: string; // Foto del bordado terminado
  packedProductPhoto?: string;   // Foto del paquete cerrado

  // Feedback
  clientFeedback?: string;

  // Mockup
  generatedMockup?: string;
}

export interface Placement {
  position: EmbroideryPosition;
  label?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

export interface Customer {
  id: string;
  email: string;
  customerName: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSession {
  customerId: string;
  email: string;
  customerName: string;
}