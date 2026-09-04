from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.style import WD_STYLE_TYPE
from pathlib import Path

OUT = Path("deliverables/Buyala_Waste_Operations_User_Guide.docx")
OUT.parent.mkdir(parents=True, exist_ok=True)

GREEN = "176B43"
DARK = "10372C"
GOLD = "F3C84B"
PALE_GREEN = "EAF4EF"
PALE_GOLD = "FFF5D8"
PALE_RED = "FDECEA"
INK = "17251F"
MUTED = "5E6F66"
LINE = "D6E1DB"
WHITE = "FFFFFF"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=120, bottom=90, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_table_geometry(table, widths_dxa):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths_dxa)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "120")
    tbl_ind.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths_dxa:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)
    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(widths_dxa[idx]))
            tc_w.set(qn("w:type"), "dxa")
            cell.width = Inches(widths_dxa[idx] / 1440)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char1, instr_text, fld_char2])


def add_callout(doc, title, body, kind="info"):
    fill = {"info": PALE_GREEN, "warning": PALE_GOLD, "danger": PALE_RED}[kind]
    table = doc.add_table(rows=1, cols=1)
    set_table_geometry(table, [9360])
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(title)
    r.bold = True
    r.font.color.rgb = RGBColor.from_string(DARK if kind == "info" else "7C5310")
    p2 = cell.add_paragraph(body)
    p2.paragraph_format.space_after = Pt(0)


def new_numbering(doc, kind="decimal"):
    numbering = doc.part.numbering_part.element
    abstract_ids = [int(e.get(qn("w:abstractNumId"))) for e in numbering.findall(qn("w:abstractNum"))]
    num_ids = [int(e.get(qn("w:numId"))) for e in numbering.findall(qn("w:num"))]
    abstract_id = max(abstract_ids, default=0) + 1
    num_id = max(num_ids, default=0) + 1
    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), str(abstract_id))
    multi = OxmlElement("w:multiLevelType")
    multi.set(qn("w:val"), "singleLevel")
    abstract.append(multi)
    lvl = OxmlElement("w:lvl")
    lvl.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:start")
    start.set(qn("w:val"), "1")
    lvl.append(start)
    num_fmt = OxmlElement("w:numFmt")
    num_fmt.set(qn("w:val"), "decimal" if kind == "decimal" else "bullet")
    lvl.append(num_fmt)
    lvl_text = OxmlElement("w:lvlText")
    lvl_text.set(qn("w:val"), "%1." if kind == "decimal" else "•")
    lvl.append(lvl_text)
    suff = OxmlElement("w:suff")
    suff.set(qn("w:val"), "tab")
    lvl.append(suff)
    p_pr = OxmlElement("w:pPr")
    tabs = OxmlElement("w:tabs")
    tab = OxmlElement("w:tab")
    tab.set(qn("w:val"), "num")
    tab.set(qn("w:pos"), "540")
    tabs.append(tab)
    p_pr.append(tabs)
    ind = OxmlElement("w:ind")
    ind.set(qn("w:left"), "540")
    ind.set(qn("w:hanging"), "270")
    p_pr.append(ind)
    lvl.append(p_pr)
    abstract.append(lvl)
    numbering.append(abstract)
    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(num_id))
    abstract_num_id = OxmlElement("w:abstractNumId")
    abstract_num_id.set(qn("w:val"), str(abstract_id))
    num.append(abstract_num_id)
    numbering.append(num)
    return num_id


def apply_num(paragraph, num_id):
    p_pr = paragraph._p.get_or_add_pPr()
    num_pr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), "0")
    num = OxmlElement("w:numId")
    num.set(qn("w:val"), str(num_id))
    num_pr.extend([ilvl, num])
    p_pr.append(num_pr)


def add_steps(doc, steps):
    num_id = new_numbering(doc, "decimal")
    for item in steps:
        p = doc.add_paragraph(style="Guide Number")
        apply_num(p, num_id)
        p.add_run(item)


