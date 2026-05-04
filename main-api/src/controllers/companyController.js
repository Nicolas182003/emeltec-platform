const db = require('../config/db');

const SITE_COLUMNS = 'id, descripcion, empresa_id, sub_empresa_id, id_serial, ubicacion';

/**
 * GET /api/companies/tree
 *
 * Modelo de jerarquia:
 * empresa -> sub_empresa -> sitio
 */
exports.getHierarchyTree = async (req, res, next) => {
  try {
    const { tipo, empresa_id, sub_empresa_id } = req.user;

    let companies = [];
    let subCompanies = [];
    let sites = [];

    if (tipo === 'SuperAdmin') {
      const compRes = await db.query('SELECT id, nombre, rut, tipo_empresa FROM empresa ORDER BY nombre ASC');
      const subRes = await db.query('SELECT id, nombre, rut, empresa_id FROM sub_empresa ORDER BY nombre ASC');
      const siteRes = await db.query(`SELECT ${SITE_COLUMNS} FROM sitio ORDER BY descripcion ASC`);

      companies = compRes.rows;
      subCompanies = subRes.rows;
      sites = siteRes.rows;
    } else if (tipo === 'Admin') {
      if (!empresa_id) {
        return res.json({ ok: true, data: [] });
      }

      const compRes = await db.query('SELECT id, nombre, rut, tipo_empresa FROM empresa WHERE id = $1', [empresa_id]);
      const subRes = await db.query(
        'SELECT id, nombre, rut, empresa_id FROM sub_empresa WHERE empresa_id = $1 ORDER BY nombre ASC',
        [empresa_id]
      );
      const siteRes = await db.query(
        `SELECT ${SITE_COLUMNS} FROM sitio WHERE empresa_id = $1 ORDER BY descripcion ASC`,
        [empresa_id]
      );

      companies = compRes.rows;
      subCompanies = subRes.rows;
      sites = siteRes.rows;
    } else if (tipo === 'Gerente' || tipo === 'Cliente') {
      if (!empresa_id || !sub_empresa_id) {
        return res.json({ ok: true, data: [] });
      }

      const compRes = await db.query('SELECT id, nombre, rut, tipo_empresa FROM empresa WHERE id = $1', [empresa_id]);
      const subRes = await db.query(
        'SELECT id, nombre, rut, empresa_id FROM sub_empresa WHERE id = $1 AND empresa_id = $2',
        [sub_empresa_id, empresa_id]
      );
      const siteRes = await db.query(
        `SELECT ${SITE_COLUMNS} FROM sitio WHERE sub_empresa_id = $1 ORDER BY descripcion ASC`,
        [sub_empresa_id]
      );

      companies = compRes.rows;
      subCompanies = subRes.rows;
      sites = siteRes.rows;
    } else {
      return res.status(403).json({ ok: false, error: 'Rol no reconocido' });
    }

    const tree = companies.map((company) => ({
      ...company,
      subCompanies: subCompanies
        .filter((subCompany) => subCompany.empresa_id === company.id)
        .map((subCompany) => ({
          ...subCompany,
          sites: sites.filter((site) => site.sub_empresa_id === subCompany.id),
        })),
    }));

    res.json({ ok: true, data: tree });
  } catch (err) {
    console.error('Error en getHierarchyTree:', err);
    next(err);
  }
};

/**
 * GET /api/companies
 * Lista plana de empresas, filtrada por rol.
 */
exports.getAllCompanies = async (req, res, next) => {
  try {
    const { tipo, empresa_id } = req.user;
    let query;
    let params;

    if (tipo === 'SuperAdmin') {
      query = 'SELECT id, nombre, rut, sitios, tipo_empresa FROM empresa ORDER BY nombre ASC';
      params = [];
    } else {
      query = 'SELECT id, nombre, rut, sitios, tipo_empresa FROM empresa WHERE id = $1 ORDER BY nombre ASC';
      params = [empresa_id];
    }

    const { rows } = await db.query(query, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/companies/:id/sites
 *
 * El id puede ser una sub_empresa o una empresa:
 * - Si es sub_empresa, devuelve solo sus sitios.
 * - Si es empresa, devuelve sus sitios respetando el alcance del usuario.
 */
exports.getCompanySites = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipo, empresa_id, sub_empresa_id } = req.user;

    const subCompanyRes = await db.query('SELECT id, empresa_id FROM sub_empresa WHERE id = $1', [id]);
    const subCompany = subCompanyRes.rows[0];

    if (subCompany) {
      if (tipo !== 'SuperAdmin' && subCompany.empresa_id !== empresa_id) {
        return res.status(403).json({ ok: false, error: 'No tiene acceso a esta sub-empresa' });
      }

      if ((tipo === 'Gerente' || tipo === 'Cliente') && sub_empresa_id && id !== sub_empresa_id) {
        return res.status(403).json({ ok: false, error: 'No tiene acceso a esta sub-empresa' });
      }

      const { rows } = await db.query(
        `SELECT ${SITE_COLUMNS} FROM sitio WHERE sub_empresa_id = $1 ORDER BY descripcion ASC`,
        [id]
      );
      return res.json({ ok: true, data: rows });
    }

    if (tipo !== 'SuperAdmin' && id !== empresa_id) {
      return res.status(403).json({ ok: false, error: 'No tiene acceso a esta empresa' });
    }

    const params = [];
    let query = `SELECT ${SITE_COLUMNS} FROM sitio`;

    if ((tipo === 'Gerente' || tipo === 'Cliente') && sub_empresa_id) {
      params.push(sub_empresa_id);
      query += ` WHERE sub_empresa_id = $${params.length}`;
    } else {
      params.push(id);
      query += ` WHERE empresa_id = $${params.length}`;
    }

    query += ' ORDER BY descripcion ASC';

    const { rows } = await db.query(query, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
};
