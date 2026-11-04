#!/usr/bin/env python3
"""Build the five one-page family PDFs from src/data/family-printables.json.
Requires reportlab and pypdf. Icons are rasterized by the companion Node script.
Run: node scripts/prepare-family-printables.mjs && python3 scripts/render-family-printables.py
"""
from pathlib import Path
import json, textwrap
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/data/family-printables.json").read_text())
OUT = ROOT / "public/downloads/family"
OUT.mkdir(parents=True, exist_ok=True)
FONT = ROOT / "public/fonts/worksheet"
for name, file in [("Editorial","gelasio-400.ttf"),("Body","montserrat-400.ttf"),("Bold","montserrat-600.ttf")]:
    pdfmetrics.registerFont(TTFont(name, str(FONT / file)))
INK = HexColor("#545454")
RULE = HexColor("#D5C5B8")
W,H = 612,792

def text(c, value, x, y, width, size=10, font="Body", leading=None):
    leading = leading or size*1.4
    c.setFont(font,size); c.setFillColor(INK)
    for paragraph in value.split("\n"):
        line=""
        for word in paragraph.split():
            test=(line+" "+word).strip()
            if pdfmetrics.stringWidth(test,font,size)>width and line:
                c.drawString(x,y,line); y-=leading; line=word
            else: line=test
        if line: c.drawString(x,y,line); y-=leading
    return y

def icon(c, name, x,y,size=36):
    c.drawImage(ImageReader(str(ROOT / ".family-printable-icons" / (name+".png"))),x,y,width=size,height=size,mask="auto",preserveAspectRatio=True,anchor="c")

def field(c,key,label,x,y,width):
    text(c,label,x,y+21,width,size=8,font="Bold")
    c.acroForm.textfield(name=key,tooltip=label,x=x,y=y,width=width,height=19,
        fontName="Helvetica",fontSize=11,textColor=INK,borderWidth=.5,
        borderColor=RULE,fillColor=white,borderStyle="underlined",forceBorder=True,
        maxlen=85,value="")

def box(c,r,y,height=80,num=None,check=False):
    c.setStrokeColor(RULE);c.setLineWidth(.6);c.line(42,y-height,570,y-height)
    icon(c,r["icon"],45,y-55,40)
    x=101
    if num is not None:
        text(c,str(num),x,y-18,22,size=10,font="Bold");x+=22
    text(c,r["label"],x,y-18,420,size=16,font="Editorial")
    text(c,r["detail"],101,y-40,425,size=10)
    text(c,r["done"],101,y-62,425,size=9)
    if check:
        c.acroForm.checkbox(name="done-"+str(num),tooltip="Finished: "+r["label"],x=550,y=y-22,size=13,
            checked=False,buttonStyle="check",borderWidth=.7,borderColor=INK,fillColor=white,textColor=INK)

def fallback(c,d,y=83,height=78):
    c.setFillColor(HexColor(d["accent"]));c.roundRect(42,y,528,height,8,fill=1,stroke=0)
    text(c,d["fallbackTitle"],55,y+height-21,502,size=15,font="Editorial")
    text(c,d["fallback"],55,y+height-41,502,size=9.5)

