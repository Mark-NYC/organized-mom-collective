#!/usr/bin/env python3
"""Generate the one-page boredom card PDF from the article component's choices.
Run with Python, ReportLab, Node/sharp, and the checked-in worksheet fonts. Not a build dependency.
"""
from pathlib import Path
import re
import subprocess
import tempfile
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'src/components/resources/BoredomChoices.astro').read_text()
choices = re.findall(r"\['([^']+)', '([^']+)', '([^']+)'\]", source)
assert len(choices) == 6, 'Expected exactly six article choices'
fonts = ROOT / 'public/fonts/worksheet'
for name, file in [('Heading', 'gelasio-400.ttf'), ('Body', 'montserrat-400.ttf'), ('Label', 'montserrat-600.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(fonts / file)))
output = ROOT / 'public/downloads/boredom-busters-choice-card.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(output), pagesize=letter, pageCompression=1)
pdf.setTitle('Bored? Pick One. | Organized Mom Collective')
pdf.setAuthor('Organized Mom Collective')
ink = HexColor('#545454')
pdf.setFillColor(ink)
pdf.setFont('Label', 10)
pdf.drawCentredString(306, 729, 'SIX IDEAS YOU CAN START YOURSELF')
pdf.setFont('Heading', 38)
pdf.drawCentredString(306, 674, 'Bored? Pick one.')
pdf.setFont('Body', 11)
pdf.drawCentredString(306, 644, 'Choose an idea. Gather what you need.')
pdf.drawCentredString(306, 626, 'Put it away when you finish.')
colors = ['#D4DFC4', '#CDDDE1', '#F1D8A8', '#E8D2D6', '#D5C5B8', '#BBCBC4']
# Use the exact same existing SVG masters as the article, preserving transparent edges.
icon_dir = Path(tempfile.mkdtemp(prefix='omc-boredom-icons-'))
for _, _, icon in choices:
    subprocess.run(['node', '-e', "const sharp=require('sharp');sharp(process.argv[1],{density:300}).resize(320,320,{fit:'contain',background:'#00000000'}).png().toFile(process.argv[2]).catch(e=>{console.error(e);process.exit(1)});", str(ROOT / f'assets/icons/ofc/updatedicons/svg/{icon}.svg'), str(icon_dir / f'{icon}.png')], cwd=ROOT, check=True)
for i, (title, body, icon) in enumerate(choices):
    col, row = i % 2, i // 2
    x, top = 44 + col * 270, 585 - row * 153
    pdf.setFillColor(HexColor(colors[i]))
    pdf.roundRect(x, top - 126, 254, 126, 8, fill=1, stroke=0)
    pdf.setFillColor(ink)
    pdf.drawImage(ImageReader(str(icon_dir / f'{icon}.png')), x + 16, top - 58, width=44, height=44, preserveAspectRatio=True, anchor='c', mask='auto')
    pdf.setFont('Heading', 17)
    pdf.drawString(x + 71, top - 39, title)
    pdf.setFont('Body', 11)
    words = body.split(); lines = []; line = ''
    for word in words:
        next_line = (line + ' ' + word).strip()
        if pdfmetrics.stringWidth(next_line, 'Body', 11) > 218:
            lines.append(line); line = word
        else:
            line = next_line
    lines.append(line)
    for j, line in enumerate(lines):
        pdf.drawString(x + 18, top - 82 - 17 * j, line)
pdf.setFillColor(ink)
pdf.setFont('Label', 9)
pdf.drawCentredString(306, 71, 'ORGANIZED MOM COLLECTIVE')
pdf.setFont('Body', 8)
pdf.drawCentredString(306, 54, 'organizedmomcollective.com')
pdf.showPage(); pdf.save()
for icon_path in icon_dir.iterdir():
    icon_path.unlink()
icon_dir.rmdir()
print(output)
