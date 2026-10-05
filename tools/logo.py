# tools/logo.py — logo de l'appli (05/10/2026) : étoile à 8 branches arrondies, une couleur par branche (une branche = une activité),
# dans l'esprit du logo de Claude demandé par David. Génère tools/logo.svg puis les icônes (Chromium via Playwright).
import math, os
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COULEURS = ["#E5484D", "#F76B15", "#F5B800", "#30A46C", "#12A594", "#0090FF", "#6E56CF", "#D6409F"]   # cercle chromatique
FOND = "#FAF7F2"

def etoile(cx=512, cy=512, echelle=1.0):
    branches = []
    for i, c in enumerate(COULEURS):
        angle = -90 + i * 360 / len(COULEURS)
        longueur = (390, 300, 360, 290, 380, 310, 350, 295)[i] * echelle     # longueurs irrégulières, comme une étincelle
        largeur, debut = 104 * echelle, 22 * echelle
        branches.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s" transform="rotate(%.1f %d %d)"/>'
                        % (cx + debut, cy - largeur / 2, longueur, largeur, largeur / 2, c, angle, cx, cy))
    return "".join(branches)

def svg(fond=None, echelle=1.0, arrondi=0):
    f = '<rect width="1024" height="1024" rx="%d" fill="%s"/>' % (arrondi, fond) if fond else ""
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">%s%s</svg>' % (f, etoile(echelle=echelle))

if __name__ == "__main__":
    from playwright.sync_api import sync_playwright
    open(os.path.join(RACINE, "tools", "logo.svg"), "w").write(svg())
    variantes = {  # nom : (svg, taille)
        "etoile-512.png": (svg(None, 0.98), 512), "etoile-192.png": (svg(None, 0.98), 192),
        "etoile-maskable-512.png": (svg(FOND, 0.95), 512),            # lanceur Android : fond plein, étoile dans la zone de sécurité (cercle de 80 %)
        "etoile-apple-180.png": (svg(FOND, 0.9), 180),
    }
    with sync_playwright() as p:
        nav = p.chromium.launch()
        for nom, (code, taille) in variantes.items():
            pg = nav.new_page(viewport={"width": taille, "height": taille})
            pg.set_content('<html><body style="margin:0;background:transparent">%s</body></html>' % code.replace('width="1024" height="1024"', 'width="%d" height="%d"' % (taille, taille), 1))
            pg.screenshot(path=os.path.join(RACINE, "icons", nom), omit_background=True)
            pg.close()
        nav.close()
    print("OK :", sorted(variantes))
