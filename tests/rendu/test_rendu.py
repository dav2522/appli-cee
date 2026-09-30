# tests/rendu/test_rendu.py — rendu des cinq ecrans (sombre + clair), avis, dossier, hors ligne.
# Usage : python3 tests/rendu/test_rendu.py [--donnees DOSSIER]   (defaut : /home/appli-cee-donnees/app)
import http.server, os, sys, threading, urllib.parse
from playwright.sync_api import sync_playwright
RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DONNEES = sys.argv[sys.argv.index("--donnees") + 1] if "--donnees" in sys.argv else "/home/appli-cee-donnees/app"
CAPTURES = os.path.join(RACINE, "tests", "rendu", "captures")
PORT = 8766
os.makedirs(CAPTURES, exist_ok=True)


def serveur():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=RACINE, **k)

        def log_message(self, *a):
            pass
    s = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def route_api(route):
    u = urllib.parse.urlparse(route.request.url)
    chemin = urllib.parse.unquote(u.path.split("/contents/")[1])
    if route.request.method == "PUT":
        route_api.puts.append(chemin)
        return route.fulfill(status=201, body="{}", content_type="application/json")
    if chemin.startswith("avis/"):
        return route.fulfill(status=404, body='{"message":"Not Found"}', content_type="application/json")
    local = os.path.join(DONNEES, chemin[4:]) if chemin.startswith("app/") else None
    if not local or not os.path.exists(local):
        return route.fulfill(status=404, body='{"message":"Not Found"}', content_type="application/json")
    with open(local, "rb") as fh:
        route.fulfill(status=200, body=fh.read(), content_type="application/json")


route_api.puts = []


def verifier(cond, msg):
    if not cond:
        raise SystemExit("ECHEC : " + msg)


def main():
    s = serveur()
    erreurs = []
    base = "http://127.0.0.1:%d/" % PORT
    with sync_playwright() as p:
        b = p.chromium.launch()
        for theme in ("dark", "light"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme=theme,
                                locale="fr-FR", is_mobile=True, has_touch=True)
            ctx.route("https://api.github.com/**", route_api)
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: erreurs.append(str(e)))
            pg.goto(base + "#/reglages")
            pg.fill("#r-jeton", "jeton-de-test")
            pg.click("#r-enregistrer")
            pg.wait_for_function("document.querySelector('#r-resultat').textContent.startsWith('Connect')", timeout=15000)
            pg.screenshot(path=os.path.join(CAPTURES, "reglages-%s.png" % theme))
            for vue in ("aujourdhui", "fiches", "echeances", "dossiers"):
                pg.goto(base + "#/" + vue)
                pg.wait_for_timeout(400)
                pg.screenshot(path=os.path.join(CAPTURES, "%s-%s.png" % (vue, theme)))
            pg.goto(base + "#/fiche/BAT-TH-163")
            pg.wait_for_timeout(300)
            verifier("115 – 170 k€" in pg.inner_text("main"), "coût BAT-TH-163")
            pg.click("#texte-officiel summary")
            pg.wait_for_function("document.querySelector('#texte-zone').textContent.includes('Conditions')", timeout=10000)
            pg.click("#a-up")
            pg.wait_for_timeout(300)
            verifier(pg.get_attribute("#a-up", "aria-pressed") == "true", "avis 👍")
            pg.screenshot(path=os.path.join(CAPTURES, "fiche-%s.png" % theme))
            pg.goto(base + "#/fiches")
            pg.fill("#q", "raccordement")
            pg.wait_for_timeout(400)
            t = pg.inner_text("main")
            verifier("BAT-TH-127" in t and "BAR-TH-137" in t, "recherche")
            if theme == "dark":
                pg.goto(base + "#/dossiers")
                pg.set_input_files("#d-fichier", os.path.join(RACINE, "tests", "rendu", "devis_test.pdf"))
                pg.wait_for_selector("#d-generer", timeout=20000)
                pg.wait_for_timeout(500)
                verifier(pg.input_value("#d-fiche") == "BAT-TH-163", "suggestion BAT-TH-163 (obtenu : %s)" % pg.input_value("#d-fiche"))
                verifier(pg.input_value("[data-param=puissance_kw]") == "160", "puissance")
                pg.click("#d-generer")
                pg.wait_for_selector("#d-dossier", timeout=15000)
                verifier("# Expertise CEE" in pg.input_value("#d-dossier"), "dossier")
                pg.screenshot(path=os.path.join(CAPTURES, "dossier-dark.png"))
                # hors ligne : coquille (service worker) + donnees en cache
                pg.goto(base + "#/aujourdhui")
                pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
                pg.wait_for_timeout(1500)
                ctx.set_offline(True)
                pg.goto(base + "#/aujourdhui")
                pg.wait_for_timeout(800)
                verifier("fiches actives" in pg.inner_text("main").lower(), "hors ligne")
                pg.screenshot(path=os.path.join(CAPTURES, "hors-ligne-dark.png"))
                ctx.set_offline(False)
            ctx.close()
        b.close()
    s.shutdown()
    verifier("avis/BAT-TH-163.json" in route_api.puts, "PUT avis")
    verifier(not erreurs, "erreurs de page : " + " | ".join(erreurs))
    print("RENDU OK :", len(os.listdir(CAPTURES)), "captures, PUT", sorted(set(route_api.puts)))


if __name__ == "__main__":
    main()
