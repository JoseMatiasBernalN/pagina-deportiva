// 1. VALIDACIÓN INMEDIATA (Redirige antes de mostrar nada si no hay sesión)
const sesionActiva = localStorage.getItem('sesion_activa');

if (!sesionActiva) {
  alert('Acceso restringido: Debes iniciar sesión o registrarte primero.');
  window.location.href = 'registro.html';
}

// 2. CARGA DE DATOS E INTERACTIVIDAD
document.addEventListener('DOMContentLoaded', function() {
  const nombre = localStorage.getItem('usuario_nombre') || 'No disponible';
  const correo = localStorage.getItem('usuario_correo') || 'No disponible';
  const cedula = localStorage.getItem('usuario_cedula') || 'No disponible';
  const expedicion = localStorage.getItem('usuario_expedicion') || 'No disponible';
  const nacimiento = localStorage.getItem('usuario_nacimiento') || 'No disponible';
  const telefono = localStorage.getItem('usuario_telefono') || 'No disponible';
  const ciudad = localStorage.getItem('usuario_ciudad') || 'No disponible';
  const saldo = localStorage.getItem('usuario_saldo') || '0';

  // Renderizar valores en pantalla
  document.getElementById('mostrar_nombre').textContent = nombre;
  document.getElementById('mostrar_correo').textContent = correo;
  document.getElementById('mostrar_cedula').textContent = cedula;
  document.getElementById('mostrar_expedicion').textContent = expedicion;
  document.getElementById('mostrar_nacimiento').textContent = nacimiento;
  document.getElementById('mostrar_telefono').textContent = telefono;
  document.getElementById('mostrar_ciudad').textContent = ciudad;
  
  // Formatear saldo a COP
  const saldoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(saldo);
  document.getElementById('mostrar_saldo').textContent = saldoFormateado;

  // Evento Cierre de Sesión
  document.getElementById('btn_cerrar_sesion').addEventListener('click', function() {
    localStorage.removeItem('sesion_activa');
    alert('Has cerrado sesión correctamente.');
    window.location.href = 'inicio.html';
  });
});
// --- Inserción dinámica de botón Admin en cuenta.js ---
document.addEventListener('DOMContentLoaded', function() {
  const esAdmin = localStorage.getItem('es_admin');

  if (esAdmin === 'true') {
    const tarjetaRegistro = document.querySelector('.card-registro');
    
    if (tarjetaRegistro) {
      const enlaceAdmin = document.createElement('a');
      enlaceAdmin.href = 'admin.html';
      enlaceAdmin.className = 'btn-submit';
      enlaceAdmin.style.backgroundColor = '#9333ea';
      enlaceAdmin.style.marginTop = '10px';
      enlaceAdmin.style.textDecoration = 'none';
      enlaceAdmin.style.display = 'flex';
      enlaceAdmin.style.alignItems = 'center';
      enlaceAdmin.style.justifyContent = 'center';
      enlaceAdmin.style.gap = '8px';
      enlaceAdmin.innerHTML = '<i class="fas fa-shield-alt"></i> Ir al Panel de Administración';

      const btnCerrarSesion = document.getElementById('btn_cerrar_sesion');
      if (btnCerrarSesion) {
        tarjetaRegistro.insertBefore(enlaceAdmin, btnCerrarSesion);
      } else {
        tarjetaRegistro.appendChild(enlaceAdmin);
      }
    }
  }
});