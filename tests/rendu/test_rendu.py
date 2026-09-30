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


def sse_simule(texte):
    """Flux SSE tel que l'API Messages le renvoie en streaming (un mot par delta)."""
    ev = ['event: message_start\ndata: {"type":"message_start","message":{"id":"msg_t","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":3000,"cache_read_input_tokens":0,"cache_creation_input_tokens":2500,"output_tokens":0}}}\n\n',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n']
    for mot in texte.split(" "):
        ev.append('event: content_block_delta\ndata: ' + json.dumps({"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": mot + " "}}) + '\n\n')
    ev += ['event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
           'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":42}}\n\n',
           'event: message_stop\ndata: {"type":"message_stop"}\n\n']
    return "".join(ev)


def route_claude(route):
    """api.anthropic.com simule : test de cle (GET /v1/models/...) et question (POST /v1/messages, corps conserve)."""
    u = urllib.parse.urlparse(route.request.url)
    if u.path.startswith("/v1/models/"):
        return route.fulfill(status=200, body=json.dumps({"id": "claude-opus-5", "type": "model", "display_name": "Claude Opus 5", "created_at": "2026-01-01T00:00:00Z"}), content_type="application/json")
    if u.path.endswith("/v1/messages"):
        route_claude.corps.append(json.loads(route.request.post_data))
        return route.fulfill(status=200, body=sse_simule("Réponse **simulée** : le devis est conforme à la fiche."), content_type="text/event-stream")
    route.fulfill(status=404, body="{}", content_type="application/json")


route_claude.corps = []


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
            ctx.route("https://api.anthropic.com/**", route_claude)
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
                # sans cle : libelle de partage ; puis cle enregistree et testee (API simulee)
                verifier("Partager la question vers Claude" in pg.inner_text("#q-poser"), "libellé sans clé")
                url_dossier = pg.url
                pg.goto(base + "#/reglages")
                pg.fill("#r-cle", "sk-ant-test")
                pg.click("#r-cle-enregistrer")
                pg.click("#r-cle-tester")
                pg.wait_for_function("document.querySelector('#r-cle-resultat').textContent.includes('valide')", timeout=10000)
                pg.goto(url_dossier)
                pg.wait_for_selector("#q-poser", timeout=10000)
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
                # question -> reponse streamee, cout, historique
                pg.click("[data-sugg='0']")
                pg.click("#q-poser")
                pg.wait_for_function("(document.querySelector('.q-courante .q-reponse') || {textContent: ''}).textContent.includes('conforme')", timeout=15000)
                pg.wait_for_function("document.querySelector('#q-historique summary').textContent.includes('1 question')", timeout=10000)
                verifier("simulée" in pg.inner_text(".q-courante") and "jetons" in pg.inner_text(".q-courante"), "réponse et coût")
                corps = route_claude.corps[-1]
                contenu = corps["messages"][0]["content"]
                verifier(corps["model"] == "claude-opus-5" and corps["fallbacks"] == "default" and corps["stream"] is True, "requête : modèle/fallbacks/stream")
                verifier([b["type"] for b in contenu] == ["text", "document", "text", "image", "text"], "requête : blocs " + str([b["type"] for b in contenu]))
                verifier(contenu[3].get("cache_control") == {"type": "ephemeral"} and contenu[1]["source"]["media_type"] == "application/pdf" and contenu[3]["source"]["media_type"] == "image/jpeg", "requête : cache, PDF et photo JPEG")
                verifier(corps["system"][0].get("cache_control") == {"type": "ephemeral"} and "BAT-TH-163" in corps["system"][1]["text"], "requête : système + fiche")
                pg.screenshot(path=os.path.join(CAPTURES, "questions-dark.png"))
                # persistance : rechargement -> historique, documents et visionneuse toujours la
                pg.reload()
                pg.wait_for_selector("#q-historique", timeout=10000)
                verifier("1 question" in pg.inner_text("#q-historique summary"), "historique après rechargement")
                pg.wait_for_selector("#v-zone canvas", timeout=15000)
                pg.click("#q-historique summary")
                pg.click("#q-historique details summary")
                verifier("simulée" in pg.inner_text("#q-historique"), "réponse conservée")
                pg.screenshot(path=os.path.join(CAPTURES, "historique-dark.png"))
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
    verifier(len(route_claude.corps) == 1, "un seul appel à /v1/messages (%d)" % len(route_claude.corps))
    verifier(not erreurs, "erreurs de page : " + " | ".join(erreurs))
    print("RENDU OK :", len(os.listdir(CAPTURES)), "captures, PUT", sorted(set(route_api.puts)))


if __name__ == "__main__":
    main()
