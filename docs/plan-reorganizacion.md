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

## Etapa 2 — Mover la información al lugar donde se la busca
**Problema:** hay cosas potentes escondidas y config mezclada con análisis.

**Cambios:**
- Mover **"Recorridos post-21hs"** de Volúmenes → Herramientas hacia **Análisis
  del Día** (mismo dominio de datos).
- Sacar **Feriados** y **Plantillas semanales** de "Herramientas" (son
  configuración, no herramientas) hacia un futuro grupo de Ajustes.
- Dejar "Herramientas" solo con lo que realmente es reporte/consulta (o
  disolverla, ver Etapa 3).

**Riesgo:** bajo-medio (se reubican componentes, no se reescriben).
**Checkpoint:** ¿cada cosa quedó donde uno la iría a buscar?

---

## Etapa 3 — Reagrupar el menú principal por función
**Problema:** "Volúmenes" mete 4 apps distintas adentro; "Mi ruta" (rol
conductor) convive con herramientas de gestión.

**Cambios (propuesta a validar en su momento):**
- Reagrupar el menú lateral en secciones lógicas:
  - **Operación diaria:** Carga del Día · Operación del Día
  - **Análisis / Reportes:** Análisis del Día (+ post-21hs) · Historial · Informe mensual · KPIs
  - **Planificación:** Proyección
  - **Mapa:** Mapa · Pendientes
  - **Campo (conductor):** Mi ruta (separada visualmente, es otro rol)
  - **Ajustes:** Usuarios · Feriados · Plantillas · Instalar app
- Renombrar "Volúmenes" a algo que comunique (ej: "Planificación").

**Riesgo:** medio (toca el sidebar y el ruteo). **Reversible:** sí, con cuidado.
**Checkpoint:** ¿el menú se entiende de una sola pasada, sin conocer el negocio?

---

## Etapa 4 — Hacerla autoexplicativa (onboarding y consistencia)
**Problema:** hoy hay que saber cómo funciona el negocio para navegarla.

**Cambios:**
- Descripción corta / subtítulo en cada sección y sub-solapa (qué es y para qué).
- Mejores estados vacíos con una pista de qué hacer.
- Pasada de consistencia de íconos y textos.
- (Opcional) una mini guía del flujo diario para usuarios nuevos.

**Riesgo:** mínimo. **Checkpoint:** ¿un usuario nuevo entiende sin que le expliquen?

---

## Forma de trabajo
1 etapa → build + deploy → la revisás en producción → ajustamos → siguiente
etapa. Nada se rompe: todo es cambio de nombres/ubicación, la funcionalidad y
los datos quedan intactos.
