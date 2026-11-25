"""Draw the Campus Info icons: a yellow bookmark on navy.

    python tools/make_icons.py        (needs Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "docs" / "icons"
NAVY = (31, 42, 68)
YELLOW = (255, 216, 77)


def icon(size, scale):
    """scale: the bookmark's height as a share of the icon."""
    big = size * 4                      # draw large, then shrink, for smooth edges
    img = Image.new("RGB", (big, big), NAVY)
    d = ImageDraw.Draw(img)
    h = big * scale
    w = h * 0.68
    x0, y0 = (big - w) / 2, (big - h) / 2
    r = w * 0.12
    notch = h * 0.2
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h - notch), radius=r, fill=YELLOW, corners=(True, True, False, False))
    d.polygon([(x0, y0 + h - notch - 1), (x0 + w, y0 + h - notch - 1), (x0 + w, y0 + h), (x0 + w / 2, y0 + h - notch),
               (x0, y0 + h)], fill=YELLOW)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192, 0.62).save(OUT / "icon-192.png", optimize=True)
    icon(512, 0.62).save(OUT / "icon-512.png", optimize=True)
    icon(512, 0.48).save(OUT / "maskable-512.png", optimize=True)    # stays inside the safe circle
    icon(180, 0.60).save(OUT / "apple-touch-icon.png", optimize=True)
    (OUT / "icon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1f2a44"/>'
        '<path d="M20 12a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v42l-12-8-12 8z" fill="#ffd84d"/></svg>\n', encoding="utf-8")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
