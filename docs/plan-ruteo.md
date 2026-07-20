# Plan — Ruteo para conductores (MVP → optimización)

## Objetivo
Que un conductor (sobre todo los nuevos) cargue sus direcciones en la app, vea
cuáles caen dentro de su recorrido, la app le ordene las paradas de forma
conveniente y le pase la ruta a Google Maps / Waze para navegar.

**No se construye navegación propia** (GPS turn-by-turn): eso lo hace Google/Waze.

## Qué ya existe y se reutiliza
- Geocodificación de direcciones (Nominatim) — `BuscadorDireccion`.
- Point-in-polygon dirección → recorrido (`turf.booleanPointInPolygon`) — ya calcula
  a qué recorrido pertenece un punto.
- Mapa Leaflet + pin (`MarcadorDireccion`).
- Supabase (auth, RPC con `es_editor`), match por código con Carga del Día.

## Modelo de datos (nuevo)
Tabla `ruta_conductor` (o `paradas_ruta`):
- `id`, `fecha`, `conductor` (o `perfil_id`), `recorrido_codigo` (opcional),
- `orden` (int, para el orden final),
- `direccion_texto`, `lat`, `lon`,
- `dentro_recorrido` (bool), `recorrido_detectado` (codigo),
- `estado` (pendiente / entregado), `creado_en`.

RPCs: `agregar_parada`, `get_ruta(fecha, conductor)`, `reordenar_ruta`,
`eliminar_parada`, `limpiar_ruta`. Todas con chequeo de sesión.

---

## Etapas

### Etapa 1 — Cargar y guardar direcciones (base del MVP)
- Pantalla nueva "Mi ruta" (o dentro del mapa).
- Input de dirección → geocodifica (Nominatim) → muestra el pin → **confirmar** →
  guarda la parada en la tabla.
- Lista de paradas cargadas con opción de borrar / reordenar a mano.
- **Entregable**: el conductor arma su lista de direcciones y queda guardada.
- Esfuerzo: **medio** (pantalla + tabla + acciones).

### Etapa 2 — "¿Me queda dentro del recorrido?"
- Al guardar cada dirección, correr el point-in-polygon contra el área del
  recorrido del conductor (match por código con Carga del Día, ya disponible).
- Indicador por parada: 🟢 dentro / 🔴 fuera (con qué recorrido cae si es de otro).
- **Entregable**: el conductor nuevo ve al instante si una parada no le corresponde.
- Esfuerzo: **bajo** (lógica ya hecha, se reubica).

### Etapa 3 — Dictado por voz (opcional, mejora de carga)
- Web Speech API (gratis, Chrome/celular): botón de micrófono → transcribe la
  dirección al input → el conductor confirma antes de geocodificar.
- **Ojo**: el dictado se equivoca con calles/números → confirmación obligatoria.
- Esfuerzo: **bajo-medio**.

### Etapa 4 — Ordenar la ruta (Nivel 1, gratis)
- Algoritmo vecino-más-cercano + mejora 2-opt sobre distancia en línea recta
  (haversine). Corre al instante, sin depender de nadie, $0.
- Botón "Optimizar orden" → reordena las paradas y actualiza `orden`.
- Bueno para ~10-40 paradas. Limitación: no conoce calles reales (ríos,
  autopistas, mano única).
- **Entregable**: la app propone un orden conveniente automáticamente.
- Esfuerzo: **bajo** (algoritmo conocido, ~1 función).

### Etapa 5 — Pasar a Google Maps / Waze
- **Google Maps** (multi-parada): `https://www.google.com/maps/dir/?api=1&travelmode=driving&waypoints=lat,lon|lat,lon|...&destination=última`.
- **Waze** (una parada por vez): `https://waze.com/ul?ll=lat,lon&navigate=yes` para
  "ir a la próxima".
- Botón "Abrir en Google Maps" con las paradas en el orden calculado.
- Esfuerzo: **bajo**.

### Etapa 6 — Distancias reales de calle (Nivel 2, futuro/opcional)
- Reemplazar la distancia en línea recta por distancias/tiempos reales de manejo
  (matriz OSRM auto-hospedado = gratis pero más infra; o Google/Mapbox = pago).
- Mismo algoritmo, mejor calidad de orden. Ideal si el Nivel 1 se queda corto.
- Esfuerzo: **alto** (infraestructura o costo por uso).

---

## Consideraciones y riesgos
- **Geocodificación (mayor riesgo de calidad)**: Nominatim a veces falla con la
  altura exacta en el conurbano. Mitigación: confirmación visual del pin, y opción
  de mover el pin a mano; si no alcanza, migrar solo esa pieza a Google (pago).
- **Waze no hace multi-parada por link** → Google Maps es el camino para la ruta
  completa.
- **Escala**: pensado para pocas decenas de paradas por conductor. Cientos de
  paradas, ventanas horarias o múltiples vehículos = VRP, otro nivel (API paga).
- **Permisos**: cada conductor ve/edita solo su propia ruta del día.

## Costos
- MVP (Etapas 1-5): **$0** — Nominatim + heurística propia + handoff a Google Maps.
- Nivel 2 (Etapa 6): costo por uso (Google/Mapbox) o infra propia (OSRM).

## Orden sugerido de implementación
1. Etapa 1 (cargar/guardar) → 2 (dentro/fuera) → 5 (link Google Maps): ya es un MVP usable.
2. Etapa 4 (ordenar) — el "ruteo" automático.
3. Etapa 3 (voz) — comodidad.
4. Etapa 6 (distancias reales) — solo si hace falta más precisión.
