// comun/app.js
// Coordinador principal de estado, pestañas, deshacer/rehacer, atajos de teclado y guardado automático.

import { aFechaIso, aHoraIso } from './tiempo.js';
import {
  validarDatos,
  clonar,
  crearTarea,
  actualizarTarea,
  eliminarTarea,
  marcarTareaHecha,
  crearBloque,
  actualizarBloque,
  eliminarBloque,
  marcarBloqueHecho,
  crearFijo,
  actualizarFijo,
  eliminarFijo,
  generarId,
  planificar,
  esEcoPropio
} from './modelo.js';
import {
  cargarDatos,
  guardarDatos,
  cargarUsuarioActual,
  cargarListaUsuarios,
  guardarCookieUsuario
} from './archivo.js';
import { Editor } from './editor.js';
import { VistaHoy } from '../vistas/hoy.js';
import { VistaSemana } from '../vistas/semana.js';
import { VistaPendientes } from '../vistas/pendientes.js';

class AplicacionItinerario {
  constructor() {
    this.datos = null;
    this.etag = null;
    this.usuarioActual = null;
    this.usuariosDisponibles = [];
    this.escuchaFocoRegistrada = false;
    this.vistaActual = 'hoy'; // 'hoy' | 'semana' | 'pendientes'
    this.fechaSeleccionada = aFechaIso();
    this.filtroMateria = null;
    this.mostrarHechas = false;
    this.elementoSeleccionado = null;
    this.avisosNoAlcanza = {};

    this.historialDeshacer = [];
    this.historialRehacer = [];
    this.maxHistorial = 50;

    this.temporizadorAutoguardado = null;
    this.estadoGuardado = 'guardado'; // 'guardado' | 'modificado' | 'guardando' | 'error' | 'conflicto'
    this.hayCambiosSinGuardar = false;

    this.eventSource = null;

    this.inicializarDom();
    this.inicializarEditor();
    this.inicializarVistas();
    this.conectarAtajosTeclado();
    this.conectarTema();
    this.iniciar();
  }

  inicializarDom() {
    this.elIndicadorUsuario = document.getElementById('indicador-usuario');
    this.elIndicadorGuardado = document.getElementById('indicador-guardado');
    this.elContenedorVista = document.getElementById('contenedor-vista');
    this.elContenedorEditor = document.getElementById('contenedor-editor');
    this.elBannerConflicto = document.getElementById('banner-conflicto');
    this.elContenedorAvisos = document.getElementById('contenedor-avisos');
    this.btnDeshacer = document.getElementById('btn-deshacer');
    this.btnRehacer = document.getElementById('btn-rehacer');
    this.btnTema = document.getElementById('btn-tema');
    this.btnAjustes = document.getElementById('btn-ajustes');

    // Botones de pestañas
    this.pestanas = {
      hoy: document.getElementById('pestana-hoy'),
      semana: document.getElementById('pestana-semana'),
      pendientes: document.getElementById('pestana-pendientes')
    };

    Object.entries(this.pestanas).forEach(([vista, btn]) => {
      btn?.addEventListener('click', () => this.cambiarVista(vista));
    });

    this.btnDeshacer?.addEventListener('click', () => this.deshacer());
    this.btnRehacer?.addEventListener('click', () => this.rehacer());
    this.btnAjustes?.addEventListener('click', () => {
      this.editor.abrir({ tipo: 'config', id: 'config', esNuevo: false }, this.datos);
    });
  }

