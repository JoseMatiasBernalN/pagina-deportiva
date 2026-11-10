# Sincronización automática de partidos

La función programada `sincronizarPartidos` mantiene los documentos de la colección `partidos` actualizados. Los componentes de partidos en fútbol y baloncesto leen estos documentos desde Firestore en tiempo real; abrir una vista no ejecuta la sincronización ni consulta al proveedor para descargar partidos.

## Fuentes y consumo previsto

- API-Football: una consulta de fixtures para la fecha UTC actual, como máximo cada 55 minutos (aprox. 24 solicitudes al día).
- API Ninjas Basketball: NBA, WNBA, NCAA masculina y NCAA femenina, como máximo cada cinco horas (aprox. 16 solicitudes al día en total).
- API-Football live odds: una consulta central por hora; solo se toma el mercado 1X2 cuando el proveedor incluye una casa y valores válidos.
- API-Football `/odds/live/bets`: catálogo de mercados live guardado una vez al día; los IDs de apuestas prepartido y live no se mezclan.
- API-Football pre-match odds: una consulta cada tres horas para el día siguiente, coincidiendo con la frecuencia recomendada del proveedor.
- API-Basketball pre-match odds: una consulta diaria de partidos y hasta 25 consultas de cuotas por los partidos que se puedan emparejar con seguridad. API-Basketball no documenta `/odds/live`; sus cuotas son prepartido.
- Las cuotas reales guardan casa, mercado, proveedor, hora del proveedor y una vigencia local. Una cuota bloqueada, ausente o vencida se marca no disponible y deja de poder seleccionarse.
- El endpoint live de fútbol puede publicar cambios cada pocos segundos, pero la sincronización consulta como máximo cada hora para controlar el consumo. La cuota mostrada puede tardar hasta unos 70 minutos en renovarse y luego se deshabilita si no se actualiza.
- La programación es cada hora, con una sola instancia. Firestore registra última ejecución, última ejecución exitosa, estado, cantidades y error por proveedor.
- API Ninjas entrega estado de partidos en curso en el plan gratuito, pero el marcador, periodo y reloj en directo requieren plan pago.

## Protección de documentos

- ID determinista: `api_football_<fixtureId>` y `api_basketball_<game_id>`.
- Cada registro conserva `origen: api`, proveedor e ID de origen.
- La función solo actualiza documentos propios que tengan `origen: api` y el mismo proveedor. Si encuentra un documento preexistente manual o de otro origen, lo omite.
- Las escrituras usan merge y solo actualizan campos deportivos recibidos. No se borran documentos y no se modifican campos administrativos ni cuotas.
- Los endpoints de partidos no incluyen cuotas: estas se consultan por separado a los endpoints de odds y solo se guardan cuando el proveedor las devuelve. Los fallos quedan registrados y la tarea programada tiene reintentos acotados.
- Los documentos de API Ninjas se emparejan con API-Basketball únicamente si coinciden los nombres de ambos equipos; si no aparece un ID inequívoco, no se asocia ni se inventa una cuota.
- Las apuestas existentes en `historial_apuestas` nunca se editan. Cada apuesta nueva conserva la cuota, el mercado, el proveedor, la casa y si era DEMO.

## Preparación pendiente para habilitarla

Este repositorio no tenía una carpeta de Cloud Functions ni configuración `firebase.json`; se creó el scaffold, pero no se instaló nada ni se desplegó.

1. Selecciona el proyecto correcto con `firebase use --add` (no se guardó un ID de proyecto porque no estaba configurado en el repositorio).
2. Instala las dependencias de backend: `cd functions` y `npm install`.
3. Configura los secretos con `firebase functions:secrets:set API_FOOTBALL_KEY`, `firebase functions:secrets:set API_NINJAS_KEY` y `firebase functions:secrets:set API_BASKETBALL_KEY`. Introduce las claves en el prompt privado de Firebase CLI; no las pegues en el código ni en archivos versionados. API Ninjas no proporciona cuotas, por eso se usa API-Basketball para esa parte.
4. Verifica la cuota/plan vigente de cada proveedor y el uso real de API Ninjas antes del despliegue.
5. Despliega solo después de autorizarlo: `firebase deploy --only functions:sincronizarPartidos,functions:sincronizarCuotas`.

No se modificaron las reglas de Firestore. Admin SDK escribe desde backend y omite las reglas; los clientes conservan sus permisos actuales.

## Facturación requerida

No se activó facturación ni se desplegó. Firebase exige el plan Blaze para desplegar Cloud Functions; las funciones programadas también dependen de Cloud Scheduler y pueden generar cargos, aunque Cloud Scheduler contempla una asignación mensual gratuita limitada. Antes de activar o desplegar hay que revisar el proyecto de Firebase, el plan, las APIs habilitadas y el presupuesto/alertas de facturación en Google Cloud.