def add_bullets(doc, items):
    num_id = new_numbering(doc, "bullet")
    for item in items:
        p = doc.add_paragraph(style="Guide Bullet")
        apply_num(p, num_id)
        p.add_run(item)


def add_checklist(doc, items):
    for item in items:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.25)
        p.paragraph_format.first_line_indent = Inches(-0.25)
        p.paragraph_format.space_after = Pt(5)
        p.add_run("[ ] ").bold = True
        p.add_run(item)


def add_heading(doc, text, level=1):
    return doc.add_heading(text, level=level)


def add_table(doc, headers, rows, widths):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0]
    set_repeat_table_header(hdr)
    for i, text in enumerate(headers):
        set_cell_shading(hdr.cells[i], GREEN)
        p = hdr.cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(text)
        run.bold = True
        run.font.color.rgb = RGBColor.from_string(WHITE)
    for row_values in rows:
        cells = table.add_row().cells
        for i, text in enumerate(row_values):
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.add_run(str(text))
    set_table_geometry(table, widths)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


doc = Document()
doc.settings.odd_and_even_pages_header_footer = False
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(0.78)
section.bottom_margin = Inches(0.72)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.header_distance = Inches(0.35)
section.footer_distance = Inches(0.35)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
normal.font.color.rgb = RGBColor.from_string(INK)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.22

for name, size, color, before, after in [
    ("Title", 28, DARK, 0, 8),
    ("Subtitle", 14, MUTED, 0, 14),
    ("Heading 1", 16, GREEN, 16, 8),
    ("Heading 2", 13, GREEN, 12, 6),
    ("Heading 3", 11.5, DARK, 9, 4),
]:
    st = styles[name]
    st.font.name = "Calibri"
    st.font.size = Pt(size)
    st.font.color.rgb = RGBColor.from_string(color)
    st.font.bold = name != "Subtitle"
    st.paragraph_format.space_before = Pt(before)
    st.paragraph_format.space_after = Pt(after)
    st.paragraph_format.keep_with_next = True

for style_name, base_name in [("Guide Bullet", "Normal"), ("Guide Number", "Normal")]:
    st = styles.add_style(style_name, WD_STYLE_TYPE.PARAGRAPH)
    st.base_style = styles[base_name]
    st.font.name = "Calibri"
    st.font.size = Pt(10.5)
    st.font.color.rgb = RGBColor.from_string(INK)
    st.paragraph_format.left_indent = Inches(0.375)
    st.paragraph_format.first_line_indent = Inches(-0.188)
    st.paragraph_format.space_after = Pt(4)
    st.paragraph_format.line_spacing = 1.2

header = section.header
hp = header.paragraphs[0]
hp.text = "BUYALA WASTE OPERATIONS  |  USER GUIDE"
hp.style = styles["Normal"]
hp.runs[0].font.size = Pt(8)
hp.runs[0].font.bold = True
hp.runs[0].font.color.rgb = RGBColor.from_string(GREEN)
even_hp = section.even_page_header.paragraphs[0]
even_hp.text = "BUYALA WASTE OPERATIONS  |  USER GUIDE"
even_hp.runs[0].font.size = Pt(8)
even_hp.runs[0].font.bold = True
even_hp.runs[0].font.color.rgb = RGBColor.from_string(GREEN)

footer = section.footer
fp = footer.paragraphs[0]
fp.add_run("Operational guidance • September 2026")
fp.runs[0].font.size = Pt(8)
fp.runs[0].font.color.rgb = RGBColor.from_string(MUTED)
add_page_number(footer.add_paragraph())
footer.paragraphs[-1].runs[0].font.size = Pt(8)
footer.paragraphs[-1].runs[0].font.color.rgb = RGBColor.from_string(MUTED)
even_footer = section.even_page_footer
even_fp = even_footer.paragraphs[0]
even_fp.add_run("Operational guidance • September 2026")
even_fp.runs[0].font.size = Pt(8)
even_fp.runs[0].font.color.rgb = RGBColor.from_string(MUTED)
add_page_number(even_footer.add_paragraph())
even_footer.paragraphs[-1].runs[0].font.size = Pt(8)
even_footer.paragraphs[-1].runs[0].font.color.rgb = RGBColor.from_string(MUTED)

