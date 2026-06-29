"""Generate extension icons using Pillow — no system fonts required."""
from PIL import Image, ImageDraw
import os

ICON_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
os.makedirs(ICON_DIR, exist_ok=True)

BG_COLOR = '#5C3D2E'

for size in [16, 48, 128]:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = max(1, size // 16)

    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [margin, margin, size - margin - 1, size - margin - 1],
        radius=size // 4,
        fill=BG_COLOR
    )

    # Draw a simple book icon using shapes
    # Book outline (rectangle)
    bx = size // 4
    by = size // 5
    bw = size - bx * 2
    bh = size - by * 2

    # Book body
    draw.rectangle([bx, by, bx + bw, by + bh], fill='#F5E6D3')

    # Book spine
    spine_w = max(1, size // 10)
    draw.rectangle([bx, by, bx + spine_w, by + bh], fill='#D4A574')

    # Lines on book (text representation)
    line_y_start = by + max(2, size // 8)
    line_x_start = bx + spine_w + max(1, size // 12)
    line_x_end = bx + bw - max(1, size // 12)
    line_spacing = max(2, size // 8)
    line_thickness = max(1, size // 24)

    for i in range(3):
        ly = line_y_start + i * line_spacing
        if ly + line_thickness < by + bh - max(1, size // 12):
            draw.rectangle(
                [line_x_start, ly, line_x_end, ly + line_thickness],
                fill='#8B7355'
            )

    out_path = os.path.join(ICON_DIR, f'icon-{size}.png')
    img.save(out_path)
    print(f'Created {out_path} ({size}x{size})')

print('Done!')
