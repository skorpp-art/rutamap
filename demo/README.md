# Demo de RutaMap

Datos ficticios para mostrar la app a un cliente nuevo sin exponer nada de la
operación real.

## Estado: la base ya existe y está cargada

Proyecto Supabase **`rutamap-demo`** (`htpukmetvifuoozvhyvj`), región `sa-east-1`.

| | |
|---|---|
| Recorridos | 58 |
| Choferes | 60 |
| Días operados | 52 (últimos 60 días, sin domingos) |
| Días con resultados | 26 |
| Paquetes movidos | 91.001 · promedio 1.750 por día |
| Pendientes | 90 |
| Alternativas | 28 |
| Paquetes especiales | 12 |
| Depósito | 12 clientes · 156 bultos · 64 remitos |

**Usuario:** `demo@rutamap.app` · **contraseña:** `demo1234` · rol maestro (ve todo).

Verificado: el login funciona, la app lee los datos con sesión iniciada y sin
sesión no se ve nada.

## Falta el deploy

El demo **no es otro repositorio**: es el mismo código apuntando a otra base. Hay
que crear un segundo proyecto en Vercel desde el panel, porque conectar GitHub y
definir variables de entorno no se puede hacer por API.

1. Vercel → **Add New** → **Project** → importar `skorpp-art/rutamap`.
2. Nombre: `rutamap-demo`. Rama de producción: `main`.
3. Variables de entorno:

```
NEXT_PUBLIC_SUPABASE_URL=https://htpukmetvifuoozvhyvj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cHVrbWV0dmlmdW9venZoeXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMjc1MjEsImV4cCI6MjEwMTkwMzUyMX0.Z53R0SumlgUJ-vNljLsbgbYwyXz4Ob7s8EdIgUfFjGA
NEXT_PUBLIC_EMPRESA=Logística Pampa
NEXT_PUBLIC_EMPRESA_SIGLA=LP
NEXT_PUBLIC_DEMO=1
```

4. Deploy.

Como sale del mismo repositorio y la misma rama, **el demo se actualiza solo**
cada vez que mejora la app. No hay dos copias del código que mantener.

`NEXT_PUBLIC_EMPRESA` es lo que sale en el membrete de los remitos. En producción
no se define y queda "Logística Hogareño".

`NEXT_PUBLIC_DEMO=1` enciende una franja amarilla fija que avisa que los datos
son ficticios. No se puede cerrar, a propósito: así nadie puede sacar una captura
del demo y hacerla pasar por una operación real.

## Rehacer el demo desde cero

Los scripts se corren **en orden** y **sólo en la base del demo**. Los dos
primeros abortan si detectan datos reales.

| Script | Qué genera |
|---|---|
| `01_catalogos.sql` | Recorridos, choferes, el piso de cada tipo de día y las condiciones especiales |
| `02_operacion.sql` | 60 días de operación: volumen por cliente, recorridos activos, carga de cada chofer e indicadores |
| `03_resultados_y_deposito.sql` | Resultados diarios, pendientes, alternativas, paquetes especiales y el depósito |
| `04_usuario.sql` | La cuenta con la que se entra al demo |

Sirven para dejar el demo prolijo después de una reunión donde el prospecto tocó
todo. El primero borra lo que generó la corrida anterior.

El esquema de la base se clonó desde producción; si en el futuro cambia, hay que
aplicar el mismo cambio acá (los `.sql` de la raíz del repo son la referencia).

## Qué tan ficticio es

- **Clientes y choferes**: inventados. Cualquier parecido con alguien real es
  casualidad.
- **Destinatarios**: nombres inventados, con direcciones armadas como calle real
  del AMBA más una altura al azar. Creíbles para mostrar, pero no corresponden a
  ninguna persona.
- **Teléfonos**: prefijo `11-0000-xxxx`, que no existe. No hay forma de llamar a
  nadie desde el demo.
- **Barrios y localidades**: reales, porque hacen falta para que el mapa y las
  zonas se vean como una operación de verdad. No son dato de nadie.
- **Volúmenes y efectividad**: inventados, con la forma de una operación real —
  lunes pesado por lo que se acumula el fin de semana, martes a viernes parejo,
  sábado a la mitad, domingo sin operación, y la efectividad bajando un poco los
  días de volumen alto (95,3% promedio). Sin eso los gráficos quedan planos y el
  demo se nota falso.

La semilla del azar es fija (`setseed(0.42)`), así que dos corridas dan el mismo
demo: sirve para preparar una presentación sabiendo de antemano qué se va a ver.
