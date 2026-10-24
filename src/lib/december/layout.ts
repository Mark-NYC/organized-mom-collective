import { monthColors } from '../../theme';
import { fit } from '../worksheet/text';
import type { Metrics,Op,Page,FontKey } from '../worksheet/types';
import type { Plan } from './traditions';
const ACCENT=monthColors[11].hex;
const INK='#3d3834', DEEP='#527468', SOFT='#66635f';
const X=43, W=526;
class Draw {
 ops:Op[]=[];
 constructor(private m:Metrics){}
 text(x:number,y:number,t:string,font:FontKey,size:number,color=INK){this.ops.push({t:'text',x,y,text:t,font,size,color});}
 block(x:number,y:number,t:string,font:FontKey,size:number,width:number,lines=2,color=INK,lead=1.32){const f=fit(this.m,font,t,{size,min:Math.max(9,size-3),maxLines:lines,width});f.lines.forEach((s,i)=>this.text(x,y+i*f.size*lead,s,font,f.size,color));}
 line(y:number){this.ops.push({t:'line',x1:X,y1:y,x2:X+W,y2:y,color:ACCENT,sw:1.2});}
 header(side:string){this.ops.push({t:'rect',x:X,y:38,w:W,h:11,fill:ACCENT});this.text(X,72,'ORGANIZED FAMILY CLUB  ·  DECEMBER', 'sansBold',8,SOFT);this.text(X+W-88,72,side,'sans',8,SOFT);}
 footer(side:string){this.text(X,747,'organizedmomcollective.com','sans',7,SOFT);this.text(522,747,side,'sans',7,SOFT);}
}
export function decemberPages(m:Metrics,p:Plan):[Page,Page]{
 const a=new Draw(m);a.header('THE TRADITION');
 a.block(X,112,p.family.toUpperCase(),'sansBold',9,W,1,SOFT);
 a.block(X,158,'A Tradition We Make Together','serifBoldItalic',30,W,2,DEEP);
 a.block(X,199,p.tradition.name,'serif',20,W,1);
 a.block(X,224,p.tradition.summary,'sans',11,W,3);
 a.line(263);
 a.text(X,288,'WHAT WE NEED','sansBold',9,SOFT);
 p.tradition.supplies.slice(0,4).forEach((s,i)=>a.block(X+5,310+i*25,'•  '+s,'sans',11,W-5,1));
 a.line(417);
 a.text(X,443,'EVERYONE HAS A PART','sansBold',9,SOFT);
 p.names.slice(0,4).forEach((name,i)=>{const y=475+i*55;a.block(X,y,name,'serif',16,128,1);a.block(X+146,y,p.roles[i]??'Join in.','sans',10.5,W-150,2);});
 a.footer('1 / 2');
 const b=new Draw(m);b.header('LET’S MAKE IT');
 b.block(X,130,'Make It Together','serifBoldItalic',34,W,1,DEEP);
 b.block(X,166,p.tradition.name,'serifItalic',17,W,2);
 b.line(193);
 p.tradition.steps.slice(0,3).forEach((step,i)=>{const y=240+i*113;b.text(X,y,String(i+1).padStart(2,'0'),'serifBoldItalic',21,DEEP);b.block(X+49,y,step,'serif',17,W-49,3);if(i<2)b.line(y+56);});
 b.line(570);
 b.block(X,607,p.tradition.closing,'serifItalic',18,W,2,INK);
 b.text(X,663,'A NOTE FROM MEGAN','sansBold',9,SOFT);
 b.block(X,690,'One tradition is enough. Let everyone have a part, enjoy the time together, and leave the rest simple.','serif',12.5,W,3);
 b.footer('2 / 2');
 return [{width:612,height:792,ops:a.ops},{width:612,height:792,ops:b.ops}];
}
