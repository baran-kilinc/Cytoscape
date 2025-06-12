# Cytoscape.js - Canlı Vektörel Büyüteç Paneli (Zoom Slider ile)

## Amaç

Bu sistem, Cytoscape.js ile oluşturulmuş bir grafiğe **canlı, net, vektörel bir büyüteç paneli** ekler.  
Kullanıcı, büyüteç ikonuna tıklayarak paneli açabilir, panelde ana grafikte farenin gezdiği alanı **1x ile 10x arası ayarlanabilir yakınlaştırma** ile görebilir.  
Büyüteç paneli, ana grafiği CANLI olarak yansıtır, daima vektörel ve pikselsiz gösterim sunar.

## Özellikler

- Sağ üstte bir büyüteç (magnifier) ikonu yer alır.
- Büyüteç ikonuna tıklayınca sağ altta 150x100 px sabit boyutlu bir büyüteç paneli açılır.
    - Panelin üst kısmında bir "slider" (range input) ile yakınlaştırma oranı **1x ile 10x** arası seçilebilir.
    - Panelin altında, farenin ana grafikte gezdiği yerin **vektörel (asla bulanık olmayan)** canlı görünümü sunulur.
- Büyüteç açıkken, farenin şekli "+" olur.
- Panelde hiçbir etkileşim yoktur (sadece önizleme sunar).
- Panel kapandığında büyüteç işlevi devre dışı kalır.
- Büyüteç paneli, ana grafikteki zoom/pan ve veri değişikliklerine tam senkronize şekilde tepki verir.

## Nasıl Çalışır?

- Panelde, ana Cytoscape’den **ayrı, ikinci bir Cytoscape örneği** (`magCy`) oluşturulur.
- Bu ikinci örnek, ana grafiğin tüm “elements” ve “style”’ını paylaşır.
- Her mouse hareketinde:
    - Ana grafikteki mouse noktasının graf uzayındaki koordinatı alınır.
    - Büyüteç panelindeki Cytoscape’in ortasına bu nokta denk gelecek şekilde `pan` ve `zoom` ayarlanır.
    - Panelin zoom oranı, slider üzerinden istediğin gibi değiştirilebilir.
- Sonuç: Paneldeki görünüm daima net ve CANLI’dır, hiçbir zaman pixel büyütme yapılmaz.

## KOD (Kendi başına çalışır, başka bağımlılık gerektirmez)

