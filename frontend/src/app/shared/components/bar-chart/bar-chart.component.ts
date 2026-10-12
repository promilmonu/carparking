import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BarDatum {
  label: string;
  value: number;
  display?: string;
}

/** Dependency-free vertical bar chart used for occupancy/revenue widgets. */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart" *ngIf="data.length; else empty">
      <div class="bar-wrap" *ngFor="let d of data" [title]="d.display ?? d.value">
        <div class="value">{{ d.display ?? d.value }}</div>
        <div class="track">
          <div class="bar" [style.height.%]="heightFor(d)"></div>
        </div>
        <div class="label">{{ d.label }}</div>
      </div>
    </div>
    <ng-template #empty><p class="text-muted">No data for this period.</p></ng-template>
  `,
  styles: [`
    .chart { display: flex; align-items: flex-end; gap: .6rem; height: 190px; overflow-x: auto; padding-top: 1.4rem; }
    .bar-wrap { flex: 1; min-width: 42px; display: flex; flex-direction: column; align-items: center; height: 100%; }
    .value { font-size: .68rem; color: var(--pe-muted); margin-bottom: .25rem; white-space: nowrap; }
    .track { flex: 1; width: 70%; display: flex; align-items: flex-end; background: #f0f2f8; border-radius: 6px 6px 0 0; overflow: hidden; }
    .bar { width: 100%; background: linear-gradient(180deg, #5c6bc0, #3f51b5); border-radius: 6px 6px 0 0; min-height: 2px; transition: height .3s ease; }
    .label { font-size: .68rem; color: var(--pe-muted); margin-top: .35rem; white-space: nowrap; }
  `],
})
export class BarChartComponent {
  @Input({ required: true }) data: BarDatum[] = [];
  @Input() maxValue?: number;

  heightFor(d: BarDatum): number {
    const max = this.maxValue ?? Math.max(...this.data.map((x) => x.value), 1);
    return Math.max(2, Math.round((d.value / max) * 100));
  }
}
