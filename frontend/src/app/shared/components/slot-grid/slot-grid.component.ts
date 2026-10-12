import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParkingSlot, SlotStatus } from '../../../core/models';
import { StatusLabelPipe } from '../../pipes/status-label.pipe';

/** Visual slot grid with selection support. */
@Component({
  selector: 'app-slot-grid',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe],
  template: `
    <div class="legend">
      <span *ngFor="let s of legend" class="legend-item">
        <i [attr.data-status]="s"></i>{{ s | statusLabel }}
      </span>
    </div>
    <div class="floors" *ngIf="groupedFloors.length; else empty">
      <div *ngFor="let g of groupedFloors" class="floor">
        <h4>Floor {{ g.floor === 'G' ? 'Ground' : g.floor }}</h4>
        <div class="slots">
          <button
            *ngFor="let slot of g.slots"
            type="button"
            class="slot"
            [class.selected]="selectedSlotId === slot._id"
            [attr.data-status]="effectiveStatus(slot)"
            [disabled]="!selectable || effectiveStatus(slot) !== 'available'"
            (click)="select.emit(slot)"
            [title]="slot.slotNumber + ' — ' + effectiveStatus(slot)">
            <span class="num">{{ slot.slotNumber }}</span>
            <span class="cat" *ngIf="slot.category !== 'regular'">{{ slot.category }}</span>
          </button>
        </div>
      </div>
    </div>
    <ng-template #empty><p class="text-muted">No slots match the current filters.</p></ng-template>
  `,
  styles: [`
    .legend { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; font-size: .78rem; color: var(--pe-muted); }
    .legend-item { display: flex; align-items: center; gap: .35rem; }
    .legend-item i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
    .legend-item i[data-status='available'] { background: #e3f2e6; border: 1px solid #7cb77f; }
    .legend-item i[data-status='reserved'] { background: #fff3e0; border: 1px solid #ffb74d; }
    .legend-item i[data-status='occupied'] { background: #e1f5fe; border: 1px solid #4fc3f7; }
    .legend-item i[data-status='maintenance'] { background: #ffebee; border: 1px solid #ef9a9a; }
    .floor h4 { margin: .75rem 0 .5rem; font-size: .9rem; color: var(--pe-muted); text-transform: uppercase; letter-spacing: .04em; }
    .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: .5rem; }
    .slot {
      border: 1px solid var(--pe-border); border-radius: 8px; padding: .55rem .25rem; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: .15rem; font-weight: 600; font-size: .85rem;
      background: #fff; transition: transform .1s ease, box-shadow .1s ease;
    }
    .slot:not(:disabled):hover { transform: translateY(-2px); box-shadow: var(--pe-shadow); }
    .slot:disabled { cursor: not-allowed; opacity: .85; }
    .slot .cat { font-size: .6rem; font-weight: 500; text-transform: uppercase; color: var(--pe-muted); }
    .slot[data-status='available'] { background: #f1f8f2; border-color: #7cb77f; color: #1b5e20; }
    .slot[data-status='reserved'] { background: #fff3e0; border-color: #ffb74d; color: #e65100; }
    .slot[data-status='occupied'] { background: #e1f5fe; border-color: #4fc3f7; color: #01579b; }
    .slot[data-status='maintenance'] { background: #ffebee; border-color: #ef9a9a; color: #b71c1c; }
    .slot.selected { outline: 3px solid var(--pe-primary); outline-offset: 1px; }
  `],
})
export class SlotGridComponent {
  @Input({ required: true }) slots: ParkingSlot[] = [];
  @Input() selectable = false;
  @Input() selectedSlotId: string | null = null;
  @Output() select = new EventEmitter<ParkingSlot>();

  readonly legend: SlotStatus[] = ['available', 'reserved', 'occupied', 'maintenance'];

  /** For customer booking we derive display status from availability flags. */
  effectiveStatus(slot: ParkingSlot): string {
    if (slot.isAvailable === false) return 'reserved';
    if (slot.isAvailable === true) return 'available';
    return slot.status;
  }

  get groupedFloors(): { floor: string; slots: ParkingSlot[] }[] {
    const map = new Map<string, ParkingSlot[]>();
    for (const s of this.slots) {
      const key = s.floor || 'G';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].map(([floor, slots]) => ({ floor, slots }));
  }
}
