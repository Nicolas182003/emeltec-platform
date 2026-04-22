/**
 * alertDispatcher.js — Decide a quien enviar cada alerta segun la jerarquia de roles.
 *
 * Este modulo recibe un tipo de alerta y los datos del evento, consulta la base
 * de datos para determinar los destinatarios correctos, y delega el envio a alertService.
 *
 * Jerarquia de notificaciones:
 *   - SuperAdmin creado  => notifica a los otros SuperAdmins existentes
 *   - Admin creado       => notifica a todos los SuperAdmins
 *   - Gerente creado     => notifica a los Admins de su empresa + SuperAdmins
 *   - Cliente creado     => notifica a Gerentes + Admins de su empresa + SuperAdmins
 *   - Empresa creada     => notifica a todos los SuperAdmins
 *   - Umbral telemetria  => notifica a Admins de la empresa del equipo + SuperAdmins
 *   - Monitoreo          => notifica solo a SuperAdmins
 *   - Error archivo      => notifica solo a SuperAdmins (error en el pipeline Go)
 */

const db           = require('../config/db');
const alertService = require('./alertService');

/**
 * Consulta la BD y retorna los emails de todos los usuarios con rol SuperAdmin.
 */
async function getSuperAdmins() {
  const { rows } = await db.query(
    `SELECT email FROM usuario WHERE tipo = 'SuperAdmin'`
  );
  return rows.map(r => r.email);
}

/**
 * Consulta la BD y retorna los emails de los Admins de una empresa especifica.
 * @param {string} empresa_id
 */
async function getAdminsDeEmpresa(empresa_id) {
  const { rows } = await db.query(
    `SELECT email FROM usuario WHERE tipo = 'Admin' AND empresa_id = $1`,
    [empresa_id]
  );
  return rows.map(r => r.email);
}

/**
 * Consulta la BD y retorna los emails de los Gerentes de una empresa especifica.
 * @param {string} empresa_id
 */
async function getGerentesDeEmpresa(empresa_id) {
  const { rows } = await db.query(
    `SELECT email FROM usuario WHERE tipo = 'Gerente' AND empresa_id = $1`,
    [empresa_id]
  );
  return rows.map(r => r.email);
}

/**
 * Elimina emails duplicados de un array (por si un usuario tiene varios roles).
 * Tambien filtra valores nulos o vacios.
 */
function unique(emails) {
  return [...new Set(emails.filter(Boolean))];
}

/**
 * Punto de entrada principal del dispatcher.
 * Determina los destinatarios segun el tipo de alerta y llama a alertService.
 *
 * @param {string} tipo  - Tipo de alerta (debe coincidir con los definidos en alertService)
 * @param {object} datos - Datos del evento para pasar a la plantilla de correo
 * @returns {{ ok: boolean, skipped?: boolean, error?: string }}
 */
exports.despachar = async (tipo, datos) => {
  try {
    let destinos = [];

    switch (tipo) {

      case 'usuario_creado': {
        const { nuevoUsuario } = datos;
        const superAdmins = await getSuperAdmins();

        if (nuevoUsuario.tipo === 'Admin') {
          // Un Admin fue creado => solo los SuperAdmins deben saberlo
          destinos = superAdmins;

        } else if (nuevoUsuario.tipo === 'Gerente') {
          // Un Gerente fue creado => los Admins de su empresa + todos los SuperAdmins
          const admins = await getAdminsDeEmpresa(nuevoUsuario.empresa_id);
          destinos = unique([...admins, ...superAdmins]);

        } else if (nuevoUsuario.tipo === 'Cliente') {
          // Un Cliente fue creado => Gerentes + Admins de su empresa + SuperAdmins
          const gerentes = await getGerentesDeEmpresa(nuevoUsuario.empresa_id);
          const admins   = await getAdminsDeEmpresa(nuevoUsuario.empresa_id);
          destinos = unique([...gerentes, ...admins, ...superAdmins]);

        } else if (nuevoUsuario.tipo === 'SuperAdmin') {
          // Otro SuperAdmin fue creado => notificar a los SuperAdmins ya existentes
          // (excluimos al recien creado para no notificarse a si mismo)
          destinos = superAdmins.filter(e => e !== nuevoUsuario.email);
        }

        break;
      }

      case 'empresa_creada': {
        // Una empresa fue creada => solo los SuperAdmins supervisan esto
        destinos = await getSuperAdmins();
        break;
      }

      case 'umbral_telemetria': {
        // Un equipo supero un limite => Admins de la empresa del equipo + SuperAdmins
        const { empresa_id } = datos;
        const admins      = empresa_id ? await getAdminsDeEmpresa(empresa_id) : [];
        const superAdmins = await getSuperAdmins();
        destinos = unique([...admins, ...superAdmins]);
        break;
      }

      case 'monitoreo': {
        // Alerta general del sistema => solo SuperAdmins
        destinos = await getSuperAdmins();
        break;
      }

      case 'error_archivo': {
        // El pipeline Go (csvprocessor) fallo al procesar un archivo de telemetria.
        // Solo los SuperAdmins deben recibir esta alerta de infraestructura.
        destinos = await getSuperAdmins();
        break;
      }

      default:
        console.warn(`⚠️  alertDispatcher: tipo desconocido "${tipo}"`);
        return { ok: false, error: `Tipo desconocido: ${tipo}` };
    }

    // Si no se encontro ningun destinatario en la BD, no se envia nada
    if (destinos.length === 0) {
      console.log(`ℹ️  alertDispatcher: sin destinatarios para "${tipo}". Sin envio.`);
      return { ok: true, skipped: true, motivo: 'sin_destinatarios' };
    }

    // Delegar el envio real del correo a alertService
    return await alertService.enviarAlerta(tipo, destinos, datos);

  } catch (err) {
    console.error('❌ alertDispatcher error:', err.message);
    return { ok: false, error: err.message };
  }
};
