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











  
// --- Parentleri sensorParents algoritması ile hizala (Zusammenbau/ECU) ---
// START_X varyansı x = -2000'den başlayacak
// --- TARGET PARENTLERİ VE CHILD'LARI GRID-BENZERİ DİZİLİŞ (EN ÇOK CHILDA SAHİP OLAN EN ÜSTTE, ÇAKIŞMASIZ) ---

if (typeof window.firstTargetLayoutRun === "undefined") {
  window.firstTargetLayoutRun = true;
}

const targetParents = parentNodes.filter(parent => {
  const type = parent.data('componenttype');
  return type === "ECU" || type === "Zusammenbau";
});
if (targetParents.length > 0) {
  // Sıralama: En çok child'a sahip olan parent en üstte olacak şekilde sırala
  const sortedTargetParents = targetParents.sort((a, b) => {
    const aChildren = getChildNodesOfParent(a.id()).length;
    const bChildren = getChildNodesOfParent(b.id()).length;
    return bChildren - aChildren;
  });

  // Grid için başlama noktası ve parametreler
  const START_X = -2000; // Grid'in sol başı
  const PARENTS_PER_ROW = 2; // Maksimum 2 parent yan yana
  const PARENT_HORIZONTAL_GAP = 800; // Parentlar arası yatay mesafe
  const PARENT_VERTICAL_GAP = 400; // Satırlar arası mesafe
  const CHILD_GRID_MAX_COLS = 4; // Child gridinde en fazla 4 sütun

  // Parent'ların grid yerleşimini hazırla
  let rowParents = [];
  let layoutY = 0;
  let rowMaxHeight = 0;

  // Önce tüm parent ve child grid'lerinin boyutlarını hesaplayalım
  const parentBlockGeometries = sortedTargetParents.map(parent => {
    const parentSize = getNodeSize(parent);
    const childNodes = getChildNodesOfParent(parent.id());
    const childCount = childNodes.length;
    const cols = Math.min(CHILD_GRID_MAX_COLS, childCount > 0 ? childCount : 1);
    const rows = childCount > 0 ? Math.ceil(childCount / cols) : 0;

    let maxChildWidth = 0;
    let maxChildHeight = 0;
    childNodes.forEach(n => {
      const size = getNodeSize(n);
      if (size.width > maxChildWidth) maxChildWidth = size.width;
      if (size.height > maxChildHeight) maxChildHeight = size.height;
    });

    const gridWidth = cols * maxChildWidth + (cols - 1) * CHILD_PADDING;
    const gridHeight = rows * maxChildHeight + (rows - 1) * VERTICAL_CHILD_PADDING;

    const totalBlockHeight = parentSize.height / 2 + CHILD_SIDE_PADDING + gridHeight + maxChildHeight / 2;
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

  // Parent ve child'ların konumlarını önceden hesaplayıp çakışmayı önleyecek şekilde ayarlayalım
  const parentPlacements = [];

  for (let i = 0; i < parentBlockGeometries.length; i++) {
    const block = parentBlockGeometries[i];

    if (rowParents.length === 0) {
      rowMaxHeight = block.parentSize.height + CHILD_SIDE_PADDING + block.gridHeight;
    } else {
      if (block.parentSize.height + CHILD_SIDE_PADDING + block.gridHeight > rowMaxHeight) {
        rowMaxHeight = block.parentSize.height + CHILD_SIDE_PADDING + block.gridHeight;
      }
    }

    const parentX = START_X + (rowParents.length) * (block.totalBlockWidth + PARENT_HORIZONTAL_GAP);
    const parentY = layoutY + block.parentSize.height / 2;

    parentPlacements.push({
      parent: block.parent,
      parentX,
      parentY,
      block
    });

    rowParents.push(block);

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
      const gridStartX = parentX + (block.totalBlockWidth - block.gridWidth) / 2;
      const gridStartY = parentY + block.parentSize.height / 2 + CHILD_SIDE_PADDING;
      for (let idx = 0; idx < block.childNodes.length; idx++) {
        const col = idx % block.gridCols;
        const row = Math.floor(idx / block.gridCols);
        const child = block.childNodes[idx];
        const csize = getNodeSize(child);
        const cx = gridStartX + col * (block.maxChildWidth + CHILD_PADDING) + block.maxChildWidth / 2;
        const cy = gridStartY + row * (block.maxChildHeight + VERTICAL_CHILD_PADDING) + block.maxChildHeight / 2;

        // SADECE İLK ÇALIŞTIRMADA X DEĞERİNİ 0'A ÇEK
        if (window.firstTargetLayoutRun) {
          child.position({ x: 0, y: cy });
        } else {
          child.position({ x: cx, y: cy });
        }
      }
    }
  });

  // Artık ilk çalıştırma yapıldı, tekrar x=0 yapılmasın
  window.firstTargetLayoutRun = false;
}










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







