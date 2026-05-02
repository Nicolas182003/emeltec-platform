import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header
      class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white border-b border-slate-200"
      style="height: 64px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);"
    >
      <!-- Left: Logo -->
      <div class="flex items-center justify-center" style="min-width: 248px; width: 248px; border-right: 1px solid #E2E8F0; height: 100%;">
        <button
          type="button"
          class="flex items-center justify-center"
          (click)="router.navigate(['/dashboard'])"
        >
          <div style="overflow: hidden; height: 22px;">
            <img src="/images/emeltec-logo.svg" alt="Emeltec" style="height: 30px; width: auto; display: block; margin-top: -2px;" />
          </div>
        </button>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-2" style="padding: 0 20px;">

        <!-- Notifications -->
        <button
          class="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          title="Notificaciones"
        >
          <span class="material-symbols-outlined" style="font-size: 20px;">notifications</span>
        </button>

        <!-- Settings (SuperAdmin / Admin only) -->
        @if (auth.canEdit()) {
          <button
            class="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title="Configuración"
          >
            <span class="material-symbols-outlined" style="font-size: 20px;">settings</span>
          </button>
        }

        <!-- User management (SuperAdmin / Admin only) -->
        @if (auth.canManageUsers()) {
          <button
            (click)="goToUsers()"
            class="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title="Gestión de Usuarios"
          >
            <span class="material-symbols-outlined" style="font-size: 20px;">group</span>
          </button>
        }

        <!-- Divider -->
        <div class="w-px h-6 bg-slate-200 mx-1"></div>

        <!-- User info + avatar -->
        <div class="flex items-center gap-2.5">
          <div class="text-right hidden sm:block">
            <p class="text-[13px] font-semibold text-[#1E293B] leading-none">{{ auth.user()?.nombre || 'Usuario' }}</p>
            <p class="text-[11px] text-[#94A3B8] mt-0.5">{{ auth.user()?.tipo || 'Rol' }}</p>
          </div>

          <!-- Gradient avatar -->
          <div
            class="flex items-center justify-center rounded-full text-[11px] font-bold text-white cursor-pointer"
            style="width: 32px; height: 32px; background: linear-gradient(135deg, #0DAFBD, #04606A);"
          >
            {{ getUserInitials() }}
          </div>
        </div>

        <!-- Logout -->
        <button
          (click)="auth.logout()"
          class="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors ml-1"
          title="Cerrar Sesión"
        >
          <span class="material-symbols-outlined" style="font-size: 18px;">logout</span>
        </button>
      </div>
    </header>
  `
})
export class HeaderComponent {
  auth = inject(AuthService);
  router = inject(Router);

  goToUsers() {
    this.router.navigate(['/companies']);
  }

  getUserInitials(): string {
    const user = this.auth.user();
    const first = user?.nombre?.charAt(0) ?? '';
    const last = user?.apellido?.charAt(0) ?? '';
    return (`${first}${last}`.trim() || first || 'U').toUpperCase();
  }
}