# Cover page — editorial cover pattern.
doc.add_paragraph().paragraph_format.space_after = Pt(54)
kicker = doc.add_paragraph()
kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER
kr = kicker.add_run("BUYALA WASTE MANAGEMENT FACILITY")
kr.bold = True
kr.font.size = Pt(10)
kr.font.color.rgb = RGBColor.from_string(GREEN)
kr.font.letter_spacing = Pt(1) if hasattr(kr.font, "letter_spacing") else None

title = doc.add_paragraph(style="Title")
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.add_run("Buyala Waste Operations\nUser Guide")
subtitle = doc.add_paragraph(style="Subtitle")
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
subtitle.add_run("Step-by-step instructions for Data Clerks, Engineers and the System Admin")

doc.add_paragraph().paragraph_format.space_after = Pt(18)
add_callout(doc, "Purpose", "Use this guide during training and daily work to record weighbridge transactions, recovered materials, master data and reports safely—online or offline.")
meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
meta.paragraph_format.space_before = Pt(30)
mr = meta.add_run("Version 1.0  •  1 September 2026\nHosted system: buyala-weighbridge.web.app")
mr.font.size = Pt(10)
mr.font.color.rgb = RGBColor.from_string(MUTED)

doc.add_page_break()
contents_heading = doc.add_paragraph()
contents_heading.paragraph_format.space_after = Pt(14)
contents_heading.paragraph_format.keep_with_next = False
contents_run = contents_heading.add_run("Contents")
contents_run.bold = True
contents_run.font.name = "Calibri"
contents_run.font.size = Pt(18)
contents_run.font.color.rgb = RGBColor.from_string(GREEN)
for line in [
    "1. Quick start and role permissions",
    "2. Important terms",
    "3. Record a vehicle transaction",
    "4. Materials Recovery",
    "5. Vehicles and Drivers",
    "6. Records, open transactions and corrections",
    "7. Reports, Excel and PDF",
    "8. User Accounts and passwords",
    "9. Offline work and synchronization",
    "10. Application updates",
    "11. System Admin settings and training reset",
    "12. Troubleshooting and daily checklists",
]:
    p = doc.add_paragraph(line)
    p.paragraph_format.space_after = Pt(6)
    p.runs[0].bold = True
add_callout(doc, "Mobile navigation", "On a phone, use Dashboard, Operations and Records on the bottom bar. Tap More to open Materials Recovery, Reports, Vehicles, Drivers, User Accounts or My Account when your role permits them.")

doc.add_page_break()
add_heading(doc, "1. Quick start and role permissions", 1)
add_heading(doc, "Sign in", 2)
add_steps(doc, [
    "Open the installed Buyala app, or visit https://buyala-weighbridge.web.app while connected to the internet.",
    "Enter the username supplied to you. The app accepts either clerk or @clerk format.",
    "Enter your password and select Sign in.",
    "If the account has a temporary password, create a private password before opening operational records.",
])
add_callout(doc, "Keep accounts private", "Never share a personal password. If a password is forgotten or an account is inactive, contact the System Admin or Engineer instead of creating a duplicate account.", "warning")
add_heading(doc, "Who can do what", 2)
add_table(doc, ["Activity", "Data Clerk", "Engineer", "System Admin"], [
    ["Record and complete vehicles", "Yes", "Yes", "Yes"],
    ["Record recovered materials", "Yes", "Yes", "Yes"],
    ["Manage vehicles and drivers", "Yes", "Yes", "Yes"],
    ["Review records / finish open entries", "Yes", "Yes", "Yes"],
    ["Correct or void completed records", "No", "Yes", "Yes"],
    ["View and export reports", "No", "Yes", "Yes"],
    ["Create or control Data Clerk accounts", "No", "Yes", "Yes"],
    ["Audit Log and App Settings", "No", "No", "Yes"],
], [4320, 1680, 1680, 1680])

