

// ---- YENİ CUSTOM LAYOUT ALGORITHM (çakışmasız ve ortalanmış) ----
function applyCustomLayoutForAllocationTargets(cy) {
  // CHILD_PADDING ve VERTICAL_CHILD_PADDING iki katına çıkarıldı!
  const CHILD_PADDING = 450; // Child node'lar arası boşluk (2 kat)
  const CHILD_SIDE_PADDING = 150; // Parent-child kenar boşlukları (child'lar arası dikeyde de kullanılacak)
  const VERTICAL_CHILD_PADDING = 50; // Sensor/Actuator child'ları arası dikey boşluk (2 kat)
  const CHILD_SIDE_PADDING_SENSOR = 250;
  const CHILD_SIDE_PADDING_ACTUATOR = 250;

  function getNodeSize(n) {
    const label = n.data('label') || '';
    const lines = countLabelLines(label);
    const font = "18px Arial";
    const width = computeNodeWidthByLabel(label, font, 100, 40);
    const height = 40 * lines + 40; // Satır sayısına göre dinamik yükseklik
    return { width, height };
  }

  function calcTotalSize(nodes, axis) {
    if (nodes.length === 0) return 0;
    let total = 0;
    nodes.forEach(n => {
      const size = getNodeSize(n);
      total += axis === "x" ? size.width : size.height;
    });
    total += (nodes.length - 1) * (axis === "x" ? CHILD_PADDING : VERTICAL_CHILD_PADDING);
    return total;
  }

  const parentNodes = cy.nodes().filter(n =>
    n.data('originalType') === "allocationtargetfunml" &&
    typeof n.data('componenttype') !== "undefined"
  );

  function getChildNodesOfParent(parentId) {
    return cy.nodes().filter(n =>
      n.data('parent') === parentId
    );
  }











  
/**
 * ECU & Zusammenbau özel layout fonksiyonu
 *
 * Sağlanan kurallar:
 *  - Parent'lar (yalnızca componenttype: ECU veya Zusammenbau):
 *      * Child sayısına göre (çok -> az) yukarıdan aşağıya sıralanır.
 *      * 7 veya daha fazla child varsa parent tek başına bir satır kaplar.
 *      * 6 veya daha az child varsa iki parent aynı satırı paylaşabilir (kalan tek kalırsa tek satır alır).
 *      * Satırlar x=0 etrafında ortalanır.
 *
 *  - Child grid (parent altındaki dizilim):
 *      1  => 1
 *      2  => 2
 *      3  => 3
 *      4  => 2-2
 *      5  => 3-2 (listede yoktu, varsayılan. İstersen 2-3 yapabilirsin)
 *      6  => 2-2-2
 *      7  => 4-3
 *      8  => 4-4
 *      9  => 4-4-1
 *      10 => 4-4-2
 *      11 => 4-4-3
 *      12 => 4-4-4
 *      13 => 4-4-4-1
 *      14 => 4-4-4-2
 *      15 => 4-4-4-3
 *      16 => 4-4-4-4
 *      17 => 4-4-4-4-1
 *      18 => 4-4-4-4-2
 *      19 => 4-4-4-4-3
 *      20 => 4-4-4-4-4
 *      >20 => 4-4-4-...-kalan (4'erli satırlar + kalan)
 *
 *  - Çocuk satırları arası dikey boşluk, yatay spacing ayarlanır.
 *  - Parent üstü ile ilk child satırı arası offset: 300px
 *
 * Varsayımlar:
 *  - Global yardımcılar mevcut:
 *      getChildNodesOfParent(parentId) => array / collection
 *      getNodeSize(node) => { width, height }
 *      parentNodes => ECU, Sensor vb. parent node'ları içeren collection
 *      cy => Cytoscape instance
 *
 * Önemli:
 *  - Başka bir script bu fonksiyondan sonra position() çağırıp üzerine yazıyorsa grid bozulur.
 *  - Bu fonksiyon yalnızca ECU ve Zusammenbau için çalışır; Sensor / Actuator vb. dokunmaz.
 */

 (function layoutECUAndZusammenbau() {
  // --- KONFİG ---
  const TARGET_TYPES = new Set(["ECU", "Zusammenbau"]);
  const CENTER_X = 0;

  // Parent satırları arası dikey boşluk (bir satırın en alt child'ından sonraki satır parent üstüne kadar)
  const ROW_VERTICAL_GAP = 400;

  // Aynı satırda iki küçük parent arası yatay boşluk
  const SMALL_PARENT_HORIZONTAL_GAP = 600;

  // Child grid parametreleri
  const CHILD_FIRST_ROW_OFFSET = 300;   // Parent alt kenarından ilk child satırının üstüne kadar
  const CHILD_ROW_V_GAP = 50;           // Child satırları arası dikey boşluk
  const CHILD_COL_H_GAP = 450;          // Aynı satırdaki child kutuları arası yatay boşluk

  // --- Yardımcı: Child row pattern tablosu ---
  const PATTERN_MAP = {
    1: [1],
    2: [2],
    3: [3],
    4: [2, 2],
    5: [3, 2],          // Belirtilmediği için varsayılan
    6: [2, 2, 2],
    7: [4, 3],
    8: [4, 4],
    9: [4, 4, 1],
    10: [4, 4, 2],
    11: [4, 4, 3],
    12: [4, 4, 4],
    13: [4, 4, 4, 1],
    14: [4, 4, 4, 2],
    15: [4, 4, 4, 3],
    16: [4, 4, 4, 4],
    17: [4, 4, 4, 4, 1],
    18: [4, 4, 4, 4, 2],
    19: [4, 4, 4, 4, 3],
    20: [4, 4, 4, 4, 4]
  };

  function getChildRowPattern(count) {
    if (PATTERN_MAP[count]) return PATTERN_MAP[count].slice();
    // 20'den büyük -> 4'lü satırlar + kalan
    const pattern = [];
    let remaining = count;
    while (remaining > 4) {
      pattern.push(4);
      remaining -= 4;
    }
    if (remaining > 0) pattern.push(remaining);
    return pattern;
  }

  // --- Hedef parent'ları al ---
  const targetParents = parentNodes.filter(p => TARGET_TYPES.has(p.data('componenttype')));
  if (!targetParents || targetParents.length === 0) return;

  // Parent verileri
  const entries = targetParents.map(p => {
    const children = getChildNodesOfParent(p.id()) || [];
    return {
      parent: p,
      children,
      childCount: children.length,
      parentSize: getNodeSize(p)
    };
  });

  // Child sayısına göre (çok -> az) sırala
  entries.sort((a, b) => b.childCount - a.childCount);

  // Row oluşturma (>=7 tek, <=6 ikili)
  const rows = [];
  for (let i = 0; i < entries.length; ) {
    const cur = entries[i];
    if (cur.childCount >= 7) {
      rows.push([cur]);
      i += 1;
    } else {
      const next = entries[i + 1];
      if (next && next.childCount <= 6) {
        rows.push([cur, next]);
        i += 2;
      } else {
        rows.push([cur]);
        i += 1;
      }
    }
  }

  // Bir parent'ın (child grid dahil) en geniş satır genişliğini hesapla
  function computeLayoutWidth(entry) {
    const { parent, children, parentSize } = entry;
    if (!children || children.length === 0) return parentSize.width;
    const pattern = getChildRowPattern(children.length);
    let idx = 0;
    let maxRowWidth = 0;

    pattern.forEach(rowCount => {
      const rowKids = children.slice(idx, idx + rowCount);
      idx += rowCount;
      let rowWidth = 0;
      rowKids.forEach((n, i) => {
        const sz = getNodeSize(n);
        rowWidth += sz.width;
        if (i > 0) rowWidth += CHILD_COL_H_GAP;
      });
      if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
    });

    return Math.max(parentSize.width, maxRowWidth);
  }

  // Bir parent’ın child’larını grid’e yerleştir
  function layoutChildren(entry) {
    const { parent, parentSize, children } = entry;
    if (!children || children.length === 0) {
      return parent.position('y') + parentSize.height / 2;
    }

    const parentPos = parent.position();
    const parentBottom = parentPos.y + parentSize.height / 2;

    const pattern = getChildRowPattern(children.length);

    // Satırları oluştur
    let idx = 0;
    const rows = pattern.map(cnt => {
      const slice = children.slice(idx, idx + cnt);
      idx += cnt;
      return slice;
    });

    // Satır metrikleri
    const rowMetrics = rows.map(rowKids => {
      const sizes = rowKids.map(n => getNodeSize(n));
      const maxH = sizes.reduce((m, s) => Math.max(m, s.height), 0);
      const totalW = sizes.reduce((sum, s, i) => sum + s.width + (i > 0 ? CHILD_COL_H_GAP : 0), 0);
      return { sizes, maxH, totalW };
    });

    let currentTop = parentBottom + CHILD_FIRST_ROW_OFFSET;
    let overallBottom = parentBottom;

    rows.forEach((rowKids, rIndex) => {
      const { sizes, maxH, totalW } = rowMetrics[rIndex];
      const startX = parentPos.x - totalW / 2;
      let cursorX = startX;
      const rowCenterY = currentTop + maxH / 2;

      rowKids.forEach((node, i) => {
        const sz = sizes[i];
        const cx = cursorX + sz.width / 2;
        node.position({ x: cx, y: rowCenterY });
        cursorX += sz.width + CHILD_COL_H_GAP;
      });

      const rowBottom = currentTop + maxH;
      if (rowBottom > overallBottom) overallBottom = rowBottom;
      currentTop = rowBottom + CHILD_ROW_V_GAP;
    });

    return overallBottom;
  }

  // --- Yerleştirme döngüsü ---
  let currentYTop = 0; // Bir sonraki satırın parent üst kenarı

  cy.batch(() => {
    rows.forEach(row => {
      // Satırın toplam genişliği
      const widths = row.map(e => computeLayoutWidth(e));
      let totalWidth;
      if (row.length === 1) {
        totalWidth = widths[0];
      } else {
        totalWidth = widths[0] + SMALL_PARENT_HORIZONTAL_GAP + widths[1];
      }
      const leftX = CENTER_X - totalWidth / 2;

      // Parent merkez X’leri
      const centers = [];
      if (row.length === 1) {
        centers.push(leftX + widths[0] / 2);
      } else {
        const c1 = leftX + widths[0] / 2;
        const c2 = c1 + widths[0] / 2 + SMALL_PARENT_HORIZONTAL_GAP + widths[1] / 2;
        centers.push(c1, c2);
      }

      // Parent'ları yerleştir (üst kenar currentYTop)
      row.forEach((entry, idx) => {
        const py = currentYTop + entry.parentSize.height / 2;
        entry.parent.position({ x: centers[idx], y: py });
      });

      // Child grid ve satır alt sınırı
      let rowBottom = currentYTop;
      row.forEach(entry => {
        const bottom = layoutChildren(entry);
        if (bottom > rowBottom) rowBottom = bottom;
      });

      currentYTop = rowBottom + ROW_VERTICAL_GAP;
    });
  });

  // (İsteğe bağlı) Tamamlandığını event ile duyurmak istersen:
  // cy.emit('layoutready');
})();




// --- SENSOR PARENTLERİ VE CHILD'LARI GRID-BENZERİ DİZİLİŞ (EN ÇOK CHILDA SAHİP OLAN EN ÜSTTE, ÇAKIŞMASIZ) ---

// Bu flag sadece ilk çalıştırmada true olacak, sonra false olacak
if (typeof window.firstSensorLayoutRun === "undefined") {
  window.firstSensorLayoutRun = true;
}

const sensorParents = parentNodes.filter(parent => parent.data('componenttype') === "Sensor");
if (sensorParents.length > 0) {
  // Sıralama: En çok child'a sahip olan parent en üstte olacak şekilde sırala
  const sortedSensorParents = sensorParents.sort((a, b) => {
    const aChildren = getChildNodesOfParent(a.id()).length;
    const bChildren = getChildNodesOfParent(b.id()).length;
    return bChildren - aChildren;
  });

  // Grid için başlama noktası ve parametreler
  const START_X = -20000; // Grid'in sol başı
  const PARENTS_PER_ROW = 2; // Maksimum 2 parent yan yana
  const PARENT_HORIZONTAL_GAP = 800; // Parentlar arası yatay mesafe
  const PARENT_VERTICAL_GAP = 400; // Satırlar arası mesafe
  const CHILD_GRID_MAX_COLS = 4; // Child gridinde en fazla 4 sütun
  // Child paddingler yukarıdan geliyor: CHILD_PADDING, VERTICAL_CHILD_PADDING, CHILD_SIDE_PADDING_SENSOR

  // Parent'ların grid yerleşimini hazırla
  let currentRow = 0;
  let currentCol = 0;
  let maxRowHeight = 0; // Her row'daki en yüksek parent + en yüksek child grid yüksekliği

  // Parent ve child'ların konumlarını önceden hesaplayıp çakışmayı önleyecek şekilde ayarlayalım
  // Her parent'ın yerleşeceği x,y
  const parentPlacements = [];

  // Önce tüm parent ve child grid'lerinin boyutlarını hesaplayalım
  const parentBlockGeometries = sortedSensorParents.map(parent => {
    const parentSize = getNodeSize(parent);
    const childNodes = getChildNodesOfParent(parent.id());
    // Child grid boyutu
    const childCount = childNodes.length;
    const cols = Math.min(CHILD_GRID_MAX_COLS, childCount > 0 ? childCount : 1);
    const rows = childCount > 0 ? Math.ceil(childCount / cols) : 0;

    // Her child'ın width/height değerlerini topla, gridde max genişlik/satır yüksekliği bul
    let maxChildWidth = 0;
    let maxChildHeight = 0;
    childNodes.forEach(n => {
      const size = getNodeSize(n);
      if (size.width > maxChildWidth) maxChildWidth = size.width;
      if (size.height > maxChildHeight) maxChildHeight = size.height;
    });

    // Grid'in toplam genişliği/height'ı (aralara padding de eklenecek)
    const gridWidth = cols * maxChildWidth + (cols - 1) * CHILD_PADDING;
    const gridHeight = rows * maxChildHeight + (rows - 1) * VERTICAL_CHILD_PADDING;

    // Parent'ın altına grid koyulacaksa toplam yükseklik
    // Parent üstte, altında CHILD_SIDE_PADDING_SENSOR, sonra child grid
    const totalBlockHeight = parentSize.height / 2 + CHILD_SIDE_PADDING_SENSOR + gridHeight + maxChildHeight / 2;
    // Parent'ın ortalanacağı genişlik
    const totalBlockWidth = Math.max(parentSize.width, gridWidth);

    return {
      parent,
      parentSize,
      childNodes,
      childCount,
      gridCols: cols,
      gridRows: rows,
      maxChildWidth,
      maxChildHeight,
      gridWidth,
      gridHeight,
      totalBlockWidth,
      totalBlockHeight
    };
  });

  // Parent'ları satır satır yerleştir
  let layoutY = 0;
  let rowParents = [];
  let rowMaxHeight = 0;

  for (let i = 0; i < parentBlockGeometries.length; i++) {
    const block = parentBlockGeometries[i];

    // Satır başıysa
    if (rowParents.length === 0) {
      rowMaxHeight = block.parentSize.height + CHILD_SIDE_PADDING_SENSOR + block.gridHeight;
    } else {
      // Satırda max yükseklik tutulsun
      if (block.parentSize.height + CHILD_SIDE_PADDING_SENSOR + block.gridHeight > rowMaxHeight) {
        rowMaxHeight = block.parentSize.height + CHILD_SIDE_PADDING_SENSOR + block.gridHeight;
      }
    }

    // Parent'ın x pozisyonu
    const parentX = START_X + (rowParents.length) * (block.totalBlockWidth + PARENT_HORIZONTAL_GAP);
    // Parent'ın y pozisyonu (her satırda yukarıdan aşağıya)
    const parentY = layoutY + block.parentSize.height / 2;

    parentPlacements.push({
      parent: block.parent,
      parentX,
      parentY,
      block
    });

    rowParents.push(block);

    // Satır dolduysa veya son parent ise, bir sonraki satıra geç
    if (rowParents.length === PARENTS_PER_ROW || i === parentBlockGeometries.length - 1) {
      layoutY += rowMaxHeight + PARENT_VERTICAL_GAP;
      rowParents = [];
      rowMaxHeight = 0;
    }
  }

  // Parent ve child'ları konumlandır
  parentPlacements.forEach(({ parent, parentX, parentY, block }) => {
    // 1. Parent node pozisyonu
    parent.position({
      x: parentX + block.totalBlockWidth / 2,
      y: parentY
    });

    // 2. Child grid pozisyonları
    if (block.childCount > 0) {
      // Gridin sol üst köşe (parent'ın altına ortalanmış)
      const gridStartX = parentX + (block.totalBlockWidth - block.gridWidth) / 2;
      const gridStartY = parentY + block.parentSize.height / 2 + CHILD_SIDE_PADDING_SENSOR;
      for (let idx = 0; idx < block.childNodes.length; idx++) {
        const col = idx % block.gridCols;
        const row = Math.floor(idx / block.gridCols);
        const child = block.childNodes[idx];
        // Child'ın tam boyutunu öğren
        const csize = getNodeSize(child);
        // X: kolonun başı + ortalanmış child
        const cx = gridStartX + col * (block.maxChildWidth + CHILD_PADDING) + block.maxChildWidth / 2;
        // Y: satırın başı + ortalanmış child
        const cy = gridStartY + row * (block.maxChildHeight + VERTICAL_CHILD_PADDING) + block.maxChildHeight / 2;

        // SADECE İLK ÇALIŞTIRMADA X DEĞERİNİ 0'A ÇEK
        if (window.firstSensorLayoutRun) {
          child.position({ x: 0, y: cy });
        } else {
          child.position({ x: cx, y: cy });
        }
      }
    }
  });

  // Artık ilk çalıştırma yapıldı, tekrar x=0 yapılmasın
  window.firstSensorLayoutRun = false;
}
















// --- ACTUATOR PARENTLERİ VE CHILD'LARI GRID-BENZERİ DİZİLİŞ (EN ÇOK CHILDA SAHİP OLAN EN ÜSTTE, ÇAKIŞMASIZ) ---

// Sadece ilk çalıştırmada true olacak bir flag
if (typeof window.firstActuatorLayoutRun === "undefined") {
  window.firstActuatorLayoutRun = true;
}

const actuatorParents = parentNodes.filter(parent => parent.data('componenttype') === "Actuator");
if (actuatorParents.length > 0) {
  // Sıralama: En çok child'a sahip olan parent en üstte olacak şekilde sırala
  const sortedActuatorParents = actuatorParents.sort((a, b) => {
    const aChildren = getChildNodesOfParent(a.id()).length;
    const bChildren = getChildNodesOfParent(b.id()).length;
    return bChildren - aChildren;
  });

  // Grid için başlama noktası ve parametreler
  const START_X = +20000; // Grid'in sağ başı
  const PARENTS_PER_ROW = 2; // Maksimum 2 parent yan yana
  const PARENT_HORIZONTAL_GAP = 800; // Parentlar arası yatay mesafe
  const PARENT_VERTICAL_GAP = 400; // Satırlar arası mesafe
  const CHILD_GRID_MAX_COLS = 4; // Child gridinde en fazla 4 sütun
  // Child paddingler yukarıdan geliyor: CHILD_PADDING, VERTICAL_CHILD_PADDING, CHILD_SIDE_PADDING_ACTUATOR

  // Parent'ların grid yerleşimini önceden hesaplayalım
  let currentRow = 0;
  let currentCol = 0;
  let maxRowHeight = 0; // Her row'daki en yüksek parent + en yüksek child grid yüksekliği

  // Her parent'ın yerleşeceği x,y
  const parentPlacements = [];

  // Önce tüm parent ve child grid'lerinin boyutlarını hesaplayalım
  const parentBlockGeometries = sortedActuatorParents.map(parent => {
    const parentSize = getNodeSize(parent);
    const childNodes = getChildNodesOfParent(parent.id());
    // Child grid boyutu
    const childCount = childNodes.length;
    const cols = Math.min(CHILD_GRID_MAX_COLS, childCount > 0 ? childCount : 1);
    const rows = childCount > 0 ? Math.ceil(childCount / cols) : 0;

    // Her child'ın width/height değerlerini topla, gridde max genişlik/satır yüksekliği bul
    let maxChildWidth = 0;
    let maxChildHeight = 0;
    childNodes.forEach(n => {
      const size = getNodeSize(n);
      if (size.width > maxChildWidth) maxChildWidth = size.width;
      if (size.height > maxChildHeight) maxChildHeight = size.height;
    });

    // Grid'in toplam genişliği/height'ı (aralara padding de eklenecek)
    const gridWidth = cols * maxChildWidth + (cols - 1) * CHILD_PADDING;
    const gridHeight = rows * maxChildHeight + (rows - 1) * VERTICAL_CHILD_PADDING;

    // Parent'ın altına grid koyulacaksa toplam yükseklik
    // Parent üstte, altında CHILD_SIDE_PADDING_ACTUATOR, sonra child grid
    const totalBlockHeight = parentSize.height / 2 + CHILD_SIDE_PADDING_ACTUATOR + gridHeight + maxChildHeight / 2;
    // Parent'ın ortalanacağı genişlik
    const totalBlockWidth = Math.max(parentSize.width, gridWidth);

    return {
      parent,
      parentSize,
      childNodes,
      childCount,
      gridCols: cols,
      gridRows: rows,
      maxChildWidth,
      maxChildHeight,
      gridWidth,
      gridHeight,
      totalBlockWidth,
      totalBlockHeight
    };
  });

  // Parent'ları satır satır yerleştir
  let layoutY = 0;
  let rowParents = [];
  let rowMaxHeight = 0;

  for (let i = 0; i < parentBlockGeometries.length; i++) {
    const block = parentBlockGeometries[i];

    // Satır başıysa
    if (rowParents.length === 0) {
      rowMaxHeight = block.parentSize.height + CHILD_SIDE_PADDING_ACTUATOR + block.gridHeight;
    } else {
      // Satırda max yükseklik tutulsun
      if (block.parentSize.height + CHILD_SIDE_PADDING_ACTUATOR + block.gridHeight > rowMaxHeight) {
        rowMaxHeight = block.parentSize.height + CHILD_SIDE_PADDING_ACTUATOR + block.gridHeight;
      }
    }

    // Parent'ın x pozisyonu
    const parentX = START_X + (rowParents.length) * (block.totalBlockWidth + PARENT_HORIZONTAL_GAP);
    // Parent'ın y pozisyonu (her satırda yukarıdan aşağıya)
    const parentY = layoutY + block.parentSize.height / 2;

    parentPlacements.push({
      parent: block.parent,
      parentX,
      parentY,
      block
    });

    rowParents.push(block);

    // Satır dolduysa veya son parent ise, bir sonraki satıra geç
    if (rowParents.length === PARENTS_PER_ROW || i === parentBlockGeometries.length - 1) {
      layoutY += rowMaxHeight + PARENT_VERTICAL_GAP;
      rowParents = [];
      rowMaxHeight = 0;
    }
  }

  // Parent ve child'ları konumlandır
  parentPlacements.forEach(({ parent, parentX, parentY, block }) => {
    // 1. Parent node pozisyonu
    parent.position({
      x: parentX + block.totalBlockWidth / 2,
      y: parentY
    });

    // 2. Child grid pozisyonları
    if (block.childCount > 0) {
      // Gridin sol üst köşe (parent'ın altına ortalanmış)
      const gridStartX = parentX + (block.totalBlockWidth - block.gridWidth) / 2;
      const gridStartY = parentY + block.parentSize.height / 2 + CHILD_SIDE_PADDING_ACTUATOR;
      for (let idx = 0; idx < block.childNodes.length; idx++) {
        const col = idx % block.gridCols;
        const row = Math.floor(idx / block.gridCols);
        const child = block.childNodes[idx];
        // Child'ın tam boyutunu öğren
        const csize = getNodeSize(child);
        // X: kolonun başı + ortalanmış child
        const cx = gridStartX + col * (block.maxChildWidth + CHILD_PADDING) + block.maxChildWidth / 2;
        // Y: satırın başı + ortalanmış child
        const cy = gridStartY + row * (block.maxChildHeight + VERTICAL_CHILD_PADDING) + block.maxChildHeight / 2;

        // SADECE İLK ÇALIŞTIRMADA X DEĞERİNİ 0'A ÇEK
        if (window.firstActuatorLayoutRun) {
          child.position({ x: 0, y: cy });
        } else {
          child.position({ x: cx, y: cy });
        }
      }
    }
  });

  // İlk çalıştırmadan sonra flag'i false yap
  window.firstActuatorLayoutRun = false;
}









  // --- Diğer parent'lar için child node'ları hizala ---
  parentNodes.forEach(parent => {
    const type = parent.data('componenttype');
    if (type === "Sensor" || type === "Sensor") {
      // Sensor ve Actuator tipi yukarıda özel sırada işlendi!
      return;
    }
    const childNodes = getChildNodesOfParent(parent.id());
    if (childNodes.length === 0) return;

    // Parent'in EN GÜNCEL pozisyonunu al!
    const px = parent.position('x');
    const py = parent.position('y');

    if (type === "ECU" || type === "Zusammenbau") {
      // YATAY hizalama: Parent’in altına, ortalı şekilde child’ları CHILD_PADDING ile sırala
      const totalWidth = childNodes.reduce((sum, n, i) => {
        const size = getNodeSize(n);
        return sum + size.width + (i > 0 ? CHILD_PADDING : 0);
      }, 0);

      let startX = px - totalWidth / 2;
      let y = py - 300; // Parent'in hemen altı

      childNodes.forEach((n, i) => {
        const size = getNodeSize(n);
        n.position({ x: startX + size.width / 2 + 200, y: y + size.height / 2 });
        startX += size.width + CHILD_PADDING;
      });

    }
  })






}



