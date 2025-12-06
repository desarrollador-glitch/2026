# 🎨 Malcriados.app - Sistema de Diseño & Guía de Estilo

Este documento describe los principios visuales, la paleta de colores, la tipografía y el stack tecnológico utilizado en la aplicación **Malcriados Embroidery Manager**.

---

## 🛠 Tech Stack & UI Libraries

*   **Framework:** React 19
*   **Estilos:** Tailwind CSS (v3.4 via CDN)
*   **Iconografía:** Lucide React (`stroke-width={2}`)
*   **Fuente:** Google Fonts (Inter)
*   **IA:** Google GenAI SDK (Gemini 2.5 Flash & Pro)

---

## 🔤 Tipografía

La aplicación utiliza exclusivamente la familia tipográfica **Inter** para garantizar máxima legibilidad en interfaces densas de información.

**Importación:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

**Jerarquía y Pesos:**

| Uso | Tailwind Class | Peso (Weight) | Ejemplo |
| :--- | :--- | :--- | :--- |
| **Títulos Principales** | `text-2xl font-bold` | 700 | Encabezados de Vistas |
| **Subtítulos / Cards** | `text-xl font-bold` | 700 | Nombre del Cliente, Títulos de Banner |
| **Énfasis / Botones** | `font-bold` | 700 | Botones de acción, Estados |
| **Texto Cuerpo** | `text-sm font-normal` | 400 | Descripciones, inputs |
| **Detalles / Metadata** | `text-xs text-gray-500` | 400 | Fechas, SKUs, IDs |

---

## 🎨 Paleta de Colores

La configuración de colores extiende la paleta por defecto de Tailwind. El color primario es **Brand (Emerald/Green)**, evocando naturaleza, calma y aprobación.

### 🟢 Brand Colors (Primario)
Utilizado para acciones principales, bordes activos y estados de éxito.

```javascript
colors: {
  brand: {
    50:  '#ecfdf5', // Fondos muy claros, hover de botones ghost
    100: '#d1fae5', // Fondos de alertas success
    200: '#a7f3d0', // Bordes suaves
    300: '#6ee7b7', // Anillos de foco (Focus Rings)
    400: '#34d399',
    500: '#10b981', // ESTÁNDAR: Botones primarios, Iconos activos
    600: '#059669', // Hover de botones primarios
    700: '#047857', // Texto sobre fondo brand-100
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22', // Texto oscuro de marca
  }
}
```

### 🌈 Colores Semánticos (Estados del Flujo)

El sistema utiliza colores funcionales para denotar la etapa del pedido:

*   **🔵 Azul (Información / IA):**
    *   Uso: Procesamiento de IA, Estado "Bordando" (In Progress).
    *   Clases: `bg-blue-50`, `text-blue-700`.
*   **🟣 Púrpura (Creatividad / Diseño):**
    *   Uso: Etapa de Diseño, Rol de Diseñador, Herramientas de edición.
    *   Clases: `bg-purple-50`, `text-purple-900`, `bg-purple-600` (Botones).
*   **🟡 Ámbar (Precaución / Revisión):**
    *   Uso: Esperando revisión del cliente, alertas no bloqueantes.
    *   Clases: `bg-amber-50`, `text-amber-800`.
*   **🔴 Rojo (Error / Bloqueo):**
    *   Uso: Fotos rechazadas, Incidencias en producción (On Hold).
    *   Clases: `bg-red-50`, `text-red-700`, `border-red-200`.
*   **🟠 Naranja (Logística):**
    *   Uso: Empaque, Despacho, Rol de Bordador.
    *   Clases: `bg-orange-50`, `text-orange-800`.

---

## 🧩 Componentes UI Core

### 1. Cards & Contenedores
*   **Estilo:** Limpio, con sombras suaves y bordes sutiles.
*   **Clases Base:** `bg-white rounded-2xl shadow-sm border border-gray-100`.
*   **Hover:** `hover:shadow-md transition-shadow`.

### 2. Botones
*   **Forma:** Redondeados generosos (`rounded-xl` o `rounded-lg`).
*   **Primario:** `bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200`.
*   **Secundario/Ghost:** `bg-white border border-gray-200 hover:bg-gray-50`.
*   **Interacción:** Efecto de escala leve al click (`active:scale-95`).

### 3. Inputs & Formularios
*   **Base:** `border-gray-200 rounded-lg`.
*   **Focus:** `focus:ring-2 focus:ring-brand-500 focus:border-brand-500`.
*   **Read-Only:** `bg-gray-100 text-gray-900 font-bold border-transparent`.

### 4. Imágenes
*   **Ratio:** Cuadradas (`aspect-square`) para fotos de mascotas.
*   **Bordes:** `rounded-xl`.
*   **Comportamiento:** `object-cover`.

---

## 📐 Layout & Espaciado

*   **Container Principal:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
*   **Separación Vertical:** `space-y-8` entre secciones mayores.
*   **Grid:** Uso extensivo de Grid y Flexbox para layouts responsivos.
    *   Mobile: Columnas únicas.
    *   Desktop: `md:grid-cols-2` o `lg:grid-cols-3`.

---

## ✨ Micro-interacciones

*   **Animaciones:** Uso de `animate-in`, `fade-in`, `zoom-in` para modales y banners.
*   **Pulsos:** `animate-pulse` para estados de carga (IA Analizando) o alertas críticas.
*   **Transiciones:** `transition-all duration-300` para suavizar cambios de estado (hover, focus).

