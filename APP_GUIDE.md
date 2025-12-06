# 📘 Guía de Desarrollo - Malcriados.app

## 1. Visión General
**Malcriados Embroidery Manager** es una aplicación web progresiva (PWA) diseñada para gestionar el flujo de trabajo post-venta de una tienda de bordados personalizados de mascotas.

El sistema orquesta la comunicación entre cuatro roles clave: **Cliente, Diseñador, Bordador y Administrador**, transformando una orden de Shopify en un producto físico entregado.

---

## 2. Arquitectura Técnica

### Stack Tecnológico
*   **Frontend:** React 19 (Hooks, Context pattern).
*   **Estilos:** Tailwind CSS v3.4.
*   **Iconografía:** Lucide React.
*   **Inteligencia Artificial:** Google Gemini API (`gemini-2.5-flash` para análisis JSON, `gemini-2.5-flash-image` para edición).
*   **Backend:** Supabase (PostgreSQL + Storage).
*   **Ingesta de Datos:** n8n (Workflow automation desde Shopify).

### Estructura de Directorios
```
/src
  /components
    /views          # Vistas principales por Rol (Client, Designer, Production, Admin)
    GarmentVisualizer.tsx # Selector de posición lineal (Grid)
    SleeveDesigner.tsx    # Configurador de mangas
    StatusBadge.tsx       # Etiquetas de estado
    PawModal.tsx          # Modal de confirmación de fotos
  /hooks
    useOrderSystem.ts # 🧠 CEREBRO DE LA APP (Lógica de Negocio, Sync de Packs, CRUD)
  /services
    geminiService.ts  # Integración con Google AI
  types.ts            # Definiciones de Entidades
  constants.ts        # Data Mock y Constantes (Fuentes, Iconos)
```

---

## 3. Arquitectura de Datos & Ingesta (n8n -> Supabase)

La aplicación depende de que los datos de Shopify se transformen correctamente al esquema relacional de Supabase.

### A. Mapeo de Tablas (Schema Definition)

#### 1. Tabla `orders`
Representa la cabecera del pedido.
*   `id`: UUID (Generado por sistema o derivado de Shopify ID).
*   `shopify_order_id`: Text (Mapear desde `$json.id`).
*   `status`: Text (Default: 'PENDING_UPLOAD').
*   `total_amount`: Numeric **(CRÍTICO PARA DASHBOARD)** -> Mapear desde `$json.current_total_price`.
*   `customer_name`: Text.
*   `email`: Text.

#### 2. Tabla `order_items`
Representa las prendas físicas.
*   `sku`: Text.
*   `product_name`: Text.
*   `quantity`: Integer.
*   `price`: Numeric **(CRÍTICO)** -> Mapear desde `$json.price` (Line Item).
*   `pack`: Text (Nullable). **Lógica Bundle:** Si el producto viene de un bundle (ej: `_flyBundles`), este campo debe contener el ID del bundle (ej: `VOL-844799`).
    *   *Uso en App:* Si dos items tienen el mismo `pack`, comparten la foto de la mascota.
*   `sleeve_config`: JSONB (Nullable). Inicialmente `NULL`.

#### 3. Tabla `embroidery_slots`
Representa los espacios para bordar (Retratos).
*   Generación en n8n: Se deben crear `N` filas por cada `order_item`, donde `N` = Cantidad de retratos del SKU.
*   `status`: Default 'EMPTY'.
*   `pet_name`: Nullable.
*   `photo_url`: Nullable.

### B. Flujo de Trabajo n8n (Workflow Logic)

1.  **Trigger:** `Shopify Trigger (orders/create)`.
2.  **Filtrado:** Procesar solo órdenes `paid`.
3.  **Extracción de Pack:**
    *   Script JS debe iterar `line_items[].properties`.
    *   Buscar propiedad que empiece con `VOL-` o `_flyBundles`.
    *   Asignar ese valor a la columna `pack` en `order_items`.
4.  **Generación de Slots:**
    *   Consultar tabla auxiliar `product_skus` para saber cuántos retratos tiene cada SKU.
    *   Insertar filas en `embroidery_slots` vinculadas al `order_item_id`.

---

## 4. Lógica de Negocio Compleja

### A. Packs (Sincronización Automática)
Cuando el cliente sube una foto en la App:
1.  El sistema verifica si el item tiene un `pack` (groupId).
2.  Si existe, busca "hermanos" con el mismo `pack`.
3.  Replica la foto, el nombre y el estado de IA a los slots correspondientes de los hermanos.
4.  *Resultado:* El cliente carga la foto 1 vez, se aplica a Hoodie + Jockey.

