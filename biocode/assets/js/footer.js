(function () {
  var el = document.getElementById('site-footer-include');
  if (!el) return;
  el.innerHTML = [
    '<div class="container">',
    '  <div class="footer-disclaimer">',
    '    <strong>Research Use Only.</strong> BioCode Peptides products are furnished for laboratory and research purposes exclusively. They are not drugs, dietary supplements, cosmetics, or medical devices, are not intended to diagnose, treat, cure, or prevent any disease, and are not for human or veterinary consumption. Products have not been evaluated by the U.S. Food and Drug Administration. By purchasing, the buyer certifies that they are a qualified professional or institution and assumes full responsibility for safe handling, applicable licensing, and compliant use.',
    '  </div>',
    '  <div class="footer-grid">',
    '    <div>',
    '      <div class="footer-brand"><img src="assets/img/logo-64.png" alt="BioCode Peptides"><b>BIOCODE PEPTIDES</b></div>',
    '      <p style="font-size:0.88rem;max-width:32ch">Precision-engineered, independently verified research peptides. Designed and quality-tested in Cambridge, Massachusetts.</p>',
    '    </div>',
    '    <div><h4>Company</h4><ul>',
    '      <li><a href="about.html">Who We Are</a></li>',
    '      <li><a href="about.html#advisory-board">Scientific Advisory Board</a></li>',
    '      <li><a href="science.html">Science &amp; R&amp;D</a></li>',
    '      <li><a href="quality.html">Quality &amp; Compliance</a></li>',
    '    </ul></div>',
    '    <div><h4>Catalog</h4><ul>',
    '      <li><a href="products.html">All Research Peptides</a></li>',
    '      <li><a href="quality.html#coa">Certificates of Analysis</a></li>',
    '      <li><a href="contact.html">Distributor Program</a></li>',
    '    </ul></div>',
    '    <div><h4>Contact</h4><ul>',
    '      <li>100 Cambridge Research Parkway<br>Suite 400<br>Cambridge, MA 02142</li>',
    '      <li><a href="mailto:info@biocodepeptides.com">info@biocodepeptides.com</a></li>',
    '      <li><span class="fillin" title="Insert live phone number">+1 (617) 555-0142</span></li>',
    '    </ul></div>',
    '  </div>',
    '  <div class="footer-legal">',
    '    <span>&copy; <span id="year">2026</span> BioCode Peptides, Inc. All rights reserved.</span>',
    '    <span><a href="contact.html">Privacy &amp; Terms</a> &middot; Not for human consumption &middot; Research Use Only</span>',
    '  </div>',
    '</div>'
  ].join('\n');
})();
