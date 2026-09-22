/**
 * MathJax 3 离线加载器与公式排版调度中心
 * 支持标准行内 ($...$)/块级 ($$...$$) 语法，并针对 Arxiv/Readwise 论文的 LaTeX 公式与 MathML 混合数据进行智能清洗与定界符自动包裹
 */

let mathjaxLoadPromise = null;

/**
 * 确保 MathJax 3 脚本已加载并完成全局初始化
 */
export function ensureMathJaxLoaded() {
  if (typeof window === 'undefined') return Promise.resolve(null);

  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    return Promise.resolve(window.MathJax);
  }

  if (mathjaxLoadPromise) {
    return mathjaxLoadPromise;
  }

  mathjaxLoadPromise = new Promise((resolve) => {
    // 预先注入纯净的全局配置（自包含单文件，无需任何外部 loader）
    window.MathJax = window.MathJax || {};
    window.MathJax.tex = {
      inlineMath: [['$', '$']],
      displayMath: [['$$', '$$']],
      processEscapes: true,
      processEnvironments: true
    };
    window.MathJax.chtml = {
      fontURL: '/libs/mathjax/output/chtml/fonts/woff-v2'
    };
    window.MathJax.options = {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation', 'annotation-xml']
    };
    window.MathJax.startup = {
      typeset: false // 禁用启动时全量自动扫描，由应用精确控制局部渲染
    };

    // 检查页面是否已有 script 标签
    const existingScript = document.querySelector('script[src*="tex-chtml.js"]');
    if (existingScript) {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
          clearInterval(checkInterval);
          resolve(window.MathJax);
        } else if (attempts > 80) { // 4秒超时兜底
          clearInterval(checkInterval);
          mathjaxLoadPromise = null;
          resolve(window.MathJax && typeof window.MathJax.typesetPromise === 'function' ? window.MathJax : null);
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.src = '/libs/mathjax/tex-chtml.js';
    script.async = true;
    script.id = 'mathjax-script';

    script.onload = () => {
      if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
        window.MathJax.startup.promise.then(() => {
          resolve(window.MathJax);
        }).catch(() => {
          resolve(window.MathJax);
        });
      } else {
        resolve(window.MathJax);
      }
    };

    script.onerror = (err) => {
      console.warn('MathJax 离线脚本装载失败，尝试从 CDN 容灾加载:', err);
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
      fallbackScript.async = true;
      fallbackScript.onload = () => resolve(window.MathJax);
      fallbackScript.onerror = () => {
        mathjaxLoadPromise = null;
        resolve(null);
      };
      document.head.appendChild(fallbackScript);
    };

    document.head.appendChild(script);
  });

  return mathjaxLoadPromise;
}

/**
 * 智能 LaTeX 语法预处理与定界符自动补全
 * 针对抓取、翻译或剥离了 $ 定界符的技术文章/论文，智能剔除 MathML 提取残留的 Unicode 镜像前缀，并包裹为标准定界符
 */
