# PlayExpert Vue — guía de estado y uso para Claude

Documento de traspaso basado en el código actual del proyecto. Debe actualizarse cuando cambie la implementación. No contiene claves ni credenciales.

## Resumen ejecutivo del proyecto

PlayExpert es una aplicación académica de pronósticos deportivos/casino migrada a Vue 3. El proyecto conserva vistas de autenticación, cuenta, deportes, juegos, apuestas, historial y administración. Usa Firebase para autenticación y Firestore. Consume APIs deportivas desde servicios frontend y tiene scaffolding de Cloud Functions que no está desplegado.

La interfaz incluye tarjetas deportivas con gráficos SVG decorativos de cancha, marcadores y animaciones moderadas; apuestas individuales y combinadas en un carrito; y una página informativa de juego responsable. No se debe presentar como casa de apuestas con dinero real: no tiene controles de saldo confiables en servidor, no cuenta con liquidación segura ni cash out.

## Herramientas y tecnologías utilizadas

- **Lenguaje:** JavaScript (ES modules), HTML de plantilla Vue y CSS.
- **Framework:** Vue `^3.4.21`.
- **Bundler y servidor local:** Vite `^5.1.6` (instalado/resuelto como `5.4.21` en la última compilación).
- **Rutas:** Vue Router `^4.6.4`.
- **Estado de sesión:** Pinia `^2.3.1`.
- **Backend como servicio:** Firebase JS SDK `^10.14.1`, Firebase Auth y Cloud Firestore.
- **Código de funciones preparado:** Node.js 22, `firebase-admin ^13.0.0`, `firebase-functions ^6.0.0`.
- **Estilos/visuales:** CSS local, SVG inline para canchas; no se añadieron bibliotecas de gráficos ni motor 3D.
- **Comandos disponibles:** `npm run dev`, `npm run build`, `npm run preview`.
- **No configurado:** Vitest/Jest, Vue Test Utils, ESLint, TypeScript, GitHub Actions.

No hay Chart.js instalado. El panel admin es una vista simple, no un dashboard de estadísticas.

## APIs y fuentes externas utilizadas

1. **API-Football v3** — base `https://v3.football.api-sports.io/`; se usa en `src/services/sportsApi.js` para fixtures live/por fecha/próximos, ligas, equipos, jugadores, eventos, estadísticas y cuotas `/odds` y `/odds/live`.
2. **API-Basketball v1 (API-Sports)** — base `https://v1.basketball.api-sports.io/`; juegos, ligas, equipos, jugadores, standings/estadísticas y `/odds` prepartido. No se implementa cash out; el proveedor no entrega cash out y la disponibilidad de mercados/cuotas depende del partido y del plan.
3. **API Ninjas Basketball** — `https://api.api-ninjas.com/v1`; se utiliza para calendario/datos de básquetbol, equipos, jugadores y standings. Los IDs no son intercambiables con API-Basketball; si se emparejan registros debe hacerse por equipo y hora y, si no hay coincidencia segura, no asociar la cuota.
4. **TheSportsDB** — `src/services/sportsDb.js`, fuente complementaria para metadatos y fotos/escudos cuando existe coincidencia.

Las variables de entorno Vite tienen prefijo `VITE_`, por lo que su contenido puede quedar visible en el bundle del navegador. No guardar valores secretos en Git, documentación, capturas ni commits. Las claves previamente compartidas por chat deben considerarse expuestas y rotarse antes de cualquier publicación.

## Cambios realizados por etapas (según el historial de trabajo)

