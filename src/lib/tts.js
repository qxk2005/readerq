/**
 * TTS (Text-to-Speech) 管理器 - 使用 Web Speech API
 * 支持分段朗读文章、暂停/继续、进度追踪、上一段/下一段跳转
 * 用于 Electron (macOS/Windows) 桌面端
 */

const MAX_CHUNK_SIZE = 3500;

/**
 * 从 HTML 内容中提取纯文本
 */
function extractTextFromHtml(html) {
  // 使用 DOM 解析来提取文本（比正则更可靠）
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // 移除 script 和 style 标签
  doc.querySelectorAll('script, style').forEach(el => el.remove());
  
  // 获取纯文本，保留段落间的换行
  const blocks = [];
  const blockTags = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TR', 'FIGURE', 'FIGCAPTION', 'SECTION', 'ARTICLE']);
  
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\s+/g, ' ');
      if (text.trim()) blocks.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    
    const tag = node.tagName;
    if (tag === 'BR') {
      blocks.push('\n');
      return;
    }
    if (tag === 'IMG') return; // 跳过图片
    
    const isBlock = blockTags.has(tag);
    if (isBlock && blocks.length > 0) blocks.push('\n');
    
    for (const child of node.childNodes) {
      walk(child);
    }
    
    if (isBlock) blocks.push('\n');
  }
  
  walk(doc.body);
  
  let text = blocks.join('');
  // 清理多余空白
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * 将文本按段落分割成适合 TTS 的小段
 */
function splitIntoChunks(text) {
  const paragraphs = text.split(/\n{2,}/);
  const result = [];
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    
    if (trimmed.length <= MAX_CHUNK_SIZE) {
      result.push(trimmed);
    } else {
      // 按句子拆分过长段落
      const sentences = trimmed.split(/(?<=[。！？.!?；;]\s*)/);
      let current = '';
      for (const sentence of sentences) {
        if (current.length + sentence.length > MAX_CHUNK_SIZE && current) {
          result.push(current.trim());
          current = '';
        }
        current += sentence;
      }
      if (current.trim()) {
        result.push(current.trim());
      }
    }
  }
  return result.filter(s => s.trim());
}

/**
 * 自动检测文本语言
 */
function detectLanguage(text) {
  const sample = text.slice(0, 500);
  let chineseCount = 0;
  for (const char of sample) {
    const code = char.codePointAt(0);
    if (code >= 0x4E00 && code <= 0x9FFF) chineseCount++;
  }
  return chineseCount > sample.length * 0.1 ? 'zh-CN' : 'en-US';
}

/**
 * 创建 TTS 管理器实例
 */
