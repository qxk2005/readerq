package com.readerq.app.api

import io.ktor.client.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.json.*
import java.net.URLDecoder

data class NativeSubtitleSegment(
    val time: Double,
    val timeStr: String,
    val duration: Double,
    val text: String,
    val zh: String? = null
)

object AndroidSubtitleFetcher {

    private val jsonParser = Json { ignoreUnknownKeys = true }

    private val client = HttpClient(Android) {
        install(HttpTimeout) {
            requestTimeoutMillis = 30_000
            connectTimeoutMillis = 10_000
            socketTimeoutMillis = 30_000
        }
    }

    /**
     * 从各种 YouTube URL 中提取 Video ID
     */
    fun extractVideoId(url: String): String? {
        if (url.isBlank()) return null
        val regexes = listOf(
            Regex("(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/" +
                    "|.*[?&]v=)|youtu\\.be\\/)([^\"&?\\/\\s]{11})"),
            Regex("^([^\"&?\\/\\s]{11})$")
        )
        for (regex in regexes) {
            val match = regex.find(url.trim())
            if (match != null) return match.groupValues[1]
        }
        return null
    }

    /**
     * 原生 XML 解包与实体还原
     */
    private fun unescapeXml(text: String): String {
        return text
            .replace("&#39;", "'")
            .replace("&#039;", "'")
            .replace("&quot;", "\"")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace(Regex("<[^>]+>"), "")
            .trim()
    }

    /**
     * 时间戳转 mm:ss 或 hh:mm:ss 格式
     */
    fun formatTimestamp(seconds: Double): String {
        val sec = seconds.toInt()
        val hours = sec / 3600
        val mins = (sec % 3600) / 60
        val secs = sec % 60
        return if (hours > 0) {
            String.format("%d:%02d:%02d", hours, mins, secs)
        } else {
            String.format("%d:%02d", mins, secs)
        }
    }

    /**
     * 按完整句子语义与优雅时间窗合并字幕段落 (Sentence-level Subtitle Merging)
     */
    fun mergeSubtitlesBySentence(
        rawSegments: List<NativeSubtitleSegment>,
        targetMaxDuration: Double = 8.0,
        targetMinDuration: Double = 3.5
    ): List<NativeSubtitleSegment> {
        if (rawSegments.isEmpty()) return emptyList()

        val merged = mutableListOf<NativeSubtitleSegment>()
        var currentGroup = mutableListOf<NativeSubtitleSegment>()
        var groupStartTime: Double? = null

        for (seg in rawSegments) {
            if (currentGroup.isEmpty()) {
                currentGroup.add(seg)
                groupStartTime = seg.time
            } else {
                val start = groupStartTime ?: seg.time
                val durationSpan = (seg.time + seg.duration) - start
                val lastText = currentGroup.last().text.trim()
                val sentenceEnded = Regex("[.!?]$").containsMatchIn(lastText)
                val groupChars = currentGroup.joinToString(" ") { it.text }.length

                if ((sentenceEnded && (durationSpan >= targetMinDuration || groupChars >= 50)) ||
                    durationSpan >= targetMaxDuration || groupChars >= 140
                ) {
                    val first = currentGroup.first()
                    merged.add(
                        NativeSubtitleSegment(
                            time = first.time,
                            timeStr = first.timeStr,
                            duration = durationSpan,
                            text = currentGroup.joinToString(" ") { it.text.trim() }
                        )
                    )
                    currentGroup = mutableListOf(seg)
                    groupStartTime = seg.time
                } else {
                    currentGroup.add(seg)
                }
            }
        }

        if (currentGroup.isNotEmpty()) {
            val first = currentGroup.first()
            merged.add(
                NativeSubtitleSegment(
                    time = first.time,
                    timeStr = first.timeStr,
                    duration = Math.max(3.0, (currentGroup.last().time) - first.time + 2.5),
                    text = currentGroup.joinToString(" ") { it.text.trim() }
                )
            )
        }

        return merged
    }

