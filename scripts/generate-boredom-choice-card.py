#!/usr/bin/env python3
"""Generate the one-page boredom card PDF from the article component's choices.
Run with Python, ReportLab, and the checked-in worksheet fonts. Not a build dependency.
"""
from pathlib import Path
import re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'src/components/resources/BoredomChoices.astro').read_text()
choices = re.findall(r"\['([^']+)', '([^']+)'\]", source)
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
for i, (title, body) in enumerate(choices):
    col, row = i % 2, i // 2
    x, top = 44 + col * 270, 585 - row * 153
    pdf.setFillColor(HexColor(colors[i]))
    pdf.roundRect(x, top - 126, 254, 126, 8, fill=1, stroke=0)
    pdf.setFillColor(ink)
    pdf.setFont('Heading', 19)
    pdf.drawString(x + 18, top - 36, title)
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
        pdf.drawString(x + 18, top - 63 - 17 * j, line)
pdf.setFillColor(ink)
pdf.setFont('Label', 9)
pdf.drawCentredString(306, 71, 'ORGANIZED MOM COLLECTIVE')
pdf.setFont('Body', 8)
pdf.drawCentredString(306, 54, 'organizedmomcollective.com')
pdf.showPage(); pdf.save()
print(output)
