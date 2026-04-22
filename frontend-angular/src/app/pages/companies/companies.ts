import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './companies.html'
})
export class CompaniesComponent implements OnInit {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  companies = signal<any[]>([]);
  sites = signal<any[]>([]);
  selectedCompany = signal<any>(null);
  searchTerm = signal('');
  loading = signal(true);
  sidebarCollapsed = signal(false);
  activeTab = signal('instalaciones');

  // Estado para Gestión de Usuarios
  empresas = signal<any[]>([]);
  userFormLoading = signal(false);
  userStatus = signal<{ type: string; msg: string }>({ type: '', msg: '' });
  formData = signal({
    nombre: '', apellido: '', email: '', telefono: '',
    cargo: '', tipo: 'Cliente', empresa_id: '', sub_empresa_id: ''
  });

  get user() { return this.auth.user(); }

  get filteredCompanies() {
    const term = this.searchTerm().toLowerCase();
    return this.companies().filter(c => c.nombre.toLowerCase().includes(term));
  }

  getUserInitial(): string {
    const u = this.auth.user();
    return u ? u.nombre.charAt(0).toUpperCase() : 'U';
  }

  ngOnInit(): void {
    this.fetchCompanies();
    this.fetchEmpresas();
  }

  fetchCompanies(): void {
    this.http.get<any>('/api/companies').subscribe({
      next: (json) => {
        if (json.ok && json.data) {
          this.companies.set(json.data);
          if (json.data.length > 0) {
            this.selectCompany(json.data[0]);
          }
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  fetchEmpresas(): void {
    this.http.get<any>('/api/users/empresas').subscribe({
      next: (res) => {
        if (res.ok) this.empresas.set(res.data);
      }
    });
  }

  selectCompany(company: any): void {
    this.selectedCompany.set(company);
    this.activeTab.set('instalaciones');
    this.fetchSites(company.id);
  }

  fetchSites(companyId: string): void {
    this.http.get<any>(`/api/companies/${companyId}/sites`).subscribe({
      next: (json) => {
        if (json.ok && json.data) this.sites.set(json.data);
      }
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  logout(): void {
    this.auth.logout();
  }

  // ── Formulario de Usuarios ──
  updateFormField(field: string, value: string): void {
    this.formData.update(f => ({ ...f, [field]: value }));
  }

  updateEmpresaId(value: string): void {
    this.formData.update(f => ({ ...f, empresa_id: value, sub_empresa_id: '' }));
  }

  get selectedEmpresaSubEmpresas(): any[] {
    const emp = this.empresas().find(e => e.id === this.formData().empresa_id);
    return emp?.sub_empresas || [];
  }

  handleUserSubmit(event: Event): void {
    event.preventDefault();
    this.userFormLoading.set(true);
    this.userStatus.set({ type: '', msg: '' });

    this.http.post<any>('/api/users', this.formData()).subscribe({
      next: (res) => {
        if (res.ok) {
          this.userStatus.set({ type: 'success', msg: res.message });
          this.formData.update(f => ({ ...f, nombre: '', apellido: '', email: '', telefono: '', cargo: '' }));
        }
        this.userFormLoading.set(false);
      },
      error: (err) => {
        this.userStatus.set({ type: 'error', msg: err.error?.error || 'Error al crear el usuario.' });
        this.userFormLoading.set(false);
      }
    });
  }

  get tabs() {
    const base = [
      { key: 'general', label: 'General' },
      { key: 'instalaciones', label: 'Instalaciones' },
      { key: 'contactos', label: 'Contactos' }
    ];
    if (this.user && (this.user.tipo === 'Admin' || this.user.tipo === 'SuperAdmin')) {
      base.push({ key: 'usuarios', label: 'Usuarios' });
    }
    return base;
  }
}
