# Diseño: tarjeta analítica única del Inicio Personal

## Propósito

Simplificar el Inicio Personal para que, después del resumen mensual, solo exista una tarjeta analítica principal que permita entender la distribución de ingresos o gastos por categoría. Los movimientos, cuentas y demás tarjetas se consultan desde su navegación propia.

## Alcance

- Aplica únicamente a `/dashboard` en contexto Personal.
- Se conserva el resumen de flujo mensual ya aprobado.
- Se eliminan del Inicio las tarjetas de movimientos recientes, cuentas y lista actual de categorías.
- Se retira la acción `Editar tablero`, pues deja de existir un tablero reordenable u ocultable.
- No cambia Hogar, Firebase, contrato v1, cálculos de dominio, rutas ni permisos.

## Composición

### Tarjeta analítica

- Una única `FinanceCard` ocupa todo el ancho disponible debajo del resumen mensual.
- Título dinámico: `Gastos por categoría` o `Ingresos por categoría`.
- Subtítulo dinámico: `Total gastado en [mes]` o `Total ingresado en [mes]`.
- Selector segmentado accesible en la cabecera: `Gastos` e `Ingresos`; Gastos es el estado inicial y el estado vive solo durante la sesión actual.
- Los datos se ordenan de mayor a menor importe.

### Gráfico

- Escritorio: barras verticales para una lectura comparativa de un vistazo.
- Móvil: barras horizontales para preservar nombres completos, importes y reflow sin scroll horizontal.
- Cada barra representa una categoría y usa el color canónico de esa categoría.
- El importe COP sin decimales y el porcentaje se muestran de forma visible; no dependen de hover ni tooltip.
- Como máximo se muestran seis categorías individuales. Las restantes se agrupan en `Otras`, conservando el total y evitando scroll o etiquetas ilegibles.
- Sin datos, se muestra un estado vacío específico del selector activo dentro de la misma tarjeta.

## Interacción y accesibilidad

- El selector usa controles nativos y expone el estado seleccionado.
- El gráfico no transmite información solo por color: cada barra conserva nombre, monto y porcentaje.
- Las barras tienen descripción accesible con categoría, importe y participación.
- Cualquier animación de barras respeta `prefers-reduced-motion` y no es necesaria para comprender los datos.
- El diseño debe funcionar a 320, 390, 768, 1024 y escritorio ancho sin scroll horizontal.

## Estados y reglas

- Gastos e ingresos se calculan con los datos mensuales existentes; no se alteran las reglas financieras.
- `Otras` aparece solo si hay más de seis categorías con importe positivo.
- Las categorías de importe cero no aparecen como barras.
- En caso de una sola categoría, se muestra una única barra al 100% y se conserva el mismo encabezado y selector.

## Criterios de aceptación

1. El Inicio Personal solo muestra el resumen mensual y la tarjeta analítica principal.
2. El selector cambia Gastos/Ingresos sin cambiar datos ni ruta.
3. La categoría dominante se percibe inmediatamente y todos los valores siguen disponibles.
4. En móvil no hay scroll horizontal ni etiquetas de categoría truncadas de forma que oculten su significado.
5. Hogar y las rutas de movimientos/cuentas no cambian.
