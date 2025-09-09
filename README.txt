# Invernadero Panel — Profesores/Cursos/Proyectos + Asignaciones

Este paquete añade:
- **Campos** Profesor, Curso y Proyecto en ítems.
- **Módulo de Asignaciones/Movimientos**: Consumo/Salida (resta stock), Devolución/Entrada (suma stock) y Reserva (no afecta stock).
- **Lista de asignaciones** con búsqueda y **Exportar CSV**.
- **Botones multicolor con íconos** estilo portafolio unificado.
- Todo corre con `localStorage` (sin bloquear el ingreso de ítems).

## CSV Ítems
Encabezado:
```
codigo,nombre,categoria,profesor,curso,proyecto,unidad,cantidad,ubicacion,proveedor,valorUnitario,estado,fecha,obs
```

## CSV Asignaciones
Encabezado:
```
fecha,tipo,codigo,nombre,cantidad,profesor,curso,proyecto,obs,afecta
```

## Uso
1. `Añadir ítem` para crear o editar productos/insumos.
2. Botón **Asignaciones** (o el icono 🔗 por fila) para registrar movimientos.
3. En el modal de movimientos puedes ver la **lista** y exportar CSV.
