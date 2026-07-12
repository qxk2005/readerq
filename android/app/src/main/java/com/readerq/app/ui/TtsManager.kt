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
 * 支持分段朗读文章、暂停/继续、进度追踪、上一段/下一段跳转
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
    // 防止 stop() 触发的 onDone 回调造成竞态
    private var isStopping = false

    private val _ttsState = MutableStateFlow(TtsState())
    val ttsState: StateFlow<TtsState> = _ttsState.asStateFlow()

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                isInitialized = true
                // 设置默认语言为简体中文（使用 Locale.CHINA = zh_CN）
                // 注意: Locale.CHINESE = "zh" 在许多 TTS 引擎上不被正确支持
                val result = tts?.setLanguage(Locale.CHINA)
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // 尝试繁体中文
                    val result2 = tts?.setLanguage(Locale.TAIWAN)
                    if (result2 == TextToSpeech.LANG_MISSING_DATA || result2 == TextToSpeech.LANG_NOT_SUPPORTED) {
                        // 回退到英文
                        tts?.setLanguage(Locale.US)
                        Log.w(TAG, "Chinese TTS not available, falling back to English")
                    }
                }
                // 设置语速为正常速度
                tts?.setSpeechRate(1.0f)
                // 设置音调
                tts?.setPitch(1.0f)
                setupListener()
                Log.d(TAG, "TTS initialized successfully, engine: ${tts?.defaultEngine}")
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
                // 确保状态反映为正在播放
                if (!isStopping) {
                    _ttsState.value = _ttsState.value.copy(isPlaying = true, error = null)
                }
            }

            override fun onDone(utteranceId: String?) {
                Log.d(TAG, "Finished utterance: $utteranceId, isPaused=$isPausedState, isStopping=$isStopping")
                // 如果是 stop()/暂停触发的 onDone，不要自动播放下一段
                if (isPausedState || isStopping) return

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
                _ttsState.value = _ttsState.value.copy(
                    error = "播放出错，请检查系统 TTS 引擎设置",
                    isPlaying = false
                )
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                Log.e(TAG, "Error on utterance: $utteranceId, code: $errorCode")
                val errorMsg = when (errorCode) {
                    TextToSpeech.ERROR_SYNTHESIS -> "语音合成失败，TTS 引擎可能不支持当前语言"
                    TextToSpeech.ERROR_SERVICE -> "TTS 服务错误"
                    TextToSpeech.ERROR_OUTPUT -> "音频输出错误"
                    TextToSpeech.ERROR_NETWORK -> "网络错误（在线 TTS 引擎）"
                    TextToSpeech.ERROR_NETWORK_TIMEOUT -> "网络超时（在线 TTS 引擎）"
                    TextToSpeech.ERROR_NOT_INSTALLED_YET -> "TTS 引擎未安装"
                    else -> "播放出错 (code: $errorCode)"
                }
                _ttsState.value = _ttsState.value.copy(error = errorMsg, isPlaying = false)
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
                error = "TTS 引擎尚未初始化，请稍后再试",
                isActive = true
            )
            Log.e(TAG, "speak() called but TTS not initialized yet")
            return
        }

        // 停止当前播放
        isStopping = true
        tts?.stop()
        isStopping = false
        isPausedState = false

        // 提取文本并分段
        val plainText = extractTextFromHtml(htmlContent)
        if (plainText.isBlank()) {
            _ttsState.value = _ttsState.value.copy(error = "无法提取文章内容", isActive = true)
            return
        }

        Log.d(TAG, "Extracted text length: ${plainText.length}, first 100 chars: ${plainText.take(100)}")

        chunks = splitIntoChunks(plainText)
        if (chunks.isEmpty()) {
            _ttsState.value = _ttsState.value.copy(error = "文章内容为空", isActive = true)
            return
        }

        Log.d(TAG, "Split into ${chunks.size} chunks, first chunk length: ${chunks[0].length}")

        currentChunkIndex = 0
        _ttsState.value = TtsState(
            isActive = true,
            isPlaying = true,
            progress = 0f,
            currentChunk = 0,
            totalChunks = chunks.size
        )

        // 自动检测语言并设置
        detectAndSetLanguage(plainText)

        // 开始朗读第一段
        speakChunk(0)
    }

    /**
     * 根据文本内容自动检测并设置语言
     */
    private fun detectAndSetLanguage(text: String) {
        val sample = text.take(500)
        val chineseCount = sample.count { it.code in 0x4E00..0x9FFF }
        val locale = if (chineseCount > sample.length * 0.1) Locale.CHINA else Locale.US
        val result = tts?.setLanguage(locale)
        Log.d(TAG, "Language set to ${locale.toLanguageTag()}, result=$result")

        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            Log.w(TAG, "Language ${locale.toLanguageTag()} not supported, trying alternatives...")
            if (locale == Locale.CHINA) {
                // 尝试繁体中文
                val result2 = tts?.setLanguage(Locale.TAIWAN)
                if (result2 == TextToSpeech.LANG_MISSING_DATA || result2 == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // 尝试通用中文
                    val result3 = tts?.setLanguage(Locale("zh"))
                    if (result3 == TextToSpeech.LANG_MISSING_DATA || result3 == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts?.setLanguage(Locale.US)
                        Log.w(TAG, "No Chinese TTS available, falling back to English")
                    }
                }
            }
        }
    }

    private fun speakChunk(index: Int) {
        if (index < 0 || index >= chunks.size) return

        val chunkText = chunks[index]
        Log.d(TAG, "Speaking chunk $index/${chunks.size}, length=${chunkText.length}, text=${chunkText.take(50)}")

        val params = Bundle().apply {
            // 使用音乐流播放，确保音量正常
            putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, android.media.AudioManager.STREAM_MUSIC)
        }

        val result = tts?.speak(
            chunkText,
            TextToSpeech.QUEUE_FLUSH,
            params,
            "${UTTERANCE_PREFIX}$index"
        )

        Log.d(TAG, "tts.speak() returned: $result (SUCCESS=${TextToSpeech.SUCCESS}, ERROR=${TextToSpeech.ERROR})")

        if (result == TextToSpeech.ERROR) {
            _ttsState.value = _ttsState.value.copy(
                error = "TTS 播放失败，请检查系统是否安装了 TTS 引擎（如 Google TTS）",
                isPlaying = false
            )
        }
    }

    /**
     * 暂停播放
     */
    fun pause() {
        if (_ttsState.value.isPlaying) {
            isPausedState = true
            isStopping = true
            tts?.stop()
            isStopping = false
            _ttsState.value = _ttsState.value.copy(isPlaying = false)
        }
    }

    /**
     * 继续播放
     */
    fun resume() {
        if (_ttsState.value.isActive && !_ttsState.value.isPlaying) {
            isPausedState = false
            isStopping = false
            _ttsState.value = _ttsState.value.copy(isPlaying = true, error = null)
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
     * 跳转到下一段
     */
    fun nextChunk() {
        if (chunks.isEmpty()) return
        val nextIndex = currentChunkIndex + 1
        if (nextIndex >= chunks.size) return

        // 停止当前播放
        isStopping = true
        tts?.stop()
        isStopping = false
        isPausedState = false

        currentChunkIndex = nextIndex
        val progress = nextIndex.toFloat() / chunks.size
        _ttsState.value = _ttsState.value.copy(
            currentChunk = nextIndex,
            progress = progress,
            isPlaying = true,
            error = null
        )
        speakChunk(nextIndex)
    }

    /**
     * 跳转到上一段
     */
    fun previousChunk() {
        if (chunks.isEmpty()) return
        val prevIndex = currentChunkIndex - 1
        if (prevIndex < 0) return

        // 停止当前播放
        isStopping = true
        tts?.stop()
        isStopping = false
        isPausedState = false

        currentChunkIndex = prevIndex
        val progress = prevIndex.toFloat() / chunks.size
        _ttsState.value = _ttsState.value.copy(
            currentChunk = prevIndex,
            progress = progress,
            isPlaying = true,
            error = null
        )
        speakChunk(prevIndex)
    }

    /**
     * 停止并关闭播放器
     */
    fun stop() {
        isStopping = true
        tts?.stop()
        isStopping = false
        isPausedState = false
        currentChunkIndex = 0
        chunks = emptyList()
        _ttsState.value = TtsState()
    }

    /**
     * 释放资源
     */
    fun shutdown() {
        isStopping = true
        tts?.stop()
        tts?.shutdown()
        tts = null
        isInitialized = false
        isStopping = false
    }
}
