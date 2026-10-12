import { Pipe, PipeTransform } from '@angular/core';

/** Human friendly labels + material icons for status values. */
const LABELS: Record<string, string> = {
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'checked-in': 'Checked In',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  'no-show': 'No Show',
  'available': 'Available',
  'reserved': 'Reserved',
  'occupied': 'Occupied',
  'maintenance': 'Maintenance',
  'paid': 'Paid',
  'refunded': 'Refunded',
  'failed': 'Failed',
  'indoor': 'Indoor',
  'outdoor': 'Outdoor',
  'basement': 'Basement',
  'multi-level': 'Multi Level',
  'two-wheeler': 'Two Wheeler',
  'car': 'Car',
  'suv': 'SUV',
  'commercial': 'Commercial',
};

@Pipe({ name: 'statusLabel', standalone: true })
export class StatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
  }
}
