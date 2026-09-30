# Ecrit tests/rendu/devis_test.pdf : PDF minimal 1 page, texte Helvetica (ASCII), lisible par pdf.js
import os
LIGNES = ["DEVIS n 2026-118 - SAS Thermoclim", "Client : EHPAD Les Tilleuls, 5 000 m2 chauffes, Lyon (69)",
          "Fourniture et pose d'une pompe a chaleur air/eau collective 160 kW, Etas 178 %,",
          "en remplacement de la chaudiere fioul 400 kW (depose et evacuation de la cuve comprises)",
          "Chaudiere gaz a condensation 240 kW en appoint", "Montant total HT : 148 500,00 EUR - TVA 20 % - TTC 178 200,00 EUR"]
contenu = "BT /F1 11 Tf 40 780 Td 16 TL " + " ".join("(%s) Tj T*" % l.replace("(", "\\(").replace(")", "\\)") for l in LIGNES) + " ET"
objets = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
          "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
          "<< /Length %d >>\nstream\n%s\nendstream" % (len(contenu), contenu)]
out = b"%PDF-1.4\n"; offsets = []
for i, o in enumerate(objets, 1):
    offsets.append(len(out)); out += ("%d 0 obj\n%s\nendobj\n" % (i, o)).encode("latin-1")
xref = len(out)
out += ("xref\n0 %d\n0000000000 65535 f \n" % (len(objets) + 1)).encode() + b"".join(("%010d 00000 n \n" % o).encode() for o in offsets)
out += ("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objets) + 1, xref)).encode()
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "devis_test.pdf"), "wb").write(out); print("devis_test.pdf", len(out), "octets")
