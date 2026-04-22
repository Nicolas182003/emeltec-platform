import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent),
    canActivate: [publicGuard]
  },
  {
    path: 'companies',
    loadComponent: () => import('./pages/companies/companies').then(m => m.CompaniesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'users',
    loadComponent: () => import('./pages/user-management/user-management').then(m => m.UserManagementComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'companies' }
];
