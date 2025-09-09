# Invernadero Panel — Profesores/Cursos/Proyectos

Este paquete añade **asignación de Profesor, Curso y Proyecto** a cada ítem del inventario,
incluye filtros y búsqueda por esos campos, y mantiene la compatibilidad de **Importar/Exportar CSV**.

## Archivos
- `index.html` — UI con botones multicolor y modal de edición.
- `css/styles.css` — Estilos (tema oscuro, botones con gradientes).
- `js/app.js` — Lógica con `localStorage`.

## CSV
Se agregan nuevas columnas: `profesor, curso, proyecto`.
El export incluye el siguiente encabezado:
```
codigo,nombre,categoria,profesor,curso,proyecto,unidad,cantidad,ubicacion,proveedor,valorUnitario,estado,fecha,obs
```

## Cómo usar
1. Abre `index.html` en el navegador o súbelo a GitHub Pages.
2. Usa **Añadir ítem** para crear registros con profesor/curso/proyecto.
3. Filtra y busca por cualquiera de esos campos.
4. Importa CSV con el encabezado anterior para cargar datos existentes.
