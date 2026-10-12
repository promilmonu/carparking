import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ParkingLocation } from '../../../core/models';
import { StatusLabelPipe } from '../../pipes/status-label.pipe';

@Component({
  selector: 'app-parking-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, StatusLabelPipe],
  template: `
    <article class="parking-card card" (click)="select.emit(location)">
      <div class="thumb">
        <img *ngIf="location.images?.length" [src]="location.images[0]" [alt]="location.name" />
        <div *ngIf="!location.images?.length" class="thumb-placeholder">
          <mat-icon>local_parking</mat-icon>
        </div>
        <span class="type-chip">{{ location.parkingType | statusLabel }}</span>
        <span class="inactive-chip" *ngIf="!location.isActive">Inactive</span>
      </div>
      <div class="body">
        <h3>{{ location.name }}</h3>
        <p class="address">
          <mat-icon>location_on</mat-icon>
          {{ location.address }}, {{ location.city }}
        </p>
        <div class="rates">
          <span><strong>{{ location.hourlyRate | currency }}</strong>/hr</span>
          <span><strong>{{ location.dailyRate | currency }}</strong>/day</span>
        </div>
        <div class="facilities">
          <span *ngFor="let f of location.facilities?.slice(0, 4)" class="facility">{{ f }}</span>
        </div>
        <div class="footer flex justify-between items-center">
          <span class="availability" [class.empty]="(location.availableSlots ?? 0) === 0">
            <mat-icon>grid_view</mat-icon>
            {{ location.availableSlots ?? 0 }} / {{ location.totalSlots ?? location.totalCapacity }} slots free
          </span>
          <a mat-flat-button color="primary" [routerLink]="['/parking', location._id]">View &amp; Book</a>
        </div>
      </div>
    </article>
  `,
  styles: [`
    .parking-card { padding: 0; overflow: hidden; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
    .parking-card:hover { transform: translateY(-2px); box-shadow: var(--pe-shadow-lg); }
    .thumb { position: relative; height: 150px; background: linear-gradient(135deg, #3f51b5, #7986cb); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb-placeholder { height: 100%; display: grid; place-items: center; }
    .thumb-placeholder mat-icon { font-size: 56px; width: 56px; height: 56px; color: rgba(255,255,255,.75); }
    .type-chip, .inactive-chip {
      position: absolute; top: .6rem; padding: .15rem .6rem; border-radius: 999px;
      font-size: .72rem; font-weight: 600; color: #fff; background: rgba(0,0,0,.55); text-transform: capitalize;
    }
    .type-chip { left: .6rem; }
    .inactive-chip { right: .6rem; background: #c62828; }
    .body { padding: 1rem; }
    h3 { font-size: 1.05rem; margin: 0; }
    .address { display: flex; gap: .25rem; align-items: center; color: var(--pe-muted); font-size: .85rem; margin: .35rem 0 .6rem; }
    .address mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .rates { display: flex; gap: 1rem; font-size: .9rem; margin-bottom: .5rem; }
    .facilities { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: .75rem; }
    .facility { font-size: .7rem; background: #eef1fa; color: #3949ab; padding: .15rem .5rem; border-radius: 999px; text-transform: capitalize; }
    .availability { display: flex; gap: .3rem; align-items: center; font-size: .82rem; color: var(--pe-success); font-weight: 600; }
    .availability mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .availability.empty { color: var(--pe-danger); }
  `],
})
export class ParkingCardComponent {
  @Input({ required: true }) location!: ParkingLocation;
  @Output() select = new EventEmitter<ParkingLocation>();
}
