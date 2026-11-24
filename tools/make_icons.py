"""Draw the Campus Info icons: a highlighter-yellow square with a black "ci".

    python tools/make_icons.py        (needs Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "docs" / "icons"
YELLOW = (255, 228, 92)
INK = (17, 17, 17)
FONTS = [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf",
         "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]


def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def icon(size, scale):
    img = Image.new("RGB", (size, size), YELLOW)
    d = ImageDraw.Draw(img)
    f = font(int(size * scale))
    box = d.textbbox((0, 0), "ci", font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1] - size * 0.01), "ci", font=f, fill=INK)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192, 0.56).save(OUT / "icon-192.png", optimize=True)
    icon(512, 0.56).save(OUT / "icon-512.png", optimize=True)
    icon(512, 0.40).save(OUT / "maskable-512.png", optimize=True)    # stays inside the safe circle
    icon(180, 0.52).save(OUT / "apple-touch-icon.png", optimize=True)
    (OUT / "icon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ffe45c"/>'
        '<text x="32" y="45" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-weight="800" font-size="36" '
        'text-anchor="middle" fill="#111">ci</text></svg>\n', encoding="utf-8")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
