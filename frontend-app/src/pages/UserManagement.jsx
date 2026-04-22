import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { UserPlus, Box, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import axios from 'axios';

export default function UserManagement() {
  const { user } = useContext(AuthContext);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    cargo: '',
    tipo: 'Cliente',
    empresa_id: '',
    sub_empresa_id: ''
  });

  useEffect(() => {
    // Cargar empresas
    const fetchEmpresas = async () => {
      try {
        const token = localStorage.getItem('jwt_token');
        const res = await axios.get('/api/front/empresas', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.ok) setEmpresas(res.data.data);
      } catch (err) {
        console.error("Error al cargar empresas", err);
      }
    };
    fetchEmpresas();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await axios.post('/api/front/usuarios', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.ok) {
        setStatus({ type: 'success', msg: res.data.message });
        setFormData({ ...formData, nombre: '', apellido: '', email: '', telefono: '', cargo: '' });
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setStatus({ type: 'error', msg: err.response.data.error });
      } else {
        setStatus({ type: 'error', msg: "Error al crear el usuario." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col">
        {/* Topbar blanca */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Gestión de Usuarios</h1>
              <p className="text-sm text-slate-500">Añada nuevos miembros y proveedores al sistema</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 max-w-4xl mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            
            <div className="flex items-center gap-3 mb-6">
              <Mail className="text-blue-500 w-6 h-6" />
              <h2 className="text-lg font-bold text-slate-800">Invitar a un Evaluador o Cliente</h2>
            </div>
            
            <p className="text-sm text-slate-500 mb-8 border-l-4 border-blue-500 pl-4 py-1 bg-blue-50/50 rounded-r-lg">
              Al invitar a un usuario, el sistema <strong>generará y enviará automáticamente una clave inicial</strong> de 8 caracteres al correo que indiques.
            </p>

            {status.msg && (
              <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 font-medium transition-all ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {status.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                <span>{status.msg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Nombre *</label>
                  <input required name="nombre" value={formData.nombre} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" placeholder="Ej. Roberto" />
                </div>

                {/* Apellido */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Apellido *</label>
                  <input required name="apellido" value={formData.apellido} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" placeholder="Ej. Sánchez" />
                </div>

                {/* Email */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Correo Electrónico * (Destino de la clave)</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" placeholder="roberto@empresa.com" />
                </div>

                {/* Rol */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Nivel de Acceso (Rol) *</label>
                  <select required name="tipo" value={formData.tipo} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-slate-800 font-medium">
                    <option value="Cliente">Cliente (Lectura)</option>
                    <option value="Gerente">Gerente (Supervisa Sub-Empresa)</option>
                    {user?.tipo === 'SuperAdmin' && <option value="Admin">Admin (Dueño Empresa Padre)</option>}
                  </select>
                </div>

                {/* Empresa */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Empresa Padre Asignada *</label>
                  <select required name="empresa_id" value={formData.empresa_id} onChange={(e) => setFormData({...formData, empresa_id: e.target.value, sub_empresa_id: ''})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-slate-800">
                    <option value="" disabled>-- Selecciona una Empresa --</option>
                    {empresas.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre} ({e.tipo_empresa})</option>
                    ))}
                  </select>
                </div>

                {/* Sub Empresa (Condicional) */}
                {(formData.tipo === 'Gerente' || (formData.tipo === 'Cliente' && formData.empresa_id)) && (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Sub Empresa / Faena {formData.tipo === 'Gerente' ? '*' : '(Opcional para Clientes)'}
                    </label>
                    <select 
                      name="sub_empresa_id" 
                      value={formData.sub_empresa_id} 
                      onChange={handleChange} 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-slate-800"
                      required={formData.tipo === 'Gerente'}
                    >
                      <option value="">-- {formData.tipo === 'Gerente' ? 'Debes seleccionar una sucursal' : 'Toda la Empresa Padre'} --</option>
                      {empresas.find(e => e.id === formData.empresa_id)?.sub_empresas?.map(se => (
                        <option key={se.id} value={se.id}>{se.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Opcionales */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Teléfono Auxiliar</label>
                  <input name="telefono" value={formData.telefono} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" placeholder="+56 9 ..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Cargo</label>
                  <input name="cargo" value={formData.cargo} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" placeholder="Ej. Supervisor de Planta" />
                </div>

              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button type="submit" disabled={loading} className={`px-6 py-3 rounded-xl text-white font-bold transition-all shadow-md ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'}`}>
                  {loading ? 'Generando Contraseña...' : 'Invitar y Enviar Correo'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
