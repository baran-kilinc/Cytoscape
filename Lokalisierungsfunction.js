

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











  
// --- YENİ: Sadece "Zusammenbau / ECU" parent grubunu lokalize et (dikey sıralı, parent x=0 ortalanmış) ---
// İSTEK ÖZETİ:
//  - Sadece ECU ve Zusammenbau parent'ları işlenecek
//  - Parent'lar child sayısına göre (çok -> az) yukarıdan aşağıya sıralanacak
//  - Her parent için mevcut child düzeni (aralarındaki mesafeler, konum farkları) KORUNACAK
//  - Parent merkezinin x'i 0 yapılacak (parent x=0'a ortalanacak)
//  - Child'lar parent'a göre relatif konumlarını koruyacak (yani grup hep birlikte yatayda parent ile beraber kayacak)
//  - Dikeyde gruplar alt alta yerleştirilecek; grup yüksekliği parent + child'ların kapsadığı yükseklikle belirlenir
//  - Her parent için genişlik (parent ve child'ların kapsadığı toplam genişlik) hesaplanıp data'ya yazılır (isteğe bağlı kullanılabilir)
(function localizeAndPlaceUnlocalisedNodes() {
  // --- Padding ve boşluk parametreleri ---
  const TARGET_TYPES = new Set(["ECU", "Zusammenbau"]);
  const VERTICAL_GROUP_GAP = 400;
  const CHILD_PADDING = 450; // Child node'lar arası boşluk (düzen kuralı: actuator grid gibi)
  const CHILD_SIDE_PADDING = 150;
  const VERTICAL_CHILD_PADDING = 50; // Sensor/Actuator child arası dikey
  const ECU_CHILD_OFFSET_Y = 300; // ECU/Zusammenbau'nun child'ı parent'in altına ne kadar uzakta
  const ECU_CHILD_OFFSET_X = 200; // Child'ların sağa kaydırılması (orada da uygulanıyor)

  // --- ECU & Zusammenbau gruplarını hizala ---
  const targetParents = parentNodes.filter(p => TARGET_TYPES.has(p.data('componenttype')));
  if (targetParents.length === 0) return;

  // Child sayısına göre sırala (çoktan aza)
  const sortedParents = targetParents.sort((a, b) =>
    getChildNodesOfParent(b.id()).length - getChildNodesOfParent(a.id()).length
  );

  let currentY = 0;
  let groupBottomYs = [];

  sortedParents.forEach(parent => {
    const parentSize = getNodeSize(parent);
    const parentOldX = parent.position('x');
    const parentOldY = parent.position('y');
    const children = getChildNodesOfParent(parent.id());

    // Çocukların parent'a göre relatif offsetlerini kaydet
    const childOffsets = children.map(ch => ({
      node: ch,
      dx: ch.position('x') - parentOldX,
      dy: ch.position('y') - parentOldY,
      size: getNodeSize(ch)
    }));

    // Grup için relatif bounding box hesapla
    let minRelX = -parentSize.width / 2;
    let maxRelX =  parentSize.width / 2;
    let minRelY = -parentSize.height / 2;
    let maxRelY =  parentSize.height / 2;

    childOffsets.forEach(o => {
      const w = o.size.width, h = o.size.height;
      const left   = o.dx - w / 2;
      const right  = o.dx + w / 2;
      const top    = o.dy - h / 2;
      const bottom = o.dy + h / 2;
      if (left   < minRelX) minRelX = left;
      if (right  > maxRelX) maxRelX = right;
      if (top    < minRelY) minRelY = top;
      if (bottom > maxRelY) maxRelY = bottom;
    });

    const groupWidth  = maxRelX - minRelX;
    const groupHeight = maxRelY - minRelY;

    // Parent'in yeni Y'sini belirle
    const newParentY = currentY - minRelY;

    // Parent'i x=0 merkezle
    parent.position({ x: 0, y: newParentY });

    // Çocukları relatif farkları koruyarak taşı
    childOffsets.forEach(o => {
      o.node.position({
        x: 0 + o.dx,
        y: newParentY + o.dy
      });
    });

    parent.data('computedGroupWidth', groupWidth);
    parent.data('computedGroupHeight', groupHeight);

    // Bu grubun alt sınırı (mutlak Y)
    const groupBottomY = newParentY + maxRelY;
    groupBottomYs.push(groupBottomY);

    currentY += groupHeight + VERTICAL_GROUP_GAP + 300;
  });

  // --- Sensor ve Actuator gruplarının alt sınırlarını da bul ---
  const sensorParents = parentNodes.filter(p => p.data('componenttype') === "Sensor");
  sensorParents.forEach(parent => {
    const parentSize = getNodeSize(parent);
    const children = getChildNodesOfParent(parent.id());
    let maxChildY = parent.position('y');
    children.forEach(n => {
      const nSize = getNodeSize(n);
      const childBottomY = n.position('y') + nSize.height / 2;
      if (childBottomY > maxChildY) maxChildY = childBottomY;
    });
    const parentBottomY = parent.position('y') + parentSize.height / 2;
    groupBottomYs.push(Math.max(maxChildY, parentBottomY));
  });

  const actuatorParents = parentNodes.filter(p => p.data('componenttype') === "Actuator");
  actuatorParents.forEach(parent => {
    const parentSize = getNodeSize(parent);
    const children = getChildNodesOfParent(parent.id());
    let maxChildY = parent.position('y');
    children.forEach(n => {
      const nSize = getNodeSize(n);
      const childBottomY = n.position('y') + nSize.height / 2;
      if (childBottomY > maxChildY) maxChildY = childBottomY;
    });
    const parentBottomY = parent.position('y') + parentSize.height / 2;
    groupBottomYs.push(Math.max(maxChildY, parentBottomY));
  });

  // En büyük alt sınırı bul
  const lowestBottomY = Math.max(...groupBottomYs, Number.NEGATIVE_INFINITY);

  // --- Diğer parent grupları ve nodeleri yerleştir ---
  const parentNodeses = cy.nodes().filter(n =>
    n.data('originalType') === "allocationtargetfunml" &&
    (
      n.data('componenttype') === "ECU" ||
      n.data('componenttype') === "Sensor" ||
      n.data('componenttype') === "Actuator" ||
      n.data('componenttype') === "Zusammenbau"
    )
  );
  const localisedParentIds = new Set(parentNodeses.map(n => n.id()));
  const localisedChildIds = new Set();
  parentNodeses.forEach(parent => {
    cy.nodes().forEach(n => {
      if (n.data('parent') === parent.id()) localisedChildIds.add(n.id());
    });
  });
  const excludedIds = new Set([...localisedParentIds, ...localisedChildIds]);
  const unlocalisedNodes = cy.nodes().filter(n => !excludedIds.has(n.id()));

  if (unlocalisedNodes.length > 0) {
    // Artık en alttan başlıyoruz!
    const startY = lowestBottomY + 750;

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
        return sum + size.width + (idx > 0 ? CHILD_PADDING : 0); // DÜZEN: actuator gibi spacing
      }, 0);
      const groupWidth = Math.max(parentSize.width, childrenWidth);
      groupWidths.push(groupWidth);
      totalGroupsWidth += groupWidth;
      if (i > 0) totalGroupsWidth += CHILD_PADDING;
    });

    let startX = -totalGroupsWidth / 2;

    parentGroups.forEach(({ parent, children }, i) => {
      const parentSize = getNodeSize(parent);
      const childrenWidth = children.reduce((sum, n, idx) => {
        const size = getNodeSize(n);
        return sum + size.width + (idx > 0 ? CHILD_PADDING : 0); // DÜZEN: actuator gibi spacing
      }, 0);
      const groupWidth = groupWidths[i];

      // Parent'i ortala
      parent.position({
        x: startX + groupWidth / 2,
        y: startY - parentSize.height / 2 - CHILD_SIDE_PADDING // parent biraz yukarıda, actuator grid mantığıyla
      });

      // Child'ları parent'in altına, yan yana ortala
      let childStartX = startX + groupWidth / 2 - childrenWidth / 2;
      const childY = startY + parentSize.height / 2 + CHILD_SIDE_PADDING;
      children.forEach((n, idx) => {
        const size = getNodeSize(n);
        n.position({
          x: childStartX + size.width / 2,
          y: childY
        });
        childStartX += size.width + CHILD_PADDING;
      });

      startX += groupWidth + CHILD_PADDING;
    });

    // 3. Parent'i olmayan nodeleri EN SAĞA hizala
    let singlesStartX = startX;
    singles.forEach((node, i) => {
      const size = getNodeSize(node);
      node.position({
        x: singlesStartX + size.width / 2 + 200,
        y: startY
      });
      singlesStartX += size.width + 500;
    });
  }

  // --- Diğer parent'lar için child node'ları hizala ---
  parentNodes.forEach(parent => {
    const type = parent.data('componenttype');
    if (type === "Sensor" || type === "Actuator") {
      // Sensor ve Actuator tipi yukarıda özel sırada işlendi!
      return;
    }
    const childNodes = getChildNodesOfParent(parent.id());
    if (childNodes.length === 0) return;

    // Parent'in EN GÜNCEL pozisyonunu al!
    const px = parent.position('x');
    const py = parent.position('y');

    if (type === "ECU" || type === "Zusammenbau") {
      // YATAY hizalama: Parent’in altına, ortalı şekilde child’ları actuator spacing ile sırala
      const totalWidth = childNodes.reduce((sum, n, i) => {
        const size = getNodeSize(n);
        return sum + size.width + (i > 0 ? CHILD_PADDING : 0);
      }, 0);

      let startX = px - totalWidth / 2;
      let y = py + ECU_CHILD_OFFSET_Y; // Parent'in hemen altı (düzen: actuator grid mantığı)

      childNodes.forEach((n, i) => {
        const size = getNodeSize(n);
        n.position({ x: startX + size.width / 2 + ECU_CHILD_OFFSET_X, y: y + size.height / 2 });
        startX += size.width + CHILD_PADDING;
      });
    }
  });
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

