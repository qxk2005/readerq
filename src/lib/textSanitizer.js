/**
 * 高精强博客文章 Markdown 文本清洗器
 * 彻底过滤大模型泄露的 Special Token、伪指令与乱码杂质
 * （纯逻辑模块，可同时安全运行于客户端与服务端）
 * 
 * @param {string} text 
 * @returns {string} 清洗后的干净 Markdown 字符串
 */
export function cleanBlogMarkdownText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // 1. 消除 Special Tokens（兼容包含空格/下划线的情况，如 < | begin__of__sentence | >）
    .replace(/<\|\s*(?:begin_of_sentence|end_of_sentence|begin_of_text|end_of_text|im_start|im_end|endoftext|fim_prefix|fim_suffix|fim_middle)\s*\|>/gi, '')
    .replace(/<\s*\|\s*[a-z0-9_ -]+\s*\|\s*>/gi, '')
    .replace(/<\|\s*[a-z0-9_ -]+\s*\|>/gi, '')

    // 2. 消除误插入的代码预处理指令与伪属性前缀（如 #include, ##itario: 等）
    .replace(/<\|\s*#include/gi, '')
    .replace(/(^|\n)#[a-z0-9_-]+\s+([一-龥a-zA-Z0-9])/gi, '$1$2')
    .replace(/^(#+)\s*[a-zA-Z0-9_-]+:\s*/gm, '$1 ')

    // 3. 消除非中英文本段落中误带入的无意义乱码字符 (如阿文/乱码字符块)
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]{3,}/g, '')

    // 4. 清理多余连续空行与首尾空白
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
