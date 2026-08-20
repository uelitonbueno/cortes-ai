"""Compositor de thumbnail do Cortes AI.

Recebe uma imagem/frame já selecionado pelo worker de visão e aplica texto
legível; a seleção CLIP pode ser conectada antes desta etapa sem alterar o
contrato de saída.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def compose_thumbnail(frame_path: str, output_path: str, text: str, font_path: str = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") -> None:
    image = Image.open(frame_path).convert("RGB")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(font_path, max(28, image.width // 14))
    margin = max(24, image.width // 18)
    y = image.height - margin - font.size * 2
    for offset in range(-5, 6, 5):
        draw.text((margin + offset, y + offset), text.upper(), font=font, fill="black", stroke_width=4, stroke_fill="black")
    draw.text((margin, y), text.upper(), font=font, fill="white", stroke_width=2, stroke_fill="#00d7ff")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, quality=95)