  inicializarEditor() {
    this.editor = new Editor(this.elContenedorEditor, {
      onActualizar: (tipo, id, cambios, esNuevo) => {
        if (tipo === 'config') {
          this.aplicarModificacion((d) => {
            const nuevo = clonar(d);
            nuevo.config = Object.assign({}, nuevo.config, cambios);
            return nuevo;
          });
          this.mostrarAviso('Configuración guardada', 'info');
          return;
        }
        if (esNuevo) {
          if (tipo === 'tarea') this.aplicarModificacion((d) => crearTarea(d, { ...cambios, id }));
          else if (tipo === 'bloque') this.aplicarModificacion((d) => crearBloque(d, { ...cambios, id }));
          else if (tipo === 'fijo') this.aplicarModificacion((d) => crearFijo(d, { ...cambios, id }));
        } else {
          if (tipo === 'tarea') this.aplicarModificacion((d) => actualizarTarea(d, id, cambios));
          else if (tipo === 'bloque') this.aplicarModificacion((d) => actualizarBloque(d, id, cambios));
          else if (tipo === 'fijo') this.aplicarModificacion((d) => actualizarFijo(d, id, cambios));
        }
      },
      onEliminar: (tipo, id) => {
        if (tipo === 'tarea') this.aplicarModificacion((d) => eliminarTarea(d, id));
        else if (tipo === 'bloque') this.aplicarModificacion((d) => eliminarBloque(d, id));
        else if (tipo === 'fijo') this.aplicarModificacion((d) => eliminarFijo(d, id));
      },
      onDuplicar: (tipo, id) => {
        this.duplicarElemento(tipo, id);
      },
      onCerrar: () => {
        this.elementoSeleccionado = null;
      }
    });
  }

  inicializarVistas() {
    this.instanciaVistaHoy = new VistaHoy(this.elContenedorVista, {
      onSeleccionar: (tipo, id) => this.abrirEditor(tipo, id),
      onCambiarFecha: (fechaIso) => {
        this.fechaSeleccionada = fechaIso;
        this.renderizarVistaActual();
      },
      onMarcarBloqueHecho: (id, hecho) => {
        this.aplicarModificacion((d) => marcarBloqueHecho(d, id, hecho));
      },
      onActualizarBloque: (id, cambios) => {
        this.aplicarModificacion((d) => actualizarBloque(d, id, cambios));
      },
      onAceptarBloquePropuesto: (id) => {
        this.aplicarModificacion((d) => actualizarBloque(d, id, { propuesto: false }));
      },
      onDescartarBloquePropuesto: (id) => {
        this.aplicarModificacion((d) => eliminarBloque(d, id));
      },
      onPlanificar: () => {
        this.ejecutarPlanificador();
      },
      onAceptarTodosPropuestos: () => {
        this.aplicarModificacion((d) => ({
          ...d,
          bloques: (d.bloques || []).map((b) => b.propuesto ? { ...b, propuesto: false } : b)
        }));
        this.mostrarAviso('Se aceptaron todos los bloques propuestos', 'info');
      },
      onDescartarTodosPropuestos: () => {
        this.aplicarModificacion((d) => ({
          ...d,
          bloques: (d.bloques || []).filter((b) => !b.propuesto)
        }));
        this.mostrarAviso('Se descartaron los bloques propuestos', 'info');
      },
      onNuevoBloque: (fecha, inicio, fin) => {
        this.abrirEditorNuevo('bloque', { fecha, inicio, fin, hecho: false, propuesto: false });
      },
      onNuevoFijo: () => {
        this.abrirEditorNuevo('fijo', {
          titulo: '',
          materia: null,
          dias: [1],
          inicio: '07:00',
          fin: '09:00',
          lugar: '',
          desde: '',
          hasta: ''
        });
      }
    });

    this.instanciaVistaSemana = new VistaSemana(this.elContenedorVista, {
      onSeleccionar: (tipo, id) => this.abrirEditor(tipo, id),
      onCambiarFecha: (fechaIso) => {
        this.fechaSeleccionada = fechaIso;
        this.renderizarVistaActual();
      },
      onNuevoBloque: (fecha, inicio, fin) => {
        this.abrirEditorNuevo('bloque', { fecha, inicio, fin, hecho: false, propuesto: false });
      },
      onNuevoFijo: () => {
        this.abrirEditorNuevo('fijo', {
          titulo: '',
          materia: null,
          dias: [1],
          inicio: '07:00',
          fin: '09:00',
          lugar: '',
          desde: '',
          hasta: ''
        });
      }
    });

    this.instanciaVistaPendientes = new VistaPendientes(this.elContenedorVista, {
      onSeleccionar: (tipo, id) => this.abrirEditor(tipo, id),
      onNuevaTarea: (padreId) => {
        this.abrirEditorNuevo('tarea', {
          padre: padreId || null,
          materia: this.filtroMateria || (this.datos?.materias[0]?.id || '')
        });
      },
      onCapturaRapida: (titulo, materiaId) => {
        const materia = materiaId || (this.datos?.materias[0]?.id || '');
        this.aplicarModificacion((d) => crearTarea(d, {
          titulo,
          materia,
          entrega: '',
          duracionMin: 60,
          avance: 0,
          estado: 'pendiente'
        }));
      },
      onMarcarHecha: (id, hecha) => {
        this.aplicarModificacion((d) => marcarTareaHecha(d, id, hecha));
      },
      onCambiarFiltroMateria: (materiaId) => {
        this.filtroMateria = materiaId;
        this.renderizarVistaActual();
      },
      onCambiarMostrarHechas: (mostrar) => {
        this.mostrarHechas = mostrar;
        this.renderizarVistaActual();
      },
      onActualizarVista: () => {
        this.renderizarVistaActual();
      }
    });
  }

