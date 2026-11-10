import { useEffect, useState } from 'react';
import AdminGate, { type AdminContext } from './AdminGate';
import { adminRpc } from '../../lib/admin/session';

/** Owner-only email scorecard. Data comes from Supabase, not estimates or browser tracking. */
type Report = {
  generated_at: string;
  signups: { total:number; last_7d:number; last_30d:number; opted_in:number; opted_in_30d:number; email_sourced_30d:number };
  audience: { ready:number; sync_errors:number; pending:number };
  welcome: { sent_30d:number; held:number; failed:number; due:number };
  suppression: { all_time:number; last_30d:number; unsubscribed_30d:number };
  broadcast: { scheduled:number; sent_30d:number; reserved:number };
  delivery: { delivered_30d:number; failed_30d:number; clicked_30d:number; click_events_30d:number };
  click_sections: { section:string; clicks:number }[];
  trends: { day:string; signups:number; opt_ins:number }[];
  upcoming: { date:string; title:string; status:string; scheduled_at:string }[];
  email_conversions: {paid_shop_orders_30d:number;calendar_orders_30d:number;shop_net_revenue_30d_cents:number;club_enrollments_30d:number};
  email_campaigns: {campaign:string;shop_orders:number;shop_revenue_cents:number;club_enrollments:number}[];
  business: { club_active:number; club_started_30d:number; paid_site_orders_30d:number };
};

export default function EmailAdmin() {
  return <AdminGate>{(ctx) => <EmailReportPage {...ctx}/>}</AdminGate>;
}

