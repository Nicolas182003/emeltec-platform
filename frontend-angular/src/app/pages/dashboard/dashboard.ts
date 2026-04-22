import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { MetricCardComponent } from '../../components/metric-card/metric-card';
import { ChartCardComponent } from '../../components/chart-card/chart-card';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SidebarComponent, MetricCardComponent, ChartCardComponent],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  auth = inject(AuthService);

  latestData = signal<any>(null);
  historicalData = signal<any[]>([]);
  availableKeys = signal<string[]>([]);
  loading = signal(true);
  private intervalId: any;

  // Colores alternados para gráficos
  chartColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

  ngOnInit(): void {
    this.fetchData();
    this.intervalId = setInterval(() => this.fetchData(), 15000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  fetchData(): void {
    this.loading.set(true);

    // 1. Obtener último registro
    this.http.get<any>('/api/data/latest').subscribe({
      next: (json) => {
        let lastTimestamp: string | null = null;
        if (json.ok && json.data?.length > 0) {
          const row = json.data[0];
          this.latestData.set(row);
          lastTimestamp = row.timestamp_completo || row.time;
          
          const metricsObj = row.data || {};
          this.availableKeys.set(Object.keys(metricsObj));
        }

        // 2. Obtener histórico
        let url = '/api/data/preset?preset=365d';
        if (lastTimestamp) {
          url += `&base_date=${encodeURIComponent(lastTimestamp)}`;
        }

        this.http.get<any>(url).subscribe({
          next: (histJson) => {
            if (histJson.ok && histJson.data) {
              const flatData = histJson.data.map((row: any) => ({
                time: row.timestamp_completo || row.time,
                ...(row.data || {})
              })).reverse();
              this.historicalData.set(flatData);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  getMetricTitle(key: string): string {
    if (key.toUpperCase().includes('REG1')) return 'Nivel Freático';
    if (key.toUpperCase().includes('CAUDAL') || key === 'REG2') return 'Caudal Instantáneo';
    return `Métrica ${key}`;
  }

  getMetricUnit(key: string): string {
    if (key.toUpperCase().includes('REG1')) return 'm';
    if (key.toUpperCase().includes('CAUDAL') || key === 'REG2') return 'L/s';
    return 'uds';
  }

  getMetricValue(key: string): any {
    const data = this.latestData();
    return data?.data ? data.data[key] : undefined;
  }

  getMetricTime(): string {
    const data = this.latestData();
    return data ? (data.timestamp_completo || data.time) : '';
  }

  getChartTitle(key: string): string {
    if (key.toUpperCase().includes('REG1')) return 'Fluctuación del Nivel Freático';
    if (key.toUpperCase().includes('CAUDAL') || key === 'REG2') return 'Comportamiento del Caudal';
    return `Histórico - ${key}`;
  }

  getChartColor(index: number): string {
    return this.chartColors[index % this.chartColors.length];
  }

  get currentTime(): string {
    return new Date().toLocaleTimeString('es-ES');
  }
}
