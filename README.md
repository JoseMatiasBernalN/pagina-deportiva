# PlayExpert — migración a Vue 3 + Vite

Este proyecto reemplaza las 20+ páginas HTML sueltas del PlayExpert
original por una sola app Vue 3 con router y componentes reutilizables.
Cubre completamente: login, registro, mi cuenta, inicio/apuestas en
vivo, depositar, retirar, historial y el panel de administración. Las
páginas de Fútbol, Baloncesto, Jugadores y Juegos quedan como
esqueletos listos para pegar su contenido (ver el comentario dentro de
cada archivo en `src/views/`).

## 1. Paso a paso desde cero (Git Bash)

Abre Git Bash en la carpeta donde quieras tener tus proyectos y ejecuta,
una línea a la vez:

```bash
# 1. Crear la carpeta del proyecto y entrar en ella
mkdir playexpert-vue
cd playexpert-vue

# 2. Verificar que tienes Node.js (necesitas v18 o más reciente)
node -v

# 3. Iniciar un repositorio git
git init
```

Ahora copia dentro de esa carpeta **todos los archivos que te entrego**
(manteniendo la misma estructura de carpetas: `src/`, `src/views/`,
`src/components/`, etc.). Si descargaste el `.zip` que te compartí,
simplemente descomprímelo dentro de `playexpert-vue/`.

```bash
# 4. Instalar las dependencias (Vue, Vue Router, Pinia, Firebase)
npm install

# 5. Copiar tus imágenes y video originales (no los incluí en el zip
#    para no hacerlo pesado). Ajusta la ruta de origen a donde tengas
#    el proyecto original descomprimido:
mkdir -p public/imagenes public/videos
cp -r /ruta/al/proyecto/original/imagenes/* public/imagenes/
cp /ruta/al/proyecto/original/videos/VIDEO.mp4 public/videos/

# 6. Crear tu archivo de variables de entorno real a partir del ejemplo
cp .env.example .env
```

Abre `.env` con un editor de texto y pega ahí los valores de tu
proyecto Firebase (los mismos que tenías repetidos en `firebase.js`,
`iniciosesion.js`, `registro.js`, etc.):

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=disenowed-6eb3b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=disenowed-6eb3b
VITE_FIREBASE_STORAGE_BUCKET=disenowed-6eb3b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=176191941008
VITE_FIREBASE_APP_ID=1:176191941008:web:49dce9b511eb9993ab2b15
```

```bash
# 7. Levantar el servidor de desarrollo
npm run dev
```

Te dará una URL como `http://localhost:5173`. Ábrela en el navegador:
ahí está corriendo tu app Vue.

```bash
# 8. Cuando quieras subirlo a GitHub
git add .
git commit -m "Migración inicial a Vue 3"
git branch -M main
git remote add origin https://github.com/tu-usuario/playexpert-vue.git
git push -u origin main
```

`.env` nunca se sube a git porque está en `.gitignore` — así tu clave
de Firebase no queda pública en el repositorio.

## 2. Aplicar las reglas de seguridad de Firestore

El archivo `firestore.rules` es la corrección de seguridad más
importante de todas (ver resumen abajo). Para activarlo:

