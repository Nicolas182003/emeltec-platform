import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CompanyService } from '../../../services/company.service';

interface Module {
  key: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  tipoEmpresa: string | null;
}

const MODULES: Module[] = [
  { key: 'agua',     label: 'Consumo de Agua',      icon: 'water_drop', color: '#0DAFBD', bg: 'rgba(13,175,189,0.10)',  tipoEmpresa: 'Agua'      },
  { key: 'riles',    label: 'Generación de Riles',  icon: 'waves',      color: '#22C55E', bg: 'rgba(34,197,94,0.08)',   tipoEmpresa: 'Riles'     },
  { key: 'proceso',  label: 'Variables de Proceso',  icon: 'memory',     color: '#6366F1', bg: 'rgba(99,102,241,0.08)', tipoEmpresa: 'Proceso'   },
  { key: 'electrico',label: 'Consumo Eléctrico',    icon: 'bolt',       color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', tipoEmpresa: 'Eléctrico' },
  { key: 'maletas',  label: 'Maletas Piloto',        icon: 'rocket',     color: '#F97316', bg: 'rgba(249,115,22,0.08)', tipoEmpresa: null        },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside
      class="fixed left-0 bottom-0 z-40 flex flex-col overflow-y-auto bg-white"
      style="top: 64px; width: 248px; border-right: 1px solid #E2E8F0; box-shadow: 1px 0 4px rgba(0,0,0,0.04);"
    >
      <!-- User card -->
      <div style="margin: 10px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px;">
        <div class="flex items-center gap-2.5">
          <div class="relative flex items-center justify-center rounded-full text-[11px] font-bold text-white flex-shrink-0"
            style="width: 32px; height: 32px; background: linear-gradient(135deg, #0DAFBD, #04606A);">
            {{ getUserInitials() }}
            <span class="absolute rounded-full border-2"
              style="width: 8px; height: 8px; bottom: 1px; right: 1px; background: #22C55E; border-color: #F8FAFC;"></span>
          </div>
          <div class="min-w-0">
            <div class="truncate font-semibold" style="font-size: 13px; color: #1E293B;">{{ auth.user()?.nombre || 'Usuario' }}</div>
            <div style="font-size: 11px; color: #94A3B8;">{{ auth.user()?.tipo || 'Rol' }}</div>
          </div>
        </div>
      </div>

      <!-- Dashboard link -->
      <div style="padding: 4px 8px;">
        <a
          routerLink="/dashboard"
          routerLinkActive
          #rla="routerLinkActive"
          class="flex items-center gap-2.5 rounded-lg transition-all"
          style="padding: 8px 10px; font-size: 13px; font-weight: 500; text-decoration: none;"
          [style.background]="rla.isActive ? 'rgba(13,175,189,0.06)' : 'transparent'"
          [style.color]="rla.isActive ? '#0899A5' : '#475569'"
        >
          <div class="flex items-center justify-center rounded-[7px]"
            style="width: 28px; height: 28px; background: rgba(13,175,189,0.10); border: 1px solid rgba(13,175,189,0.2);">
            <span class="material-symbols-outlined" style="font-size: 14px; color: #0DAFBD;">grid_view</span>
          </div>
          <span>Dashboard</span>
        </a>
      </div>

      <!-- ── SuperAdmin: full module tree ── -->
      @if (auth.isSuperAdmin()) {
        <div style="flex: 1; padding-bottom: 12px;">
          @for (mod of modules; track mod.key) {
            @if (companiesForModule(mod).length > 0) {
              <div style="margin: 2px 8px;">
                <!-- Module header -->
                <div
                  (click)="toggleModule(mod.key)"
                  class="flex items-center justify-between rounded-lg cursor-pointer transition-all"
                  style="padding: 8px 10px; font-size: 13px; font-weight: 500; color: #475569;"
                  (mouseenter)="onModuleHover($event, true)"
                  (mouseleave)="onModuleHover($event, false)"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="flex items-center justify-center rounded-[7px] flex-shrink-0"
                      [style.background]="mod.bg"
                      [style.border]="'1px solid ' + mod.color + '33'"
                      style="width: 28px; height: 28px;">
                      <span class="material-symbols-outlined" [style.color]="mod.color" style="font-size: 14px;">{{ mod.icon }}</span>
                    </div>
                    <span>{{ mod.label }}</span>
                  </div>
                  <span
                    class="material-symbols-outlined transition-transform"
                    [style.transform]="openModules[mod.key] ? 'rotate(90deg)' : 'none'"
                    style="font-size: 14px; color: #CBD5E1;"
                  >chevron_right</span>
                </div>

                <!-- Company / plant tree -->
                @if (openModules[mod.key]) {
                  <div style="padding-left: 16px; margin-bottom: 4px;">
                    @for (company of companiesForModule(mod); track company.id) {
                      <!-- Company label -->
                      <div class="flex items-center gap-1.5" style="padding: 5px 10px 2px; font-size: 10px; font-weight: 700; color: #94A3B8; letter-spacing: 0.07em; text-transform: uppercase;">
                        <span class="material-symbols-outlined" style="font-size: 10px; opacity: 0.5;">domain</span>
                        {{ company.nombre }}
                      </div>
                      <!-- Plants with tree line -->
                      <div class="relative" style="padding-left: 14px;">
                        <div class="absolute" style="left: 4px; top: 0; bottom: 6px; width: 1px; background: #E2E8F0;"></div>
                        @for (sub of company.subCompanies; track sub.id) {
                          <div
                            (click)="selectSubCompany(sub.id)"
                            class="relative cursor-pointer rounded-md transition-all"
                            style="font-size: 12px; padding: 5px 10px 5px 12px; margin-bottom: 1px;"
                            [style.color]="selectedId() === sub.id ? '#0899A5' : '#64748B'"
                            [style.fontWeight]="selectedId() === sub.id ? '600' : '400'"
                            [style.background]="selectedId() === sub.id ? 'rgba(13,175,189,0.06)' : 'transparent'"
                            (mouseenter)="onPlantHover($event, sub.id)"
                            (mouseleave)="onPlantLeave($event, sub.id)"
                          >
                            <span class="absolute block" style="left: -10px; top: 50%; width: 8px; height: 1px;"
                              [style.background]="selectedId() === sub.id ? '#0DAFBD' : '#E2E8F0'"></span>
                            {{ sub.nombre }}
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <!-- ── Admin view ── -->
      @if (auth.isAdmin()) {
        <div style="flex: 1; padding: 4px 8px 12px;">
          <div class="rounded-lg" style="padding: 6px 10px; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #94A3B8;">Mi Empresa</span>
          </div>
          @for (company of filteredTree(); track company.id) {
            <div style="margin-bottom: 2px;">
              <div
                (click)="toggleItem(company.id)"
                class="flex items-center gap-2 rounded-lg cursor-pointer transition-all"
                style="padding: 8px 10px; font-size: 13px; color: #475569;"
                (mouseenter)="onModuleHover($event, true)"
                (mouseleave)="onModuleHover($event, false)"
              >
                <span class="material-symbols-outlined transition-transform" [class.rotate-90]="expanded[company.id]" style="font-size: 16px; color: #CBD5E1;">chevron_right</span>
                <span class="truncate font-medium" style="font-size: 13px;">{{ company.nombre }}</span>
              </div>
              @if (expanded[company.id]) {
                <div class="relative" style="padding-left: 24px; margin-top: 2px;">
                  <div class="absolute" style="left: 14px; top: 0; bottom: 6px; width: 1px; background: #E2E8F0;"></div>
                  @for (sub of company.subCompanies; track sub.id) {
                    <div
                      (click)="selectSubCompany(sub.id)"
                      class="relative cursor-pointer rounded-md transition-all"
                      style="font-size: 12px; padding: 5px 10px 5px 12px; margin-bottom: 1px;"
                      [style.color]="selectedId() === sub.id ? '#0899A5' : '#64748B'"
                      [style.fontWeight]="selectedId() === sub.id ? '600' : '400'"
                      [style.background]="selectedId() === sub.id ? 'rgba(13,175,189,0.06)' : 'transparent'"
                      (mouseenter)="onPlantHover($event, sub.id)"
                      (mouseleave)="onPlantLeave($event, sub.id)"
                    >
                      <span class="absolute block" style="left: -10px; top: 50%; width: 8px; height: 1px;"
                        [style.background]="selectedId() === sub.id ? '#0DAFBD' : '#E2E8F0'"></span>
                      {{ sub.nombre }}
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- ── Gerente view ── -->
      @if (auth.isGerente()) {
        <div style="flex: 1; padding: 4px 8px 12px;">
          <div style="padding: 6px 10px; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #94A3B8;">Mi División</span>
          </div>
          @for (company of filteredTree(); track company.id) {
            <div style="margin-bottom: 2px;">
              <div class="flex items-center gap-2 rounded-lg" style="padding: 7px 10px; background: #F8FAFC;">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #0DAFBD;">corporate_fare</span>
                <span class="truncate font-semibold" style="font-size: 13px; color: #1E293B;">{{ company.nombre }}</span>
              </div>
              <div class="relative" style="padding-left: 24px; margin-top: 2px;">
                <div class="absolute" style="left: 14px; top: 0; bottom: 6px; width: 1px; background: #E2E8F0;"></div>
                @for (sub of company.subCompanies; track sub.id) {
                  <div
                    (click)="selectSubCompany(sub.id)"
                    class="relative cursor-pointer rounded-md transition-all"
                    style="font-size: 12px; padding: 5px 10px 5px 12px; margin-bottom: 1px;"
                    [style.color]="selectedId() === sub.id ? '#0899A5' : '#64748B'"
                    [style.background]="selectedId() === sub.id ? 'rgba(13,175,189,0.06)' : 'transparent'"
                    (mouseenter)="onPlantHover($event, sub.id)"
                    (mouseleave)="onPlantLeave($event, sub.id)"
                  >
                    <span class="absolute block" style="left: -10px; top: 50%; width: 8px; height: 1px;"
                      [style.background]="selectedId() === sub.id ? '#0DAFBD' : '#E2E8F0'"></span>
                    {{ sub.nombre }}
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- ── Cliente view ── -->
      @if (auth.isCliente()) {
        <div style="flex: 1; padding: 4px 8px 12px;">
          <div style="padding: 6px 10px; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #94A3B8;">Mi Vista</span>
          </div>
          @for (company of filteredTree(); track company.id) {
            <div class="flex items-center gap-1.5 px-2.5 py-1" style="color: #94A3B8;">
              <span class="material-symbols-outlined" style="font-size: 14px;">domain</span>
              <span class="truncate" style="font-size: 10px; font-weight: 500;">{{ company.nombre }}</span>
            </div>
            @for (sub of company.subCompanies; track sub.id) {
              <div
                (click)="selectSubCompany(sub.id)"
                class="flex items-center gap-2 cursor-pointer rounded-lg transition-all"
                style="padding: 8px 12px; margin-bottom: 2px; background: rgba(13,175,189,0.06); border: 1px solid rgba(13,175,189,0.15);"
              >
                <div class="flex items-center justify-center rounded-lg bg-white" style="width: 28px; height: 28px;">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: #0DAFBD;">factory</span>
                </div>
                <div class="min-w-0">
                  <span class="block truncate font-semibold" style="font-size: 11px; color: #0899A5;">{{ sub.nombre }}</span>
                  <span style="font-size: 9px; color: #94A3B8;">Solo lectura</span>
                </div>
              </div>
            }
          }
        </div>
      }
    </aside>
  `,
})
export class SidebarComponent implements OnInit {
  companyService = inject(CompanyService);
  auth = inject(AuthService);
  router = inject(Router);

  readonly modules = MODULES;

  expanded: Record<string, boolean> = {};
  openModules: Record<string, boolean> = { agua: true };
  filteredTree = signal<any[]>([]);
  selectedId = this.companyService.selectedSubCompanyId;

  companiesForModule(mod: Module): any[] {
    const tree = this.filteredTree();
    if (mod.tipoEmpresa === null) {
      const known = MODULES.filter(m => m.tipoEmpresa !== null).map(m => m.tipoEmpresa);
      return tree.filter(c => !known.includes(c.tipo_empresa));
    }
    return tree.filter(c => c.tipo_empresa === mod.tipoEmpresa);
  }

  getUserInitials(): string {
    const user = this.auth.user();
    const first = user?.nombre?.charAt(0) ?? '';
    const last = user?.apellido?.charAt(0) ?? '';
    return (`${first}${last}`.trim() || first || 'U').toUpperCase();
  }

  ngOnInit() {
    this.companyService.fetchHierarchy().subscribe((res: any) => {
      if (res.ok) {
        this.filteredTree.set(res.data);

        if (res.data.length > 0) {
          const firstCompany = res.data[0];

          if (this.auth.isSuperAdmin()) {
            this.expanded[firstCompany.id] = true;
            if (firstCompany.subCompanies?.[0]) {
              this.setSelectedSubCompany(firstCompany.subCompanies[0].id);
            }
          } else if (this.auth.isAdmin()) {
            this.expanded[firstCompany.id] = true;
            if (firstCompany.subCompanies?.[0] && !this.selectedId()) {
              this.setSelectedSubCompany(firstCompany.subCompanies[0].id);
            }
          } else if (firstCompany.subCompanies?.[0]) {
            this.setSelectedSubCompany(firstCompany.subCompanies[0].id);
          }
        }
      }
    });
  }

  toggleModule(key: string) {
    this.openModules[key] = !this.openModules[key];
  }

  toggleItem(id: string) {
    this.expanded[id] = !this.expanded[id];
  }

  selectSubCompany(id: string) {
    this.setSelectedSubCompany(id);
    this.router.navigate(['/companies']);
  }

  onModuleHover(event: MouseEvent, enter: boolean) {
    const el = event.currentTarget as HTMLElement;
    el.style.background = enter ? '#F1F5F9' : 'transparent';
  }

  onPlantHover(event: MouseEvent, id: string) {
    if (this.selectedId() !== id) {
      (event.currentTarget as HTMLElement).style.background = '#F1F5F9';
    }
  }

  onPlantLeave(event: MouseEvent, id: string) {
    (event.currentTarget as HTMLElement).style.background =
      this.selectedId() === id ? 'rgba(13,175,189,0.06)' : 'transparent';
  }

  private setSelectedSubCompany(id: string) {
    this.companyService.selectedSubCompanyId.set(id);
  }
}
