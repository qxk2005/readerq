export function getTextOffset(root, node, offset) {
  let currentOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode === node) {
      return currentOffset + offset;
    }
    currentOffset += currentNode.textContent.length;
    currentNode = walker.nextNode();
  }
  return -1;
}

export function getNodeAndOffsetAt(root, targetOffset) {
  let currentOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let currentNode = walker.nextNode();

  while (currentNode) {
    const nodeLength = currentNode.textContent.length;
    if (currentOffset + nodeLength >= targetOffset || (currentOffset + nodeLength === targetOffset && !walker.nextNode())) {
      return { node: currentNode, offset: targetOffset - currentOffset };
    }
    currentOffset += nodeLength;
    currentNode = walker.nextNode();
  }
  return null;
}

export function findFuzzyOffset(fullText, query) {
  if (!query) return null;

  // 提前移除 Markdown 图片和链接语法（只保留链接文字）
  // 因为 Readwise 高亮中包含了嵌套的长 URL，而网页 DOM 的 textContent 不会包含这些 URL
  let cleanQuery = query.replace(/!\[[\s\S]*?\]\([\s\S]*?\)/g, '');
  cleanQuery = cleanQuery.replace(/\[([^\]]*?)\]\([\s\S]*?\)/g, '$1');
  
  // 移除 [图片: xxx] 格式的占位符文本（ReaderQ 创建高亮时为 <img> 生成的占位符）
  // 这些占位符在文章 DOM 的 textContent 中不存在（图片是 <img> 标签，不产生文本）
  cleanQuery = cleanQuery.replace(/\[图片:\s*[^\]]*?\]/g, '');
  
  // 移除列表开头的数字序号，例如 "1. " 或 "12. "
  // 这可以解决 Readwise 会带上序号而正文 HTML 只包含纯文本（序号由浏览器渲染）的情况
  cleanQuery = cleanQuery.replace(/^\s*\d+\.\s+/gm, '');
  
  // 清理后可能残留多余的换行和空白，进行规范化
  cleanQuery = cleanQuery.replace(/\n{2,}/g, '\n').trim();

  const exact = fullText.indexOf(cleanQuery);
  if (exact !== -1) return { start: exact, end: exact + cleanQuery.length };

  // 尝试忽略换行和多余空格的匹配
  const queryTokens = cleanQuery.trim().split(/\s+/);
  if (queryTokens.length === 0) return null;
  
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = queryTokens.map(escapeRegExp).join('\\s*');
  
  try {
    const regex = new RegExp(pattern, 'i'); // 忽略大小写
    const match = fullText.match(regex);
    if (match && match.index != null) {
      return { start: match.index, end: match.index + match[0].length };
    }
  } catch (e) {
    // 忽略过长正则等引发的异常
  }

  // Fallback 2: 尝试去除高亮文本中可能包含的 Markdown 格式符号 (如 **, _, # 等)
  const strippedQuery = cleanQuery.replace(/(\*\*|\*|__|_|#|`|>)/g, '');
  if (strippedQuery !== cleanQuery && strippedQuery.trim().length > 0) {
    const strippedTokens = strippedQuery.trim().split(/\s+/);
    const pattern2 = strippedTokens.map(escapeRegExp).join('\\s*');
    try {
      const regex2 = new RegExp(pattern2, 'i');
      const match2 = fullText.match(regex2);
      if (match2 && match2.index != null) {
        return { start: match2.index, end: match2.index + match2[0].length };
      }
    } catch (e) {}
  }

  // Fallback 3: 最强回退机制 (Robust Sequence Matching)
  // 剥离所有的标点符号、空格、换行，仅保留文字和数字进行严格的比对
  // 这样无论 Readwise 在提取时如何合并段落、改变标点，只要核心文字顺序一致就能找到匹配
  const isWordChar = (char) => !/[\s\p{P}\p{S}]/u.test(char);
  
  const strippedFull = [];
  const mapFull = [];
  for (let i = 0; i < fullText.length; i++) {
    if (isWordChar(fullText[i])) {
      strippedFull.push(fullText[i]);
      mapFull.push(i);
    }
  }
  
  const strippedQueryStr = Array.from(strippedQuery).filter(isWordChar).join('');
  const strippedFullStr = strippedFull.join('');
  
  if (strippedQueryStr.length > 0) {
    const matchIndex = strippedFullStr.indexOf(strippedQueryStr);
    if (matchIndex !== -1) {
      // 找到了，将其映射回原始 fullText 的起止位置
      const originalStart = mapFull[matchIndex];
      const originalEnd = mapFull[matchIndex + strippedQueryStr.length - 1] + 1;
      return { start: originalStart, end: originalEnd };
    }
  }

  return null;
}

export function restoreHighlights(root, highlights, onHighlightClick) {
  if (!root) return;
  const fullText = root.textContent;
  
  // 预处理高亮：如果缺少 location_start，通过文本匹配推算
  const processedHighlights = highlights.map(hl => {
    if (hl.location_start == null || hl.location_end == null) {
      if (hl.text) {
        const offset = findFuzzyOffset(fullText, hl.text);
        if (offset) {
          return { ...hl, location_start: offset.start, location_end: offset.end };
        }
      }
    }
    return hl;
  });

  // 过滤掉仍然无法确定位置的高亮（如图片高亮），防止在文章开头生成空的 mark 标签
  const validHighlights = processedHighlights.filter(hl => hl.location_start != null && hl.location_end != null);

  // Sort highlights in reverse to avoid messing up offsets when modifying DOM
  const sorted = [...validHighlights].sort((a, b) => b.location_start - a.location_start);
  
  for (const hl of sorted) {
    const startObj = getNodeAndOffsetAt(root, hl.location_start);
    const endObj = getNodeAndOffsetAt(root, hl.location_end);
    
    if (startObj && endObj) {
        // 健壮的跨节点高亮渲染方案：替代朴素的 extractContents (跨块级元素时会报错)
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        walker.currentNode = startObj.node;
        
        const nodes = [startObj.node];
        if (startObj.node !== endObj.node) {
          let n;
          while ((n = walker.nextNode())) {
            nodes.push(n);
            if (n === endObj.node) break;
          }
        }
        
        nodes.forEach((n, idx) => {
          const isFirst = (idx === 0);
          const isLast = (idx === nodes.length - 1);
          let start = isFirst ? startObj.offset : 0;
          let end = isLast ? endObj.offset : n.textContent.length;
          
          const textSegment = n.textContent.substring(start, end);
          
          // 仅当文本片段不是纯空白字符时才包裹 <mark>，
          // 避免块级元素（如 <p>）之间的换行符被包裹，从而在页面上撑开额外的空白行
          if (start < end && textSegment.trim().length > 0) {
            const mark = document.createElement('mark');
            mark.className = `highlight-color ${hl.color || 'yellow'}`;
            mark.dataset.highlightId = hl.id;
            
            // splitText 会修改原始的 DOM 结构，分离出我们要高亮的文本部分
            const middle = n.splitText(start);
            middle.splitText(end - start);
            
            mark.appendChild(middle.cloneNode(true));
            middle.parentNode.replaceChild(mark, middle);
            
            if (onHighlightClick) {
              mark.onclick = (e) => {
                e.stopPropagation();
                onHighlightClick(hl, e);
              };
              // Make mark appear clickable
              mark.style.cursor = 'pointer';
            }
          }
        });
      }
    }
}