- Migración existente a Vue 3 + Vite, rutas por vista, componentes compartidos, Auth/Pinia y configuración Firebase centralizada.
- Se añadieron reglas Firestore para restringir rol, bloqueo, acceso staff, datos de usuario, historial y partidos. **Las reglas actuales todavía permiten al dueño actualizar el saldo con restricciones numéricas; no constituyen procesamiento seguro de dinero.**
- Se sustituyeron interacciones de apuesta con prompts/alertas por un carrito lateral en escritorio e inferior en móvil y toasts.
- Se conectaron servicios deportivos y normalizadores para API-Football, API-Basketball, API Ninjas y TheSportsDB. Las respuestas dependen de cobertura, cuota, disponibilidad, red, CORS y credenciales.
- Se preparó código de Cloud Functions para sincronización programada de partidos y cuotas, pero no se desplegó. Un archivo en el repo no significa que esté corriendo en Firebase.
- Se añadieron cuotas frontend de fútbol/básquetbol con cache local en memoria y controles de disponibilidad/expiración; esta consulta directa consume la cuota de API por cada navegador y expone claves `VITE_`.
- El carrito admite individual y combinada. Una combinada solo permite una selección por partido, multiplica las cuotas, guarda un único registro con `selecciones` y `cuotaCombinada`. La escritura del historial y el descuento del saldo siguen siendo pasos separados en cliente.
- Se añadió el cash out deshabilitado en historial; no se inventa una cotización.
- Se mejoraron tarjetas deportivas en `ApiMatchesPanel.vue`: cancha SVG, escudos reales/fallback de iniciales, marcador resaltado, señal live animada y consideración de `prefers-reduced-motion`.
- Se añadió `/juego-responsable` y su enlace en el footer. La página advierte que límites/autoexclusión server-side no están implementados, que no existe un canal especializado integrado y que el producto no está habilitado para dinero real.
- Se preparó este archivo como documentación de traspaso para Claude.

No se han desplegado funciones, activado Blaze, hecho cambios de facturación, aplicado migraciones de datos ni publicado la aplicación desde este trabajo.

## Qué significa “hacer una apuesta” en la implementación actual

El procedimiento se detalla abajo. En código, `ApuestasLive.vue` valida en el navegador saldo, monto mínimo, selección, vigencia/cuota y cambios de precio. Luego crea un documento en `historial_apuestas` y actualiza `usuarios/{uid}.saldo`. La página consulta cuotas directamente y permite la apuesta si Firestore/API han entregado un valor vigente.

Esto **no impide manipulación desde las herramientas del navegador**: el cliente no es autoridad. La aplicación usa saldo demostrativo. No afirmar que una apuesta fue validada de forma segura, que el pago está garantizado o que se liquidará automáticamente.

## Instrucción para continuar el trabajo

Trabaja sobre el proyecto Vue 3 + Vite existente. No reconstruyas ni reorganices la aplicación. Haz cambios localizados, conserva rutas, datos, estilos y funcionalidades existentes. No inventes resultados deportivos, cuotas, soporte, licencias ni integraciones. No cambies reglas de Firestore, billing ni despliegues sin autorización. Antes de afirmar que algo está probado, ejecútalo y describe exactamente el alcance de la prueba.

## Ubicación y ejecución

- Proyecto: `C:\Users\MATIAS\OneDrive\Desktop\proyecto\playexpert-vue`
- Instalar dependencias ya declaradas: `npm install`
- Iniciar localmente: `npm run dev`
- Compilar: `npm run build`
- Variables locales: `.env.local` (no copiar valores secretos a este documento ni al repositorio).

La configuración de Firebase está centralizada en `src/firebase.js`. Las variables Firebase necesarias están descritas en `.env.example`. Las APIs usan `VITE_API_FOOTBALL_KEY`, `VITE_API_BASKETBALL_KEY`, `VITE_API_NINJAS_KEY` y `VITE_THESPORTSDB_KEY`, según el servicio.

## Arquitectura actual

- Vue 3, Vite, Vue Router, Pinia y Firebase JS SDK.
- Rutas y protección básica: `src/router/index.js`; `/admin` requiere sesión y rol staff leído del perfil Firestore.
- Sesión y perfil: `src/stores/auth.js`; escucha Firebase Auth y `usuarios/{uid}`.
- Cliente Firebase: `src/firebase.js`.
- APIs deportivas: `src/services/sportsApi.js` (API-Football y API-Basketball), `src/services/apiNinjasBasketball.js`, `src/services/sportsDb.js`.
- Partidos deportivos: `src/components/ApiMatchesPanel.vue`, utilizado por `src/views/Futbol.vue` y `src/views/Basquetbol.vue`.
- Apuestas: `src/views/ApuestasLive.vue`.
- Vistas principales: `Home.vue`, `Login.vue`, `Registro.vue`, `Cuenta.vue`, `Depositar.vue`, `Retirar.vue`, `Historial.vue`, `Juegos.vue`, `Admin.vue`, `JuegoResponsable.vue`.
- Reglas: `firestore.rules`. Funciones preparadas: `functions/index.js`; su existencia en el repo no significa que estén desplegadas.

## Cómo hacer una apuesta de demostración

