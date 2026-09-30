# tools/icones.py — icônes PNG (navy, lettres CEE), maskable avec marge de sécurité
from PIL import Image, ImageDraw, ImageFont
import os
os.makedirs("icons", exist_ok=True)
POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def icone(taille, marge, nom):
    im = Image.new("RGBA", (taille, taille), (15, 23, 42, 255))
    d = ImageDraw.Draw(im)
    r = int(taille * 0.18)
    d.rounded_rectangle([marge, marge, taille - marge, taille - marge], radius=r, fill=(3, 105, 161, 255))
    f = ImageFont.truetype(POLICE, int(taille * 0.34))
    d.text((taille / 2, taille / 2 - taille * 0.02), "CEE", font=f, fill="white", anchor="mm")
    im.save(os.path.join("icons", nom))
icone(192, 0, "icon-192.png"); icone(512, 0, "icon-512.png"); icone(512, 60, "maskable-512.png")
