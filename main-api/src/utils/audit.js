const http = require('http');
const pool  = require('../config/db');

const VERBOS    = { crear: 'creó', actualizar: 'actualizó', eliminar: 'eliminó' };
const ENTIDADES = { usuario: 'el usuario', empresa: 'la empresa', sub_empresa: 'la subempresa', sitio: 'el sitio', variable: 'la variable' };

function generarDescripcion(usuario_email, accion, entidad, detalle) {
  const verbo = VERBOS[accion]     || accion;
  const ent   = ENTIDADES[entidad] || entidad;

  let nombre = '';
  if (entidad === 'usuario')     nombre = `${detalle.nombre || ''} ${detalle.apellido || ''}`.trim();
  if (entidad === 'empresa')     nombre = detalle.nombre      || '';
  if (entidad === 'sub_empresa') nombre = detalle.nombre      || '';
  if (entidad === 'sitio')       nombre = detalle.descripcion || '';
  if (entidad === 'variable')    nombre = detalle.alias       || '';

  return `${usuario_email} ${verbo} ${ent}${nombre ? ` ${nombre}` : ''}`.trim();
}

function extraerIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.ip || '').replace('::ffff:', '') || null;
}

function geolocalizarIp(ip) {
  return new Promise((resolve) => {
    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      return resolve('Localhost');
    }

    http.get(`http://ip-api.com/json/${ip}?fields=country,regionName,city,zip&lang=es`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.city && json.regionName && json.country) {
            const lugar = [json.city, json.zip].filter(Boolean).join(' ');
            resolve(`${lugar}, ${json.regionName}, ${json.country}`);
          } else {
            resolve(ip);
          }
        } catch {
          resolve(ip);
        }
      });
    }).on('error', () => resolve(ip));
  });
}

/**
 * @param {object} params
 * @param {string} params.usuario_id
 * @param {string} params.usuario_email
 * @param {string} params.usuario_tipo
 * @param {'crear'|'actualizar'|'eliminar'} params.accion
 * @param {string} params.entidad   — 'usuario' | 'empresa' | 'sub_empresa' | 'sitio' | 'variable'
 * @param {string} params.entidad_id
 * @param {object} [params.detalle]
 * @param {object} params.req       — Express request (para extraer IP)
 */
async function registrarAuditoria({ usuario_id, usuario_email, usuario_tipo, accion, entidad, entidad_id, detalle = {}, req }) {
  try {
    const descripcion = generarDescripcion(usuario_email, accion, entidad, detalle);
    const ip          = req ? extraerIp(req) : null;
    const ubicacion   = ip ? await geolocalizarIp(ip) : null;

    await pool.query(
      `INSERT INTO audit_log (usuario_id, usuario_email, usuario_tipo, accion, entidad, entidad_id, detalle, descripcion, ip, ubicacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
      [usuario_id, usuario_email, usuario_tipo, accion, entidad, entidad_id, JSON.stringify(detalle), descripcion, ip, ubicacion]
    );
  } catch (err) {
    console.error('[audit] Error al registrar auditoria:', err.message);
  }
}

module.exports = { registrarAuditoria, extraerIp };
