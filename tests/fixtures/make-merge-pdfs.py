"""Sample PDFs for the PDF merge/split tests (python3 make-merge-pdfs.py).

outline.pdf    5 numbered pages with nested bookmarks; page 2 carries
               /Rotate 90, page 4 is A4 landscape.
form.pdf       1 page with an AcroForm text field "name" (value "Ada").
owner-rc4.pdf  report.pdf with only an owner (permissions) password,
               RC4 128-bit: opens without a password.
owner-aes.pdf  the same with AES-256.
owner-aes128-objstm.pdf  outline.pdf with only an owner password, AES-128
               (R=4) and compressed object streams (pikepdf).
"""
import io, os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
import pikepdf

HERE = os.path.dirname(os.path.abspath(__file__))


def numbered():
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for i in range(1, 6):
        size = landscape(A4) if i == 4 else A4
        c.setPageSize(size)
        c.setFont('Helvetica-Bold', 96)
        c.drawCentredString(size[0] / 2, size[1] / 2, f'P{i}')
        c.setFont('Helvetica', 14)
        c.drawString(40, 40, f'outline.pdf page {i}')
        c.showPage()
    c.save()
    r = PdfReader(io.BytesIO(buf.getvalue()))
    w = PdfWriter()
    for p in r.pages:
        w.add_page(p)
    w.pages[1].rotate(90)
    ch1 = w.add_outline_item('Chapter 1', 0)
    w.add_outline_item('Section 1.1', 1, parent=ch1)
    w.add_outline_item('Section 1.2', 2, parent=ch1)
    w.add_outline_item('Chapter 2', 3)
    w.add_outline_item('Appendix', 4)
    with open(os.path.join(HERE, 'outline.pdf'), 'wb') as f:
        w.write(f)


def form():
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont('Helvetica', 16)
    c.drawString(72, 760, 'Name:')
    c.acroForm.textfield(name='name', value='Ada', x=140, y=748, width=240, height=24)
    c.showPage()
    c.save()
    with open(os.path.join(HERE, 'form.pdf'), 'wb') as f:
        f.write(buf.getvalue())


def owner_only(name, algorithm):
    r = PdfReader(os.path.join(HERE, 'report.pdf'))
    w = PdfWriter()
    for p in r.pages:
        w.add_page(p)
    w.encrypt(user_password='', owner_password='owner-secret', permissions_flag=0b0100, algorithm=algorithm)
    with open(os.path.join(HERE, name), 'wb') as f:
        w.write(f)


def owner_aes128_objstm():
    with pikepdf.open(os.path.join(HERE, 'outline.pdf')) as pdf:
        pdf.save(os.path.join(HERE, 'owner-aes128-objstm.pdf'),
                 encryption=pikepdf.Encryption(owner='owner-secret', user='', R=4, aes=True,
                                               allow=pikepdf.Permissions(extract=False, modify_other=False)),
                 object_stream_mode=pikepdf.ObjectStreamMode.generate,
                 static_id=True)


numbered()
form()
owner_only('owner-rc4.pdf', 'RC4-128')
owner_only('owner-aes.pdf', 'AES-256')
owner_aes128_objstm()
