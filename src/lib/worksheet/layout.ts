/**
 * The worksheet's two US Letter pages as drawing operations (types.ts → Op), in points from the top-left.
 *
 * Every box has a fixed size and every personalized line is fitted into its box (text.ts → fit), so no entry can push
 * the layout, add a page or clip at the edge. A blank entry becomes a dotted line to write on.
 * Print-safe: nothing is drawn within 0.5 in of the paper's edge, no bleed.
 */
import { WORKSHEET } from './content.ts';
import { monthColors } from '../../theme.ts';
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
  blue: monthColors[10].hex,
  heading: '#8A6D58', // readable deep tone of November's warm mushroom
  blueRule: monthColors[10].hex,
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



function steps(text:string|null):string[] {
 return (text??'').split(/\n|[.;]+/).map(s=>s.trim()).filter(Boolean).slice(0,3);
}
function front(m:Metrics,d:WorksheetData):Page {
 const g=new Draw(m);
 g.rect(X0,39,52,4,COLORS.blue);
 g.label(X0,59,'November 2026  ·  Organized Family Club',{size:7});
 g.label(X0,94,d.familyName??'Our family',{size:7});
 g.block(X0,137,d.planTitle??'Our Family Ownership Plan','serifBoldItalic',{width:W,maxLines:2,size:31,min:23,lead:1.15,color:COLORS.heading});
 g.block(X0,165,d.planGoal??'Everyone owns a part. Everyone knows what finished means.','sans',{width:W,maxLines:2,size:9.5,min:8.5,lead:1.2,color:COLORS.soft});
 const group=(y:number,name:string|null,job:string|null,when:string|null,done:string|null)=>{
  g.line(X0,y-24,X1,y-24,COLORS.blue,.9);
  g.block(X0,y,name??'A family member','serif',{width:145,maxLines:1,size:24,min:15,lead:1});
  g.block(X0+166,y,job??'One whole responsibility','serifItalic',{width:W-166,maxLines:2,size:16,min:11,lead:1.17});
  if(when)g.block(X0,y+22,when,'sans',{width:W,maxLines:1,size:10,min:9,lead:1.2,color:COLORS.soft});
  steps(done).forEach((s,i)=>{g.circle(X0+5,y+49+i*31,2,COLORS.ink);g.block(X0+17,y+53+i*31,s,'sans',{width:W-17,maxLines:2,size:12.5,min:10.5,lead:1.2});});
 };
 const adultSteps=steps(d.adultSteps);
 group(215,'Dad',d.adultJob,d.adultWhen,adultSteps.join('. '));
 group(386,d.owner,d.job,d.when,d.done);
 group(557,d.secondChild,d.secondJob,d.secondWhen,d.secondDone);
 g.line(X0,681,X1,681,COLORS.blue,.9);
 g.block(X0,707,'Mom','serif',{width:140,maxLines:1,size:19,min:12,lead:1});
 g.label(X0+157,697,'Already owning',{size:6.1});
 g.block(X0+157,715,d.momOwns??'An existing family responsibility','sans',{width:W-157,maxLines:2,size:10,min:8.5,lead:1.2});
 g.footer('Front · 1 / 2');
 return {width:PAGE_W,height:PAGE_H,ops:g.ops};
}
function back(m:Metrics,d:WorksheetData):Page {
 const g=new Draw(m);
 g.rect(X0,39,52,4,COLORS.blue);
 g.label(X0,59,'November 2026  ·  Organized Family Club',{size:7});
 g.label(X0,103,'A little less to carry');
 g.text(X0,148,'How we hand it over','serifBoldItalic',32,{color:COLORS.heading});
 g.block(X0,188,'Show the plan to everyone who will own a part. Agree on what finished means, and where things belong. Then let each person take the lead.','serif',{width:W,maxLines:3,size:14,min:12,lead:1.45});
 const lines=[
  ['Start together','Walk through each job once. Practice anything new.'],
  ['Hand over the noticing','The owner remembers when it happens, not just how to do it.'],
  ['Adjust without taking it back','If a step is too hard, simplify it together. Keep a clear owner.']
 ];
 lines.forEach((item,i)=>{const y=289+i*104;g.line(X0,y-24,X1,y-24,COLORS.blue,.9);g.text(X0,y,item[0],'serif',19);g.block(X0,y+26,item[1],'sans',{width:W,maxLines:2,size:11,min:10,lead:1.3});});
 g.line(X0,580,X1,580,COLORS.blue,.9);
 g.label(X0,601,'What the family aims to take off Mom’s plate',{size:6.3});
 g.block(X0,626,d.momRelief??'The responsibility for managing and reminding everyone about their jobs.','serifItalic',{width:W,maxLines:2,size:14,min:11,lead:1.3});
 g.text(X0,670,'A note from Megan','serifItalic',19);
 g.block(X0,694,'The goal is not a perfect family overnight. Start small, and let everyone grow into their role.','serif',{width:W,maxLines:2,size:11.5,min:10.5,lead:1.35});
 g.text(X0,732,'Megan','serifBoldItalic',15);
 g.footer('Back · 2 / 2');
 return {width:PAGE_W,height:PAGE_H,ops:g.ops};
}
export function layoutWorksheet(m:Metrics,d:WorksheetData):[Page,Page]{return [front(m,d),back(m,d)];}
