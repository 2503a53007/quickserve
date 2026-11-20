'use client';

import React, { useState } from 'react';
import { Check, Copy, Download, Share2, Zap } from 'lucide-react';
import type { Invoice } from '@/types/db';
import { downloadInvoicePdf, formatCopyBillText } from '@/lib/pdf/invoicePdf';

export function InvoiceView({ invoice }: { invoice: Invoice }) {
  const [copied, setCopied] = useState(false);

  const handleCopyBill = async () => {
    const text = formatCopyBillText(invoice);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    const text = formatCopyBillText(invoice);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `QuickServe Invoice ${invoice.invoice_number}`,
          text,
        });
        return;
      } catch {
        // user dismissed share sheet
      }
    }
    await handleCopyBill();
  };

  return (
    <div className="rounded-3xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#F97316] to-[#EA580C] p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
            <Zap className="w-6 h-6 fill-white" />
          </span>
          <div>
            <h3 className="font-black text-xl">QuickServe Tax Invoice</h3>
            <p className="text-xs text-orange-100">
              {invoice.invoice_number} · Date: {invoice.service_date}
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
            invoice.payment_status === 'paid' ? 'bg-[#16A34A] text-white' : 'bg-white text-[#EA580C]'
          }`}
        >
          {invoice.payment_status} ({(invoice.payment_method ?? 'cash').toUpperCase()})
        </span>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-2xl bg-[#FFF7F2] dark:bg-slate-800/70">
            <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Customer</p>
            <p className="font-bold text-[#171717] dark:text-white mt-1">{invoice.customer_name ?? 'Customer'}</p>
            {invoice.customer_mobile && <p className="text-xs text-[#737373] dark:text-slate-400">{invoice.customer_mobile}</p>}
            {invoice.customer_address && (
              <p className="text-xs text-[#737373] dark:text-slate-400 mt-1">{invoice.customer_address}</p>
            )}
          </div>
          <div className="p-4 rounded-2xl bg-[#FFF7F2] dark:bg-slate-800/70">
            <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Service &amp; Provider</p>
            <p className="font-bold text-[#171717] dark:text-white mt-1">{invoice.service_name}</p>
            <p className="text-xs text-[#737373] dark:text-slate-400">
              Provider: {invoice.provider_name ?? invoice.company_name ?? 'Verified Professional'}
            </p>
            <p className="text-xs text-[#737373] dark:text-slate-400 mt-1">
              Duration: <strong>{invoice.actual_hours} hr</strong> actual · <strong>{invoice.billed_hours} hr</strong> billed
            </p>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange-100 dark:border-slate-800 text-left text-xs uppercase tracking-wider text-[#737373]">
                <th className="py-2.5">Description</th>
                <th className="py-2.5 text-center">Qty</th>
                <th className="py-2.5 text-right">Rate</th>
                <th className="py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(invoice.line_items ?? []).map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 font-semibold text-[#171717] dark:text-white">{item.label}</td>
                  <td className="py-3 text-center text-[#737373]">{item.quantity}</td>
                  <td className="py-3 text-right text-[#737373]">₹{Number(item.rate).toFixed(2)}</td>
                  <td className="py-3 text-right font-bold text-[#171717] dark:text-white">
                    ₹{Number(item.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-orange-100 dark:border-slate-800 pt-4 space-y-2 text-sm max-w-xs ml-auto">
          <div className="flex justify-between">
            <span className="text-[#737373]">Base + Visiting</span>
            <span className="font-semibold">
              ₹{(Number(invoice.base_amount) + Number(invoice.visiting_charge)).toFixed(2)}
            </span>
          </div>
          {Number(invoice.material_cost) > 0 && (
            <div className="flex justify-between">
              <span className="text-[#737373]">Materials</span>
              <span className="font-semibold">₹{Number(invoice.material_cost).toFixed(2)}</span>
            </div>
          )}
          {Number(invoice.spare_parts_cost) > 0 && (
            <div className="flex justify-between">
              <span className="text-[#737373]">Spare Parts</span>
              <span className="font-semibold">₹{Number(invoice.spare_parts_cost).toFixed(2)}</span>
            </div>
          )}
          {Number(invoice.discount_amount) > 0 && (
            <div className="flex justify-between text-[#16A34A]">
              <span>Coupon Discount</span>
              <span className="font-bold">-₹{Number(invoice.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#737373]">GST ({invoice.tax_percent}%)</span>
            <span className="font-semibold">₹{Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-orange-200 dark:border-slate-700 text-base font-black text-[#171717] dark:text-white">
            <span>Total Payable</span>
            <span className="text-[#EA580C]">₹{Number(invoice.total_amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Action buttons: Download PDF, Copy Bill, Share Invoice */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => downloadInvoicePdf(invoice)}
            className="flex-1 min-w-[140px] h-11 px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:opacity-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button
            type="button"
            onClick={handleCopyBill}
            className="flex-1 min-w-[140px] h-11 px-4 rounded-xl bg-[#FFF1E8] dark:bg-orange-500/15 hover:bg-orange-100 text-[#EA580C] dark:text-orange-400 font-bold text-sm flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Bill Copied!' : 'Copy Bill'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#F97316] font-bold text-sm flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" /> Share Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
