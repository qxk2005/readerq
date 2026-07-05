package com.readerq.app.ui

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

/**
 * TTS 播放状态
 */
data class TtsState(
    val isActive: Boolean = false,      // TTS 播放器是否激活（显示控制条）
    val isPlaying: Boolean = false,     // 是否正在播放
    val progress: Float = 0f,           // 播放进度 0f~1f
    val currentChunk: Int = 0,          // 当前播放的段落索引
    val totalChunks: Int = 0,           // 总段落数
    val error: String? = null           // 错误信息
)

/**
 * TTS 管理器 - 封装 Android 系统 TextToSpeech API
 * 支持分段朗读文章、暂停/继续、进度追踪
 */
class TtsManager(context: Context) {

    companion object {
        private const val TAG = "TtsManager"
        private const val UTTERANCE_PREFIX = "tts_chunk_"
        // 每段最大字符数（TextToSpeech.getMaxSpeechInputLength()）
        private const val MAX_CHUNK_SIZE = 3500
    }

    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private var chunks: List<String> = emptyList()
    private var currentChunkIndex = 0
    private var isPausedState = false

    private val _ttsState = MutableStateFlow(TtsState())
    val ttsState: StateFlow<TtsState> = _ttsState.asStateFlow()

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                isInitialized = true
                // 设置默认语言为中文，如果不支持则退回英文
                val result = tts?.setLanguage(Locale.CHINESE)
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts?.setLanguage(Locale.US)
                }
                setupListener()
                Log.d(TAG, "TTS initialized successfully")
            } else {
                Log.e(TAG, "TTS initialization failed with status: $status")
                _ttsState.value = _ttsState.value.copy(error = "TTS 引擎初始化失败，请检查系统 TTS 设置")
            }
        }
    }

    private fun setupListener() {
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                Log.d(TAG, "Started utterance: $utteranceId")
            }

            override fun onDone(utteranceId: String?) {
                Log.d(TAG, "Finished utterance: $utteranceId, isPaused=$isPausedState")
                if (isPausedState) return

                val nextIndex = currentChunkIndex + 1
                if (nextIndex < chunks.size) {
                    currentChunkIndex = nextIndex
                    val progress = nextIndex.toFloat() / chunks.size
                    _ttsState.value = _ttsState.value.copy(
                        currentChunk = nextIndex,
                        progress = progress
                    )
                    speakChunk(nextIndex)
                } else {
                    // 播放完毕
                    _ttsState.value = TtsState(
                        isActive = false,
                        isPlaying = false,
                        progress = 1f,
                        currentChunk = chunks.size,
                        totalChunks = chunks.size
                    )
                    currentChunkIndex = 0
                }
            }

            @Deprecated("Deprecated")
            override fun onError(utteranceId: String?) {
                Log.e(TAG, "Error on utterance: $utteranceId")
                _ttsState.value = _ttsState.value.copy(error = "播放出错")
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                Log.e(TAG, "Error on utterance: $utteranceId, code: $errorCode")
                _ttsState.value = _ttsState.value.copy(error = "播放出错 (code: $errorCode)")
            }

            override fun onRangeStart(utteranceId: String?, start: Int, end: Int, frame: Int) {
                // 粒度更细的进度追踪（如果 TTS 引擎支持）
                if (chunks.isNotEmpty() && currentChunkIndex < chunks.size) {
                    val chunkLength = chunks[currentChunkIndex].length
                    val inChunkProgress = if (chunkLength > 0) end.toFloat() / chunkLength else 0f
                    val overallProgress = (currentChunkIndex + inChunkProgress) / chunks.size
                    _ttsState.value = _ttsState.value.copy(progress = overallProgress.coerceIn(0f, 1f))
                }
            }
        })
    }

    /**
     * 从 HTML 内容中提取纯文本
     */
    private fun extractTextFromHtml(html: String): String {
        // 去除 script 和 style 标签及内容
        var text = html.replace(Regex("<(script|style)[^>]*>[\\s\\S]*?</\\1>", RegexOption.IGNORE_CASE), "")
        // 将 <br> / <p> / <div> / <li> 等块级标签换成换行
        text = text.replace(Regex("<(br|p|div|li|h[1-6]|blockquote|tr)[^>]*>", RegexOption.IGNORE_CASE), "\n")
        // 去除所有 HTML 标签
        text = text.replace(Regex("<[^>]+>"), "")
        // 解码常见 HTML 实体
        text = text.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&nbsp;", " ")
        // 清理多余空白
        text = text.replace(Regex("[ \\t]+"), " ")
        text = text.replace(Regex("\\n{3,}"), "\n\n")
        return text.trim()
    }

    /**
     * 将文本按段落分割成适合 TTS 的小段
     */
    private fun splitIntoChunks(text: String): List<String> {
        val paragraphs = text.split(Regex("\\n{2,}"))
        val result = mutableListOf<String>()

        for (para in paragraphs) {
            val trimmed = para.trim()
            if (trimmed.isEmpty()) continue

            if (trimmed.length <= MAX_CHUNK_SIZE) {
                result.add(trimmed)
            } else {
                // 按句子拆分过长段落
                val sentences = trimmed.split(Regex("(?<=[。！？.!?；;]\\s*)"))
                var current = StringBuilder()
                for (sentence in sentences) {
                    if (current.length + sentence.length > MAX_CHUNK_SIZE && current.isNotEmpty()) {
                        result.add(current.toString().trim())
                        current = StringBuilder()
                    }
                    current.append(sentence)
                }
                if (current.isNotEmpty()) {
                    result.add(current.toString().trim())
                }
            }
        }
        return result.filter { it.isNotBlank() }
    }

    /**
     * 开始朗读
     * @param htmlContent 文章的 HTML 内容
     */
    fun speak(htmlContent: String) {
        if (!isInitialized) {
            _ttsState.value = _ttsState.value.copy(
                error = "TTS 引擎尚未初始化，请稍后再试"
            )
            return
        }

        // 停止当前播放
        tts?.stop()
        isPausedState = false

        // 提取文本并分段
        val plainText = extractTextFromHtml(htmlContent)
        if (plainText.isBlank()) {
            _ttsState.value = _ttsState.value.copy(error = "无法提取文章内容")
            return
        }

        chunks = splitIntoChunks(plainText)
        if (chunks.isEmpty()) {
            _ttsState.value = _ttsState.value.copy(error = "文章内容为空")
            return
        }

        currentChunkIndex = 0
        _ttsState.value = TtsState(
            isActive = true,
            isPlaying = true,
            progress = 0f,
            currentChunk = 0,
            totalChunks = chunks.size
        )

        // 自动检测语言
        detectAndSetLanguage(plainText)

        speakChunk(0)
    }

    /**
     * 根据文本内容自动检测并设置语言
     */
    private fun detectAndSetLanguage(text: String) {
        val sample = text.take(200)
        val chineseCount = sample.count { it.code in 0x4E00..0x9FFF }
        val locale = if (chineseCount > sample.length * 0.1) Locale.CHINESE else Locale.US
        tts?.setLanguage(locale)
    }

    private fun speakChunk(index: Int) {
        if (index < 0 || index >= chunks.size) return

        val params = Bundle()
        tts?.speak(
            chunks[index],
            TextToSpeech.QUEUE_FLUSH,
            params,
            "${UTTERANCE_PREFIX}$index"
        )
    }

    /**
     * 暂停播放
     */
    fun pause() {
        if (_ttsState.value.isPlaying) {
            isPausedState = true
            tts?.stop()
            _ttsState.value = _ttsState.value.copy(isPlaying = false)
        }
    }

    /**
     * 继续播放
     */
    fun resume() {
        if (_ttsState.value.isActive && !_ttsState.value.isPlaying) {
            isPausedState = false
            _ttsState.value = _ttsState.value.copy(isPlaying = true)
            speakChunk(currentChunkIndex)
        }
    }

    /**
     * 播放/暂停切换
     */
    fun togglePlayPause() {
        if (_ttsState.value.isPlaying) {
            pause()
        } else {
            resume()
        }
    }

    /**
     * 停止并关闭播放器
     */
    fun stop() {
        tts?.stop()
        isPausedState = false
        currentChunkIndex = 0
        chunks = emptyList()
        _ttsState.value = TtsState()
    }

    /**
     * 释放资源
     */
    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isInitialized = false
    }
}
