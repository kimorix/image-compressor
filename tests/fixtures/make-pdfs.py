"""Sample PDFs for the PDF to Word tests (python3 make-pdfs.py).

report.pdf     3 pages, Chinese + English: title, headings, paragraphs,
               bold/italic, bullet + numbered lists, a picture, a table,
               page numbers. Chinese uses the non-embedded STSong-Light
               CID font, so pdf.js needs its CMaps.
two-column.pdf paper-style page: spanning title/abstract, two columns.
locked.pdf     report.pdf page 1 encrypted with the password "secret".
scanned.pdf    one page that is only a picture of text (OCR input).
"""
import io, os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

HERE = os.path.dirname(os.path.abspath(__file__))
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
W, H = A4


def chart_png():
    im = Image.new('RGB', (480, 260), (240, 246, 255))
    d = ImageDraw.Draw(im)
    for i, h in enumerate([120, 180, 90, 210, 150]):
        d.rectangle([40 + i * 85, 240 - h, 100 + i * 85, 240], fill=(37, 99, 235))
    d.line([30, 240, 460, 240], fill=(20, 20, 20), width=2)
    buf = io.BytesIO(); im.save(buf, 'PNG'); buf.seek(0)
    return ImageReader(buf)


def wrap(c, text, font, size, x, y, width, leading):
    """Greedy wrap (CJK char by char, Latin by words); returns new y."""
    line = ''
    tokens = []
    word = ''
    for ch in text:
        if ord(ch) > 0x2e80:
            if word: tokens.append(word); word = ''
            tokens.append(ch)
        elif ch == ' ':
            if word: tokens.append(word); word = ''
            tokens.append(' ')
        else:
            word += ch
    if word: tokens.append(word)
    for tk in tokens:
        trial = line + tk
        if pdfmetrics.stringWidth(trial, font, size) > width and line.strip():
            c.setFont(font, size); c.drawString(x, y, line.strip()); y -= leading; line = tk.lstrip()
        else:
            line = trial
    if line.strip():
        c.setFont(font, size); c.drawString(x, y, line.strip()); y -= leading
    return y


def report():
    path = os.path.join(HERE, 'report.pdf')
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle('2026 Product Plan')
    L, R = 72, W - 72
    # page 1
    y = H - 90
    c.setFont('Helvetica-Bold', 24); c.drawString(L, y, '2026 Product Plan'); y -= 40
    c.setFont('Helvetica-Bold', 16); c.drawString(L, y, '1 Overview'); y -= 26
    y = wrap(c, 'This report describes the product plan for the coming year. It covers the goals, the main projects and the budget, and it explains how progress will be measured every quarter.', 'Helvetica', 11, L, y, R - L, 15)
    y -= 8
    y = wrap(c, '本报告介绍明年的产品规划，包括目标、主要项目和预算，并说明每个季度如何衡量进展。所有数据均为示例。', 'STSong-Light', 11, L, y, R - L, 16)
    y -= 8
    c.setFont('Helvetica', 11); c.drawString(L, y, 'Key terms are')
    c.setFont('Helvetica-Bold', 11); c.drawString(L + pdfmetrics.stringWidth('Key terms are ', 'Helvetica', 11), y, 'bold')
    x2 = L + pdfmetrics.stringWidth('Key terms are ', 'Helvetica', 11) + pdfmetrics.stringWidth('bold ', 'Helvetica-Bold', 11)
    c.setFont('Helvetica', 11); c.drawString(x2, y, 'and notes are')
    c.setFont('Helvetica-Oblique', 11); c.drawString(x2 + pdfmetrics.stringWidth('and notes are ', 'Helvetica', 11), y, 'italic.')
    y -= 28
    c.setFont('Helvetica-Bold', 16); c.drawString(L, y, '2 Goals'); y -= 24
    for g in ['Grow monthly active users to two million.', 'Ship the mobile app on iOS and Android.', 'Cut page load time in half.']:
        c.setFont('Helvetica', 11); c.drawString(L + 10, y, '\u2022'); c.drawString(L + 24, y, g); y -= 16
    y -= 10
    for i, g in enumerate(['Research the market', 'Build the prototype', 'Launch the beta']):
        c.setFont('Helvetica', 11); c.drawString(L + 6, y, f'{i + 1}.'); c.drawString(L + 24, y, g); y -= 16
    c.setFont('Helvetica', 9); c.drawCentredString(W / 2, 40, '1')
    c.showPage()
    # page 2: picture + table
    y = H - 90
    c.setFont('Helvetica-Bold', 16); c.drawString(L, y, '3 Results'); y -= 24
    y = wrap(c, 'The chart below shows the number of sign-ups per quarter. Growth was strongest in the fourth quarter.', 'Helvetica', 11, L, y, R - L, 15)
    c.drawImage(chart_png(), L, y - 200, width=360, height=195); y -= 230
    c.setFont('Helvetica-Bold', 13); c.drawString(L, y, '3.1 Budget'); y -= 22
    cols = [L, L + 160, L + 280, L + 380]
    rows = [['Item', 'Q1', 'Q2', 'Total'], ['Design', '12,000', '8,000', '20,000'], ['Engineering', '40,000', '45,000', '85,000'], ['Marketing', '5,000', '15,000', '20,000']]
    for ri, row in enumerate(rows):
        for ci, cell in enumerate(row):
            c.setFont('Helvetica-Bold' if ri == 0 else 'Helvetica', 11); c.drawString(cols[ci], y, cell)
        y -= 18
    c.setFont('Helvetica', 9); c.drawCentredString(W / 2, 40, '2')
    c.showPage()
    # page 3
    y = H - 90
    c.setFont('Helvetica-Bold', 16); c.drawString(L, y, '4 Next steps'); y -= 24
    y = wrap(c, 'The team will review this plan at the end of every quarter and update the budget when the market changes. Questions can be sent to the planning office.', 'Helvetica', 11, L, y, R - L, 15)
    c.setFont('Helvetica', 9); c.drawCentredString(W / 2, 40, '3')
    c.showPage()
    c.save()
    return path


