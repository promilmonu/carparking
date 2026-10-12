import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusLabelPipe } from '../../pipes/status-label.pipe';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe],
  template: `<span class="badge" [attr.data-status]="status">{{ status | statusLabel }}</span>`,
  styles: [`
    .badge {
      display: inline-block;
      padding: .2rem .65rem;
      border-radius: 999px;
      font-size: .75rem;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
      background: #eceff1;
      color: #455a64;
    }
    .badge[data-status='available'], .badge[data-status='confirmed'], .badge[data-status='paid'],
    .badge[data-status='completed'], .badge[data-status='active'] { background: #e3f2e6; color: #1b5e20; }
    .badge[data-status='pending'], .badge[data-status='reserved'], .badge[data-status='refunded'] { background: #fff3e0; color: #e65100; }
    .badge[data-status='checked-in'], .badge[data-status='occupied'] { background: #e1f5fe; color: #01579b; }
    .badge[data-status='cancelled'], .badge[data-status='no-show'], .badge[data-status='maintenance'],
    .badge[data-status='failed'], .badge[data-status='inactive'] { background: #ffebee; color: #b71c1c; }
  `],
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: string;
}
