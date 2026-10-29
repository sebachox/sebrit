import { Component } from '@angular/core';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-admin-dashboard',
  imports: [StatCard, StatusBadge],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {}