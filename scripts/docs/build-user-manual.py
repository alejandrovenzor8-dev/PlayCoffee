"""Build the user manual from its maintained Markdown source using python-docx."""
from pathlib import Path
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "manual-usuario"
SOURCE = OUTPUT / "Manual_de_usuario_PlayCoffee.md"
doc = Document()
section = doc.sections[0]
section.page_width, section.page_height = Inches(8.5), Inches(11)
section.top_margin = section.bottom_margin = Inches(0.7)
section.left_margin = section.right_margin = Inches(0.7)
section.footer_distance = Inches(0.3)
styles = doc.styles
for name in ["Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3", "List Bullet", "List Number"]:
    styles[name].font.name = "Calibri"
    styles[name].font.color.rgb = RGBColor(0, 0, 0)
    styles[name]._element.get_or_add_rPr().append(OxmlElement("w:rFonts"))
    styles[name]._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    styles[name]._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
normal = styles["Normal"]
normal.font.size = Pt(11)
normal.paragraph_format.line_spacing = 1.07
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.widow_control = True
styles["Title"].font.size = Pt(28)
styles["Title"].font.bold = True
styles["Title"].paragraph_format.space_after = Pt(15)
styles["Heading 1"].font.size = Pt(19)
styles["Heading 1"].paragraph_format.space_before = Pt(0)
styles["Heading 1"].paragraph_format.space_after = Pt(12)
styles["Heading 1"].paragraph_format.page_break_before = True
styles["Heading 2"].font.size = Pt(12.5)
styles["Heading 2"].paragraph_format.space_before = Pt(10)
styles["Heading 2"].paragraph_format.space_after = Pt(5)
for name in ["Heading 1", "Heading 2", "Heading 3"]:
    styles[name].paragraph_format.keep_with_next = True
styles["List Bullet"].paragraph_format.space_after = Pt(3)

def rich(paragraph, text):
    for index, part in enumerate(re.split(r"\*\*(.*?)\*\*", text)):
        run = paragraph.add_run(part)
        run.bold = index % 2 == 1
    return paragraph

def field(paragraph, instruction):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    code = OxmlElement("w:instrText")
    code.set(qn("xml:space"), "preserve")
    code.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for element in [begin, code, separate, end]:
        run._r.append(element)

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
run = footer.add_run("PlayCoffee  |  Manual de usuario  |  ")
run.font.size = Pt(9)
field(footer, " PAGE ")

def table(lines):
    rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]
    rows = [row for row in rows if not all(re.fullmatch(r":?-+:?", cell) for cell in row)]
    ncols = len(rows[0])
    tab = doc.add_table(rows=0, cols=ncols)
    tab.alignment = WD_TABLE_ALIGNMENT.CENTER
    tab.autofit = False
    widths = [2.0, 5.1] if ncols == 2 else [1.25, 2.65, 3.2]
    if rows[0][0] == "Rol": widths = [1.0, 3.0, 3.1]
    for col, width in zip(tab.columns, widths): col.width = Inches(width)
    props = tab._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for side in ["top", "left", "bottom", "right", "insideH", "insideV"]:
        edge = OxmlElement(f"w:{side}")
        for key, value in [("val", "single"), ("sz", "4"), ("color", "D9D9D9")]:
            edge.set(qn(f"w:{key}"), value)
        borders.append(edge)
    props.append(borders)
    margins = OxmlElement("w:tblCellMar")
    for side, value in [("top", "65"), ("bottom", "65"), ("left", "90"), ("right", "90")]:
        edge = OxmlElement(f"w:{side}")
        edge.set(qn("w:w"), value)
        edge.set(qn("w:type"), "dxa")
        margins.append(edge)
    props.append(margins)
    for i, values in enumerate(rows):
        row = tab.add_row()
        row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
        if i == 0: row._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))
        for j, value in enumerate(values):
            cell = row.cells[j]
            cell.width = Inches(widths[j])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.02
            rich(p, value)
            for run in p.runs:
                run.font.size = Pt(10.5)
                if i == 0:
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
            shading = OxmlElement("w:shd")
            shading.set(qn("w:fill"), "243746" if i == 0 else ("F2F5F7" if i % 2 == 0 else "FFFFFF"))
            cell._tc.get_or_add_tcPr().append(shading)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)

lines = SOURCE.read_text(encoding="utf-8").splitlines()
i = 0
first_title = True
contents_added = False
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1
        continue
    if line.startswith("# "):
        if first_title:
            doc.add_paragraph(line[2:], "Title")
            first_title = False
        else:
            if not contents_added:
                doc.add_page_break()
                p = doc.add_paragraph("Contenido", "Title")
                p.runs[0].font.size = Pt(22)
                doc.add_paragraph("Selecciona un capítulo en el índice o utiliza los marcadores del PDF para ir directamente a la tarea que necesitas.")
                field(doc.add_paragraph(), ' TOC \\o "1-1" \\h \\z \\u ')
                contents_added = True
            doc.add_heading(line[2:], 1)
    elif line.startswith("## "):
        doc.add_heading(line[3:], 2)
    elif line.startswith("| "):
        block = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            block.append(lines[i])
            i += 1
        table(block)
        continue
    elif line.startswith("- "):
        rich(doc.add_paragraph(style="List Bullet"), line[2:])
    else:
        p = doc.add_paragraph()
        if re.match(r"^\d+\. ", line):
            p.paragraph_format.left_indent = Inches(0.18)
            p.paragraph_format.first_line_indent = Inches(-0.18)
            p.paragraph_format.space_after = Pt(4)
        rich(p, line)
    i += 1

doc.core_properties.title = "Manual de usuario de PlayCoffee"
doc.core_properties.subject = "Guía de operación para cafetería y área infantil"
doc.core_properties.author = "PlayCoffee"
doc.core_properties.keywords = "manual, usuario, caja, mesas, control infantil, inventario"
settings = doc.settings.element
lang = OxmlElement("w:themeFontLang")
lang.set(qn("w:val"), "es-MX")
settings.append(lang)
update = OxmlElement("w:updateFields")
update.set(qn("w:val"), "true")
settings.append(update)
for root in [doc.element, doc.styles.element]:
    for border in list(root.xpath(".//w:pBdr")):
        border.getparent().remove(border)
path = OUTPUT / "Manual_de_usuario_PlayCoffee.docx"
doc.save(path)
print(path)