// 1. Lokalize edilen parent grubu (ECU, Sensor, Actuator, Zusammenbau)
const parentNodeses = cy.nodes().filter(n =>
  n.data('originalType') === "allocationtargetfunml" &&
  (
    n.data('componenttype') === "ECU" ||
    n.data('componenttype') === "Sensor" ||
    n.data('componenttype') === "Actuator" ||
    n.data('componenttype') === "Zusammenbau"
  )
);
// 2. Lokalize edilen parent'ların child'ları
const localisedParentIds = new Set(parentNodeses.map(n => n.id()));
const localisedChildIds = new Set();
parentNodeses.forEach(parent => {
  cy.nodes().forEach(n => {
    if (n.data('parent') === parent.id()) localisedChildIds.add(n.id());
  });
});
// 3. Tüm lokalize edilen node'ların id'leri (parent ve onların child'ları)
const excludedIds = new Set([...localisedParentIds, ...localisedChildIds]);
// 4. Geriye kalan tüm node'ler gridde hizalanacak
const unlocalisedNodes = cy.nodes().filter(n => !excludedIds.has(n.id()));

// --- GELİŞTİRİLMİŞ: unlocalisedNodes için lokalizasyon ---
if (unlocalisedNodes.length > 0) {
  const avgY = unlocalisedNodes.map(n => n.position('y')).reduce((sum, y) => sum + y, 0) / unlocalisedNodes.length;

  // 1. Parent'lı ve parent'sız nodeleri ayır
  const parentGroups = [];
  const singles = [];
  const unlocalisedParents = unlocalisedNodes.filter(n => getChildNodesOfParent(n.id()).length > 0);
  const usedNodeIds = new Set();
  unlocalisedParents.forEach(parent => {
    const children = getChildNodesOfParent(parent.id()).filter(n => unlocalisedNodes.some(un => un.id() === n.id()));
    parentGroups.push({ parent, children });
    usedNodeIds.add(parent.id());
    children.forEach(n => usedNodeIds.add(n.id()));
  });
  unlocalisedNodes.forEach(n => {
    if (!usedNodeIds.has(n.id())) {
      singles.push(n);
    }
  });

  // 2. Grupların toplam genişliğini ve başlama noktasını hesapla
  let totalGroupsWidth = 0;
  const groupWidths = [];
  parentGroups.forEach(({ parent, children }, i) => {
    const parentSize = getNodeSize(parent);
    const childrenWidth = children.reduce((sum, n, idx) => {
      const size = getNodeSize(n);
      return sum + size.width + (idx > 0 ? CHILD_PADDING*1.7 : 0);
    }, 0);
    const groupWidth = Math.max(parentSize.width, childrenWidth);
    groupWidths.push(groupWidth);
    totalGroupsWidth += groupWidth;
    if (i > 0) totalGroupsWidth += CHILD_PADDING*2.2; // gruplar arası boşluk
  });

  // Ortala: tüm grubun orta noktası x = 0 olacak şekilde hizala
  let startX = -totalGroupsWidth / 2;

  parentGroups.forEach(({ parent, children }, i) => {
    const parentSize = getNodeSize(parent);
    const childrenWidth = children.reduce((sum, n, idx) => {
      const size = getNodeSize(n);
      return sum + size.width + (idx > 0 ? CHILD_PADDING*1.7 : 0);
    }, 0);
    const groupWidth = groupWidths[i];

    // Parent'i ortala
    parent.position({
      x: startX + groupWidth / 2,
      y: avgY - 200
    });

    // Child'ları parent'in altına, yan yana ortala
    let childStartX = startX + groupWidth / 2 - childrenWidth / 2;
    children.forEach((n, idx) => {
      const size = getNodeSize(n);
      n.position({
        x: childStartX + size.width / 2,
        y: avgY + 150
      });
      childStartX += size.width + CHILD_PADDING*1.65;
    });

    // Sonraki grubun başlama noktasını güncelle
    startX += groupWidth + CHILD_PADDING*2.2;
  });

  // 3. Parent'i olmayan nodeleri EN SAĞA hizala
  let singlesStartX = startX;
  singles.forEach((node, i) => {
    const size = getNodeSize(node);
    node.position({
      x: singlesStartX + size.width / 2 + 200,
      y: avgY
    });
    singlesStartX += size.width + 500; // NODE_PADDING
  });
}
}

