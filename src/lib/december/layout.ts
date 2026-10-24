/** December's kid-facing mission and two cut-and-fold cards.
 * Page 2 is printed on ONE side only; do not duplex-print it. The blank reverse is intentional.
 * Cut across the horizontal midpoint, then fold each half vertically with printed faces OUT.
 * This produces a decorated outside front and writable outside reverse, with blank inner faces.
 */
import { monthColors } from '../../theme';
import { fit } from '../worksheet/text';
import type {Metrics,Op,Page,FontKey} from '../worksheet/types';
import type {Family} from './traditions';
const ACCENT=monthColors[11].hex;
const DEEP='#527468',INK='#3d3834',SOFT='#66635f';
class Pen{
 ops:Op[]=[];
 constructor(private m:Metrics){}
 text(x:number,y:number,t:string,font:FontKey,size:number,color:string=INK){this.ops.push({t:'text',x,y,text:t,font,size,color});}
 block(x:number,y:number,t:string,font:FontKey,size:number,w:number,max=3,color:string=INK,leading=1.32){
  const v=fit(this.m,font,t,{size,min:Math.max(9,size-3),width:w,maxLines:max});
  v.lines.forEach((line,i)=>this.text(x,y+i*v.size*leading,line,font,v.size,color));
 }
 line(x:number,y:number,x2:number,y2:number,color:string=ACCENT,sw=1){this.ops.push({t:'line',x1:x,y1:y,x2,y2,color,sw});}
 rect(x:number,y:number,w:number,h:number,color:string=ACCENT){this.ops.push({t:'rect',x,y,w,h,fill:color});}
 circle(x:number,y:number,r:number,color:string=ACCENT){this.ops.push({t:'circle',cx:x,cy:y,r,fill:color});}
 sprig(x:number,y:number,scale=1){
  this.line(x,y,x+34*scale,y-28*scale,DEEP,.8);
  for(let i=0;i<3;i++){const dx=(i+1)*8*scale,dy=-(i+1)*7*scale;
   this.line(x+dx,y+dy,x+dx-9*scale,y+dy-9*scale,DEEP,.75);
   this.line(x+dx,y+dy,x+dx+10*scale,y+dy+2*scale,DEEP,.75);
  }
 }
}
const sheet=(ops:Op[]):Page=>({width:612,height:792,ops});
export function decemberPages(m:Metrics,f:Family):[Page,Page]{
 const [,second,...kids]=f.members;
 const names=kids.length===1?kids[0]:kids.length===2?kids.join(' & '):kids.slice(0,-1).join(', ')+' & '+kids[kids.length-1];
 const helper=second||'a grown-up';
 const a=new Pen(m);
 a.rect(42,40,528,9);
 a.text(42,75,'ORGANIZED FAMILY CLUB  /  DECEMBER','sansBold',8,SOFT);
 a.text(42,114,'A CHRISTMAS MISSION FOR', 'sansBold',9,DEEP);
 a.block(42,162,names+',','serifBoldItalic',33,526,2,DEEP);
 a.block(42,208,'Your Christmas Mission Has Arrived!', 'serifBoldItalic',25,526,2,DEEP);
 a.sprig(516,150,1);
 a.block(42,257,'Christmas is full of surprises. But this year, you get to be the surprise.', 'serif',14,522,2);
 a.block(42,307,'Your mission: make someone feel loved, remembered, and encouraged. You are in charge!', 'sans',11.5,521,3);
 a.line(42,343,570,343);
 const stages=[
 ['01','CHOOSE SOMEONE TO SURPRISE','A neighbor, teacher, friend, or someone who could use a smile.'],
 ['02','MAKE THEIR CHRISTMAS CARD','Use one of the two cards on the next sheet. Add a kind message or drawing.'],
 ['03','DELIVER YOUR KINDNESS','Ask '+helper+' to help you give your card to its special person.']
 ];
 stages.forEach((step,i)=>{
  const y=387+i*93;
  a.text(42,y,step[0],'serifBoldItalic',25,DEEP);
  a.text(94,y-4,step[1],'sansBold',9.5,INK);
  a.block(94,y+19,step[2],'sans',10.5,470,3);
  if(i<2)a.line(94,y+51,566,y+51);
 });
 a.line(42,663,570,663);
 a.block(42,694,'MISSION COMPLETE: Someone knows they were remembered this Christmas.', 'serifItalic',14,527,2,DEEP);
 a.block(42,731,'For grown-ups: Hand this to the kids. Help only as needed, especially with delivery.', 'sans',8.5,526,2,SOFT);
 const b=new Pen(m);
 // Exactly two independent half-letter cards; no reverse-side art. Cut y=396, fold x=306.
 const card=(top:number,headline:string,kicker:string,message:string,addSprig:boolean)=>{
  const bottom=top+396;
  b.line(25,top+12,587,top+12,ACCENT,.7);
  b.line(25,bottom-12,587,bottom-12,ACCENT,.7);
  // Two exterior panels, left is decorated cover; right is the writable message panel.
  b.line(306,top+21,306,bottom-21,'#b6b6b6',.55);
  b.text(285,top+29,'FOLD', 'sans',6.4,SOFT);
  b.rect(57,top+68,10,10);
  if(addSprig)b.sprig(211,top+111,1.05);
  else {b.circle(246,top+99,3,DEEP);b.circle(221,top+127,2,DEEP);b.circle(258,top+130,2,DEEP);}
  b.block(65,top+193,headline,'serifBoldItalic',22,217,3,DEEP);
  b.block(65,top+245,kicker,'serifItalic',11,215,2,SOFT);
  b.line(65,top+292,260,top+292,ACCENT,1);
  b.text(330,top+67,'DEAR __________________,','sansBold',9,SOFT);
  b.block(330,top+103,message,'serif',12,240,3,INK);
  b.text(330,top+172,'A NOTE OR DRAWING FOR YOU:', 'sansBold',7.7,SOFT);
  b.line(330,top+255,558,top+255,ACCENT,.7);
  b.line(330,top+281,558,top+281,ACCENT,.7);
  b.block(330,top+329,'With love, '+kids.join(' & '),'serifItalic',11,226,2,DEEP);
 };
 card(0,'A Little Christmas Kindness','Made especially for you.','Someone is thinking of you this Christmas!',true);
 card(396,'Sending You a Christmas Smile','A little reminder that you matter.','We hope this card makes your day a little brighter.',false);
 // cutting instructions outside printable art; line is slightly heavier at the middle.
 b.line(15,396,597,396,DEEP,.8);
 return [sheet(a.ops),sheet(b.ops)];
}
