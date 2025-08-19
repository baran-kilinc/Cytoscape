
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