for key,d in DATA.items():
    path=OUT/(d["slug"]+".pdf")
    c=canvas.Canvas(str(path),pagesize=(W,H),pageCompression=1)
    c.setTitle(d["title"]+" | Organized Mom Collective")
    c.setAuthor("Organized Mom Collective")
    text(c,"A LITTLE LESS TO REMEMBER",42,751,450,size=8,font="Bold")
    c.setFillColor(HexColor(d["accent"]));c.rect(42,693,528,9,fill=1,stroke=0)
    text(c,d["title"],42,710,528,size=30,font="Editorial")
    text(c,d["subtitle"],42,678,528,size=12,font="Bold")
    text(c,d["intro"],42,654,528,size=9.5)
    if key=="siblings":
        for i,r in enumerate(d["rows"]):
            x=42+i*180
            c.setStrokeColor(RULE);c.roundRect(x,439,168,178,6,fill=0,stroke=1)
            text(c,r["cue"],x+12,596,144,size=9,font="Bold")
            icon(c,r["icon"],x+12,540,40)
            text(c,r["label"],x+12,524,144,size=15,font="Editorial")
            text(c,r["detail"],x+12,502,144,size=10)
            text(c,r["done"],x+12,462,144,size=8.5)
        text(c,"Make the plan yours",42,410,528,size=20,font="Editorial")
        field(c,"family","Family / week",355,397,215)
        for i in range(3):
            y=350-i*43
            field(c,"person-"+str(i),"Person "+str(i+1),42,y,150)
            field(c,"job-"+str(i),"Their job",211,y,359)
        field(c,"adult","Adult's job",42,220,528)
        field(c,"cue","We check the plan after",42,177,528)
        fallback(c,d,83,76)
    elif key=="finish-lines":
        for i,r in enumerate(d["rows"]):
            y=617-i*83
            icon(c,r["icon"],43,y-57,43)
            text(c,r["label"],103,y-18,430,size=16,font="Editorial")
            text(c,r["cue"],103,y-37,430,size=9)
            text(c,r["detail"]+" "+r["done"],103,y-55,420,size=10)
            c.setStrokeColor(RULE);c.line(42,y-78,570,y-78)
        field(c,"name","This belongs to",42,247,245)
        field(c,"job","My job today",307,247,263)
        field(c,"finish","My own finish line",42,200,528)
        fallback(c,d,88,87)
    elif key=="bedroom":
        field(c,"name","My name",42,604,528)
        for i,r in enumerate(d["rows"]): box(c,r,590-i*74,74,i+1,True)
        field(c,"cue","My reset happens after",42,185,528)
        fallback(c,d,83,77)
    elif key=="dinner":
        field(c,"meal","Tonight's meal",42,604,528)
        for i,r in enumerate(d["rows"]):
            y=590-i*80
            icon(c,r["icon"],45,y-54,40)
            text(c,r["label"]+": "+r["cue"],103,y-18,430,size=16,font="Editorial")
            text(c,r["detail"],103,y-40,421,size=9.5)
            text(c,r["done"],103,y-61,421,size=9)
            c.setStrokeColor(RULE);c.line(42,y-75,570,y-75)
        for i,stage in enumerate(["Before","During","After"]):
            y=305-i*43
            field(c,"person-"+str(i),stage+": who",42,y,150)
            field(c,"job-"+str(i),"Their job",211,y,359)
        field(c,"adult","Adult owns",42,176,528)
        fallback(c,d,83,70)
    else:
        for i,r in enumerate(d["rows"]):
            y=617-i*96
            icon(c,r["icon"],45,y-55,40)
            text(c,r["label"],103,y-17,450,size=15,font="Editorial")
            text(c,r["cue"],103,y-39,430,size=10,font="Bold")
            text(c,r["detail"],103,y-57,430,size=9)
            text(c,r["done"],103,y-77,430,size=8.5)
            c.setStrokeColor(RULE);c.line(42,y-90,570,y-90)
        field(c,"action","Our action spot",42,195,252)
        field(c,"files","Our file spot",314,195,256)
        field(c,"owner","Who reviews the tray",42,153,252)
        field(c,"when","When",314,153,256)
        fallback(c,d,69,63)
    text(c,d["note"],42,61 if key!="counter" else 55,528,size=7.5,leading=10)
    c.setStrokeColor(RULE);c.line(42,34,570,34)
    text(c,"ORGANIZED MOM COLLECTIVE",42,20,330,size=7.5,font="Bold")
    text(c,"organizedmomcollective.com",397,20,175,size=7.5)
    c.showPage();c.save()
    p=PdfReader(path)
    assert len(p.pages)==1, str(path)+" is not one page"
    fields=p.get_fields() or {}
    assert len(fields)>=len(d["fields"]), str(path)+" missing fields"
    assert all(f.get("/V","") in ("","/Off") for f in fields.values()),"Unexpected field value"
    assert "ORGANIZED MOM COLLECTIVE" in p.pages[0].extract_text()
    print(path.relative_to(ROOT),len(fields),"fillable fields")
