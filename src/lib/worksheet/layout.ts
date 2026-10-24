/**
 * The worksheet's two US Letter pages as drawing operations (types.ts → Op), in points from the top-left.
 *
 * Every box has a fixed size and every personalized line is fitted into its box (text.ts → fit), so no entry can push
 * the layout, add a page or clip at the edge. A blank entry becomes a dotted line to write on.
 * Print-safe: nothing is drawn within 0.5 in of the paper's edge, no bleed.
 */
import { WORKSHEET } from './content.ts';
import { fit } from './text.ts';
import type { FontKey, Metrics, Op, Page, WorksheetData } from './types.ts';

export const PAGE_W = 612;
export const PAGE_H = 792;
/** Safe margin on every side: 0.5 in. */
export const MARGIN = 36;
const X0 = MARGIN;
const X1 = PAGE_W - MARGIN;
const W = X1 - X0;
/** Inner padding of framed sections. */
const PAD = 14;

/** Calendar palette: November header blue, charcoal type, fine gray rules, soft gray panels. */
export const COLORS = {
  ink: '#333333',
  soft: '#575757',
  faint: '#7a7a7a',
  blue: '#cddde1',
  blueRule: '#9fb9c0',
  frame: '#8c8c8c',
  hair: '#cfcfcf',
  panel: '#f3f3f2',
  dot: '#9c9c9c',
  white: '#ffffff',
} as const;

const LABEL = { font: 'sansBold' as FontKey, size: 6.6, tracking: 1.25 };
const WRITE_GAP = 24; // handwriting line spacing: 1/3 in

class Draw {
  ops: Op[] = [];
  m: Metrics;
  constructor(m: Metrics) {
    this.m = m;
  }

  width(text: string, font: FontKey, size: number, tracking = 0) {
    return this.m.width(font, text, size) + tracking * Math.max([...text].length - 1, 0);
  }
  text(x: number, y: number, text: string, font: FontKey, size: number, opts: { color?: string; align?: 'left' | 'center' | 'right'; tracking?: number } = {}) {
    const tracking = opts.tracking ?? 0;
    const w = this.width(text, font, size, tracking);
    const left = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
    this.ops.push({ t: 'text', x: left, y, text, font, size, color: opts.color ?? COLORS.ink, ...(tracking ? { tracking } : {}) });
    return w;
  }
  /** Spaced capitals, as on the printed calendar. Returns the label's width. */
  label(x: number, y: number, text: string, opts: { color?: string; align?: 'left' | 'center' | 'right'; size?: number } = {}) {
    const size = opts.size ?? LABEL.size;
    return this.text(x, y, text.toUpperCase(), LABEL.font, size, { color: opts.color ?? COLORS.soft, align: opts.align, tracking: LABEL.tracking * (size / LABEL.size) });
  }
  rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, sw = 0.6) {
    this.ops.push({ t: 'rect', x, y, w, h, ...(fill ? { fill } : {}), ...(stroke ? { stroke, sw } : {}) });
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string = COLORS.hair, sw = 0.5) {
    this.ops.push({ t: 'line', x1, y1, x2, y2, color, sw });
  }
  /** A dotted writing line, like the calendar's dot grid. */
  dots(x1: number, x2: number, y: number) {
    this.ops.push({ t: 'dots', x1, x2, y, gap: 4.8, r: 0.55, color: COLORS.dot });
  }
  circle(cx: number, cy: number, r: number, fill?: string, stroke?: string, sw = 0.6) {
    this.ops.push({ t: 'circle', cx, cy, r, ...(fill ? { fill } : {}), ...(stroke ? { stroke, sw } : {}) });
  }
  box(x: number, y: number, size = 8.5) {
    this.rect(x, y, size, size, COLORS.white, COLORS.soft, 0.7);
  }
  /** Fitted multi-line text; returns the baseline after the last line. */
  block(x: number, y: number, text: string, font: FontKey, o: { width: number; maxLines: number; size: number; min: number; lead: number; color?: string; align?: 'left' | 'center' }) {
    const f = fit(this.m, font, text, o);
    f.lines.forEach((line, i) => this.text(x, y + i * f.size * o.lead, line, font, f.size, { color: o.color, align: o.align }));
    return { ...f, bottom: y + (f.lines.length - 1) * f.size * o.lead };
  }

  /** A framed section with the calendar's blue title strip ("WORD OF THE WEEK"). */
  section(y: number, h: number, number: string | null, title: string) {
    this.rect(X0, y, W, h, COLORS.white, COLORS.frame);
    this.rect(X0, y, W, 20, COLORS.blue, COLORS.frame);
    let x = X0 + PAD;
    if (number) x += this.text(x, y + 13.2, number, 'sansBold', 7, { color: COLORS.ink, tracking: 0.8 }) + 10;
    this.label(x, y + 13.2, title, { color: COLORS.ink, size: 7 });
  }

  header(center: string) {
    this.rect(X0, X0, W, 46, COLORS.blue, COLORS.frame);
    this.text(X0 + 16, X0 + 31, WORKSHEET.month, 'serifBoldItalic', 25, { color: COLORS.ink, tracking: 0.4 });
    this.text(X1 - 16, X0 + 31, WORKSHEET.year, 'serifBoldItalic', 25, { color: COLORS.ink, align: 'right', tracking: 0.4 });
    this.label(PAGE_W / 2, X0 + 26, center, { align: 'center', color: COLORS.ink, size: 6.4 });
  }

  footer(side: string) {
    const y = PAGE_H - MARGIN - 2;
    this.label(X0, y, `${WORKSHEET.brand}  ·  ${WORKSHEET.site}`, { size: 5.8, color: COLORS.faint });
    this.label(X1, y, side, { size: 5.8, color: COLORS.faint, align: 'right' });
  }
}