add_heading(doc, "2. Important terms", 1)
add_table(doc, ["Term", "Meaning"], [
    ["Gross weight", "The total weight of the loaded vehicle before waste is removed."],
    ["Tare weight", "The weight of the vehicle without the waste load. It may be entered when the vehicle returns after unloading."],
    ["Net waste", "The waste quantity: Gross weight minus Tare weight. Example: 10,000 kg − 2,000 kg = 8,000 kg."],
    ["Concessionaire", "A private company formally contracted to collect or transport waste for the city."],
    ["Non-concessionaire", "A private operator delivering waste without being in the concessionaire category."],
    ["KCCA direct", "A vehicle or operation managed directly by KCCA."],
    ["KCCA/INDIVIDUAL", "The separate operator category used for a KCCA/individual vehicle arrangement."],
    ["Open transaction", "A vehicle entry with gross weight saved while tare and departure are still pending."],
    ["Matched", "The entered vehicle or driver was found in its master list."],
], [2700, 6660])
add_callout(doc, "Do not mix categories", "Origin area, Kampala division, operator category, company and route answer different reporting questions. Nabugabo/NUJV belongs under Company / owner—not under Kampala division.", "warning")

doc.add_page_break()
add_heading(doc, "3. Record a vehicle transaction", 1)
add_heading(doc, "Before starting", 2)
add_bullets(doc, [
    "Confirm the correct staff account is signed in.",
    "Check the status indicator: Synced is ideal; Offline is acceptable when the app was prepared earlier.",
    "Ask for the registration, driver, collection source and weighbridge readings.",
])
add_heading(doc, "Step 1 — Vehicle", 2)
add_steps(doc, [
    "Open Daily Operations and choose Record vehicle.",
    "Enter the registration number. Spaces and punctuation do not affect matching.",
    "If Vehicle found in database appears, confirm its details. If Vehicle not registered appears, you may continue, but the visit remains unmatched.",
    "For an unknown vehicle, select Add to Vehicles if it should be kept for future visits, then complete the vehicle form.",
])
add_heading(doc, "Step 2 — Driver", 2)
add_steps(doc, [
    "Search for or type the driver’s full name.",
    "Confirm the telephone when the driver is matched.",
    "For an unknown driver, select Add to Drivers if the person should be saved for future visits. You may also continue manually.",
])
add_heading(doc, "Step 3 — Source and arrival", 2)
add_steps(doc, [
    "Enter the actual collection site or route for this trip. A vehicle’s usual route is only a suggestion.",
    "Confirm the arrival time, or select Use current time.",
])
add_heading(doc, "Step 4 — Weight and departure", 2)
add_steps(doc, [
    "Enter Gross weight in kilograms.",
    "If Tare is known, enter it. The app calculates Net waste automatically.",
    "Confirm the departure time, or select Use current time.",
    "Select Review and complete, check every value, then select Confirm completion.",
])
add_callout(doc, "When tare is not yet known", "Select Save as open. When the vehicle returns after unloading, open Records, select that vehicle, choose Continue transaction, enter tare and departure, then complete it.", "info")
add_callout(doc, "Weight safety", "Tare cannot be greater than gross. A completed transaction must have gross, tare, a positive net weight and departure time.", "warning")

