from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas


output = Path(__file__).with_name("reading-workflow.pdf")
pdf = canvas.Canvas(str(output), pagesize=LETTER)
width, height = LETTER

pdf.setTitle("Annotex Workflow Test")
pdf.setFont("Helvetica-Bold", 18)
pdf.drawString(72, height - 84, "Annotex Workflow Test")

pdf.setFont("Helvetica", 12)
pdf.drawString(72, height - 126, "Institutions shape incentives, and incentives influence political behavior.")
pdf.drawString(72, height - 150, "Select the sentence above and choose Annotex: Explain.")

pdf.setFont("Helvetica-Oblique", 9)
pdf.drawString(72, 54, "Synthetic test document. No private research content.")
pdf.save()

print(output)
