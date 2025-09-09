
# Inventario Invernadero — Dashboard estático

Este repositorio contiene un **dashboard HTML/CSS/JS** listo para subir a GitHub Pages o abrir localmente.
Carga un archivo `data/inventario.csv` (incluido como plantilla) y muestra KPIs, filtros y una tabla.

## Estructura CSV
Columnas esperadas (en este **orden**):

```
codigo,nombre,categoria,unidad,cantidad,ubicacion,proveedor,fecha_ingreso,valor_unitario,estado,observaciones
```

- **estado**: `OK`, `BAJO`, `AGOTADO` (colorea la etiqueta).
- **valor_unitario**: número en CLP (sin $ ni puntos).
- **cantidad**: número.

Puedes importar un CSV distinto con el botón **Importar CSV** o editar `data/inventario.csv`.

## Personalización
- Iconos multicolor son SVG inline.
- Cambia colores en `css/styles.css`.
- Agrega campos extra en `js/app.js` (funciones `toCSV`, `render`, etc.).

---

> Nota: No pude extraer automáticamente los ítems desde la foto adjunta por la baja resolución para OCR. Si subes una foto más nítida o el PDF/Excel original, puedo pre-cargar `inventario.csv` con **todos** los productos y valores.


## Categorías predefinidas y umbrales
- Configura categorías y umbrales en **js/config.js** (`INVENTARIO_CONFIG`).
- Si una fila del CSV trae **minimo**, ese valor manda para ese ítem.
- Si **minimo** está vacío, se usa el umbral de su categoría; si la categoría no está en la lista, se usa `_default`.

### CSV actualizado
```
codigo,nombre,categoria,unidad,cantidad,ubicacion,proveedor,fecha_ingreso,valor_unitario,estado,minimo,observaciones
```