add_heading(doc, "4. Materials Recovery", 1)
add_callout(doc, "A separate daily process", "Materials recovered are recyclable or reusable materials obtained from waste after delivery. They are not part of the truck’s gross, tare or net transaction and must be recorded separately.")
add_steps(doc, [
    "Open Materials Recovery.",
    "Choose the recovery date.",
    "Choose the material.",
    "Enter the measured recovered quantity in kilograms.",
    "Enter the trader or recipient when known, and add optional notes.",
    "Select Save recovery entry.",
    "Use the month selector to review totals. Select Download monthly CSV when a monthly spreadsheet is required.",
])
add_heading(doc, "Materials available", 2)
add_bullets(doc, ["PET (Rwenzori)", "HD Polythenes", "Boxes / Papers", "Soft Plastics", "Scraps / Metals", "Electric Waste", "PVC Pipes", "Food Waste", "Sacks (Old)", "Glass Bottles", "Rubber", "Hard Plastics"])
add_callout(doc, "Example", "If a trader receives 4,000 kg of Boxes / Papers, create one recovery entry for that date, choose Boxes / Papers, enter 4000 kg and record the trader’s name.")

doc.add_page_break()
add_heading(doc, "5. Vehicles and Drivers", 1)
add_heading(doc, "Add or edit a vehicle", 2)
add_steps(doc, [
    "Open Vehicles and select Add vehicle.",
    "Enter the registration number. Duplicate normalized registrations are not allowed.",
    "Complete the vehicle type, origin area, operator category, company / owner, Kampala division and usual route.",
    "Enter a default tare only when an approved tare value is available; it remains editable during a transaction.",
    "Select Save vehicle.",
])
add_bullets(doc, [
    "Official Kampala divisions include Central, Nakawa, Makindye, Kawempe and Lubaga.",
    "Use Company / owner for private operators such as NUJV, Homeklin or KSMC.",
    "Changes affect future transactions only; historical transaction snapshots remain unchanged.",
])
add_heading(doc, "Add or edit a driver", 2)
add_steps(doc, [
    "Open Drivers and select Add driver.",
    "Enter the full name, telephone and optional company / notes.",
    "Select Save driver.",
])
add_callout(doc, "Long lists", "Vehicle, driver and other long lists use page controls. Select Previous, Next or a page number instead of scrolling through every record.")

add_heading(doc, "6. Records, open transactions and corrections", 1)
add_heading(doc, "Find and review a record", 2)
add_steps(doc, [
    "Open Records.",
    "Search or apply filters for status, date or other available details.",
    "Select a row or mobile card to open Transaction Detail.",
    "Use the pagination controls to move between groups of records.",
])
add_heading(doc, "Complete an open transaction", 2)
add_steps(doc, [
    "Open the record marked Tare pending.",
    "Select Continue transaction.",
    "Enter the returning tare weight and departure time.",
    "Review and confirm completion.",
])
add_heading(doc, "Correct or void a record — Engineer/Admin", 2)
add_bullets(doc, [
    "Correct reporting details changes classification, company, route or missing departure information without changing recorded weights. A reason is required and kept in correction history.",
    "Void transaction is used when the record is invalid. A reason is required. The original values remain available for audit and the record is not deleted.",
])
add_callout(doc, "Audit rule", "Never create a replacement record just to hide an error. Use an audited correction or void so the operational history remains trustworthy.", "warning")

add_heading(doc, "7. Reports, Excel and PDF", 1)
add_steps(doc, [
    "Open Reports using an Engineer or System Admin account.",
    "Choose Today, Last 7 days, This month or All records—or enter a From and To date.",
    "Review data-quality warnings before exporting.",
    "Use division, origin, operator-category and private-company summaries for analysis.",
    "For Excel, select Download styled Excel. The workbook includes the detailed log, summaries, master lists, monthly archive, audit/correction history and recovered materials.",
    "For PDF, select Print / Save PDF, then choose Save as PDF in the browser’s printer destination.",
])
add_callout(doc, "Pagination and exports", "The on-screen Detailed transaction log shows 20 records per page. Summary tables also paginate. Excel and Print / Save PDF still include every record in the selected date range—not only the visible page.")
add_heading(doc, "Reading reports correctly", 2)
add_bullets(doc, [
    "Completed transactions count toward tonnage. Open and voided records do not count as completed waste.",
    "Net waste is the main tonnage value; totals are shown in kilograms and tonnes.",
    "Materials Recovery totals remain separate from incoming vehicle tonnage.",
    "Unmatched vehicles/drivers and missing classifications appear under data-quality warnings and should be reviewed.",
])

