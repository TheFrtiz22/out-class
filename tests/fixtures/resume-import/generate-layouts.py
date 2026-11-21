# Regenerates the made-up layout-*.pdf résumé fixtures (no real people): run from this folder with ReportLab installed.
# python3 generate-layouts.py
import sys
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
W,H=letter
def doc(path, rows):
    c=canvas.Canvas(path,pagesize=letter); y=H-60
    for r in rows:
        if r is None: y-=8; continue
        kind=r[0]
        if kind=='center':
            c.setFont(r[2] if len(r)>2 else 'Helvetica',r[3] if len(r)>3 else 10); c.drawCentredString(W/2,y,r[1])
        elif kind=='h':
            c.setFont('Helvetica-Bold',11); c.drawString(54,y,r[1]); c.line(54,y-3,W-54,y-3)
        elif kind=='lr':
            c.setFont('Helvetica-Bold' if len(r)>3 and r[3] else 'Helvetica',10); c.drawString(54,y,r[1]); c.drawRightString(W-54,y,r[2])
        elif kind=='b':
            c.setFont('Helvetica',10); c.drawString(66,y,'• '+r[1])
        else:
            c.setFont('Helvetica',10); c.drawString(54,y,r[1])
        y-=14
    c.save()
# A: classic engineering resume, two column dates, degree line
doc('layout-a-engineering.pdf',[
 ('center','MAYA R. CHEN','Helvetica-Bold',16),
 ('center','mrc7xq@example.edu | (434) 555-0142 | linkedin.com/in/maya-chen-example | Charlottesville, VA'),
 None,('h','EDUCATION'),
 ('lr','University of Virginia, School of Engineering and Applied Science','Charlottesville, VA',True),
 ('lr','Bachelor of Science in Mechanical Engineering, Minor in Data Science','Expected May 2029'),
 ('t','GPA: 3.82/4.00 | Dean\'s List (Fall 2025)'),
 ('t','Relevant Coursework: Calculus II, Statics, Intro to Programming'),
 None,('h','EXPERIENCE'),
 ('lr','Virginia Motorsports','Charlottesville, VA',True),
 ('lr','Chassis Team Member','Sep 2025 - Present'),
 ('b','Designed suspension mounts in SolidWorks and ran FEA load cases'),
 ('lr','Example Robotics Co.','Richmond, VA',True),
 ('lr','Engineering Intern','June 2025 - August 2025'),
 ('b','Built test fixtures for gearbox validation'),
 None,('h','LEADERSHIP & ACTIVITIES'),
 ('lr','Engineering Student Council','Sep 2025 - Present',True),
 ('t','First-Year Representative'),
 None,('h','SKILLS'),
 ('t','SolidWorks, MATLAB, Python, 3D printing'),
])
# B: liberal arts, "B.A. in" and "Class of", Name first then contact lines
doc('layout-b-politics.pdf',[
 ('center','Jordan Lee Okafor','Helvetica-Bold',18),
 ('center','Charlottesville, VA  ·  jlo2ab@example.edu  ·  540-555-0199'),
 ('center','https://www.linkedin.com/in/jordan-okafor-example/'),
 None,('h','Education'),
 ('lr','University of Virginia','May 2028',True),
 ('t','B.A. in Foreign Affairs and Economics (double major)'),
 ('t','Cumulative GPA: 3.6'),
 None,('h','Experience'),
 ('lr','Research Assistant, Batten School Policy Lab','January 2026 – Present',True),
 ('b','Coded survey responses for a study of local elections'),
 ('lr','Campaign Intern, Example for Delegate','Summer 2025',True),
 ('b','Organized volunteer shifts'),
 None,('h','Campus Involvement'),
 ('lr','Model United Nations — Delegate','2024 – Present',True),
 None,('h','Skills'),
 ('t','Stata, Spanish (fluent), public speaking'),
])
# C: high schooler applying, test scores, class of
doc('layout-c-firstyear.pdf',[
 ('t','Sam Patel-Rivera'),
 ('t','sp9zz@example.edu'),
 None,('h','Education'),
 ('t','University of Virginia — Class of 2030'),
 ('t','Intended Major: Computer Science'),
 ('t','Example High School, Fairfax VA — Graduated June 2026'),
 ('t','SAT: 1510   ACT: 34   GPA: 4.0'),
 None,('h','Projects'),
 ('t','Study Buddy App | Personal project | 2025 - 2026'),
 ('t','Robotics Team Captain | Example High School | 2023 - 2026'),
])
doc('layout-d-business.pdf',[
 ('t','Alex Morgan  |  Charlottesville, VA  |  alex.example@example.edu  |  +1 434.555.0177'),
 None,('h','SUMMARY'),
 ('t','Second-year commerce student interested in consulting and data analytics in 2027.'),
 None,('h','EDUCATION'),
 ('lr','University of Virginia, McIntire School of Commerce','Charlottesville, VA',True),
 ('lr','B.S. Commerce, Concentrations in Finance and IT; Minor in Economics','May 2028'),
 ('t','GPA 3.71'),
 None,('h','WORK EXPERIENCE'),
 ('lr','Summer Analyst','Jun 2025 - Aug 2025',True),
 ('t','Example Capital Partners'),
 ('t','Built a model of 2024 revenue across 12 regional clients for the leadership team'),
 ('lr','Teaching Assistant, Department of Economics','Jan 2026 - Present',True),
 ('t','Held weekly office hours for 40 students'),
 None,('h','SKILLS'),
 ('t','Excel | SQL | Python | Tableau'),
])