function front(m: Metrics,d:WorksheetData):Page{
 const g=new Draw(m);g.header('Our family, our team');
 g.label(X0,110,d.familyName??'Your family');
 g.text(X0,148,'Everyone owns a part.','serif',36);
 g.text(X0,173,'Two whole jobs. Shared responsibility. Less reminding.','sans',10,{color:COLORS.soft});
 const card=(y:number,title:string,owner:string|null,job:string|null,when:string|null)=>{
  g.section(y,146,null,title);
  g.label(X0+PAD,y+41,'Owner');
  if(owner)g.block(X0+PAD,y+69,owner,'serif',{width:170,maxLines:1,size:25,min:15,lead:1});else g.dots(X0+PAD,X0+180,y+70);
  g.label(X0+210,y+41,'Whole responsibility');
  if(job)g.block(X0+210,y+63,job,'serif',{width:W-224,maxLines:2,size:18,min:10,lead:1.2});else g.dots(X0+210,X1-PAD,y+71);
  g.line(X0+PAD,y+96,X1-PAD,y+96);
  g.label(X0+PAD,y+116,'When it happens');
  if(when)g.block(X0+PAD,y+136,when,'sans',{width:W-2*PAD,maxLines:2,size:10,min:8,lead:1.25});else g.dots(X0+PAD,X1-PAD,y+141);
 };
 card(191,'01   Adult ownership',d.adultOwner,d.adultJob,d.adultWhen);
 card(348,'02   Child ownership',d.owner,d.job,d.when);
 card(505,'03   Child ownership',d.secondChild,d.secondJob,d.secondWhen);
 g.rect(X0,665,W,42,COLORS.panel,COLORS.frame);
 g.label(X0+PAD,679,'Our family, our team');
 if(d.existing)g.block(X0+PAD,697,d.existing,'serif',{width:W-2*PAD,maxLines:1,size:9,min:7,lead:1.1});
 
 g.footer('Front · 1 / 2');return {width:PAGE_W,height:PAGE_H,ops:g.ops};
}
function back(m:Metrics,d:WorksheetData):Page{
 const g=new Draw(m);g.header('The handoff');
 g.label(X0,114,'Your first-week plan');
 g.text(X0,152,'Hand over the whole job.','serif',34);
 g.text(X0,176,'Not just the doing. The remembering, too.','serifItalic',15,{color:COLORS.soft});
 const half=(W-12)/2;
 const coach=(x:number,title:string,owner:string|null,job:string|null,steps:string[])=>{
  g.rect(x,203,half,252,COLORS.white,COLORS.frame);
  g.rect(x,203,half,24,COLORS.blue,COLORS.frame);
  g.label(x+12,220,title,{size:7});
  g.block(x+12,257,(owner??'Someone')+': '+(job??'one whole job'),'serif',{width:half-24,maxLines:3,size:16,min:10,lead:1.2});
  steps.forEach((s,i)=>{const y=328+i*39;g.circle(x+20,y-4,9,COLORS.panel,COLORS.hair);g.text(x+20,y,String(i+1),'sansBold',8,{align:'center'});g.block(x+35,y-4,s,'sans',{width:half-45,maxLines:3,size:8.6,min:7.5,lead:1.2});});
 };
 coach(X0,'Adult to adult',d.adultOwner,d.adultJob,['Agree on the result and the timeline.','Transfer the planning and reminders.','Check in. Do not take the job back.']);
 coach(X0+half+12,'Adult to child',d.owner,d.job,['Days 1–2: demonstrate together.','Days 3–4: let them lead.','Days 5–7: step back and check in.']);
 g.section(468,95,null,'What finished looks like for the child');
 if(d.done)g.block(X0+PAD,509,d.done,'serif',{width:W-2*PAD,maxLines:3,size:12,min:9.4,lead:1.3});else {g.dots(X0+PAD,X1-PAD,517);g.dots(X0+PAD,X1-PAD,542);}
 g.section(575,83,null,'Our family check-in');
 g.text(X0+PAD,612,'What worked? What needs to change?','serifItalic',14);
 g.dots(X0+PAD,X1-PAD,633);
 if(d.checkIn)g.text(X0+PAD,651,d.checkIn,'sansMedium',8);
 g.rect(X0,665,W,73,COLORS.panel,COLORS.frame);
 g.label(X0+PAD,682,'Bring it to your calendar');
 g.block(X0+PAD,701,'Write each owner beside the job. Let your calendar carry the reminder.','serif',{width:W-2*PAD,maxLines:1,size:10,min:8.5,lead:1.25});
 g.text(X0+PAD,724,'A family where everyone shares the load is worth building.  — Megan','serifItalic',10,{color:COLORS.soft});
 g.footer('Back · 2 / 2');return {width:PAGE_W,height:PAGE_H,ops:g.ops};
}
export function layoutWorksheet(m:Metrics,d:WorksheetData):[Page,Page]{return [front(m,d),back(m,d)];}
