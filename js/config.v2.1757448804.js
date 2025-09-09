
// Configuración de categorías y umbrales de stock bajo por categoría.
// Si el ítem no tiene "minimo" definido en el CSV, se usa este umbral por categoría.
window.INVENTARIO_CONFIG = {
  categorias: [
    "Riego",
    "Sustratos",
    "Fertilizantes",
    "Herramientas",
    "Semillas",
    "Seguridad",
    "Eléctrico",
    "Mobiliario",
    "Insumos generales",
    "Repuestos"
  ],
  umbrales: {
    "Riego": 5,
    "Sustratos": 10,
    "Fertilizantes": 5,
    "Herramientas": 2,
    "Semillas": 100,   // sobres/unidades
    "Seguridad": 5,
    "Eléctrico": 5,
    "Mobiliario": 1,
    "Insumos generales": 10,
    "Repuestos": 3,
    "_default": 5
  }
};