export function createTtsManager() {
  let chunks = [];
  let currentChunkIndex = 0;
  let isPaused = false;
  let utterance = null;
  let listeners = [];
  let state = {
    isActive: false,
    isPlaying: false,
    progress: 0,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
    currentChunkText: null,
  };

  function getState() {
    return { ...state };
  }

  function setState(updates) {
    state = { ...state, ...updates };
    listeners.forEach(fn => fn(state));
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter(l => l !== fn);
    };
  }

  function speakChunk(index) {
    if (index < 0 || index >= chunks.length) return;
    
    const synth = window.speechSynthesis;
    const chunkText = chunks[index];
    
    utterance = new SpeechSynthesisUtterance(chunkText);
    
    // 自动检测语言
    const lang = detectLanguage(chunkText);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // 尝试找一个合适的中文语音
    if (lang === 'zh-CN') {
      const voices = synth.getVoices();
      const zhVoice = voices.find(v => v.lang === 'zh-CN') 
        || voices.find(v => v.lang.startsWith('zh'))
        || null;
      if (zhVoice) utterance.voice = zhVoice;
    }
    
    utterance.onstart = () => {
      setState({ isPlaying: true, error: null });
    };
    
    utterance.onend = () => {
      if (isPaused) return;
      
      const nextIndex = currentChunkIndex + 1;
      if (nextIndex < chunks.length) {
        currentChunkIndex = nextIndex;
        const progress = nextIndex / chunks.length;
        setState({
          currentChunk: nextIndex,
          progress,
          currentChunkText: chunks[nextIndex],
        });
        speakChunk(nextIndex);
      } else {
        // 播放完毕
        setState({
          isActive: false,
          isPlaying: false,
          progress: 1,
          currentChunk: chunks.length,
          totalChunks: chunks.length,
          currentChunkText: null,
        });
        currentChunkIndex = 0;
      }
    };
    
    utterance.onerror = (event) => {
      // 'interrupted' 和 'canceled' 不算真正的错误（暂停/跳转时会触发）
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      console.error('TTS error:', event.error);
      setState({
        error: `语音朗读出错: ${event.error}`,
        isPlaying: false,
      });
    };
    
    // 进度回调（使用 boundary 事件来跟踪粒度更细的进度）
    utterance.onboundary = (event) => {
      if (chunks.length > 0 && currentChunkIndex < chunks.length) {
        const chunkLength = chunks[currentChunkIndex].length;
        const inChunkProgress = chunkLength > 0 ? (event.charIndex + event.charLength) / chunkLength : 0;
        const overallProgress = (currentChunkIndex + inChunkProgress) / chunks.length;
        setState({ progress: Math.min(Math.max(overallProgress, 0), 1) });
      }
    };
    
    synth.speak(utterance);
  }

  function speak(htmlContent) {
    const synth = window.speechSynthesis;
    if (!synth) {
      setState({ error: '您的浏览器不支持语音朗读功能', isActive: true });
      return;
    }
    
    // 停止当前播放
    isPaused = false;
    synth.cancel();
    
    // 提取文本并分段
    const plainText = extractTextFromHtml(htmlContent);
    if (!plainText) {
      setState({ error: '无法提取文章内容', isActive: true });
      return;
    }
    
    chunks = splitIntoChunks(plainText);
    if (chunks.length === 0) {
      setState({ error: '文章内容为空', isActive: true });
      return;
    }
    
    currentChunkIndex = 0;
    setState({
      isActive: true,
      isPlaying: true,
      progress: 0,
      currentChunk: 0,
      totalChunks: chunks.length,
      currentChunkText: chunks[0],
      error: null,
    });
    
    speakChunk(0);
  }

  function pause() {
    const synth = window.speechSynthesis;
    if (state.isPlaying && synth) {
      isPaused = true;
      synth.pause();
      setState({ isPlaying: false });
    }
  }

  function resume() {
    const synth = window.speechSynthesis;
    if (state.isActive && !state.isPlaying && synth) {
      isPaused = false;
      // Web Speech API 的 resume() 有时不可靠，如果暂停超过一段时间
      // 先尝试 resume，如果不行就重新朗读当前段落
      if (synth.paused) {
        synth.resume();
        setState({ isPlaying: true, error: null });
      } else {
        // synth 没有在暂停状态（可能已经被系统清掉），重新朗读当前段落
        setState({ isPlaying: true, error: null });
        speakChunk(currentChunkIndex);
      }
    }
  }

  function togglePlayPause() {
    if (state.isPlaying) {
      pause();
    } else {
      resume();
    }
  }

  function nextChunk() {
    if (chunks.length === 0) return;
    const nextIndex = currentChunkIndex + 1;
    if (nextIndex >= chunks.length) return;
    
    const synth = window.speechSynthesis;
    isPaused = true; // 防止 onend 触发自动播放
    synth.cancel();
    isPaused = false;
    
    currentChunkIndex = nextIndex;
    const progress = nextIndex / chunks.length;
    setState({
      currentChunk: nextIndex,
      progress,
      isPlaying: true,
      error: null,
      currentChunkText: chunks[nextIndex],
    });
    speakChunk(nextIndex);
  }

  function previousChunk() {
    if (chunks.length === 0) return;
    const prevIndex = currentChunkIndex - 1;
    if (prevIndex < 0) return;
    
    const synth = window.speechSynthesis;
    isPaused = true; // 防止 onend 触发自动播放
    synth.cancel();
    isPaused = false;
    
    currentChunkIndex = prevIndex;
    const progress = prevIndex / chunks.length;
    setState({
      currentChunk: prevIndex,
      progress,
      isPlaying: true,
      error: null,
      currentChunkText: chunks[prevIndex],
    });
    speakChunk(prevIndex);
  }

  function stop() {
    const synth = window.speechSynthesis;
    isPaused = true;
    if (synth) synth.cancel();
    isPaused = false;
    currentChunkIndex = 0;
    chunks = [];
    setState({
      isActive: false,
      isPlaying: false,
      progress: 0,
      currentChunk: 0,
      totalChunks: 0,
      error: null,
      currentChunkText: null,
    });
  }

  function shutdown() {
    stop();
    listeners = [];
  }

  return {
    getState,
    subscribe,
    speak,
    pause,
    resume,
    togglePlayPause,
    nextChunk,
    previousChunk,
    stop,
    shutdown,
  };
}
