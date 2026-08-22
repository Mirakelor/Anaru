"""Regenerate every icon size from the source file site/icon.png.

Usage: python3 tools/icons/build.py
Outputs: public/icons/* (PWA + favicon), src-tauri/icons/* (Tauri).
"""
import io
import os
import struct

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, "site", "icon.png")
PUBLIC = os.path.join(ROOT, "public", "icons")
TAURI = os.path.join(ROOT, "src-tauri", "icons")

if not os.path.exists(SOURCE):
    raise SystemExit("Missing source icon: site/icon.png")


def resize(src, size):
    return src.resize((size, size), Image.LANCZOS)


def main():
    src = Image.open(SOURCE).convert("RGBA")
    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(TAURI, exist_ok=True)

    # PWA icons (RGBA — also required by Tauri's icon validation)
    resize(src, 192).save(os.path.join(PUBLIC, "icon-192.png"), "PNG")
    resize(src, 512).save(os.path.join(PUBLIC, "icon-512.png"), "PNG")
    # maskable: content shrunk to 80% with a white background for the safe zone
    pad = int(512 * 0.10)
    inner = resize(src, int(512 * 0.8))
    canvas = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
    canvas.paste(inner, (pad, pad))
    canvas.save(os.path.join(PUBLIC, "icon-512-maskable.png"), "PNG")

    # Tauri icons
    for size, name in [(32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")]:
        resize(src, size).save(os.path.join(TAURI, name), "PNG")
    resize(src, 256).convert("RGB").save(
        os.path.join(TAURI, "icon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    # icns from PNG chunks
    chunks = [(16, "icp4"), (32, "icp5"), (64, "icp6"), (128, "ic07"), (256, "ic08"), (512, "ic09"), (1024, "ic10")]
    body = io.BytesIO()
    for size, ctype in chunks:
        png = io.BytesIO()
        resize(src, size).save(png, "PNG")
        data = png.getvalue()
        body.write(ctype.encode("ascii"))
        body.write(struct.pack(">I", 8 + len(data)))
        body.write(data)
    payload = body.getvalue()
    with open(os.path.join(TAURI, "icon.icns"), "wb") as f:
        f.write(b"icns" + struct.pack(">I", 8 + len(payload)) + payload)

    print("icons regenerated from site/icon.png")


if __name__ == "__main__":
    main()
