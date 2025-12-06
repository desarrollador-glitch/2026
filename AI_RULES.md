# 🤖 AI RULES & CODING GUIDELINES - MALCRIADOS.APP

Este archivo contiene las **Reglas Maestras** que debes seguir estrictamente al generar, modificar o refactorizar código en este proyecto.

---

## 🛑 1. REGLAS DE ORO (NO NEGOCIABLES)

1.  **INMUTABILIDAD VISUAL:**
    *   **PROHIBIDO** modificar clases de Tailwind CSS en la carpeta `components/views/` a menos que se solicite explícitamente un rediseño.
    *   La estética está aprobada. Tu trabajo es conectar lógica, no "mejorar" el diseño.
    *   Si necesitas nuevos componentes, consulta `DESIGN_SYSTEM.md` y replica los estilos existentes (colores `brand-*`, fuentes `Inter`, bordes redondeados `rounded-xl`).

2.  **FUENTE DE LA VERDAD:**
    *   Antes de asumir lógica de negocio, LEE `APP_GUIDE.md`. Ahí se explica cómo funcionan los **Packs** y las **Mangas**.
    *   Revisa `types.ts` para entender las entidades antes de crear nuevas interfaces.

3.  **SUPABASE FIRST:**
    *   Estamos migrando de `localStorage` a **Supabase**.
    *   No generes código que dependa de datos locales o mocks para la versión de producción.
    *   Usa **React Query** (`@tanstack/react-query`) para el manejo de estado asíncrono.

---

## 🏗 2. ARQUITECTURA DE DATOS

### Migración de IDs
*   **Frontend:** `groupId` en `OrderItem`.
*   **Backend:** Columna `pack` en tabla `order_items`.
*   **Regla:** Ambos campos representan lo mismo (Agrupación de Packs). Asegúrate de mapearlos correctamente en las consultas.

### Sincronización de Packs
*   **CRÍTICO:** La sincronización de fotos entre items de un mismo Pack (ej: Hoodie + Jockey) **YA ESTÁ RESUELTA EN BASE DE DATOS** mediante un Trigger SQL (`sync_pack_slots`).
*   **Tu Tarea:** En el Frontend, solo debes actualizar el slot específico que el usuario editó. **NO** intentes iterar y actualizar los items hermanos manualmente en JavaScript/React. Deja que la BD haga su trabajo y simplemente invalida la query de React Query para refrescar los datos.

### Gestión de Archivos (Storage)
*   **PROHIBIDO:** Usar Base64 para almacenar imágenes en la base de datos.
*   **MANDATORIO:**
    1.  Subir archivo a Supabase Storage (Bucket `client-uploads`).
    2.  Obtener URL pública.
    3.  Guardar URL en la tabla `embroidery_slots`.

---

## 🎨 3. ESTÁNDARES DE CÓDIGO

### Stack Tecnológico
*   **Framework:** React 19 + Vite.
*   **Lenguaje:** TypeScript (Strict Mode).
*   **Estilos:** Tailwind CSS v3.4.
*   **Iconos:** `lucide-react`.

### Convenciones
*   **Componentes:** Funcionales (Hooks). Evita clases.
*   **Nombres:** PascalCase para componentes (`ClientView.tsx`), camelCase para funciones/variables (`updateSlot`).
*   **Imports:** Ordenados: 1. React, 2. Tipos, 3. Componentes, 4. Iconos/Utils.

### Manejo de Errores
*   Usa bloques `try/catch` en todas las funciones asíncronas.
*   No uses `alert()`. Implementa notificaciones tipo Toast (ej: `sonner` o `react-hot-toast`) para feedback al usuario.

---

## 🧠 4. LÓGICA DE NEGOCIO ESPECÍFICA

### Mangas (Sleeves)
*   Las mangas funcionan con un sistema de **Créditos**.
*   `Créditos Disponibles` = Cantidad de items con SKU `extra-manga`.
*   `Créditos Usados` = Cantidad de items con `sleeve_config` !== null.
*   La UI debe impedir asignar más mangas de las compradas.

### Roles de Usuario
*   No uses un selector de roles simulado.
*   Consulta la tabla `profiles` en Supabase vinculada a `auth.users` para determinar si el usuario es `CLIENT`, `DESIGNER`, `EMBROIDERER` o `ADMIN`.

---

## 🚀 5. FLUJO DE TRABAJO SUGERIDO PARA LA IA

Cuando se te asigne una tarea:
1.  **Analiza:** Lee `AI_RULES.md` y `APP_GUIDE.md`.
2.  **Verifica:** Revisa el esquema SQL en `APP_GUIDE.md` para saber qué columnas existen.
3.  **Planifica:** Describe brevemente qué archivos tocarás.
4.  **Ejecuta:** Escribe el código manteniendo el estilo visual intacto.
5.  **Refina:** Asegura que los tipos de TypeScript coincidan con la DB.