```html name=index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cytoscape Magnifier Demo (Vektörel Panel + Zoom Slider)</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.21.1/cytoscape.min.js"></script>
  <style>
    #cy { width: 100%; height: 600px; border: 1px solid black; position: relative; }
    #magnifier-btn {
      position: absolute; top: 16px; right: 32px; z-index: 10; background: none; border: none;
      cursor: pointer; width: 36px; height: 36px; padding: 0;
    }
    #magnifier-btn.active { filter: drop-shadow(0 0 6px #0077ff); background: #eef6ff; border-radius: 50%; }
    #magnifier-panel {
      position: absolute; width: 150px; height: 120px; right: 32px; bottom: 32px;
      background: #fff; border: 2px solid #aaa; z-index: 20; display: none; overflow: hidden; pointer-events: none;
      box-sizing: border-box;
    }
    #magnifier-cy {
      width: 100%;
      height: 100px;
      display: block;
      background: #fff;
    }
    #magnifier-zoom-bar {
      width: 100%;
      height: 20px;
      box-sizing: border-box;
      margin: 0;
      padding: 0 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f6f6f6;
      border-bottom: 1px solid #ddd;
      position: relative;
      pointer-events: auto;
      user-select: none;
    }
    #magnifier-zoom-bar input[type=range] {
      width: 90px;
      margin: 0 6px;
    }
    #magnifier-zoom-value {
      font-size: 12px;
      color: #333;
      min-width: 40px;
      text-align: left;
    }
    body { position: relative; min-height: 100vh; }
  </style>
</head>
<body>
  <!-- Sağ üstte büyüteç ikonu -->
  <button id="magnifier-btn" title="Büyüteç">
    <svg viewBox="0 0 40 40" width="24" height="24" fill="none" stroke="black" stroke-width="2">
      <circle cx="17" cy="17" r="10" stroke-width="2.5"/>
      <line x1="27" y1="27" x2="36" y2="36" stroke-width="3" stroke-linecap="round"/>
    </svg>
  </button>
  <!-- Ana cytoscape grafiği -->
  <div id="cy"></div>
  <!-- Sağ altta büyüteç paneli -->
  <div id="magnifier-panel">
    <div id="magnifier-zoom-bar">
      <span style="font-size:13px; color:#666;" title="Yakınlaştırma Oranı">🔍</span>
      <input id="magnifier-zoom-range" type="range" min="1" max="10" step="0.1" value="2">
      <span id="magnifier-zoom-value">2.0x</span>
    </div>
    <div id="magnifier-cy"></div>
  </div>
  <script>
    // Ana Cytoscape grafiği örneği
    var cy = cytoscape({
      container: document.getElementById('cy'),
      elements: [
        { data: { id: 'a', label: 'Node A' } },
        { data: { id: 'b', label: 'Node B' } },
        { data: { id: 'c', label: 'Node C' } },
        { data: { id: 'd', label: 'Node D' } },
        { data: { id: 'e', label: 'Node E' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'bc', source: 'b', target: 'c' } },
        { data: { id: 'cd', source: 'c', target: 'd' } },
        { data: { id: 'de', source: 'd', target: 'e' } },
        { data: { id: 'ea', source: 'e', target: 'a' } }
      ],
      style: [
        { selector: 'node', style: { 'label': 'data(label)', 'background-color': '#0077ff', 'color': '#fff', 'text-valign': 'center', 'text-halign': 'center', 'font-size': 18 } },
        { selector: 'edge', style: { 'width': 4, 'line-color': '#999', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#999' } }
      ],
      layout: { name: 'grid' }
    });

    // Büyüteç Paneli için 2. cytoscape
    let magCy = null;
    const MAG_WIDTH = 150, MAG_HEIGHT = 100;
    let magZoom = 2; // Varsayılan büyütme oranı (slider ile değişir)
    const magnifierBtn = document.getElementById('magnifier-btn');
    const magnifierPanel = document.getElementById('magnifier-panel');
    const magnifierCyDiv = document.getElementById('magnifier-cy');
    const magnifierZoomRange = document.getElementById('magnifier-zoom-range');
    const magnifierZoomValue = document.getElementById('magnifier-zoom-value');
    let magnifierActive = false;
    const plusCursor = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="13" fill="white" stroke="black" stroke-width="2"/><line x1="16" y1="7" x2="16" y2="25" stroke="black" stroke-width="3"/><line x1="7" y1="16" x2="25" y2="16" stroke="black" stroke-width="3"/></svg>';

    // Paneldeki cytoscape'i başlat (sadece 1 kez)
    function ensureMagCy() {
      if (magCy) return;
      magCy = cytoscape({
        container: magnifierCyDiv,
        elements: cy.json().elements,
        style: cy.style().json(),
        layout: { name: 'preset' },
        userPanningEnabled: false,
        userZoomingEnabled: false,
        boxSelectionEnabled: false,
        autoungrabify: true,
        autounselectify: true,
        minZoom: 0.1,
        maxZoom: 100
      });
      magCy.on('tap', e => false);
    }

    // Panel cytoscape'inin element ve stilini ana grafikle eşitle
    function syncMagCyElementsAndStyle() {
      if (!magCy) return;
      magCy.json({ elements: cy.json().elements });
      magCy.style().fromJson(cy.style().json());
      magCy.resize();
    }

    // Paneldeki zoom ve pan'ı güncelle: farenin olduğu yer panelin ortasına gelsin
    function updateMagnifierView(mouseX, mouseY) {
      if (!magnifierActive) return;
      ensureMagCy();

      const cyRect = cy.container().getBoundingClientRect();
      const localX = mouseX - cyRect.left;
      const localY = mouseY - cyRect.top;

      // Ana grafikte mouse pozisyonunu graf koordinatına çevir
      const cyGraphPosition = cy.renderer().projectIntoViewport(localX, localY);

      // Paneldeki cytoscape zoom'unu ayarla
      magCy.zoom(cy.zoom() * magZoom);
      magCy.resize();

      const panelWidth = MAG_WIDTH;
      const panelHeight = MAG_HEIGHT;
      const magCenterRendered = { x: panelWidth / 2, y: panelHeight / 2 };
      const panX = magCenterRendered.x - cyGraphPosition[0] * magCy.zoom();
      const panY = magCenterRendered.y - cyGraphPosition[1] * magCy.zoom();
      magCy.pan({ x: panX, y: panY });
      magCy.resize();
    }

    // Ana grafikte node/değişiklik olursa paneli de güncelle
    cy.on('add remove data style', () => {
      if (magnifierActive) {
        ensureMagCy();
        syncMagCyElementsAndStyle();
      }
    });

    // Panel aç/kapat
    magnifierBtn.addEventListener('click', () => {
      magnifierActive = !magnifierActive;
      magnifierBtn.classList.toggle('active', magnifierActive);
      magnifierPanel.style.display = magnifierActive ? 'block' : 'none';
      cy.container().style.cursor = magnifierActive ? `url('${plusCursor}') 16 16, crosshair` : '';
      if (magnifierActive) {
        ensureMagCy();
        syncMagCyElementsAndStyle();
        magCy.resize();
      }
    });

    // Mouse hareketinde paneli güncelle
    cy.container().addEventListener('mousemove', e => {
      if (!magnifierActive) return;
      updateMagnifierView(e.clientX, e.clientY);
    });
    cy.container().addEventListener('mouseleave', () => {});

    // Ana grafikte zoom/pan olursa paneli senkronize et
    cy.on('zoom pan render', () => {
      if (magnifierActive && window.lastMouse) updateMagnifierView(window.lastMouse.x, window.lastMouse.y);
    });
    cy.container().addEventListener('mousemove', e => {
      window.lastMouse = {x: e.clientX, y: e.clientY};
    });

    // Slider ile büyüteç zoom oranını değiştir
    function setMagnifierZoom(val) {
      magZoom = parseFloat(val);
      magnifierZoomValue.textContent = magZoom.toFixed(1) + 'x';
      if (magnifierActive && window.lastMouse) {
        updateMagnifierView(window.lastMouse.x, window.lastMouse.y);
      }
    }
    magnifierZoomRange.addEventListener('input', e => setMagnifierZoom(e.target.value));
    setMagnifierZoom(magnifierZoomRange.value);
  </script>
</body>
</html>
```

## Kullanım Kısa Özeti

- Sayfayı aç, büyüteç ikonuna tıkla.
- Ana grafikte mouse'u gezdir: Sağ alttaki panelde daima vektörel ve canlı büyütme oluşur.
- Paneldeki slider ile büyütme oranını istediğin gibi değiştir (1x-10x arası).
- Panelde hiçbir zaman bulanıklık olmaz, her şey ana grafikten CANLI alınır.
- Kendi Cytoscape verini ekleyerek istediğin gibi kullanabilirsin.
