const db = require('../config/db');

/**
 * GET /api/companies/tree
 * Devuelve el árbol de jerarquía filtrado según el rol del usuario autenticado.
 *
 * SuperAdmin → todas las empresas + sub-empresas + sitios
 * Admin      → solo su empresa + sus sub-empresas + sitios
 * Gerente    → solo su empresa padre + su sub-empresa + sitios
 * Cliente    → solo su empresa padre + su sub-empresa + sitios
 *
 * NOTA: La tabla `sitio` solo tiene empresa_id (no sub_empresa_id).
 * Los sitios se muestran bajo la empresa directamente en el árbol.
 */
exports.getHierarchyTree = async (req, res, next) => {
  try {
    const { tipo, empresa_id, sub_empresa_id } = req.user;

    let companies, subCompanies, sites;

    if (tipo === 'SuperAdmin') {
      const compRes = await db.query('SELECT id, nombre, rut, tipo_empresa FROM empresa ORDER BY nombre ASC');
      const subRes  = await db.query('SELECT id, nombre, rut, empresa_id FROM sub_empresa ORDER BY nombre ASC');
      const siteRes = await db.query('SELECT id, descripcion, empresa_id, id_serial, ubicacion FROM sitio ORDER BY descripcion ASC');
      companies    = compRes.rows;
      subCompanies = subRes.rows;
      sites        = siteRes.rows;

    } else if (tipo === 'Admin') {
      if (!empresa_id) {
        return res.json({ ok: true, data: [] });
      }
      const compRes = await db.query('SELECT id, nombre, rut, tipo_empresa FROM empresa WHERE id = $1', [empresa_id]);
      const subRes  = await db.query('SELECT id, nombre, rut, empresa_id FROM sub_empresa WHERE empresa_id = $1 ORDER BY nombre ASC', [empresa_id]);
      const siteRes = await db.query(
        'SELECT id, descripcion, empresa_id, id_serial, ubicacion FROM sitio WHERE empresa_id = $1 ORDER BY descripcion ASC',
        [empresa_id]
      );
      companies    = compRes.rows;
      subCompanies = subRes.rows;
      sites        = siteRes.rows;

    } else if (tipo === 'Gerente' || tipo === 'Cliente') {
      if (!empresa_id) {
        return res.json({ ok: true, data: [] });
      }
      const compRes = await db.query('SELECT id, nombre, rut, tipo_empresa FROM empresa WHERE id = $1', [empresa_id]);

      if (sub_empresa_id) {
        const subRes  = await db.query('SELECT id, nombre, rut, empresa_id FROM sub_empresa WHERE id = $1', [sub_empresa_id]);
        // sitio no tiene sub_empresa_id → filtramos por empresa y devolvemos todos sus sitios
        const siteRes = await db.query(
          'SELECT id, descripcion, empresa_id, id_serial, ubicacion FROM sitio WHERE empresa_id = $1 ORDER BY descripcion ASC',
          [empresa_id]
        );
        subCompanies = subRes.rows;
        sites        = siteRes.rows;
      } else {
        subCompanies = [];
        sites        = [];
      }
      companies = compRes.rows;

    } else {
      return res.status(403).json({ ok: false, error: 'Rol no reconocido' });
    }

    // Construir árbol: sitios cuelgan de la empresa (no de sub-empresa)
    const tree = companies.map(company => ({
      ...company,
      sites: sites.filter(s => s.empresa_id === company.id),
      subCompanies: subCompanies
        .filter(sc => sc.empresa_id === company.id)
        .map(sc => ({ ...sc }))
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
    let query, params;

    if (tipo === 'SuperAdmin') {
      query  = 'SELECT id, nombre, rut, sitios, tipo_empresa FROM empresa ORDER BY nombre ASC';
      params = [];
    } else {
      query  = 'SELECT id, nombre, rut, sitios, tipo_empresa FROM empresa WHERE id = $1 ORDER BY nombre ASC';
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
 * Sitios de una empresa.
 * NOTA: sitio no tiene sub_empresa_id, siempre filtramos por empresa_id.
 */
exports.getCompanySites = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipo, empresa_id, sub_empresa_id } = req.user;

    // Determinar el empresa_id real a consultar
    let targetEmpresaId = id;

    if (tipo !== 'SuperAdmin') {
      // Si el id es una sub-empresa, resolvemos su empresa padre
      if (id.startsWith('SE')) {
        const check = await db.query(
          'SELECT empresa_id FROM sub_empresa WHERE id = $1',
          [id]
        );
        if (check.rows.length === 0) {
          return res.status(404).json({ ok: false, error: 'Sub-empresa no encontrada' });
        }
        targetEmpresaId = check.rows[0].empresa_id;

        // Validar que pertenece a la empresa del usuario
        if (targetEmpresaId !== empresa_id) {
          return res.status(403).json({ ok: false, error: 'No tiene acceso a esta sub-empresa' });
        }

        // Gerente/Cliente solo pueden ver su propia sub-empresa
        if ((tipo === 'Gerente' || tipo === 'Cliente') && sub_empresa_id && id !== sub_empresa_id) {
          return res.status(403).json({ ok: false, error: 'No tiene acceso a esta sub-empresa' });
        }
      } else {
        // Es empresa directa — validar acceso
        if (id !== empresa_id) {
          return res.status(403).json({ ok: false, error: 'No tiene acceso a esta empresa' });
        }
        targetEmpresaId = id;
      }
    } else {
      // SuperAdmin: si pasan una sub-empresa, resolver su empresa padre
      if (id.startsWith('SE')) {
        const check = await db.query('SELECT empresa_id FROM sub_empresa WHERE id = $1', [id]);
        if (check.rows.length === 0) {
          return res.status(404).json({ ok: false, error: 'Sub-empresa no encontrada' });
        }
        targetEmpresaId = check.rows[0].empresa_id;
      }
    }

    const { rows } = await db.query(
      'SELECT id, descripcion, id_serial, ubicacion FROM sitio WHERE empresa_id = $1 ORDER BY descripcion ASC',
      [targetEmpresaId]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
};