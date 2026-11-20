import { jsPDF } from 'jspdf';
import type { Invoice } from '@/types/db';

/** Formats a clean plain-text invoice for the "Copy Bill" and "Share Invoice" actions. */
export function formatCopyBillText(inv: Invoice): string {
  const lines = [
    '========================================',
    '        QUICKSERVE — TAX INVOICE        ',
    '     Your Services. Your Vibe.          ',
    '========================================',
    `Invoice No : ${inv.invoice_number}`,
    `Booking ID : ${inv.booking_id}`,
    `Service    : ${inv.service_name}`,
    `Date       : ${inv.service_date}`,
    `Start Time : ${inv.start_time ? new Date(inv.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}`,
    `End Time   : ${inv.end_time ? new Date(inv.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}`,
    `Duration   : ${inv.actual_hours} hr(s) actual / ${inv.billed_hours} hr(s) billed`,
    '----------------------------------------',
    `Customer   : ${inv.customer_name ?? 'Customer'}`,
    inv.customer_mobile ? `Mobile     : ${inv.customer_mobile}` : null,
    inv.customer_address ? `Address    : ${inv.customer_address}` : null,
    `Provider   : ${inv.provider_name ?? inv.company_name ?? 'Verified Professional'}`,
    '----------------------------------------',
    'ITEMIZED CHARGES:',
    ...(inv.line_items ?? []).map(
      (item) => `  • ${item.label} (${item.quantity} × ₹${item.rate.toFixed(2)}) = ₹${item.amount.toFixed(2)}`,
    ),
    '----------------------------------------',
    `Base Labor     : ₹${Number(inv.base_amount).toFixed(2)}`,
    `Visiting Fee   : ₹${Number(inv.visiting_charge).toFixed(2)}`,
    Number(inv.material_cost) > 0 ? `Materials      : ₹${Number(inv.material_cost).toFixed(2)}` : null,
    Number(inv.spare_parts_cost) > 0 ? `Spare Parts    : ₹${Number(inv.spare_parts_cost).toFixed(2)}` : null,
    Number(inv.discount_amount) > 0 ? `Discount       : -₹${Number(inv.discount_amount).toFixed(2)}` : null,
    `GST (${inv.tax_percent}%)    : ₹${Number(inv.tax_amount).toFixed(2)}`,
    '========================================',
    `TOTAL PAYABLE  : ₹${Number(inv.total_amount).toFixed(2)}`,
    `Payment Status : ${inv.payment_status.toUpperCase()} (${(inv.payment_method ?? 'cash').toUpperCase()})`,
    '========================================',
    'Thank you for choosing QuickServe! Book it. Track it. Done.',
  ].filter(Boolean);

  return lines.join('\n');
}

/** Generates and downloads a clean branded QuickServe PDF invoice using jsPDF. */
export function downloadInvoicePdf(inv: Invoice): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // Orange header banner
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, 595, 92, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('QuickServe', 40, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Your Services. Your Vibe.  •  Book it. Track it. Done.', 40, 64);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('TAX INVOICE', 460, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(inv.invoice_number, 460, 62);

  // Meta block
  doc.setTextColor(23, 23, 23);
  let y = 122;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Billed To', 40, y);
  doc.text('Service Provider', 320, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 16;
  doc.text(inv.customer_name ?? 'Customer', 40, y);
  doc.text(inv.provider_name ?? inv.company_name ?? 'Verified Professional', 320, y);

  y += 14;
  if (inv.customer_mobile) doc.text(`Phone: ${inv.customer_mobile}`, 40, y);
  doc.text(`Service: ${inv.service_name}`, 320, y);

  y += 14;
  if (inv.customer_address) {
    const addrLines = doc.splitTextToSize(inv.customer_address, 240);
    doc.text(addrLines, 40, y);
  }
  doc.text(`Date: ${inv.service_date}`, 320, y);

  y += 14;
  doc.text(`Duration: ${inv.actual_hours} hr actual / ${inv.billed_hours} hr billed`, 320, y);

  // Table Header
  y += 42;
  doc.setFillColor(255, 241, 232);
  doc.rect(40, y, 515, 26, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(234, 88, 12);
  doc.text('Item Description', 52, y + 17);
  doc.text('Qty', 340, y + 17);
  doc.text('Rate (INR)', 400, y + 17);
  doc.text('Amount (INR)', 480, y + 17);

  // Line items
  y += 42;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(23, 23, 23);
  for (const item of inv.line_items ?? []) {
    doc.text(item.label, 52, y);
    doc.text(String(item.quantity), 340, y);
    doc.text(`Rs.${Number(item.rate).toFixed(2)}`, 400, y);
    doc.text(`Rs.${Number(item.amount).toFixed(2)}`, 480, y);
    y += 22;
  }

  // Divider
  doc.setDrawColor(253, 224, 205);
  doc.line(40, y, 555, y);
  y += 22;

  const summaryRows: Array<[string, string]> = [
    ['Base Service Charge', `Rs.${Number(inv.base_amount).toFixed(2)}`],
    ['Visiting Charge', `Rs.${Number(inv.visiting_charge).toFixed(2)}`],
  ];
  if (Number(inv.material_cost) > 0) summaryRows.push(['Materials', `Rs.${Number(inv.material_cost).toFixed(2)}`]);
  if (Number(inv.spare_parts_cost) > 0) summaryRows.push(['Spare Parts', `Rs.${Number(inv.spare_parts_cost).toFixed(2)}`]);
  if (Number(inv.discount_amount) > 0) summaryRows.push(['Coupon Discount', `-Rs.${Number(inv.discount_amount).toFixed(2)}`]);
  summaryRows.push([`GST (${inv.tax_percent}%)`, `Rs.${Number(inv.tax_amount).toFixed(2)}`]);

  for (const [label, val] of summaryRows) {
    doc.text(label, 340, y);
    doc.text(val, 480, y);
    y += 18;
  }

  y += 8;
  doc.setFillColor(249, 115, 22);
  doc.rect(330, y, 225, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Payable', 342, y + 20);
  doc.text(`Rs.${Number(inv.total_amount).toFixed(2)}`, 472, y + 20);

  y += 52;
  doc.setTextColor(115, 115, 115);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Payment Status: ${inv.payment_status.toUpperCase()}  |  Method: ${(inv.payment_method ?? 'cash').toUpperCase()}  |  Booking ID: ${inv.booking_id}`,
    40,
    y,
  );

  doc.save(`${inv.invoice_number}.pdf`);
}
