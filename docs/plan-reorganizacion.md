# Plan de reorganización de RutaMap (4 etapas)

Objetivo: que la app sea clara, intuitiva y autoexplicativa para alguien nuevo
(comprador o empleado), sin perder ninguna funcionalidad. Se hace una etapa por
vez, se revisa y se ajusta antes de seguir.

Principio: **agrupar por para-qué-sirve**, no por dónde nació el dato. Cambios de
etiquetas y ubicación primero (bajo riesgo), reestructura después.

---

## Etapa 1 — Resolver los nombres que se pisan (bajo riesgo, alta claridad)
**Problema:** hay dos "Análisis" (el del menú principal y el de adentro de
Volúmenes) y tres cosas con "del Día" (Carga / Operación / Análisis) que
confunden.

**Cambios (solo etiquetas, sin mover lógica):**
- Renombrar el sub-tab "Análisis" de Volúmenes para que no choque con "Análisis
  del Día" (ej: "Tablero operativo" o "Panel de paquetes").
- Revisar/renombrar el trío "del Día" si hace falta para dejar clara la
  secuencia (cargar → armar → analizar).

**Riesgo:** mínimo (solo textos). **Reversible:** sí.
**Checkpoint:** ¿los nombres quedan claros y sin ambigüedad?

---

## Etapa 2 — Mover la información al lugar donde se la busca ✅ hecho
**Problema:** hay cosas potentes escondidas y config mezclada con análisis.

**Cambios aplicados:**
- **"Recorridos post-21hs"** salió de Volúmenes → Herramientas y ahora es una
  tercera vista dentro de **Resultados** (Día · Histórico · Recorridos post-21hs),
  que es su mismo dominio de datos.
- En "Herramientas" (Volúmenes) las tarjetas quedaron agrupadas en dos bloques:
  **Reportes y consultas** (KPIs · Historial · Informe del mes) y
  **Configuración** (Plantillas semanales · Feriados), para separar el análisis
  de la parametrización. En Etapa 3 la Configuración migra a un grupo de Ajustes
  en el menú lateral.

**Riesgo:** bajo-medio (se reubican componentes, no se reescriben).
**Checkpoint:** ¿cada cosa quedó donde uno la iría a buscar?

---

## Etapa 3 — Reagrupar el menú principal por función ✅ hecho (opción B)
**Problema:** "Volúmenes" mete 4 apps distintas adentro; "Mi ruta" (rol
conductor) convive con herramientas de gestión.

**Decisión tomada:** opción B (renombrar, no disolver) + secciones colapsables.

**Cambios aplicados:**
- **"Volúmenes" pasó a llamarse "Planificación"** en todos lados (menú, header,
  permisos, paleta de comandos). La ruta y las sub-solapas internas quedan igual.
- El menú lateral ahora está **agrupado en secciones colapsables** (se recuerdan
  abiertas/cerradas entre sesiones):
  - **Operación diaria:** Carga del Día · Planificación
  - **Análisis:** Resultados
  - **Mapa:** Mapa · Pendientes
  - **Campo:** Mi ruta (separada, es otro rol)
  - **Ajustes:** Usuarios · Instalar app
- En modo barra colapsada / pantallas chicas se muestra la lista plana de íconos
  (sin encabezados), como antes.

**Nota:** Feriados y Plantillas quedan por ahora dentro de Planificación →
Herramientas → Configuración (Etapa 2). Como no se disolvió Volúmenes, no subieron
al grupo Ajustes del menú; si más adelante se quiere, se pueden promover.

**Riesgo:** medio (tocó el sidebar). **Reversible:** sí.
**Checkpoint:** ¿el menú se entiende de una sola pasada, sin conocer el negocio?

---

## Etapa 4 — Hacerla autoexplicativa (onboarding y consistencia) 🔄 en curso
**Problema:** hoy hay que saber cómo funciona el negocio para navegarla.

**Cambios:**
- ✅ **Subtítulo en cada sección del menú** (qué es y para qué): debajo de cada
  encabezado del sidebar (Operación diaria, Análisis, Mapa, Campo, Ajustes)
  aparece una línea corta que la explica. Las sub-solapas de Planificación y las
  tarjetas de Herramientas ya tenían su descripción.
- Estados vacíos: la mayoría ya trae una pista de qué hacer; repasar los pocos
  que quedaron sin descripción.
- Pasada de consistencia de íconos y textos.
- (Opcional) una mini guía del flujo diario (Carga del Día → Planificación →
  Resultados) para usuarios nuevos.

**Riesgo:** mínimo. **Checkpoint:** ¿un usuario nuevo entiende sin que le expliquen?

---

## Forma de trabajo
1 etapa → build + deploy → la revisás en producción → ajustamos → siguiente
etapa. Nada se rompe: todo es cambio de nombres/ubicación, la funcionalidad y
los datos quedan intactos.