### B. Mangas (Sistema de Créditos)
1.  **Detección:** El sistema cuenta cuántos items tienen SKU `extra-manga`. Esto define los "Créditos Totales".
2.  **Consumo:** El sistema cuenta cuántos items tienen `sleeve_config` no nulo. Esto define "Créditos Usados".
3.  **UI:** Muestra banner "Tienes X créditos disponibles" y permite asignar/quitar mangas dinámicamente.

---

## 5. Integración con Inteligencia Artificial

La IA actúa como un "Control de Calidad" automático en la entrada.

1.  **Análisis (`analyzeImageQuality`):**
    *   Modelo: `gemini-2.5-flash`.
    *   Input: Base64 de la imagen.
    *   Output: JSON estricto `{ approved: boolean, reason: string }`.
    *   Reglas: Nitidez, Iluminación, Obstrucciones.

2.  **Edición (`editImageWithPrompt`):**
    *   Modelo: `gemini-2.5-flash-image`.
    *   Función: Permite al cliente intentar salvar una foto regular mediante instrucciones de texto natural.

---

## 6. Estados del Pedido (State Machine)

El campo `status` en la orden gobierna la visibilidad y permisos:

1.  `PENDING_UPLOAD`: Estado inicial. Cliente debe actuar.
2.  `ANALYZING_IMAGE`: IA procesando (Spinner).
3.  `ACTION_REQUIRED`: IA rechazó foto. Cliente debe reintentar.
4.  `WAITING_FOR_DESIGN`: Todo ok. En cola del diseñador.
5.  `DESIGN_REVIEW`: Diseñador entregó. Cliente revisa propuesta.
6.  `DESIGN_REJECTED`: Cliente pidió cambios. Vuelve al diseñador.
7.  `READY_TO_EMBROIDER`: Aprobado. Visible para Bordador.
8.  `IN_PROGRESS`: En máquina.
9.  `ON_HOLD`: Problema crítico en taller.
10. `READY_FOR_DISPATCH`: Bordado listo, falta empaquetar.
11. `DISPATCHED`: Ciclo cerrado.

---

## 7. ANEXO: Script SQL de Producción (Supabase)

Ejecutar este script en el SQL Editor de Supabase para configurar la base de datos final con soporte para Packs, Mangas y Roles.

```sql
-- 1. PERFILES Y ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  role text DEFAULT 'CLIENT' CHECK (role IN ('CLIENT', 'DESIGNER', 'EMBROIDERER', 'ADMIN')),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Trigger para creación automática de perfil
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'CLIENT');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. MODIFICACIÓN DE TABLAS (Schema Migration)
-- Asegurar soporte para Dashboard Admin y Mangas
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'CLP';

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sleeve_config jsonb DEFAULT NULL; 
-- Nota: La columna 'pack' debe existir en order_items (Text)

ALTER TABLE public.embroidery_slots
DROP COLUMN IF EXISTS icon_id,
DROP COLUMN IF EXISTS font_style;

ALTER TABLE public.embroidery_slots
ADD CONSTRAINT check_slot_status 
CHECK (status IN ('EMPTY', 'ANALYZING', 'APPROVED', 'REJECTED'));

-- 3. TRIGGER DE SINCRONIZACIÓN DE PACKS
-- Mantiene sincronizadas las fotos entre items del mismo pack
CREATE OR REPLACE FUNCTION sync_pack_slots()
RETURNS TRIGGER AS $$
DECLARE
    parent_item_pack_id text;
    parent_order_id text;
BEGIN
    SELECT pack, order_id INTO parent_item_pack_id, parent_order_id
    FROM public.order_items
    WHERE id = NEW.order_item_id;

    IF parent_item_pack_id IS NOT NULL THEN
        UPDATE public.embroidery_slots s
        SET 
            photo_url = NEW.photo_url,
            pet_name = NEW.pet_name,
            include_halo = NEW.include_halo,
            status = NEW.status,
            ai_reason = NEW.ai_reason
        FROM public.order_items oi
        WHERE s.order_item_id = oi.id
          AND oi.order_id = parent_order_id
          AND oi.pack = parent_item_pack_id
          AND oi.id != NEW.order_item_id
          AND s.photo_url IS NULL; 
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_pack_slots ON public.embroidery_slots;
CREATE TRIGGER trigger_sync_pack_slots
AFTER UPDATE OF photo_url, status ON public.embroidery_slots
FOR EACH ROW
EXECUTE FUNCTION sync_pack_slots();

-- 4. POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embroidery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view own orders" ON public.orders
FOR SELECT USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Staff view all orders" ON public.orders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'DESIGNER', 'EMBROIDERER')
  )
);
```