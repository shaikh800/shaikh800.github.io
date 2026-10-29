path = "civil.html"
content = open(path, encoding='utf-8').read()

old = '''    <section class="section" id="working-areas">
      <div class="section-head reveal">
        <h2>Working Areas</h2>
        <p>Engineering skills and software I'm currently working with.</p>
      </div>
      <div class="tool-list reveal-grid">
        <div class="tool-pill"><i class="fas fa-building-columns"></i> Structural Analysis</div>
        <div class="tool-pill"><i class="fas fa-drafting-compass"></i> AutoCAD Drafting</div>
        <div class="tool-pill"><i class="fas fa-file-pdf"></i> PDF Formatting</div>
        <div class="tool-pill"><i class="fas fa-water"></i> Surveying</div>
        <div class="tool-pill"><i class="fas fa-calculator"></i> Engineering Statistics</div>
        <div class="tool-pill"><i class="fas fa-print"></i> Print Workflow</div>
      </div>
    </section>

    <section class="contact-strip reveal" id="civil-contact">
      <div><h2>Contact</h2><p>For feedback or collaboration, reach me here.</p></div>
      <div class="contact-links">
        <a href="mailto:md.shaikh.alam.007@gmail.com"><i class="fas fa-envelope"></i> Email</a>
        <a href="https://github.com/shaikh800" target="_blank" rel="noopener"><i class="fab fa-github"></i> GitHub</a>
      </div>
    </section>

'''

n = content.count(old)
assert n == 1, n
content = content.replace(old, '', 1)
open(path, 'w', encoding='utf-8').write(content)
print("civil.html: working-areas + civil-contact removed")
