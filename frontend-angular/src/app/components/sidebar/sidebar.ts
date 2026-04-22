import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html'
})
export class SidebarComponent {
  auth = inject(AuthService);

  get user() { return this.auth.user(); }

  getUserInitial(): string {
    const u = this.auth.user();
    return u ? u.nombre.charAt(0).toUpperCase() : 'U';
  }

  logout(): void {
    this.auth.logout();
  }
}
