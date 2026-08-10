# Demo de RutaMap

Datos ficticios para mostrar la app a un cliente nuevo sin exponer nada de la
operación real.

## Cómo se monta

El demo **no es otro repositorio**: es el mismo código apuntando a otra base.

1. **Base propia** — un proyecto Supabase aparte (`rutamap-demo`), con el
   esquema de RutaMap: `schema.sql`, `plantilla_operacion.sql`,
   `pendientes_retenido.sql`, `choferes_por_ruta.sql` y `deposito_esquema.sql`.
2. **Datos ficticios** — los tres scripts de esta carpeta, en orden.
3. **Deploy propio** — un segundo proyecto en Vercel desde este mismo
   repositorio y la misma rama, cambiando sólo las variables de entorno. Así el
   demo se actualiza solo cada vez que mejora la app, sin mantener dos copias
   del código.

### Variables de entorno del demo

    NEXT_PUBLIC_SUPABASE_URL=<url del proyecto rutamap-demo>
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave del proyecto rutamap-demo>
    NEXT_PUBLIC_EMPRESA=Logística Pampa
    NEXT_PUBLIC_EMPRESA_SIGLA=LP

`NEXT_PUBLIC_EMPRESA` es lo que sale en el membrete de los remitos y documentos
impresos. En producción no se define y queda "Logística Hogareño".

## Los scripts

Se corren **en orden** y **sólo en la base del demo**. Cada uno tiene un freno:
si detecta datos reales, aborta sin tocar nada.

| Script | Qué genera |
|---|---|
| `01_catalogos.sql` | 57 recorridos, 60 choferes, el piso de cada tipo de día y las condiciones especiales |
| `02_operacion.sql` | 60 días de operación: volumen por cliente, recorridos activos, carga de cada chofer e indicadores |
| `03_resultados_y_deposito.sql` | Resultados diarios, pendientes, alternativas, paquetes especiales y el módulo de depósito |

Son idempotentes: se pueden volver a correr para dejar el demo prolijo después
de una reunión donde el prospecto tocó todo.

## Qué tan ficticio es

- **Clientes y choferes**: inventados. Cualquier parecido con alguien real es
  casualidad.
- **Destinatarios**: nombres inventados, con direcciones armadas como calle real
  del AMBA más una altura al azar. Son creíbles para mostrar, pero no
  corresponden a ninguna persona.
- **Teléfonos**: prefijo `11-0000-xxxx`, que no existe. No hay forma de llamar a
  nadie desde el demo.
- **Barrios y localidades**: reales, porque hacen falta para que el mapa y las
  zonas se vean como una operación de verdad. No son dato de nadie.
- **Volúmenes y efectividad**: inventados, pero con la forma de una operación
  real — el lunes pesado por lo que se acumula el fin de semana, martes a
  viernes parejo, el sábado a la mitad, domingo sin operación, y la efectividad
  bajando un poco los días de volumen alto. Sin eso los gráficos quedan planos y
  el demo se nota falso.

La semilla del azar es fija (`setseed(0.42)`), así que dos corridas dan el mismo
demo: sirve para preparar una presentación y saber de antemano qué se va a ver.

## Estado

Los scripts están escritos y revisados contra el esquema real: se verificó que
todas las columnas existan y que los valores respeten las restricciones de la
base (turnos, estados de alternativas, estados de recepción). **Falta correrlos
una vez** contra el proyecto del demo, que todavía no existe por el límite de
proyectos gratis de Supabase.