def two_column():
    path = os.path.join(HERE, 'two-column.pdf')
    c = canvas.Canvas(path, pagesize=A4)
    L, R, G = 54, W - 54, 18
    colw = (R - L - G) / 2
    y = H - 80
    c.setFont('Times-Bold', 20); c.drawCentredString(W / 2, y, 'Attention Is Mostly What You Need'); y -= 30
    c.setFont('Times-Italic', 11); c.drawCentredString(W / 2, y, 'A. Author and B. Writer'); y -= 30
    left = ('Abstract. Sequence models are usually built from recurrent layers. We propose a simpler design that relies on attention alone. '
            'Experiments on two translation tasks show that the model is better in quality while being far easier to train in parallel. ') * 3
    right = ('Introduction. Recurrent networks process one position at a time, which makes training slow on long inputs. '
             'Attention lets every position look at every other position in one step, so the work can be spread over many processors. ') * 3
    y1 = wrap(c, 'LEFTSTART ' + left + 'LEFTEND', 'Times-Roman', 10, L, y, colw, 13)
    y2 = wrap(c, 'RIGHTSTART ' + right + 'RIGHTEND', 'Times-Roman', 10, L + colw + G, y, colw, 13)
    c.showPage(); c.save()
    return path


def locked(src):
    r = PdfReader(src)
    w = PdfWriter()
    w.add_page(r.pages[0])
    w.encrypt(user_password='secret', owner_password='owner', algorithm='RC4-128')
    path = os.path.join(HERE, 'locked.pdf')
    with open(path, 'wb') as f:
        w.write(f)
    return path


def scanned():
    im = Image.new('L', (1240, 1754), 250)
    d = ImageDraw.Draw(im)
    try:
        big = ImageFont.truetype('DejaVuSans-Bold.ttf', 56)
        font = ImageFont.truetype('DejaVuSans.ttf', 34)
    except OSError:
        big = font = ImageFont.load_default()
    d.text((120, 160), 'Rental Agreement', font=big, fill=20)
    lines = ['This agreement is made between the owner', 'and the tenant for the flat on Main Street.', 'The rent is due on the first day of each month.', 'Either side may end the lease with two months notice.']
    for i, t in enumerate(lines):
        d.text((120, 300 + i * 60), t, font=font, fill=30)
    buf = io.BytesIO(); im.save(buf, 'PNG'); buf.seek(0)
    path = os.path.join(HERE, 'scanned.pdf')
    c = canvas.Canvas(path, pagesize=A4)
    c.drawImage(ImageReader(buf), 0, 0, width=W, height=H)
    c.showPage(); c.save()
    return path


if __name__ == '__main__':
    rp = report()
    two_column()
    locked(rp)
    scanned()
    print('ok')
