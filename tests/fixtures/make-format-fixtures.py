#!/usr/bin/env python3
"""Small input fixtures for the format converter's own decoders.

Writes tests/unit/fixtures/formats/. Every file is made by an independent
tool (Pillow, tifffile, imagecodecs, ImageMagick), never by our code, so
the unit tests check our decoders against other implementations.
Expected pixels: the test regenerates the same base image (see base()).

    pip install pillow tifffile imagecodecs
    python3 tests/fixtures/make-format-fixtures.py      # needs `magick` too
"""
import io
import os
import struct
import subprocess

import numpy as np
from PIL import Image
import tifffile
import imagecodecs

OUT = os.path.join(os.path.dirname(__file__), '..', 'unit', 'fixtures', 'formats')
os.makedirs(OUT, exist_ok=True)
W, H = 48, 32


def base(alpha=True):
    """Deterministic RGBA: gradients, a solid block, a transparent hole and a soft edge."""
    y, x = np.mgrid[0:H, 0:W]
    a = np.zeros((H, W, 4), np.uint8)
    a[..., 0] = (x * 255 // (W - 1)).astype(np.uint8)
    a[..., 1] = (y * 255 // (H - 1)).astype(np.uint8)
    a[..., 2] = ((x + y) * 3 % 256).astype(np.uint8)
    a[..., 3] = 255
    a[4:12, 4:12, :3] = (200, 30, 60)
    if alpha:
        a[20:28, 30:44, 3] = 0
        a[20:28, 30:44, :3] = 0
        a[20:28, 28:30, 3] = 128
    return a


def path(name):
    return os.path.join(OUT, name)


def save_bytes(name, data):  # noqa: E302
    with open(path(name), 'wb') as f:
        f.write(data)


rgba = base(True)
rgb = base(False)[..., :3]
save_bytes('base-rgba.raw', rgba.tobytes())  # expected pixels for the tests (48×32 RGBA)

# ---- TIFF ----
Image.fromarray(rgb).save(path('rgb-lzw.tif'), compression='tiff_lzw')
Image.fromarray(rgb).save(path('rgb-packbits.tif'), compression='packbits')
tifffile.imwrite(path('rgba-deflate-pred.tif'), rgba, photometric='rgb', compression='zlib', predictor=True, extrasamples=['unassalpha'])
tifffile.imwrite(path('rgb16.tif'), (rgb.astype(np.uint16) * 257), photometric='rgb')
Image.fromarray(rgb).convert('L').save(path('gray.tif'))
Image.fromarray(rgb).convert('CMYK').save(path('cmyk.tif'))
Image.fromarray(rgb).save(path('jpeg.tif'), compression='jpeg', quality=95)
# Multi-page: three pages of different sizes, plus a reduced-resolution
# thumbnail IFD (NewSubfileType=1) that must not count as a page.
with tifffile.TiffWriter(path('multipage.tif')) as tw:
    tw.write(rgb, photometric='rgb', compression='zlib')
    tw.write(rgb[:16, :24], photometric='rgb', subfiletype=1)
    tw.write(np.ascontiguousarray(rgb[:, ::-1]), photometric='rgb')
    tw.write(np.zeros((10, 20, 3), np.uint8) + 77, photometric='rgb')
# Orientation 6 (rotate 90° CW to display) + EXIF with camera info and GPS.
im = Image.fromarray(rgb)
exif = Image.Exif()
exif[0x0112] = 6
exif[0x010F] = 'FixtureCam'
exif[0x0110] = 'Model X'
exif[0x0132] = '2024:05:06 07:08:09'
exif.get_ifd(0x8769)[0x9003] = '2024:05:06 07:08:09'
exif.get_ifd(0x8825)[1] = 'N'
exif.get_ifd(0x8825)[2] = (35.0, 41.0, 0.0)
im.save(path('orient6-exif-gps.tif'), exif=exif)

# ---- BMP (native decode, kept for the e2e matrix) ----
Image.fromarray(rgb).save(path('rgb24.bmp'))

# ---- ICO ----
big = np.kron(rgba, np.ones((4, 4, 1), np.uint8))[:, :, :]  # 192×128
Image.fromarray(big).save(path('png-multi.ico'), sizes=[(16, 16), (32, 32), (64, 64), (128, 128)])
# BMP-in-ICO variants from ImageMagick (32-bit alpha; 8-bit palette with AND mask; 24-bit).
Image.fromarray(rgba[:, :32]).save(path('_sq.png'))
subprocess.run(['magick', path('_sq.png'), '-define', 'icon:auto-resize=32', path('bmp32.ico')], check=True)
subprocess.run(['magick', path('_sq.png'), '-define', 'icon:auto-resize=32', '-colors', '16', '-type', 'PaletteAlpha', path('bmp-pal.ico')], check=True)
Image.fromarray(rgb[:, :32]).save(path('_sq-rgb.png'))
subprocess.run(['magick', path('_sq-rgb.png'), '-define', 'icon:auto-resize=32', '-type', 'TrueColor', '-alpha', 'off', path('bmp24.ico')], check=True)
for f in ('_sq.png', '_sq-rgb.png'):
    os.remove(path(f))

# ---- PSD (ImageMagick: RLE composite) ----
Image.fromarray(rgb).save(path('_rgb.png'))
Image.fromarray(rgba).save(path('_rgba.png'))
subprocess.run(['magick', path('_rgb.png'), path('rgb.psd')], check=True)
subprocess.run(['magick', path('_rgba.png'), path('rgba.psd')], check=True)
subprocess.run(['magick', path('_rgb.png'), '-colorspace', 'gray', path('gray.psd')], check=True)
subprocess.run(['magick', path('_rgb.png'), '-depth', '16', path('rgb16.psd')], check=True)
subprocess.run(['magick', path('_rgb.png'), '-compress', 'none', path('rgb-raw.psd')], check=True)

# ---- TGA ----
Image.fromarray(rgb).save(path('rgb.tga'))
Image.fromarray(rgba).save(path('rgba-rle.tga'), compression='tga_rle')
Image.fromarray(rgb).convert('L').save(path('gray.tga'))
Image.fromarray(rgb).convert('P', palette=Image.Palette.ADAPTIVE, colors=64).save(path('pal.tga'))
subprocess.run(['magick', path('_rgba.png'), '-compress', 'RLE', path('rgba-im.tga')], check=True)
for f in ('_rgb.png', '_rgba.png'):
    os.remove(path(f))

# ---- QOI ----
save_bytes('rgba.qoi', imagecodecs.qoi_encode(rgba))
save_bytes('rgb.qoi', imagecodecs.qoi_encode(np.ascontiguousarray(rgb)))

# ---- JPEG XL ----
save_bytes('rgba-lossless.jxl', imagecodecs.jpegxl_encode(rgba, lossless=True))
save_bytes('rgb-lossy.jxl', imagecodecs.jpegxl_encode(np.ascontiguousarray(rgb), level=90))

# ---- SVG ----
save_bytes('viewbox-only.svg', b'<?xml version="1.0"?>\n<!-- icon -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"><rect width="24" height="12" fill="#c81e3c"/><circle cx="6" cy="6" r="4" fill="#fff"/></svg>')
save_bytes('mm.svg', b'<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="25mm" viewBox="0 0 100 50"><rect x="0" y="0" width="50" height="50" fill="#1e64c8"/></svg>')

# ---- RAW ----
# Synthetic DNG laid out like a camera DNG: IFD0 = full-size YCbCr JPEG
# preview (NewSubfileType 1), DNGVersion, Make/Model, Orientation 6, Exif
# and GPS pointers; SubIFD = 16-bit CFA sensor data. Plus a tiny
# thumbnail JPEG via JPEGInterchangeFormat, which must lose to the preview.
pw, ph = 96, 64
prev = np.kron(rgb, np.ones((2, 2, 1), np.uint8))
jbuf = io.BytesIO()
Image.fromarray(prev).save(jbuf, 'JPEG', quality=92)
preview_jpeg = jbuf.getvalue()
tbuf = io.BytesIO()
Image.fromarray(rgb[::4, ::4]).save(tbuf, 'JPEG', quality=80)
thumb_jpeg = tbuf.getvalue()
cfa = (np.arange(ph * pw, dtype=np.uint16).reshape(ph, pw) * 7) % 4096


def dng_bytes():
    # Hand-built little-endian TIFF so the layout is exactly a DNG's.
    out = bytearray(b'II*\x00' + b'\x00' * 4)
    blobs = {}

    def add_blob(key, data):
        while len(out) % 2:
            out.append(0)
        blobs[key] = len(out)
        out.extend(data)

    add_blob('preview', preview_jpeg)
    add_blob('thumb', thumb_jpeg)
    add_blob('cfa', cfa.tobytes())
    add_blob('make', b'FixtureCam\x00')
    add_blob('model', b'DNG One\x00')
    add_blob('date', b'2024:05:06 07:08:09\x00')
    add_blob('lat', struct.pack('<6I', 35, 1, 41, 1, 0, 1))

    def ifd(entries, next_off=0):
        while len(out) % 2:
            out.append(0)
        at = len(out)
        entries = sorted(entries)
        body = struct.pack('<H', len(entries))
        extra = bytearray()
        extra_at = at + 2 + len(entries) * 12 + 4
        for tag, typ, count, value in entries:
            if isinstance(value, (bytes, bytearray)):
                if len(value) <= 4:
                    body += struct.pack('<HHI', tag, typ, count) + bytes(value).ljust(4, b'\x00')
                else:
                    body += struct.pack('<HHII', tag, typ, count, extra_at + len(extra))
                    extra += value + (b'\x00' if len(value) % 2 else b'')
            else:
                fmt = '<H' if typ == 3 else '<I'
                v = struct.pack(fmt, value).ljust(4, b'\x00')
                body += struct.pack('<HHI', tag, typ, count) + v
        body += struct.pack('<I', next_off)
        out.extend(body)
        out.extend(extra)
        return at

    sub = ifd([
        (254, 4, 1, 0), (256, 4, 1, pw), (257, 4, 1, ph), (258, 3, 1, 16), (259, 3, 1, 1),
        (262, 3, 1, 32803), (273, 4, 1, blobs['cfa']), (277, 3, 1, 1), (278, 4, 1, ph), (279, 4, 1, cfa.nbytes),
    ])
    gps = ifd([(1, 2, 2, b'N\x00'), (2, 5, 3, struct.pack('<6I', 35, 1, 41, 1, 0, 1))])
    exif_ifd = ifd([(0x9003, 2, 20, b'2024:05:06 07:08:09\x00'), (0x927C, 7, 8, b'MAKERNOT')])
    ifd1 = ifd([(513, 4, 1, blobs['thumb']), (514, 4, 1, len(thumb_jpeg))])
    ifd0 = ifd([
        (254, 4, 1, 1), (256, 4, 1, pw), (257, 4, 1, ph), (258, 3, 3, struct.pack('<3H', 8, 8, 8)), (259, 3, 1, 7),
        (262, 3, 1, 6), (271, 2, 11, b'FixtureCam\x00'), (272, 2, 8, b'DNG One\x00'), (273, 4, 1, blobs['preview']),
        (274, 3, 1, 6), (277, 3, 1, 3), (278, 4, 1, ph), (279, 4, 1, len(preview_jpeg)),
        (306, 2, 20, b'2024:05:06 07:08:09\x00'), (330, 4, 1, sub), (34665, 4, 1, exif_ifd), (34853, 4, 1, gps),
        (50706, 1, 4, b'\x01\x04\x00\x00'),
    ], ifd1)
    struct.pack_into('<I', out, 4, ifd0)
    return bytes(out)


save_bytes('synthetic.dng', dng_bytes())
# A non-TIFF RAW container (ORF-style header) with the preview somewhere
# inside: found by the byte scan.
save_bytes('scan.orf', b'IIRO\x08\x00\x00\x00' + b'\x00' * 120 + cfa.tobytes()[:2000] + preview_jpeg + b'\x00' * 64)

print('fixtures in', os.path.abspath(OUT))
for f in sorted(os.listdir(OUT)):
    print(f'  {f:28s} {os.path.getsize(path(f)):7d}')