function EmailReportPage({session, signOut, databaseReady}: AdminContext) {
  const [report,setReport]=useState<Report|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const load=async()=>{
    setBusy(true);setError('');
    try {setReport(await adminRpc<Report>(session,'admin_email_reporting'));}
    catch(err){
      if((err as Error).message==='expired') signOut();
      else setError((err as Error).message);
    } finally {setBusy(false);}
  };
  useEffect(()=>{if(databaseReady) void load();},[databaseReady]);
  if(!databaseReady) return <p className="mt-6">The admin database is not ready.</p>;
  const max=Math.max(1,...(report?.trends.map(x=>x.signups)||[]));
  return <div className="mt-6 space-y-9">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-[0.95rem] text-soft">Email health and subscriber growth. Numbers are from actual contacts, queued sends and signed provider events.</p>
      <button type="button" onClick={load} disabled={busy} className="text-link text-[0.9rem]">{busy?'Refreshing…':'Refresh report'}</button>
    </div>
    {error && <p role="alert" className="admin-notice admin-notice--warning">{error}</p>}
    {!report && !error && <p className="text-soft">Loading email reporting…</p>}
    {report && <>
      <section aria-labelledby="email-audience">
        <h2 id="email-audience" className="admin-section-heading">Audience</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric title="New contacts · 30 days" value={report.signups.last_30d} detail={`${report.signups.last_7d} in the last 7 days`}/>
          <Metric title="Marketing opt-ins" value={report.signups.opted_in} detail={`${report.signups.opted_in_30d} opted in over 30 days`}/>
          <Metric title="Newsletter ready" value={report.audience.ready} detail="Completed welcome or legacy opt-in"/>
          <Metric title="Unsubscribes · 30 days" value={report.suppression.unsubscribed_30d} detail={`${report.suppression.last_30d} all suppressions in 30 days`}/>
        </div>
      </section>
      <section aria-labelledby="email-delivery">
        <h2 id="email-delivery" className="admin-section-heading">Sending health</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric title="Welcome emails sent · 30 days" value={report.welcome.sent_30d} detail={`${report.welcome.held} upcoming; ${report.welcome.due} due`}/>
          <Metric title="Broadcasts scheduled" value={report.broadcast.scheduled} detail={`${report.broadcast.sent_30d} logged sent in last 30 days`}/>
          <Metric title="Provider-confirmed deliveries" value={report.delivery.delivered_30d} detail="30 days · only matched marketing messages"/>
          <Metric title="Provider delivery failures" value={report.delivery.failed_30d} detail="30 days · only matched marketing messages"/>
        </div>
        {(report.welcome.failed>0 || report.audience.sync_errors>0 || report.broadcast.reserved>0) &&
          <p role="status" className="admin-notice admin-notice--warning mt-4">
            Needs review: {report.welcome.failed} failed welcome jobs, {report.audience.sync_errors} audience sync errors, and {report.broadcast.reserved} unconfirmed broadcast reservations.
          </p>}
        <p className="mt-3 text-[0.85rem] text-soft">Provider delivery events are counted only after the signed Resend webhook receives them. Scheduled messages are not counted as delivered. Opens are not tracked.</p>
      </section>
      <section aria-labelledby="email-growth">
        <h2 id="email-growth" className="admin-section-heading">Subscriber growth · 30 days</h2>
        <div className="mt-4 rounded-[4px] border border-rule bg-white p-5">
          {!report.trends.length ? <p className="text-soft">No signup activity yet.</p> :
           <div className="flex h-44 items-end gap-[3px]" aria-label="Daily contact signups in the last 30 days">
             {report.trends.map(t=><div key={t.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${t.day}: ${t.signups} contacts, ${t.opt_ins} opted in`}>
               <div style={{height:`${Math.max(3,100*t.signups/max)}%`}} className="relative w-full bg-[#CDDDE1]">
                 <div style={{height:`${t.signups?100*t.opt_ins/t.signups:0}%`}} className="absolute bottom-0 w-full bg-[#3D6671]"/>
               </div>
             </div>)}
           </div>}
          <p className="mt-3 text-[0.8rem] text-muted">Each bar is a day with signups. Blue-green: opted-in contacts. Pale blue: total contacts. Days without signups are omitted.</p>
        </div>
      </section>
      <section aria-labelledby="email-engagement">
        <h2 id="email-engagement" className="admin-section-heading">Engagement and sales</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric title="Email-origin free signups" value={report.signups.email_sourced_30d} detail="30 days · first recorded email UTM source"/>
          <Metric title="Active paid Club subscriptions" value={report.business.club_active} detail="Site total, not attributed to email"/>
          <Metric title="Paid site orders · 30 days" value={report.business.paid_site_orders_30d} detail="Site total, not attributed to email"/>
        </div>
        <h3 className="mt-6 text-[1rem] font-semibold">Email-associated checkouts · 30 days</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric title="Club enrollments" value={report.email_conversions.club_enrollments_30d} detail="Completed live enrollment; free trials included"/>
          <Metric title="Calendar orders" value={report.email_conversions.calendar_orders_30d} detail="Paid live calendar orders"/>
          <Metric title="All paid site orders" value={report.email_conversions.paid_shop_orders_30d} detail="Verified site purchases; includes calendars"/>
          <Metric title="Net shop revenue" value={`${(report.email_conversions.shop_net_revenue_30d_cents/100).toFixed(2)}`} detail="Paid shop orders, after refunds"/>
        </div>
        {report.email_campaigns.length>0 && <div className="mt-4 overflow-x-auto rounded-[4px] border border-rule bg-white">
          <table className="w-full min-w-[500px] text-left text-[0.875rem]">
            <thead className="bg-band text-soft"><tr>
              <th className="p-3">Email campaign</th><th className="p-3 text-right">Shop orders</th><th className="p-3 text-right">Net shop revenue</th><th className="p-3 text-right">Club enrollments</th>
            </tr></thead>
            <tbody>{report.email_campaigns.map(c=><tr key={c.campaign} className="border-t border-rule">
              <td className="p-3">{c.campaign.replace(/_/g,' ')}</td>
              <td className="p-3 text-right">{c.shop_orders}</td>
              <td className="p-3 text-right">{`${(c.shop_revenue_cents/100).toFixed(2)}`}</td>
              <td className="p-3 text-right">{c.club_enrollments}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <p className="mt-4 text-[0.9rem] text-soft">Attribution is a 7-day last-email UTM touch in this browser, matched to a Stripe-verified checkout. It shows association, not proof that the email caused the sale. Club enrollments can be free trials, so they are not counted as paid revenue. Email click counts remain unavailable while Resend click tracking is off. Existing GA4 can show email-associated visits separately. Unattributed Club subscriptions and orders above are business totals, not credited to email.</p>
      </section>
      <section aria-labelledby="email-schedule">
        <h2 id="email-schedule" className="admin-section-heading">Upcoming newsletters</h2>
        {!report.upcoming.length ? <p className="mt-3 text-soft">No upcoming sends recorded.</p> :
        <div className="mt-3 overflow-x-auto rounded-[4px] border border-rule bg-white">
          <table className="w-full min-w-[500px] text-left text-[0.9rem]">
            <thead className="bg-band text-soft"><tr><th className="p-3">When · New York</th><th className="p-3">Issue</th><th className="p-3">State</th></tr></thead>
            <tbody>{report.upcoming.map(item=><tr key={item.date} className="border-t border-rule">
              <td className="whitespace-nowrap p-3">{new Date(item.scheduled_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</td>
              <td className="p-3">{item.title}</td>
              <td className="p-3 capitalize">{item.status}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
      <p className="text-[0.8rem] text-muted">Last refreshed: {new Date(report.generated_at).toLocaleString('en-US',{timeZone:'America/New_York'})} ET. This page never exposes subscriber email addresses.</p>
    </>}
  </div>;
}
function Metric({title,value,detail}:{title:string;value:number|string;detail:string}){
 return <div className="admin-metric">
   <span className="label block text-muted">{title}</span>
   <span className="mt-1 block text-[1.55rem] font-bold">{value}</span>
   <span className="mt-1 block text-[0.78rem] text-soft">{detail}</span>
 </div>;
}