add_heading(doc, "8. User Accounts and passwords", 1)
add_heading(doc, "Create a Data Clerk — Engineer/Admin", 2)
add_steps(doc, [
    "Open User Accounts while online.",
    "Select New Data Clerk.",
    "Enter the full name, a unique username and a temporary password of at least 10 characters.",
    "Give the temporary password privately to the clerk.",
    "At first sign-in, the clerk must replace it with a private password.",
])
add_heading(doc, "Deactivate or reactivate", 2)
add_bullets(doc, [
    "Deactivate a Data Clerk when access should stop. Firebase access changes immediately.",
    "Reactivate the same account instead of creating a duplicate.",
])
add_heading(doc, "Change your own password", 2)
add_steps(doc, [
    "Open My Account while connected to the internet.",
    "Enter the current password, new password and confirmation.",
    "Select Save new password. The new password works on all connected devices.",
])
add_callout(doc, "Forgotten password", "Ask the System Admin to reset the affected account to a temporary password. The user should then sign in and create a private password. Do not send permanent passwords in public messages.", "warning")

add_heading(doc, "9. Offline work and synchronization", 1)
add_heading(doc, "Prepare a computer before going offline", 2)
add_steps(doc, [
    "While internet is available, open the installed Buyala app—not a new private/incognito window.",
    "Sign in with the account assigned to that computer and keep it signed in.",
    "Wait until the status says Synced or Device and Firebase are up to date.",
    "System Admin: open App Settings and run the Computer readiness check before the first field use.",
    "Disconnect the internet and confirm that the app opens before normal operations begin.",
])
add_heading(doc, "Work offline", 2)
add_bullets(doc, [
    "Continue recording vehicles, drivers and recovered materials normally.",
    "Offline saves remain on that computer and the status shows Offline or a pending count.",
    "Do not clear browser data, uninstall the app or reset the computer while unsynchronized saves exist.",
])
add_heading(doc, "Reconnect and synchronize", 2)
add_steps(doc, [
    "Reconnect the internet and leave the app open.",
    "Wait while the status shows pending or uploading.",
    "Finish only when it changes to Synced and the pending count is zero.",
    "System Admin may use App Settings → Sync now for a manual confirmation.",
])
add_callout(doc, "Important", "Data created offline is safe only on the device until synchronization is confirmed. Do not move to another computer and assume the unsynchronized entry is already in Firebase.", "danger")

add_heading(doc, "10. Application updates", 1)
add_steps(doc, [
    "Connect to the internet.",
    "When A newer app version is ready appears, choose Refresh app to install it now, or Later to dismiss the notice.",
    "To check manually, open My Account and select Check for updates.",
    "If A newer version is ready appears, select Update app now.",
    "After refresh, confirm the notice disappears and normal data remains available.",
])
add_callout(doc, "Desktop installer", "Normal screen and feature updates come from the hosted Firebase application and do not require a new Windows installer. A new installer is required only when the desktop wrapper itself changes.")

