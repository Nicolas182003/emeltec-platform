import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header';
import { SidebarComponent } from './sidebar/sidebar';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent],
  template: `
    <div class="min-h-screen" style="background: #F0F2F5; font-family: 'DM Sans', system-ui, sans-serif;">
      <app-header></app-header>

      <div class="flex">
        <app-sidebar></app-sidebar>

        <main class="flex-1 min-h-screen" style="margin-left: 248px; padding-top: 64px;">
          <div class="animate-in fade-in duration-500">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `
})
export class LayoutComponent implements OnInit {
  private router = inject(Router);

  ngOnInit(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    if (navigation?.type === 'reload' && this.router.url !== '/dashboard') {
      queueMicrotask(() => {
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      });
    }
  }
}