  async iniciar() {
    try {
      this.actualizarEstadoGuardado('cargando');
      const [{ datos, etag }, usuario, usuarios] = await Promise.all([
        cargarDatos(),
        cargarUsuarioActual(),
        cargarListaUsuarios()
      ]);
      this.usuarioActual = usuario;
      this.usuariosDisponibles = usuarios;
      this.actualizarIndicadorUsuario();

      const resultadoValidacion = validarDatos(datos);
      this.datos = resultadoValidacion.datos;
      this.etag = etag;
      this.historialDeshacer = [];
      this.historialRehacer = [];
      this.hayCambiosSinGuardar = false;

      if (resultadoValidacion.advertencias.length > 0) {
        resultadoValidacion.advertencias.forEach((adv) => this.mostrarAviso(adv, 'advertencia'));
      }

      this.actualizarEstadoGuardado('guardado');
      this.actualizarBotonesHistorial();
      this.renderizarVistaActual();
      this.conectarEventosServidor();

      if (!this.escuchaFocoRegistrada && typeof window !== 'undefined') {
        this.escuchaFocoRegistrada = true;
        window.addEventListener('focus', async () => {
          const nuevoUsuario = await cargarUsuarioActual();
          const idAntes = this.usuarioActual?.id || '';
          const idNuevo = nuevoUsuario?.id || '';
          if (idAntes !== idNuevo) {
            await this.iniciar();
          }
        });
      }
    } catch (err) {
      console.error(err);
      this.actualizarEstadoGuardado('error');
      this.mostrarAviso(`No se pudieron cargar los datos: ${err.message}`, 'error');
    }
  }

  actualizarIndicadorUsuario() {
    if (!this.elIndicadorUsuario) return;
    this.elIndicadorUsuario.replaceChildren();

    if (this.usuariosDisponibles && this.usuariosDisponibles.length > 0) {
      const icono = document.createElement('span');
      icono.textContent = '👤 ';
      const selector = document.createElement('select');
      selector.className = 'selector-usuario';
      selector.title = 'Cambiar de usuario (cada usuario tiene su propio itinerario, sin contraseña)';
      selector.setAttribute('aria-label', 'Usuario activo del itinerario');

      if (!this.usuarioActual) {
        const optGen = document.createElement('option');
        optGen.value = '';
        optGen.textContent = 'Elegir usuario…';
        selector.appendChild(optGen);
      }

      for (const u of this.usuariosDisponibles) {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.nombre;
        if (this.usuarioActual && this.usuarioActual.id === u.id) {
          opt.selected = true;
        }
        selector.appendChild(opt);
      }

      selector.addEventListener('change', () => {
        this.cambiarUsuario(selector.value);
      });

      this.elIndicadorUsuario.append(icono, selector);
      this.elIndicadorUsuario.hidden = false;
      return;
    }

    if (this.usuarioActual && this.usuarioActual.nombre) {
      this.elIndicadorUsuario.textContent = `👤 ${this.usuarioActual.nombre}`;
      this.elIndicadorUsuario.hidden = false;
    } else {
      this.elIndicadorUsuario.textContent = '';
      this.elIndicadorUsuario.hidden = true;
    }
  }

