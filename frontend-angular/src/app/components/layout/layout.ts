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
    <div class="flex h-screen overflow-hidden bg-[#f0f2f5]" style="font-family: 'DM Sans', 'Josefin Sans', sans-serif;">
      <app-sidebar></app-sidebar>

      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <app-header></app-header>
        <main class="min-w-0 flex-1 overflow-y-auto bg-[#f0f2f5]">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
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
