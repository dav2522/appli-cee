# tools/icones.py — icônes de l'appli à partir du logo CEE (tools/logo-cee.png, fourni par David le 2026-09-30)
# Le blanc extérieur devient transparent (icônes « any », écran de lancement) ; la version maskable (lanceur Android)
# pose le badge sur fond blanc dans la zone de sécurité (cercle de 80 %). Usage : python3 tools/icones.py
from PIL import Image, ImageDraw
import os
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE, SORTIE = os.path.join(RACINE, "tools", "logo-cee.png"), os.path.join(RACINE, "icons")
VERT = (127, 186, 40)   # anneau du badge : couleur donnée aux pixels transparents (bords sans liseré blanc)


def badge(echelle=4):
    im = Image.open(SOURCE).convert("RGBA")
    im = im.resize((im.width * echelle, im.height * echelle), Image.LANCZOS)
    # Extérieur = clair (luminance > 205) relié aux coins ; le disque blanc intérieur est protégé par l'anneau vert
    marque = im.convert("L").point(lambda v: 255 if v > 205 else 0)
    for coin in [(0, 0), (marque.width - 1, 0), (0, marque.height - 1), (marque.width - 1, marque.height - 1)]:
        if marque.getpixel(coin) == 255:
            ImageDraw.floodfill(marque, coin, 128)
    exterieur = marque.point(lambda v: 255 if v == 128 else 0)
    fond = Image.new("RGBA", im.size, VERT + (0,))
    im = Image.composite(fond, im, exterieur)
    return im.crop(im.getchannel("A").getbbox())


def icone(b, taille, part, fond=None):
    k = taille * part / max(b.size)
    petit = b.resize((round(b.width * k), round(b.height * k)), Image.LANCZOS)
    im = Image.new("RGBA", (taille, taille), fond or VERT + (0,))
    im.alpha_composite(petit, ((taille - petit.width) // 2, (taille - petit.height) // 2))
    return im


if __name__ == "__main__":
    b = badge()
    os.makedirs(SORTIE, exist_ok=True)
    icone(b, 192, 0.96).save(os.path.join(SORTIE, "logo-192.png"))
    icone(b, 512, 0.96).save(os.path.join(SORTIE, "logo-512.png"))
    icone(b, 512, 0.74, (255, 255, 255, 255)).save(os.path.join(SORTIE, "logo-maskable-512.png"))
    icone(b, 180, 0.88, (255, 255, 255, 255)).convert("RGB").save(os.path.join(SORTIE, "logo-apple-180.png"))
    print("OK :", sorted(f for f in os.listdir(SORTIE) if f.startswith("logo-")))