    /**
     * 100% Android 原生免 Cookie 从 YouTube 网页抓取公开字幕轨
     */
    suspend fun fetchYouTubeSubtitlesNative(videoUrl: String): List<NativeSubtitleSegment>? {
        val videoId = extractVideoId(videoUrl) ?: return null
        val watchUrl = "https://www.youtube.com/watch?v=$videoId"

        try {
            val response = client.get(watchUrl) {
                header(HttpHeaders.UserAgent, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                header(HttpHeaders.AcceptLanguage, "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7")
            }

            if (!response.status.isSuccess()) return null
            val html = response.bodyAsText()

            // 正则提取 captionTracks
            val captionTracksMatch = Regex("\"captionTracks\":\\s*\\[(.*?)\\]").find(html)
            var targetTrackUrl: String? = null

            if (captionTracksMatch != null) {
                val jsonArrayStr = "[${captionTracksMatch.groupValues[1]}]"
                try {
                    val array = jsonParser.parseToJsonElement(jsonArrayStr).jsonArray
                    // 优先找英文 (en / en-orig / en-US)，其次找其他语言
                    var bestUrl: String? = null
                    var fallbackUrl: String? = null

                    for (item in array) {
                        val obj = item.jsonObject
                        val baseUrl = obj["baseUrl"]?.jsonPrimitive?.content ?: continue
                        val vssId = obj["vssId"]?.jsonPrimitive?.content ?: ""
                        val langCode = obj["languageCode"]?.jsonPrimitive?.content ?: ""

                        if (langCode.startsWith("en") || vssId.contains(".en")) {
                            bestUrl = baseUrl
                            break
                        } else if (fallbackUrl == null) {
                            fallbackUrl = baseUrl
                        }
                    }
                    targetTrackUrl = bestUrl ?: fallbackUrl
                } catch (e: Exception) {
                    println("[AndroidSubtitleFetcher] Parse captionTracks JSON error: ${e.message}")
                }
            }

            // 如果网页没找到，后备尝试官方TimedText Endpoint
            if (targetTrackUrl == null) {
                targetTrackUrl = "https://www.youtube.com/api/timedtext?v=$videoId&lang=en&fmt=srv1"
            }

            // 补全格式参数 fmt=srv1 以拿取原生 XML
            val finalXmlUrl = if (!targetTrackUrl.contains("fmt=")) {
                "$targetTrackUrl&fmt=srv1"
            } else targetTrackUrl

            val xmlResponse = client.get(finalXmlUrl) {
                header(HttpHeaders.UserAgent, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
            }

            if (!xmlResponse.status.isSuccess()) return null
            val xmlContent = xmlResponse.bodyAsText()

            // 解析 XML <text start="..." dur="...">...</text>
            val textRegex = Regex("<text start=\"([\\d.]+)\"(?: dur=\"([\\d.]+)\")?>(.*?)</text>", RegexOption.IGNORE_CASE)
            val rawSegments = mutableListOf<NativeSubtitleSegment>()

            for (match in textRegex.findAll(xmlContent)) {
                val startSec = match.groupValues[1].toDoubleOrNull() ?: continue
                val durSec = match.groupValues[2].toDoubleOrNull() ?: 3.0
                val rawText = unescapeXml(match.groupValues[3])
                if (rawText.isNotBlank()) {
                    rawSegments.add(
                        NativeSubtitleSegment(
                            time = startSec,
                            timeStr = formatTimestamp(startSec),
                            duration = durSec,
                            text = rawText
                        )
                    )
                }
            }

            if (rawSegments.isEmpty()) return null

            // 🎯 按完整句子表达封包组合
            return mergeSubtitlesBySentence(rawSegments)

        } catch (e: Exception) {
            println("[AndroidSubtitleFetcher] EXCEPTION: ${e.javaClass.simpleName}: ${e.message}")
            return null
        }
    }

    /**
     * 100% Android 原生调用 OpenAI 兼容接口进行中英双语字幕翻译
     */
    suspend fun translateSubtitlesNative(
        segments: List<NativeSubtitleSegment>,
        apiKey: String,
        baseUrl: String = "https://api.openai.com/v1",
        model: String = "gpt-3.5-turbo"
    ): List<NativeSubtitleSegment> {
        if (segments.isEmpty() || apiKey.isBlank()) return segments

        val cleanBaseUrl = baseUrl.trim().removeSuffix("/")
        val endpoint = "$cleanBaseUrl/chat/completions"

        val batchSize = 25
        val result = segments.toMutableList()

        for (i in segments.indices step batchSize) {
            val end = Math.min(i + batchSize, segments.size)
            val batch = segments.subList(i, end)

            val inputJsonArray = buildJsonArray {
                batch.forEachIndexed { idx, seg ->
                    add(buildJsonObject {
                        put("id", idx)
                        put("text", seg.text)
                    })
                }
            }.toString()

            val systemPrompt = "你是一个精通中英双语字幕翻译的专家。请将输入的英文字幕数组翻译为简明连贯的中文。请严格返回标准的 JSON 数组，格式为: [{\"id\": 0, \"zh\": \"对应的中文翻译\"}]，不要包含任何 markdown code block 以外的多余解释。"
            val userPrompt = inputJsonArray

            try {
                val payload = buildJsonObject {
                    put("model", model)
                    put("messages", buildJsonArray {
                        add(buildJsonObject {
                            put("role", "system")
                            put("content", systemPrompt)
                        })
                        add(buildJsonObject {
                            put("role", "user")
                            put("content", userPrompt)
                        })
                    })
                    put("temperature", 0.3)
                }.toString()

                val response = client.post(endpoint) {
                    header(HttpHeaders.Authorization, "Bearer $apiKey")
                    header(HttpHeaders.ContentType, ContentType.Application.Json)
                    setBody(payload)
                }

                if (response.status.isSuccess()) {
                    val respText = response.bodyAsText()
                    val jsonResponse = jsonParser.parseToJsonElement(respText).jsonObject
                    val content = jsonResponse["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                        ?.get("message")?.jsonObject?.get("content")?.jsonPrimitive?.content ?: ""

                    val cleanJsonStr = content.replace(Regex("^```json\\s*"), "")
                        .replace(Regex("^```\\s*"), "")
                        .replace(Regex("\\s*```$"), "")
                        .trim()

                    val translatedArray = jsonParser.parseToJsonElement(cleanJsonStr).jsonArray
                    for (item in translatedArray) {
                        val obj = item.jsonObject
                        val idIdx = obj["id"]?.jsonPrimitive?.intOrNull ?: continue
                        val zhText = obj["zh"]?.jsonPrimitive?.content ?: continue
                        val targetGlobalIdx = i + idIdx
                        if (targetGlobalIdx in result.indices) {
                            val orig = result[targetGlobalIdx]
                            result[targetGlobalIdx] = orig.copy(zh = zhText)
                        }
                    }
                }
            } catch (e: Exception) {
                println("[AndroidSubtitleFetcher] Batch translation exception: ${e.message}")
            }
        }

        return result
    }

    /**
     * 100% Android 原生调用 OpenAI 兼容大模型生成带时间戳的 Markdown 结构化博客文章
     */
    suspend fun generateBlogNative(
        title: String,
        segments: List<NativeSubtitleSegment>,
        apiKey: String,
        baseUrl: String = "https://api.openai.com/v1",
        model: String = "gpt-3.5-turbo"
    ): String? {
        if (segments.isEmpty() || apiKey.isBlank()) return null

        val cleanBaseUrl = baseUrl.trim().removeSuffix("/")
        val endpoint = "$cleanBaseUrl/chat/completions"

        val subtitleTranscript = segments.take(120).joinToString("\n") { seg ->
            "[${seg.timeStr}] ${seg.text}" + if (!seg.zh.isNullOrBlank()) " (${seg.zh})" else ""
        }

        val prompt = """
你是一个顶级的英文科技与知识类视频博客编辑。请将以下带有时间戳的视频字幕，转换为一篇结构精美、逻辑清晰的中文 Markdown 博客文章。

要求：
1. 主标题：为文章拟定一个引人入胜的中文 Markdown `# 标题`；
2. 核心摘要：在开头提供 3-5 句核心观点总结；
3. 章节结构：按主题划分为 3-5 个 `## 章节标题`，每个章节包含详细阐述；
4. 时间戳嵌入：在重点段落中嵌入原视频时间戳标签，格式为 `[mm:ss]`；
5. 请直接输出标准 Markdown 正文。

视频标题: $title
字幕文本:
$subtitleTranscript
""".trim()

        try {
            val payload = buildJsonObject {
                put("model", model)
                put("messages", buildJsonArray {
                    add(buildJsonObject {
                        put("role", "user")
                        put("content", prompt)
                    })
                })
                put("temperature", 0.5)
            }.toString()

            val response = client.post(endpoint) {
                header(HttpHeaders.Authorization, "Bearer $apiKey")
                header(HttpHeaders.ContentType, ContentType.Application.Json)
                setBody(payload)
            }

            if (response.status.isSuccess()) {
                val respText = response.bodyAsText()
                val jsonResponse = jsonParser.parseToJsonElement(respText).jsonObject
                val content = jsonResponse["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                    ?.get("message")?.jsonObject?.get("content")?.jsonPrimitive?.content ?: ""

                return content.replace(Regex("^```markdown\\s*"), "")
                    .replace(Regex("^```\\s*"), "")
                    .replace(Regex("\\s*```$"), "")
                    .trim()
            }
        } catch (e: Exception) {
            println("[AndroidSubtitleFetcher] generateBlogNative exception: ${e.message}")
        }
        return null
    }
}
