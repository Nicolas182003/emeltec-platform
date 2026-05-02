import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="rounded-xl transition-shadow"
      style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);"
    >
      <!-- Label + icon -->
      <div class="flex items-center justify-between" style="margin-bottom: 10px;">
        <span
          style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #94A3B8;"
        >{{ label }}</span>
        <div
          class="flex items-center justify-center rounded-lg"
          style="width: 32px; height: 32px; background: rgba(13,175,189,0.08); border: 1px solid rgba(13,175,189,0.15);"
        >
          <ng-content></ng-content>
        </div>
      </div>

      <!-- Value -->
      <div class="flex items-baseline gap-1.5">
        <span
          style="font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: #0DAFBD; letter-spacing: -0.02em; line-height: 1;"
        >{{ value }}</span>
        <span *ngIf="unit" style="font-family: 'JetBrains Mono', monospace; font-size: 14px; color: #94A3B8;">{{ unit }}</span>
      </div>

      <!-- Trend -->
      <div class="flex items-center gap-1.5" style="margin-top: 8px;">
        <span
          class="rounded-full"
          style="width: 6px; height: 6px; background: #22C55E; display: inline-block; animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;"
        ></span>
        <span style="font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em;">{{ trend }}</span>
      </div>
    </div>
  `
})
export class KpiCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = '';
  @Input() unit: string = '';
  @Input() trend: string = '';
}
