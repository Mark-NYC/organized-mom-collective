import { describe,expect,it } from 'vitest';
import { captureEmailCheckoutAttribution,readEmailCheckoutAttribution } from '../src/lib/email-checkout-attribution';

function store(){
 const data=new Map<string,string>();
 return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}};
}
const T=Date.parse('2026-11-18T12:00:00.000Z');

describe('email checkout attribution',()=>{
 it('captures only an approved email campaign with no pass or email address saved',()=>{
  const storage=store();
  expect(captureEmailCheckoutAttribution('?utm_source=omc_email&utm_medium=email&utm_campaign=one_small_win_04#omc_pass=private',storage,T)).toBe(true);
  const found=readEmailCheckoutAttribution(storage,T);
  expect(found?.campaign).toBe('one_small_win_04');
  expect(storage.getItem('omc:email:last-touch:v1')).not.toContain('omc_pass');
 });
 it('ignores non-email sources and malformed campaigns',()=>{
  const storage=store();
  expect(captureEmailCheckoutAttribution('?utm_source=pinterest&utm_medium=email&utm_campaign=one_small_win_04',storage,T)).toBe(false);
  expect(captureEmailCheckoutAttribution('?utm_source=omc_email&utm_medium=email&utm_campaign=<script>',storage,T)).toBe(false);
  expect(readEmailCheckoutAttribution(storage,T)).toBeNull();
 });
 it('expires seven-day touch after the allowed window',()=>{
  const storage=store();
  expect(captureEmailCheckoutAttribution('?utm_source=omc_email&utm_medium=email&utm_campaign=one_small_win_05',storage,T)).toBe(true);
  expect(readEmailCheckoutAttribution(storage,T+7*86400000-1)?.campaign).toBe('one_small_win_05');
  expect(readEmailCheckoutAttribution(storage,T+7*86400000+1)).toBeNull();
 });
 it('allows a later approved email campaign to replace an earlier one',()=>{
  const storage=store();
  captureEmailCheckoutAttribution('?utm_source=omc_email&utm_medium=email&utm_campaign=one_small_win_04',storage,T);
  captureEmailCheckoutAttribution('?utm_source=omc_email&utm_medium=email&utm_campaign=one_small_win_05',storage,T+1000);
  expect(readEmailCheckoutAttribution(storage,T+1001)?.campaign).toBe('one_small_win_05');
 });
 it('does not interrupt checkout if storage is unavailable',()=>{
  const storage={getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}};
  expect(captureEmailCheckoutAttribution('?utm_source=omc_email&utm_medium=email&utm_campaign=one_small_win_04',storage,T)).toBe(false);
  expect(readEmailCheckoutAttribution(storage,T)).toBeNull();
 });
});