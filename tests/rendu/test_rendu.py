# tests/rendu/test_rendu.py — rendu des cinq ecrans (sombre + clair), avis, dossier, hors ligne.
# Usage : python3 tests/rendu/test_rendu.py [--donnees DOSSIER]   (defaut : /home/appli-cee-donnees/app)
import http.server, json, os, sys, threading, urllib.parse
from PIL import Image
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
            # partage Android simule : on garde ce que l'appli enverrait a l'appli Claude
            ctx.add_init_script("window.__partages = []; navigator.canShare = () => true; navigator.share = async (d) => { window.__partages.push({ titre: d.title, texte: d.text, fichiers: (d.files || []).map((f) => f.name) }); };")
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
                pg.wait_for_selector("#q-ouvrir", timeout=10000)
                # photo ajoutee (PNG genere, reduite en JPEG), visionneuse PDF rendue
                photo = os.path.join(RACINE, "tests", "rendu", "photo_test.png")
                Image.new("RGB", (1200, 1600), "white").save(photo)
                pg.set_input_files("#d-plus", photo)
                pg.wait_for_function("document.querySelectorAll('[data-voir]').length === 2", timeout=10000)
                pg.click("[data-voir='0']")
                pg.wait_for_selector("#v-zone canvas", timeout=15000)
                pg.wait_for_function("document.querySelector('#v-zone .num').textContent.includes('page 1 /')", timeout=15000)
                encre = pg.evaluate("() => { const c = document.querySelector('#v-zone canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 128) n++; return n; }")
                verifier(encre > 100, "page PDF rendue avec du texte (%d pixels sombres)" % encre)
                # question -> partage vers l'appli Claude (question, fiche, documents, rappel du connecteur), historique
                pg.click("[data-sugg='0']")
                pg.click("#q-ouvrir")
                pg.wait_for_function("window.__partages.length === 1", timeout=10000)
                envoi = pg.evaluate("window.__partages[0]")
                verifier(envoi["texte"].startswith("Analyse ce devis") and "BAT-TH-163" in envoi["texte"] and "connecteur « Appli CEE »" in envoi["texte"], "texte partagé : " + envoi["texte"][:120])
                verifier(envoi["fichiers"] == ["devis_test.pdf", "photo_test.jpg"], "documents partagés : %s" % envoi["fichiers"])
                pg.wait_for_function("document.querySelector('#q-historique summary').textContent.includes('1 question')", timeout=10000)
                verifier("envoyée à l'appli Claude" in pg.inner_text("#q-etat"), "message après partage")
                verifier(pg.input_value("#q-texte") == "", "zone de question vidée")
                pg.click("#q-historique summary")
                pg.fill("[data-coller]", "Réponse **collée** : le devis est conforme à la fiche.")
                pg.dispatch_event("[data-coller]", "change")
                pg.wait_for_selector("#q-historique .q-reponse", state="attached", timeout=10000)
                pg.screenshot(path=os.path.join(CAPTURES, "questions-dark.png"))
                # persistance : rechargement -> historique, reponse collee, documents et visionneuse toujours la
                pg.reload()
                pg.wait_for_selector("#q-historique", timeout=10000)
                verifier("1 question" in pg.inner_text("#q-historique summary"), "historique après rechargement")
                pg.wait_for_selector("#v-zone canvas", timeout=15000)
                pg.click("#q-historique summary")
                pg.click("#q-historique details summary")
                verifier("collée" in pg.inner_text("#q-historique"), "réponse collée conservée")
                pg.screenshot(path=os.path.join(CAPTURES, "historique-dark.png"))
                # photo PNG a fond transparent -> JPEG a fond blanc (pas noir)
                transparent = os.path.join(RACINE, "tests", "rendu", "photo_test.png")
                im = Image.new("RGBA", (600, 800), (0, 0, 0, 0)); im.paste((0, 0, 0, 255), (100, 100, 500, 700)); im.save(transparent)
                pg.set_input_files("#d-plus", transparent)
                pg.wait_for_function("document.querySelectorAll('[data-voir]').length === 3", timeout=10000)
                coin = pg.evaluate("""() => new Promise((ok) => { const r = indexedDB.open('appli-cee'); r.onsuccess = () => {
                    const c = r.result.transaction('fichiers').objectStore('fichiers').getAll(); c.onsuccess = async () => {
                      const e = c.result.sort((a, b) => a.ajoute_le.localeCompare(b.ajoute_le)).at(-1);
                      const bm = await createImageBitmap(e.blob); const cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height;
                      const ctx = cv.getContext('2d'); ctx.drawImage(bm, 0, 0); const p = ctx.getImageData(2, 2, 1, 1).data; ok({ type: e.type, r: p[0], l: bm.width });
                    }; }; })""")
                verifier(coin["type"] == "image/jpeg" and coin["l"] == 600 and coin["r"] > 200, "PNG transparent -> JPEG fond blanc (obtenu : %s)" % coin)
                # suppression du dossier -> store fichiers vide
                pg.once("dialog", lambda dlg: dlg.accept())
                pg.click("#d-supprimer")
                pg.wait_for_url("**#/dossiers", timeout=10000)
                n = pg.evaluate("() => new Promise((ok) => { const r = indexedDB.open('appli-cee'); r.onsuccess = () => { const c = r.result.transaction('fichiers').objectStore('fichiers').count(); c.onsuccess = () => ok(c.result); }; })")
                verifier(n == 0, "fichiers supprimés avec le dossier (%s restant)" % n)
                # hors ligne : coquille (service worker) + donnees en cache
                pg.goto(base + "#/aujourdhui")
                pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
                pg.wait_for_timeout(1500)
                # partage Android (share_target) : POST ./partage traite par le service worker (base IndexedDB v2) -> nouveau dossier
                pg.evaluate("""() => { const f = document.createElement('form'); f.method = 'POST'; f.action = './partage'; f.enctype = 'multipart/form-data';
                    for (const [n, v] of [['titre', 'Devis partagé'], ['texte', 'Chaudière biomasse 320 kW pour un entrepôt']]) { const i = document.createElement('input'); i.name = n; i.value = v; f.appendChild(i); }
                    document.body.appendChild(f); f.submit(); }""")
                pg.wait_for_url("**#/dossier/d*", timeout=15000)
                pg.wait_for_selector("#d-titre", timeout=10000)
                verifier(pg.input_value("#d-titre") == "Devis partagé", "partage Android via le service worker (titre : %r)" % pg.input_value("#d-titre"))
                verifier(pg.locator("[data-fiche]").count() > 0, "partage Android : fiches suggérées depuis le texte partagé")
                pg.once("dialog", lambda dlg: dlg.accept())
                pg.click("#d-supprimer")
                pg.wait_for_url("**#/dossiers", timeout=10000)
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