  async cambiarUsuario(idUsuario) {
    guardarCookieUsuario(idUsuario);
    this.editor?.cerrar();
    await this.iniciar();
    if (this.usuarioActual && this.usuarioActual.nombre) {
      this.mostrarAviso(`Itinerario de ${this.usuarioActual.nombre} cargado`, 'info');
    }
  }

  conectarEventosServidor() {
    if (!window.EventSource) return;
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (_) {}
      this.eventSource = null;
    }
    try {
      this.eventSource = new EventSource('api/eventos');
      let primeraConexion = true;
      let huboDesconexion = false;

      this.eventSource.onopen = async () => {
        if (primeraConexion) {
          primeraConexion = false;
          return;
        }
        if (huboDesconexion) {
          huboDesconexion = false;
          // Reconexión: consultar /api/datos si el etag cambió mientras estaba desconectado
          try {
            const { datos, etag } = await cargarDatos();
            if (!esEcoPropio(etag, this.etag)) {
              await this.manejarCambioExterno(etag, datos);
            }
          } catch (err) {
            console.warn('Error al verificar datos tras reconexión:', err);
          }
        }
      };

      this.eventSource.addEventListener('cambio', async (e) => {
        let etagEvento = null;
        try {
          const parsed = JSON.parse(e.data);
          etagEvento = parsed?.etag || null;
        } catch (_) {}

        // 1. Error: la app reacciona a sus propios guardados
        if (etagEvento && esEcoPropio(etagEvento, this.etag)) {
          return; // Eco de nuestro propio guardado: ignorar por completo
        }

        await this.manejarCambioExterno(etagEvento);
      });

      this.eventSource.onerror = () => {
        // En caso de corte o desconexión, EventSource reconecta solo
        huboDesconexion = true;
      };
    } catch (err) {
      console.warn('No se pudo conectar a Server-Sent Events:', err);
    }
  }

  async manejarCambioExterno(etagEvento = null, datosPrecargados = null) {
    if (etagEvento && esEcoPropio(etagEvento, this.etag)) {
      return;
    }

    if (!this.hayCambiosSinGuardar) {
      // Recarga automática sin cambios pendientes
      try {
        let datos = datosPrecargados;
        let etag = etagEvento;
        if (!datos) {
          const res = await cargarDatos();
          datos = res.datos;
          etag = res.etag;
        }

        if (etag && esEcoPropio(etag, this.etag)) {
          return;
        }

        const res = validarDatos(datos);
        this.datos = res.datos;
        this.etag = etag;
        this.renderizarVistaActual();

        // 4. Editor abierto: no cerrar ni borrar lo que el usuario está escribiendo.
        // Si el elemento fue eliminado en el archivo, cerrar el editor y avisar.
        if (this.elementoSeleccionado && !this.elementoSeleccionado.esNuevo) {
          let existe = true;
          if (this.elementoSeleccionado.tipo === 'tarea') {
            existe = this.datos.tareas.some((t) => t.id === this.elementoSeleccionado.id);
          } else if (this.elementoSeleccionado.tipo === 'bloque') {
            existe = this.datos.bloques.some((b) => b.id === this.elementoSeleccionado.id);
          } else if (this.elementoSeleccionado.tipo === 'fijo') {
            existe = this.datos.fijos.some((f) => f.id === this.elementoSeleccionado.id);
          }

          if (!existe) {
            this.editor.cerrar();
            this.mostrarAviso('El elemento fue eliminado desde el archivo', 'advertencia');
          }
        }

        this.mostrarAviso('Actualizado desde el archivo', 'info');
      } catch (err) {
        console.error('Error al recargar cambios externos:', err);
      }
    } else {
      // 2. Conflicto: cambios locales pendientes
      this.mostrarBannerConflicto(etagEvento);
    }
  }

  mostrarBannerConflicto(nuevoEtag = null) {
    if (!this.elBannerConflicto) return;
    this.elBannerConflicto.innerHTML = `
      <div class="banner-alerta-contenido">
        <span class="alerta-icono">⚠️</span>
        <div class="alerta-texto">
          <strong>Archivo modificado por fuera:</strong> Existen cambios en disco y cambios locales sin guardar.
        </div>
        <div class="alerta-acciones">
          <button class="btn btn-sm btn-secundario" id="btn-conflicto-recargar">Recargar (descartar lo mío)</button>
          <button class="btn btn-sm btn-primario" id="btn-conflicto-mantener">Mantener lo mío</button>
        </div>
      </div>
    `;
    this.elBannerConflicto.style.display = 'block';

    document.getElementById('btn-conflicto-recargar')?.addEventListener('click', async () => {
      this.elBannerConflicto.style.display = 'none';
      this.hayCambiosSinGuardar = false;
      this.historialDeshacer = [];
      this.historialRehacer = [];
      await this.iniciar();
      this.mostrarAviso('Se recargó la versión en disco.', 'info');
    });

    document.getElementById('btn-conflicto-mantener')?.addEventListener('click', async () => {
      this.elBannerConflicto.style.display = 'none';
      // "Mantener lo mío" guarda con el ETag nuevo del disco, sin un 409
      try {
        let etagActual = nuevoEtag;
        if (!etagActual) {
          const res = await fetch('api/datos', { method: 'HEAD', headers: { 'Cache-Control': 'no-cache' } });
          etagActual = res.headers.get('ETag');
        }
        if (etagActual) this.etag = etagActual;
      } catch (_) {}
      await this.guardarInmediato();
    });
  }

  cambiarVista(nuevaVista) {
    this.vistaActual = nuevaVista;
    Object.entries(this.pestanas).forEach(([v, btn]) => {
      if (btn) btn.classList.toggle('activo', v === nuevaVista);
    });
    this.renderizarVistaActual();
  }

  renderizarVistaActual() {
    if (!this.datos) return;
    this.actualizarAvisosNoAlcanza();
    if (this.vistaActual === 'hoy') {
      this.instanciaVistaHoy.renderizar(this.datos, this.fechaSeleccionada, this.avisosNoAlcanza);
    } else if (this.vistaActual === 'semana') {
      this.instanciaVistaSemana.renderizar(this.datos, this.fechaSeleccionada);
    } else if (this.vistaActual === 'pendientes') {
      this.instanciaVistaPendientes.renderizar(this.datos, this.filtroMateria, this.mostrarHechas, this.avisosNoAlcanza);
    }
  }

  actualizarAvisosNoAlcanza() {
    if (!this.datos) return;
    try {
      const ahoraIso = `${aFechaIso()}T${aHoraIso()}`;
      const res = planificar(this.datos, ahoraIso, 2);
      this.avisosNoAlcanza = res.avisosNoAlcanza || {};
    } catch (_) {}
  }

  ejecutarPlanificador() {
    if (!this.datos) return;
    const ahoraIso = `${aFechaIso()}T${aHoraIso()}`;
    // Reemplaza los propuestos anteriores: filtramos antes de planificar
    const datosSinPropuestos = {
      ...this.datos,
      bloques: (this.datos.bloques || []).filter((b) => !b.propuesto)
    };
    const resultado = planificar(datosSinPropuestos, ahoraIso, 2);
    this.avisosNoAlcanza = resultado.avisosNoAlcanza || {};

    const nuevosPropuestos = resultado.bloquesPropuestos || [];
    const idsPropuestos = new Set(nuevosPropuestos.map((b) => b.id));
    this.aplicarModificacion((d) => ({
      ...d,
      bloques: [
        ...(d.bloques || []).filter((b) => !b.propuesto && !idsPropuestos.has(b.id)),
        ...nuevosPropuestos
      ]
    }));

    const cant = nuevosPropuestos.length;
    if (cant > 0) {
      this.mostrarAviso(`Planificación: ${cant} bloque${cant === 1 ? '' : 's'} propuesto${cant === 1 ? '' : 's'}`, 'info');
    } else {
      this.mostrarAviso('No hay huecos disponibles o tareas pendientes por planificar', 'info');
    }
  }

  abrirEditor(tipo, id) {
    this.elementoSeleccionado = { tipo, id, esNuevo: false };
    this.editor.abrir(this.elementoSeleccionado, this.datos);
  }

  abrirEditorNuevo(tipo, datosIniciales = {}) {
    const idGenerado = generarId(tipo === 'tarea' ? 't' : tipo === 'bloque' ? 'b' : 'f');
    this.elementoSeleccionado = { tipo, id: idGenerado, esNuevo: true, datosIniciales };
    this.editor.abrir(this.elementoSeleccionado, this.datos);
  }

  duplicarElemento(tipo, id) {
    if (tipo === 'tarea') {
      const original = this.datos.tareas.find((t) => t.id === id);
      if (original) {
        const copia = clonar(original);
        copia.id = generarId('t');
        copia.titulo = `${copia.titulo} (copia)`;
        copia.estado = 'pendiente';
        copia.avance = 0;
        this.aplicarModificacion((d) => crearTarea(d, copia));
      }
    } else if (tipo === 'bloque') {
      const original = this.datos.bloques.find((b) => b.id === id);
      if (original) {
        const copia = clonar(original);
        copia.id = generarId('b');
        copia.hecho = false;
        copia.propuesto = false;
        this.aplicarModificacion((d) => crearBloque(d, copia));
      }
    }
  }

  aplicarModificacion(transformacionFn) {
    // Guardar estado actual en el historial de deshacer
    this.historialDeshacer.push(clonar(this.datos));
    if (this.historialDeshacer.length > this.maxHistorial) {
      this.historialDeshacer.shift();
    }
    this.historialRehacer = [];

    // Aplicar transformación
    this.datos = transformacionFn(this.datos);
    this.hayCambiosSinGuardar = true;
    this.actualizarEstadoGuardado('modificado');
    this.actualizarBotonesHistorial();

    this.renderizarVistaActual();

    // Si el editor está abierto, actualizar sus datos
    if (this.elementoSeleccionado && !this.elementoSeleccionado.esNuevo) {
      this.editor.abrir(this.elementoSeleccionado, this.datos);
    }

    // Programar guardado automático tras 1 segundo
    this.programarAutoguardado();
  }

  deshacer() {
    if (this.historialDeshacer.length === 0) return;
    this.historialRehacer.push(clonar(this.datos));
    this.datos = this.historialDeshacer.pop();
    this.hayCambiosSinGuardar = true;
    this.actualizarEstadoGuardado('modificado');
    this.actualizarBotonesHistorial();
    this.renderizarVistaActual();
    if (this.elementoSeleccionado) {
      this.editor.abrir(this.elementoSeleccionado, this.datos);
    }
    this.programarAutoguardado();
  }

  rehacer() {
    if (this.historialRehacer.length === 0) return;
    this.historialDeshacer.push(clonar(this.datos));
    this.datos = this.historialRehacer.pop();
    this.hayCambiosSinGuardar = true;
    this.actualizarEstadoGuardado('modificado');
    this.actualizarBotonesHistorial();
    this.renderizarVistaActual();
    if (this.elementoSeleccionado) {
      this.editor.abrir(this.elementoSeleccionado, this.datos);
    }
    this.programarAutoguardado();
  }

  actualizarBotonesHistorial() {
    if (this.btnDeshacer) this.btnDeshacer.disabled = this.historialDeshacer.length === 0;
    if (this.btnRehacer) this.btnRehacer.disabled = this.historialRehacer.length === 0;
  }

  programarAutoguardado() {
    if (this.temporizadorAutoguardado) {
      clearTimeout(this.temporizadorAutoguardado);
    }
    this.temporizadorAutoguardado = setTimeout(() => {
      this.guardarInmediato();
    }, 1000);
  }

  async guardarInmediato() {
    if (this.temporizadorAutoguardado) {
      clearTimeout(this.temporizadorAutoguardado);
      this.temporizadorAutoguardado = null;
    }

    if (!this.datos || !this.hayCambiosSinGuardar) return;

    this.actualizarEstadoGuardado('guardando');
    const resultado = await guardarDatos(this.datos, this.etag);

    if (resultado.ok) {
      this.etag = resultado.etag;
      this.hayCambiosSinGuardar = false;
      this.actualizarEstadoGuardado('guardado');
    } else if (resultado.conflicto) {
      this.actualizarEstadoGuardado('conflicto');
      this.mostrarBannerConflicto();
    } else {
      this.actualizarEstadoGuardado('error');
      this.mostrarAviso(resultado.error || 'Error al guardar cambios', 'error');
    }
  }

  actualizarEstadoGuardado(estado) {
    this.estadoGuardado = estado;
    if (!this.elIndicadorGuardado) return;

    if (estado === 'guardado') {
      this.elIndicadorGuardado.textContent = 'Guardado';
      this.elIndicadorGuardado.className = 'indicador-guardado estado-guardado';
    } else if (estado === 'modificado') {
      this.elIndicadorGuardado.textContent = 'Sin guardar...';
      this.elIndicadorGuardado.className = 'indicador-guardado estado-modificado';
    } else if (estado === 'guardando') {
      this.elIndicadorGuardado.textContent = 'Guardando...';
      this.elIndicadorGuardado.className = 'indicador-guardado estado-guardando';
    } else if (estado === 'conflicto') {
      this.elIndicadorGuardado.textContent = 'Conflicto';
      this.elIndicadorGuardado.className = 'indicador-guardado estado-conflicto';
    } else if (estado === 'cargando') {
      this.elIndicadorGuardado.textContent = 'Cargando...';
      this.elIndicadorGuardado.className = 'indicador-guardado';
    } else if (estado === 'error') {
      this.elIndicadorGuardado.textContent = 'Error al guardar';
      this.elIndicadorGuardado.className = 'indicador-guardado estado-error';
    }
  }

  conectarAtajosTeclado() {
    window.addEventListener('keydown', (e) => {
      const esMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const teclaCtrl = esMac ? e.metaKey : e.ctrlKey;

      // Ctrl+S / Cmd+S: Guardar
      if (teclaCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.guardarInmediato();
        return;
      }

      // Ctrl+Z / Cmd+Z: Deshacer o Rehacer (si lleva Shift)
      if (teclaCtrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          this.rehacer();
        } else {
          this.deshacer();
        }
        return;
      }

      // Ctrl+Y / Cmd+Y: Rehacer
      if (teclaCtrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.rehacer();
        return;
      }

      // Esc: Cerrar editor
      if (e.key === 'Escape') {
        if (this.elementoSeleccionado) {
          this.editor.cerrar();
        }
      }
    });
  }

  conectarTema() {
    const temaGuardado = localStorage.getItem('itinerario_tema');
    const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const temaInicial = temaGuardado || (prefiereOscuro ? 'oscuro' : 'claro');

    this.aplicarTema(temaInicial);

    this.btnTema?.addEventListener('click', () => {
      const temaActual = document.documentElement.getAttribute('data-tema') || 'claro';
      const nuevoTema = temaActual === 'oscuro' ? 'claro' : 'oscuro';
      this.aplicarTema(nuevoTema);
    });
  }

  aplicarTema(tema) {
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem('itinerario_tema', tema);
    if (this.btnTema) {
      this.btnTema.textContent = tema === 'oscuro' ? '☀️' : '🌙';
      this.btnTema.title = `Cambiar a tema ${tema === 'oscuro' ? 'claro' : 'oscuro'}`;
    }
  }

  mostrarAviso(mensaje, tipo = 'info') {
    if (!this.elContenedorAvisos) return;
    const aviso = document.createElement('div');
    aviso.className = `aviso-toast aviso-${tipo}`;
    aviso.textContent = mensaje;
    this.elContenedorAvisos.appendChild(aviso);

    setTimeout(() => {
      aviso.classList.add('visible');
    }, 10);

    setTimeout(() => {
      aviso.classList.remove('visible');
      setTimeout(() => aviso.remove(), 200);
    }, 3500);
  }
}

// Inicializar la aplicación cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  window.appItinerario = new AplicacionItinerario();
});
