'use strict';

const mongoose = require('mongoose');

const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'failed'];

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: ['card', 'upi', 'cash', 'wallet'], default: 'card' },
    transactionId: { type: String, required: true, unique: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'paid', index: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