add_heading(doc, "11. System Admin settings and training reset", 1)
add_heading(doc, "App & offline settings", 2)
add_bullets(doc, [
    "Install the app from Chrome or Edge and complete the first sign-in online.",
    "Use Sync now to confirm queued changes reached Firebase.",
    "Download a full JSON backup and keep it in an approved safe folder.",
    "Run the readiness check and controlled offline field test before deployment.",
])
add_heading(doc, "Operational configuration", 2)
add_bullets(doc, [
    "Edit facility name/code, ticket prefix, Kampala divisions and vehicle types.",
    "Existing transactions retain their original values; configuration changes affect future entries.",
    "Protected operator categories remain KCCA direct, KCCA/INDIVIDUAL, Concessionaire and Non-concessionaire.",
])
add_heading(doc, "Training data reset", 2)
add_steps(doc, [
    "Confirm every device is online and synchronized. Do not reset while any computer has pending offline records.",
    "Open App Settings → Training data reset.",
    "Choose Clear training activity to remove training transactions, recovered-material entries, operational audit history and diagnostics while keeping vehicles, drivers and accounts.",
    "Choose Start operational data fresh only if the training vehicle and driver lists must also be removed. Accounts, roles and installation remain.",
    "Download the required backup.",
    "Type the exact confirmation phrase and enter the current System Admin password.",
    "Run the reset and keep devices online until the shared reset completes.",
])
add_callout(doc, "Destructive action", "The reset removes shared Firebase operational records from every connected device. Keep the downloaded backup. Never run a reset during normal operations or while an offline device may contain unsynchronized work.", "danger")

add_heading(doc, "12. Troubleshooting and daily checklists", 1)
add_table(doc, ["Problem", "What to do"], [
    ["Incorrect password", "Check spelling and username. Try clerk or @clerk. If it still fails, ask whether the account is active and request a temporary password reset."],
    ["Account inactive", "Ask an Engineer or System Admin to reactivate the existing account in User Accounts."],
    ["Different account needed in another tab", "Sign in separately in that browser tab. Browser sessions are per tab; the installed desktop app keeps its assigned account for offline work."],
    ["Vehicle/driver unmatched", "Continue only if necessary, then add the correct master record. Existing unmatched transactions still require review."],
    ["Tare not available", "Save as open. Complete the same record when the vehicle returns; do not create a second transaction."],
    ["Update notice remains", "Connect to the internet, open My Account, Check for updates, then Update app now. Close and reopen if the refresh cannot finish."],
    ["Pending saves do not clear", "Keep the app open online. Use Sync now as System Admin. Do not clear app data; record the time/device and seek support if pending remains."],
    ["Print button unavailable", "Choose a date range containing at least one completed transaction."],
], [3000, 6360])

add_heading(doc, "Data Clerk — start-of-shift checklist", 2)
add_checklist(doc, [
    "Correct account signed in.",
    "App opens and the navigation is responsive.",
    "Status is Synced before internet is disconnected.",
    "Registration, gross and tare units are being entered in kilograms.",
    "Open transactions are completed when vehicles return.",
])
add_heading(doc, "Engineer — end-of-day checklist", 2)
add_checklist(doc, [
    "Pending synchronization count is zero.",
    "Open transactions have been reviewed.",
    "Unmatched and missing-classification warnings have been checked.",
    "Daily report totals are reasonable and recovered materials remain separate.",
    "Required Excel/PDF exports or backups have been saved.",
])
add_heading(doc, "System Admin — support checklist", 2)
add_checklist(doc, [
    "Accounts and roles are correct; inactive users cannot enter.",
    "App version and offline readiness are current.",
    "Backups are stored safely and are not shared publicly.",
    "Audit Log is reviewed for resets, account changes, corrections and voids.",
])

add_callout(doc, "Support information to collect", "When reporting a problem, note the user role, device type, date/time, whether the device was online, the screen name, exact error message and whether the status showed Synced, Offline or pending. Do not include passwords.")

# Keep headings with content and prevent table rows from splitting where possible.
for table in doc.tables:
    for row in table.rows:
        tr_pr = row._tr.get_or_add_trPr()
        cant_split = OxmlElement("w:cantSplit")
        tr_pr.append(cant_split)

doc.core_properties.title = "Buyala Waste Operations User Guide"
doc.core_properties.subject = "Operational navigation and step-by-step user guidance"
doc.core_properties.author = "Buyala Waste Operations"
doc.core_properties.keywords = "Buyala, weighbridge, waste, user guide, offline, Firebase"
doc.save(OUT)
print(OUT.resolve())
