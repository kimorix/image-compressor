#!/usr/bin/env python3
"""Independent decoder for the format tests: file in, RGBA out.

usage: pyimg.py <decoder> <in-file> <out-raw> [arg]
writes the RGBA8 pixels to <out-raw> and prints JSON metadata.
decoders: pil (Pillow), tifffile, jxl (imagecodecs), qoi (imagecodecs),
          ico (Pillow, one size = arg), gif (Pillow, palette info too),
          exif (Pillow: JSON of the EXIF tags, no pixels)
"""
import io
import json
import sys

import numpy as np
from PIL import Image


def to_rgba(arr):
    arr = np.asarray(arr)
    if arr.dtype != np.uint8:
        arr = (arr >> 8).astype(np.uint8) if arr.dtype == np.uint16 else arr.astype(np.uint8)
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr, np.full_like(arr, 255)], -1)
    elif arr.shape[2] == 3:
        arr = np.concatenate([arr, np.full(arr.shape[:2] + (1,), 255, np.uint8)], -1)
    return np.ascontiguousarray(arr)


def main():
    dec, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
    arg = sys.argv[4] if len(sys.argv) > 4 else None
    meta = {}
    data = open(src, 'rb').read()
    if dec == 'exif':
        im = Image.open(io.BytesIO(data))
        ex = im.getexif()
        meta = {
            'format': im.format,
            'tags': {str(k): str(v) for k, v in ex.items()},
            'exif': {str(k): str(v) for k, v in ex.get_ifd(0x8769).items()},
            'gps': len(ex.get_ifd(0x8825)),
        }
        print(json.dumps(meta))
        return
    if dec == 'tifffile':
        import tifffile
        with tifffile.TiffFile(io.BytesIO(data)) as t:
            p = t.pages[0]
            meta = {'compression': int(p.compression), 'predictor': int(p.predictor), 'samples': int(p.samplesperpixel), 'extrasamples': [int(x) for x in p.extrasamples], 'pages': len(t.pages)}
            arr = p.asarray()
    elif dec == 'jxl':
        import imagecodecs
        arr = imagecodecs.jpegxl_decode(data)
    elif dec == 'qoi':
        import imagecodecs
        arr = imagecodecs.qoi_decode(data)
    else:
        im = Image.open(io.BytesIO(data))
        meta = {'format': im.format, 'mode': im.mode}
        if dec == 'ico':
            meta['sizes'] = sorted(list(im.info.get('sizes', [])))
            if arg:
                im.size = (int(arg), int(arg))
            im.load()
        if dec == 'gif':
            meta['transparency'] = im.info.get('transparency')
            meta['frames'] = getattr(im, 'n_frames', 1)
            meta['colors'] = len(im.getpalette() or []) // 3
        meta['info'] = {k: str(v)[:40] for k, v in im.info.items() if k in ('compression', 'dpi')}
        arr = np.asarray(im.convert('RGBA'))
    rgba = to_rgba(arr)
    meta['width'] = int(rgba.shape[1])
    meta['height'] = int(rgba.shape[0])
    open(out, 'wb').write(rgba.tobytes())
    print(json.dumps(meta))


main()