export function preprocessLatexFormulas(html) {
  if (!html || typeof html !== 'string') return html;

  // 1. 保护已存在的 <pre> 和 <code> 块，避免误格式化代码段
  const codeBlocks = [];
  let text = html.replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 公式标准化辅助函数：统一将 \bm 和 \boldsymbol 转换为 MathJax 原生完全支持的 \mathbf
  const normalizeLatex = (latex) => {
    if (!latex) return '';
    return latex.replace(/\\(?:bm|boldsymbol)\b/g, '\\mathbf').trim();
  };

  // 2. 块级公式抽取与保护 (优先处理整个表格单元格与带有换行/环境的独立公式)
  const displayMathBlocks = [];
  function addDisplayMath(latex) {
    const idx = displayMathBlocks.length;
    displayMathBlocks.push(normalizeLatex(latex));
    return `\n\n__DISPLAY_MATH_${idx}__\n\n`;
  }

  // 2.1 优先提取表格或容器中的独立块级公式
  text = text.replace(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi, (match, attrs, content) => {
    // 检查是否包含 display 数学公式特征
    if (/\\displaystyle|\\begin\{(?:cases|align|matrix|pmatrix|bmatrix|equation)\}|=\s*\\frac|\\int_|\\sum_|\\approx/.test(content)) {
      // 1. 若包含 \displaystyle，截取从 \displaystyle 开始的纯正 LaTeX
      const dIdx = content.indexOf('\\displaystyle');
      if (dIdx !== -1) {
        let latex = content.slice(dIdx);
        latex = latex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        return `<td${attrs}>${addDisplayMath(latex)}</td>`;
      }

      // 2. 若包含 \begin{cases} 等多行环境，向前匹配左值变量名
      const bMatch = content.match(/\\begin\{(?:cases|align|matrix|pmatrix|bmatrix|equation)\}/);
      if (bMatch) {
        const beforeB = content.slice(0, bMatch.index);
        const m = beforeB.match(/([A-Za-z0-9_]+(?:\([A-Za-z0-9_\\^\{\}]+\))?\s*=)$/);
        let latex = m ? content.slice(beforeB.length - m[1].length) : content.slice(bMatch.index);
        latex = latex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        return `<td${attrs}>${addDisplayMath(latex)}</td>`;
      }

      // 3. 针对形如 LHS = \frac... 或 LHS \approx \frac...
      const relMatch = content.match(/([A-Za-z0-9_]+(?:\([A-Za-z0-9_\\^\{\}]+\))?)\s*(?:=|\\approx)\s*\\(?:frac|int|sum|prod)/);
      if (relMatch) {
        let latex = content.slice(relMatch.index);
        latex = latex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        return `<td${attrs}>${addDisplayMath(latex)}</td>`;
      }
    }
    return match;
  });

  // 2.2 处理残留的段落级 \begin{cases} 等多行环境
  text = text.replace(
    /(?<!\$)\s*(\\begin\{(?:cases|align|aligned|matrix|pmatrix|bmatrix|equation)\}[\s\S]*?\\end\{(?:cases|align|aligned|matrix|pmatrix|bmatrix|equation)\})\s*(?!\$)/g,
    (m, latex) => addDisplayMath(latex)
  );

  // 3. 行内公式抽取与保护
  const inlineFormulas = [];
  function addInlineFormula(latex) {
    const idx = inlineFormulas.length;
    inlineFormulas.push(normalizeLatex(latex));
    return `__INLINE_MATH_${idx}__`;
  }

  // 3.1 保护已经由原作者书写好的 $...$ 和 $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (m, latex) => addDisplayMath(latex));
  text = text.replace(/\$([^\$\n\r]+?)\$/g, (m, latex) => addInlineFormula(latex));

  // 3.2 针对纯文本节点处理 Arxiv/Readwise 拼接的前缀 + LaTeX 混合串
  text = text.replace(/(>)([^<]+)(<)/g, (match, prefix, textNode, suffix) => {
    let t = textNode.replace(/[\u200B\u2061]/g, '');

    // A. 复杂多项复合映射 (如 MRα:𝒬×ℳstrong×ℳweak→𝒜)
    t = t.replace(/[^\s()，。；]*?(M_\{R\^\{\\alpha\}\}:[^\s()，。；]*?\\rightarrow[^\s()，。；]*)/gu, (m, latex) => addInlineFormula(latex));

    // B. 集合偏好定义 (如 \mathcal{D}_{\text{pref}}=\{(q,l_{s,w})\mid q\in\mathcal{Q},l_{s,w}\in L\})
    t = t.replace(/(?:[^\s]*?[𝒟ℳ𝒜𝒬𝜽α\u2100-\u214F\u{1D400}-\u{1D7FF}][^\s]*?)?(\\mathcal\{D\}_\{(?:[^{}]|\{[^{}]*\})*\}=\\\{.*?\\\})/gu, (m, latex) => addInlineFormula(latex));

    // C. 映射定义 (如 R^{\alpha}:\mathcal{Q}\rightarrow\{\mathcal{M}_{\text{weak}},\mathcal{M}_{\text{strong}}\})
    t = t.replace(/[^\s()，。；]*?(R\^\{\\alpha\}:[^\s()，。；]*?\\rightarrow\\\{\\mathcal\{M\}_\{\\text\{weak\}\},\\mathcal\{M\}_\{\\text\{strong\}\}\\\})/gu, (m, latex) => addInlineFormula(latex));

    // D. 基础映射 (如 M:\mathcal{Q}\rightarrow\mathcal{A})
    t = t.replace(/[^\s()，。；]*?(M:\\mathcal\{Q\}\\rightarrow\\mathcal\{A\})/gu, (m, latex) => addInlineFormula(latex));

    // E. 复合等式函数 (如 a=M(q)\in\mathcal{A})
    t = t.replace(/(?:[A-Za-z0-9_=()]+[∈→][^\s()]*?)?(a=M\(q\)\\in\\mathcal\{A\})/gu, (m, latex) => addInlineFormula(latex));

    // F. 属于关系 (如 M_{s}\in\mathcal{M}_{\text{strong}}, M_{w}\in\mathcal{M}_{\text{weak}}, q\in\mathcal{Q}, \alpha\in[0,1])
    t = t.replace(/[^\s()，。；]*?(M_\{[sw]\}\\in\\mathcal\{M\}_\{\\text\{[a-z]+\}\})/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(q\\in\\mathcal\{Q\})/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(\\alpha\\in\[0,1\])/gu, (m, latex) => addInlineFormula(latex));

    // G. 概率表示: P𝜽(wins|q)P_{\bm{\theta}}(\text{win}_{s}|q)
    t = t.replace(/(?:[^\s，。；]*?[𝜽\u2100-\u214F\u{1D400}-\u{1D7FF}][^\s，。；]*?)?(P_\{(?:[^{}]|\{[^{}]*\})*\}\([^\s，。；]+\))/gu, (m, latex) => addInlineFormula(latex));

    // H. 集合枚举 (如 L=\{\text{win}_{s},\text{tie},\text{win}_{w}\})
    t = t.replace(/[^\s()，。；]*?(L=\\\{[^\s()，。；]+\\\})/gu, (m, latex) => addInlineFormula(latex));

    // I. 变量上下标与复杂变量: R^{\alpha}, l_{s,w}, M_{R^{\alpha}}, M_{R^{\alpha}}(q), s(M_{R^{\alpha}}(q)), r(M_s), r(M_w), PGR(M_{R^{\alpha}})
    t = t.replace(/[^\s()，。；]*?(s\(M_\{R\^\{\\alpha\}\}\(q\)\))/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(r\(M_\{[sw]\}\))/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(PGR\(M_\{R\^\{\\alpha\}\}\))/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(PGR=1)/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(APGR\(M_\{R\^\{\\alpha\}\}\))/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(c\(M_\{R\^\{\\alpha\}\}\))/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(r\(M_\{R\^\{\\alpha\}\}\))/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(M_\{R\^\{\\alpha\}\}(?:\([^\)]+\))?)/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(R\^\{\\alpha\})/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()，。；]*?(l_\{s,w\})/gu, (m, latex) => addInlineFormula(latex));

    // J. 单项命令: \mathcal{M}_{\text{strong}}, \mathcal{M}_{\text{weak}}, \mathcal{M}, \bm{\theta}, \alpha
    t = t.replace(/[^\s()\[\]，。；]*?(\\mathcal\{M\}_\{\\text\{strong\}\})/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()\[\]，。；]*?(\\mathcal\{M\}_\{\\text\{weak\}\})/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()\[\]，。；]*?(\\mathcal\{M\})/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()\[\]，。；]*?(\\bm\{\\theta\})/gu, (m, latex) => addInlineFormula(latex));
    t = t.replace(/[^\s()\[\]，。；]*?(\\alpha\b)/gu, (m, latex) => addInlineFormula(latex));

    // K. 单词 + 单字母变量: query qq -> query $q$
    t = t.replace(/(\b(?:query|model|function|variable|parameter|vector)\s+)([a-z])\2\b/gi, (m, p, char) => {
      return p + addInlineFormula(char);
    });

    return prefix + t + suffix;
  });

  // 4. 还原行内公式与块级公式
  for (let i = 0; i < inlineFormulas.length; i++) {
    text = text.replace(`__INLINE_MATH_${i}__`, () => `$${inlineFormulas[i]}$`);
  }
  for (let i = 0; i < displayMathBlocks.length; i++) {
    text = text.replace(`__DISPLAY_MATH_${i}__`, () => `$$\n${displayMathBlocks[i]}\n$$`);
  }

  // 5. 还原代码块
  for (let i = 0; i < codeBlocks.length; i++) {
    text = text.replace(`__CODE_BLOCK_${i}__`, () => codeBlocks[i]);
  }

  return text;
}

/**
 * 局部触发 MathJax 渲染指定的 DOM 容器
 */
export async function typesetMathJax(containerElement) {
  if (!containerElement || typeof window === 'undefined') return;

  try {
    const mathjax = await ensureMathJaxLoaded();
    if (!mathjax) return;

    // 严格等待 MathJax startup 初始化 Promise 完成
    if (mathjax.startup && mathjax.startup.promise) {
      await mathjax.startup.promise;
    }

    if (!mathjax.typesetPromise) {
      return;
    }

    // 清理先前可能已渲染的缓存以支持重新排版
    if (mathjax.typesetClear) {
      mathjax.typesetClear([containerElement]);
    }

    await mathjax.typesetPromise([containerElement]);
  } catch (err) {
    console.warn('MathJax 渲染执行异常 (已跳过非致命排版错误):', err);
  }
}

