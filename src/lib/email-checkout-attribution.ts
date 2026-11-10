/** First-party, seven-day last email campaign. Attribution only, never authorization. */
const STORAGE_KEY='omc:email:last-touch:v1';
const MAX_AGE_MS=7*24*60*60*1000;
const CAMPAIGN=/^(?:one_small_win_[0-9]{2}|sunday_family_reset_[0-9]{2}|omc_[a-z0-9_]{1,50})$/;
export interface EmailCheckoutAttribution { campaign:string; touched_at:string; }

/** Public pages call this on entry. No emails, tokens or URL fragments are stored. */
export function captureEmailCheckoutAttribution(search:string,storage?:Pick<Storage,'getItem'|'setItem'>,now=Date.now()):boolean {
 try {
  const u=new URLSearchParams(search);
  if(u.get('utm_source')!=='omc_email'||u.get('utm_medium')!=='email')return false;
  const campaign=u.get('utm_campaign')||'';
  storage??=typeof window==='undefined'?undefined:window.sessionStorage;
  if(!CAMPAIGN.test(campaign)||!storage)return false;
  storage.setItem(STORAGE_KEY,JSON.stringify({campaign,touched_at:new Date(now).toISOString()}));
  return true;
 } catch {return false;}
}
export function readEmailCheckoutAttribution(storage?:Pick<Storage,'getItem'>,now=Date.now()):EmailCheckoutAttribution|null {
 try {
  storage??=typeof window==='undefined'?undefined:window.sessionStorage;
  const raw=storage?.getItem(STORAGE_KEY);
  if(!raw)return null;
  const value=JSON.parse(raw) as EmailCheckoutAttribution;
  const at=Date.parse(value.touched_at);
  if(!CAMPAIGN.test(value.campaign)||!Number.isFinite(at)||at>now+60000||now-at>MAX_AGE_MS)return null;
  return {campaign:value.campaign,touched_at:value.touched_at};
 }catch{return null;}
}
