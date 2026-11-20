'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Building2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Dashboard3DBackground } from '@/components/ui/Dashboard3DBackground';
import { useApp } from '@/components/providers/AppProvider';

export default function CompanyDashboardPage() {
  const { user, companyProfile } = useApp();
  const [employees, setEmployees] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerTitle, setWorkerTitle] = useState('Senior Technician');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    const [eRes, bRes] = await Promise.all([fetch('/api/companies/employees'), fetch('/api/bookings')]);
    const eJson = await eRes.json();
    const bJson = await bRes.json();
    setEmployees(eJson.data?.employees ?? []);
    setBookings(bJson.data?.bookings ?? []);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/companies/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: workerName, mobile: workerPhone, roleTitle: workerTitle, skills: [] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Could not add employee');
      setWorkerName('');
      setWorkerPhone('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const assignWorker = async (bookingId: string, workerId: string, acceptFirst = false) => {
    setError('');
    const res = await fetch(`/api/bookings/${bookingId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acceptFirst ? { action: 'accept', workerId } : { action: 'assign', workerId }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error?.message || 'Assignment failed');
    else await loadAll();
  };

  const completed = bookings.filter((b) => b.status === 'completed');
  const revenue = completed.reduce((acc, b) => acc + Number(b.provider_earning ?? 0), 0);

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden text-white">
      <Dashboard3DBackground fixed />
      <div className="relative z-10 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="rounded-3xl bg-[#0B1120]/70 backdrop-blur-2xl border border-orange-400/30 text-white p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#F97316]">
              <Building2 className="w-4 h-4" /> Registered Service Company Dashboard
            </span>
            <h1 className="text-3xl font-black mt-1">{companyProfile?.company_name || 'Company Command Center'}</h1>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#16A34A]" /> Verification:{' '}
              <strong className="uppercase text-orange-300">{companyProfile?.verification_status || 'not registered'}</strong>
            </p>
          </div>
          <Link href="/company/register" className="px-4 h-11 rounded-xl bg-white/10 text-xs font-bold inline-flex items-center">
            Company Profile &amp; GSTIN
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Active Workers', String(employees.length)],
            ['Total Bookings', String(bookings.length)],
            ['Completed Jobs', String(completed.length)],
            ['Company Net Earnings', `₹${revenue.toFixed(2)}`],
          ].map(([k, v]) => (
            <div key={k} className="card-3d rounded-3xl bg-[#0B1120]/65 backdrop-blur-2xl border border-orange-400/25 p-5">
              <p className="text-xs font-bold text-slate-300">{k}</p>
              <p className="text-2xl font-black text-[#FB923C] mt-1">{v}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Employee Management */}
          <section className="lg:col-span-5 rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-5">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Users className="w-5 h-5 text-[#F97316]" /> Team &amp; Employee Management
            </h2>

            <form onSubmit={addWorker} className="space-y-3 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-orange-100 dark:border-slate-800">
              <p className="text-xs font-extrabold uppercase text-[#EA580C] flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Add Technician to Team
              </p>
              <input type="text" required value={workerName} onChange={(e) => setWorkerName(e.target.value)} placeholder="Worker Full Name" className="w-full h-10 px-3 rounded-xl border text-xs" />
              <input type="tel" required maxLength={10} value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value.replace(/\D/g, ''))} placeholder="10-digit Indian Mobile" className="w-full h-10 px-3 rounded-xl border text-xs" />
              <input type="text" required value={workerTitle} onChange={(e) => setWorkerTitle(e.target.value)} placeholder="Role Title (e.g. AC Specialist)" className="w-full h-10 px-3 rounded-xl border text-xs" />
              <button type="submit" disabled={busy} className="w-full h-10 rounded-xl bg-[#F97316] text-white font-extrabold text-xs">
                {busy ? 'Adding...' : 'Add Worker'}
              </button>
            </form>

            <div className="space-y-2">
              {employees.length === 0 ? (
                <p className="text-xs text-[#737373]">No technicians added yet.</p>
              ) : (
                employees.map((e) => (
                  <div key={e.id} className="p-3 rounded-2xl bg-white dark:bg-slate-950 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold">{e.provider_profiles?.display_name || 'Technician'}</p>
                      <p className="text-[#737373]">{e.role_title}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-[#16A34A] font-bold">
                      {e.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Bookings & Worker Assignment */}
          <section className="lg:col-span-7 rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-xl font-black">Company Bookings &amp; Dispatch</h2>
            {bookings.length === 0 ? (
              <p className="text-xs text-[#737373]">No company bookings yet.</p>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-orange-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-[#EA580C]">{b.booking_code}</p>
                      <p className="font-bold text-sm">{b.services?.name || 'Service'}</p>
                      <p className="text-xs text-[#737373]">
                        {b.address_line}, {b.address_city} · {b.estimated_hours} hr(s)
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#FFF1E8] text-[#EA580C] text-[10px] font-extrabold uppercase">
                      {String(b.status).replace(/_/g, ' ')}
                    </span>
                  </div>
                  {['pending', 'confirmed', 'provider_assigned'].includes(b.status) && employees.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-[#737373]">Assign Technician:</span>
                      {employees.map((emp) => (
                        <button
                          key={emp.provider_id}
                          type="button"
                          onClick={() => assignWorker(b.id, emp.provider_id, b.status === 'pending')}
                          className="px-3 py-1.5 rounded-lg bg-[#F97316] text-white text-[11px] font-bold"
                        >
                          {emp.provider_profiles?.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      </main>
      <Footer />
      </div>
    </div>
  );
}
