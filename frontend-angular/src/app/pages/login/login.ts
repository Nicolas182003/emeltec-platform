import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html'
})
export class LoginComponent {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  isCodeSent = signal(false);
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  isSubmitting = signal(false);

  handleRequestCode(event: Event): void {
    event.preventDefault();
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.isSubmitting.set(true);

    this.http.post<any>('/api/auth/request-code', { email: this.email() }).subscribe({
      next: (res) => {
        if (res.ok) {
          this.isCodeSent.set(true);
          this.successMsg.set(res.message);
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.error || 'Fallo al conectar con el servidor.');
        this.isSubmitting.set(false);
      }
    });
  }

  handleLogin(event: Event): void {
    event.preventDefault();
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.isSubmitting.set(true);

    this.http.post<any>('/api/auth/login', { email: this.email(), password: this.password() }).subscribe({
      next: (res) => {
        if (res.ok) {
          this.auth.login(res.token, res.user);
          this.router.navigate(['/dashboard']);
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.error || 'Fallo al conectar con el servidor.');
        this.isSubmitting.set(false);
      }
    });
  }

  goToCodeEntry(): void {
    this.isCodeSent.set(true);
  }

  goBack(): void {
    this.isCodeSent.set(false);
  }
}
