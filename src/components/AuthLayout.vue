<script setup>
defineProps({
  fullScreen: { type: Boolean, default: false }
})
</script>

<template>
  <div :class="['auth-layout', { 'auth-layout--full': fullScreen }]">
    <slot />
  </div>
</template>

<style scoped>
.auth-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: calc(100vh - 100px);
  padding: 2rem;
  background-color: #f4f4f4;
  background-image: url('/jigsaw/jigsaw.svg');
  background-repeat: repeat;
  background-attachment: fixed;
}

.auth-layout--full {
  min-height: 100vh;
}

:deep(.card-registro),
:deep(.card-login) {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  border-radius: 12px;
  background-color: rgba(250, 250, 250, 0.95);
  color: #111;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

:deep(.card-registro h2),
:deep(.card-login h2) {
  margin-bottom: 1rem;
  color: #003366;
  text-align: center;
}

:deep(.card-registro form),
:deep(.card-login form) {
  display: flex;
  flex-direction: column;
}

:deep(.card-registro label),
:deep(.card-login label) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0.5rem 0 0.25rem;
  color: #333;
  font-weight: 600;
}

:deep(.card-registro input),
:deep(.card-login input) {
  width: 100%;
  margin-bottom: 1rem;
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  color: #111;
  font-size: 0.95rem;
}

:deep(.card-registro input:focus),
:deep(.card-login input:focus) {
  border-color: #003366;
  outline: 2px solid #60a5fa;
}

:deep(.card-registro button.btn-submit),
:deep(.card-login button.btn-submit) {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 0;
  border-radius: 8px;
  background: #60a5fa;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

:deep(.card-registro button.btn-submit:hover),
:deep(.card-login button.btn-submit:hover) {
  background: #3b82f6;
  color: #fff;
}

:deep(.card-registro button.btn-submit:disabled),
:deep(.card-login button.btn-submit:disabled) {
  cursor: wait;
  opacity: 0.7;
}

:deep(.card-registro p),
:deep(.card-login p) {
  margin-top: 1rem;
  text-align: center;
}

:deep(.card-registro p a),
:deep(.card-login p a) {
  color: #003366;
  font-weight: 700;
  text-decoration: none;
}

:deep(.card-registro p a:hover),
:deep(.card-login p a:hover) {
  text-decoration: underline;
}

@media (max-width: 600px) {
  .auth-layout {
    min-height: calc(100vh - 72px);
    padding: 1rem;
  }
}
</style>
