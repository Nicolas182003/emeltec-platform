import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  tipo: string;
  empresa_id?: string;
  sub_empresa_id?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSignal = signal<User | null>(null);
  private tokenSignal = signal<string | null>(null);
  private loadingSignal = signal<boolean>(true);

  readonly user = this.userSignal.asReadonly();
  readonly token = this.tokenSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userSignal());

  constructor(private router: Router) {
    this.initFromStorage();
  }

  private initFromStorage(): void {
    const storedToken = localStorage.getItem('jwt_token');
    const storedUser = localStorage.getItem('user_data');
    if (storedToken && storedUser) {
      this.tokenSignal.set(storedToken);
      this.userSignal.set(JSON.parse(storedUser));
    }
    this.loadingSignal.set(false);
  }

  login(tokenStr: string, userData: User): void {
    localStorage.setItem('jwt_token', tokenStr);
    localStorage.setItem('user_data', JSON.stringify(userData));
    this.tokenSignal.set(tokenStr);
    this.userSignal.set(userData);
  }

  logout(): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }
}