1. Entra a la [consola de Firebase](https://console.firebase.google.com) → tu proyecto → **Firestore Database** → pestaña **Reglas**.
2. Pega el contenido de `firestore.rules` reemplazando lo que haya.
3. Clic en **Publicar**.

(Si prefieres hacerlo por línea de comandos: `npm install -g firebase-tools`, `firebase login`, `firebase init firestore` dentro de la carpeta del proyecto, y `firebase deploy --only firestore:rules`.)

## 3. Compilar para producción

```bash
npm run build
```

Esto genera la carpeta `dist/` lista para subir a Firebase Hosting,
Netlify, Vercel, etc.

---

## Resumen de seguridad: qué se encontró y qué se arregló

1. **Saldo manipulable desde el navegador (crítico).** El sitio
   original guardaba `usuario_saldo` en `localStorage` y confiaba en
   ese valor para mostrar y mover dinero. Cualquiera podía abrir la
   consola y escribir `localStorage.setItem('usuario_saldo', '999999999')`.
   → Ahora el saldo vive solo en Firestore y se lee en vivo
   (`onSnapshot`); `firestore.rules` además bloquea que el usuario le
   ponga un valor negativo o absurdamente alto.

2. **Panel de administrador "protegido" solo por localStorage (crítico).**
   `admin.html` dejaba pasar a cualquiera con `sesion_activa === 'true'`,
   y el botón para llegar ahí aparecía según `es_admin` guardado en el
   navegador — ambos editables por el propio usuario. La única barrera
   real dependía de que existieran reglas de Firestore, que no venían
   incluidas en el proyecto.
   → Ahora el router de Vue exige `esStaff` leído en vivo del documento
   de Firestore, y `firestore.rules` prohíbe que un usuario se escriba
   a sí mismo el campo `rol` o `bloqueado`, así que no puede
   autoascenderse a admin ni aunque edite el navegador.

3. **Credenciales de Firebase repetidas en 6 archivos.** La misma
   configuración (`apiKey`, `projectId`...) estaba copiada y pegada en
   `firebase.js`, `iniciosesion.js`, `registro.js`, `pro.js`, `admin.html`.
   No es un secreto crítico (las apiKey de Firebase web están pensadas
   para ser públicas), pero tenerla repetida hace fácil que alguna
   copia quede desactualizada o que termine subida a un repo público
   sin que te des cuenta.
   → Ahora vive en un solo archivo (`src/firebase.js`), leída desde
   `.env`, que está en `.gitignore` y nunca se sube a git.

4. **XSS almacenado en el nombre de usuario (alto).** `pro.js` armaba
   el saludo del menú con `innerHTML` y el nombre que el propio usuario
   escribió al registrarse, sin escaparlo. Alguien podía registrarse
   con un "nombre" que en realidad fuera código JavaScript y que se
   ejecutara en el navegador de otros usuarios que vieran ese nombre.
   → Vue escapa automáticamente todo lo que se muestra con `{{ }}`
   (interpolación de texto), así que ese nombre nunca se interpreta
   como HTML/JS, sin tener que hacer nada manual.

5. **Partidos listados con `innerHTML` en `admin.html` (medio).**
   Mismo problema que el punto anterior, pero con los nombres de los
   equipos. → Reemplazado por `v-for` + `{{ }}` en `Home.vue` y
   `Admin.vue`.

6. **Riesgo pendiente, documentado, no resuelto por completo:**
   Depositar/Retirar siguen escribiendo el saldo directamente desde el
   navegador (aunque ya acotado por las reglas). Para manejar dinero
   real de verdad, lo correcto es mover esa lógica a una **Cloud
   Function** (con el plan Blaze de Firebase) que valide el pago contra
   una pasarela real antes de tocar el saldo, en vez de dejar que el
   cliente lo escriba directamente. Te lo dejo señalado porque,
   al ser un proyecto académico sin pasarela de pago real, no se
   justificaba montar esa infraestructura completa, pero es el
   siguiente paso si esto se vuelve un producto real.

## Qué falta migrar

`Futbol.vue`, `Basquetbol.vue`, `Jugadores.vue`, `Juegos.vue` y
`ApuestasLive.vue` quedaron como esqueletos. Para completarlos, copia
el `<body>` de cada `.html` original dentro del `<template>` del
`.vue` correspondiente, cambiando:
- `imagenes/foto.jpg` → `/imagenes/foto.jpg`
- `<a href="otra.html">` → `<router-link to="/otra">`
- el `<script>` de esa página → lógica dentro de `<script setup>`,
  usando `db` de `../firebase` y `auth` de `../stores/auth` como hacen
  `Home.vue` y `Admin.vue`.