1. Ejecuta `npm run dev` y abre la URL local que imprime Vite.
2. Inicia sesión con una cuenta de Firebase existente o regístrate. La cuenta debe tener perfil en `usuarios/{uid}` y saldo disponible.
3. Entra a **Apuestas en Vivo** (`/apuestas-live`). Se cargan documentos de `partidos`; si no hay documentos, la vista intenta consultar partidos directamente a los proveedores configurados.
4. Pulsa **Actualizar cuotas**. Solo se habilitan cuotas devueltas por un proveedor y consideradas vigentes. Si no hay cuota, la selección se mantiene deshabilitada.
5. Pulsa una cuota para añadirla al ticket. Añade otra de un partido distinto para formar una combinada. El código bloquea más de una selección del mismo partido.
6. Introduce un monto entero de al menos **5.000 COP** y confirma. El cliente comprueba saldo, disponibilidad de cada cuota y aceptación de cambios. Se crea un registro en `historial_apuestas` y luego se actualiza `usuarios/{uid}.saldo`.
7. Revisa el resultado en **Mi Cuenta** o **Historial**.

La cuota combinada es el producto de las cuotas de sus selecciones. La ganancia potencial mostrada incluye el monto apostado. Los partidos/mercados que no tengan cuotas reales disponibles no se deben completar con valores inventados.

## Funcionalidades presentes

- Registro e inicio de sesión con Firebase Auth.
- Perfil/saldo observado desde Firestore.
- Vistas de fútbol y básquetbol con consultas directas a proveedores y/o lectura de partidos sincronizados.
- Panel de partidos con escudos cuando el proveedor los entrega, fallback de iniciales y cancha SVG de fútbol/básquetbol.
- Carrito individual y combinado en `ApuestasLive.vue`, notificaciones, aceptación de cambio de cuota y grabación en `historial_apuestas`.
- Página informativa `/juego-responsable`, enlazada en el footer.
- Cash out se mantiene no disponible, porque las APIs conectadas no entregan cotización cash out verificable.
- Se compila con `npm run build`.

## Pendientes y límites importantes

- **No hay pruebas automatizadas, linter, chequeo de tipos ni GitHub Actions.** No instalar herramientas sin autorización.
- El saldo/apuestas siguen siendo procesados por el cliente. Las reglas actuales permiten cambios de saldo por el dueño dentro de límites; esto no equivale a una billetera segura.
- Las funciones de sincronización en `functions/index.js` son código preparado, pero no se han desplegado. La liquidación automática segura, cash out, auditoría, validación de apuesta y autoexclusión desde servidor no están activos.
- El panel `Admin.vue` sigue siendo básico; no tiene gestión de usuarios, gráficos empresariales ni liquidación/auditoría completa.
- No hay límites de depósito ni autoexclusión efectivos. La página responsable advierte expresamente este límite y que el producto no está habilitado para dinero real.
- La lógica de apuestas actual escribe el ticket y el saldo en operaciones separadas, no en una transacción atómica. Fallos de red pueden dejar estados parciales.
- La llamada de APIs desde variables `VITE_` expone las claves en el frontend publicado y cada cliente puede consumir cuota de API.
- El build muestra un aviso de chunk principal superior a 500 KB. No se modificó porque está fuera de los cambios funcionales.
- No se verificaron operaciones reales contra Firebase ni respuesta actual de todas las APIs durante la última compilación.

## Datos y colecciones conocidas

- `usuarios/{uid}`: perfil, rol, bloqueo y saldo.
- `partidos/{id}`: equipos, deporte, estado, marcador, proveedor y, cuando existe, cuota.
- `historial_apuestas/{id}`: movimientos y apuestas. La apuesta nueva conserva usuario, selección, monto, estado, timestamp, cuota y metadatos; la combinada agrega `tipoApuesta`, `selecciones` y `cuotaCombinada`.
- `empresa`, `transacciones_empresa`, `sincronizacion_partidos`: usados por reglas y/o scaffolding de funciones.

No borrar ni migrar registros. No tratar documentos de `sincronizacion_partidos` como prueba de que una función esté desplegada.

## Verificación conocida

La última comprobación de producción fue `npm run build`, que finalizó correctamente. No hay suite automatizada configurada. No se verificaron login, apuestas, saldos, permisos, llamadas API ni diseño responsive en navegador como parte de esa compilación.
