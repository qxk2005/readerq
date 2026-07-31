package com.readerq.app.api

import io.ktor.client.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.json.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.CookieHandler
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpURLConnection
import java.net.URL

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
            Regex("(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|" +
                    ".*[?&]v=)|youtu\\.be\\/)([^\"&?\\/\\s]{11})"),
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
            // 先处理双重编码：&amp;#39; → &#39;, &amp;quot; → &quot; 等
            .replace("&amp;#39;", "'")
            .replace("&amp;#039;", "'")
            .replace("&amp;quot;", "\"")
            .replace("&amp;lt;", "<")
            .replace("&amp;gt;", ">")
            .replace("&amp;amp;", "&")
            // 再处理标准 XML 实体
            .replace("&#39;", "'")
            .replace("&#039;", "'")
            .replace("&quot;", "\"")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            // 清理内嵌 HTML 标签和多余换行
            .replace(Regex("<[^>]+>"), "")
            .replace("\n", " ")
            .replace(Regex("\\s+"), " ")
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
     * 100% Android 原生字幕提取 —— 移植自 youtube-transcript-api (Python) 的成功方法。
     *
     * 核心原理：使用 java.net.CookieManager 维持 HTTP Session，
     * 模拟 youtube-transcript-api 的三步流程：
     * 1. GET watch 页面 → 建立 session cookies
     * 2. 从 HTML 中提取 INNERTUBE_API_KEY
     * 3. POST Innertube player API (ANDROID 客户端身份) → 获取 captionTracks
     * 4. 用同一 session GET 字幕 baseUrl → 获取 XML 字幕内容
     */
    suspend fun fetchYouTubeSubtitlesNative(videoUrl: String): List<NativeSubtitleSegment>? {
        val videoId = extractVideoId(videoUrl) ?: return null

        println("[AndroidSubtitleFetcher] Starting Innertube session method for $videoId")

        return try {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                fetchSubtitlesViaInnertube(videoId)
            }
        } catch (e: Exception) {
            println("[AndroidSubtitleFetcher] EXCEPTION: ${e.javaClass.simpleName}: ${e.message}")
            null
        }
    }

    /**
     * 通过 Innertube Session 方法获取字幕（在 IO 线程执行）
     */
    private fun fetchSubtitlesViaInnertube(videoId: String): List<NativeSubtitleSegment>? {
        // 设置全局 CookieManager 维持 session
        val cookieManager = CookieManager()
        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL)
        val previousHandler = CookieHandler.getDefault()
        CookieHandler.setDefault(cookieManager)

        try {
            // ========== Step 1: GET watch 页面，建立 session cookies ==========
            val watchUrl = "https://www.youtube.com/watch?v=$videoId"
            println("[AndroidSubtitleFetcher] Step 1: Fetching watch page...")

            val html = httpGet(watchUrl)
            if (html.isNullOrBlank()) {
                println("[AndroidSubtitleFetcher] Step 1 FAILED: Empty HTML response")
                return null
            }
            println("[AndroidSubtitleFetcher] Step 1 OK: HTML length=${html.length}")

            // 处理 CONSENT 页面（欧盟区域需要）
            if (html.contains("action=\"https://consent.youtube.com/s\"")) {
                println("[AndroidSubtitleFetcher] Handling consent page...")
                val consentMatch = Regex("name=\"v\" value=\"(.*?)\"").find(html)
                if (consentMatch != null) {
                    // 设置 CONSENT cookie
                    val consentValue = "YES+" + consentMatch.groupValues[1]
                    cookieManager.cookieStore.add(
                        java.net.URI("https://www.youtube.com"),
                        java.net.HttpCookie("CONSENT", consentValue).apply {
                            domain = ".youtube.com"
                            path = "/"
                        }
                    )
                }
            }

            // ========== Step 2: 提取 INNERTUBE_API_KEY ==========
            val apiKeyMatch = Regex("\"INNERTUBE_API_KEY\":\\s*\"([a-zA-Z0-9_-]+)\"").find(html)
            val apiKey = apiKeyMatch?.groupValues?.get(1) ?: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
            println("[AndroidSubtitleFetcher] Step 2: API key = $apiKey")

            // ========== Step 3: POST Innertube player API (ANDROID 客户端) ==========
            println("[AndroidSubtitleFetcher] Step 3: Calling Innertube player API...")

            val innertubeUrl = "https://www.youtube.com/youtubei/v1/player?key=$apiKey"
            val innertubePayload = """
                {
                    "context": {
                        "client": {
                            "clientName": "ANDROID",
                            "clientVersion": "20.10.38"
                        }
                    },
                    "videoId": "$videoId"
                }
            """.trimIndent()

            val innertubeResponse = httpPost(innertubeUrl, innertubePayload)
            if (innertubeResponse.isNullOrBlank()) {
                println("[AndroidSubtitleFetcher] Step 3 FAILED: Empty Innertube response")
                return null
            }

            val innertubeJson = jsonParser.parseToJsonElement(innertubeResponse).jsonObject
            val captionsRenderer = innertubeJson["captions"]?.jsonObject
                ?.get("playerCaptionsTracklistRenderer")?.jsonObject

            if (captionsRenderer == null) {
                val status = innertubeJson["playabilityStatus"]?.jsonObject
                    ?.get("status")?.jsonPrimitive?.content
                println("[AndroidSubtitleFetcher] Step 3 FAILED: No captions. Playability=$status")
                return null
            }

            val captionTracks = captionsRenderer["captionTracks"]?.jsonArray
            if (captionTracks == null || captionTracks.isEmpty()) {
                println("[AndroidSubtitleFetcher] Step 3 FAILED: Empty captionTracks")
                return null
            }

            println("[AndroidSubtitleFetcher] Step 3 OK: Found ${captionTracks.size} caption tracks")

            // 找英文字幕轨，否则用第一个
            var targetBaseUrl: String? = null
            var fallbackBaseUrl: String? = null
            for (track in captionTracks) {
                val trackObj = track.jsonObject
                val langCode = trackObj["languageCode"]?.jsonPrimitive?.content ?: ""
                val baseUrl = trackObj["baseUrl"]?.jsonPrimitive?.content ?: continue

                if (langCode.startsWith("en")) {
                    targetBaseUrl = baseUrl
                    break
                } else if (fallbackBaseUrl == null) {
                    fallbackBaseUrl = baseUrl
                }
            }

            val subtitleUrl = (targetBaseUrl ?: fallbackBaseUrl)
                ?.replace("&fmt=srv3", "")  // 移除 srv3 格式
            if (subtitleUrl == null) {
                println("[AndroidSubtitleFetcher] Step 3 FAILED: No usable subtitle URL")
                return null
            }

            // 检查是否需要 POT token
            if (subtitleUrl.contains("&exp=xpe")) {
                println("[AndroidSubtitleFetcher] WARNING: URL contains &exp=xpe (may need POT token)")
            }

            // ========== Step 4: GET 字幕内容（用同一 session 的 cookies） ==========
            println("[AndroidSubtitleFetcher] Step 4: Fetching subtitle XML...")
            val xmlContent = httpGet(subtitleUrl)
            if (xmlContent.isNullOrBlank()) {
                println("[AndroidSubtitleFetcher] Step 4 FAILED: Empty subtitle content")
                return null
            }

            println("[AndroidSubtitleFetcher] Step 4 OK: XML content length=${xmlContent.length}")

            // ========== Step 5: 解析 XML ==========
            return parseXmlSubtitles(xmlContent)

        } finally {
            // 恢复之前的 CookieHandler
            CookieHandler.setDefault(previousHandler)
        }
    }

    /**
     * 使用 java.net.HttpURLConnection 执行 GET 请求（自动携带 CookieManager 管理的 cookies）
     */
    private fun httpGet(urlStr: String): String? {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.instanceFollowRedirects = true

        return try {
            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader(InputStreamReader(conn.inputStream, "UTF-8")).use { it.readText() }
            } else {
                println("[AndroidSubtitleFetcher] HTTP GET ${conn.responseCode}: $urlStr")
                null
            }
        } catch (e: Exception) {
            println("[AndroidSubtitleFetcher] HTTP GET error: ${e.message}")
            null
        } finally {
            conn.disconnect()
        }
    }

    /**
     * 使用 java.net.HttpURLConnection 执行 POST 请求（JSON body）
     */
    private fun httpPost(urlStr: String, jsonBody: String): String? {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        conn.doOutput = true
        conn.connectTimeout = 15000
        conn.readTimeout = 15000

        return try {
            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(jsonBody) }
            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader(InputStreamReader(conn.inputStream, "UTF-8")).use { it.readText() }
            } else {
                println("[AndroidSubtitleFetcher] HTTP POST ${conn.responseCode}: $urlStr")
                // Try reading error stream
                val errorBody = try {
                    BufferedReader(InputStreamReader(conn.errorStream, "UTF-8")).use { it.readText() }
                } catch (_: Exception) { "" }
                println("[AndroidSubtitleFetcher]   Error: ${errorBody.take(200)}")
                null
            }
        } catch (e: Exception) {
            println("[AndroidSubtitleFetcher] HTTP POST error: ${e.message}")
            null
        } finally {
            conn.disconnect()
        }
    }

    /**
     * 解析 XML 格式的字幕内容为段落列表
     */
    private fun parseXmlSubtitles(xmlContent: String): List<NativeSubtitleSegment>? {
        println("[AndroidSubtitleFetcher] XML preview: ${xmlContent.take(300)}")
        // DOT_MATCHES_ALL 是关键：YouTube XML 中 <text> 标签内容经常包含换行符
        val textRegex = Regex("<text start=\"([\\d.]+)\"(?: dur=\"([\\d.]+)\")?>(.+?)</text>",
            setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
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

        println("[AndroidSubtitleFetcher] Parsed ${rawSegments.size} raw segments from XML")
        if (rawSegments.isEmpty()) return null

        return mergeSubtitlesBySentence(rawSegments)
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

                println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1}: HTTP status=${response.status}")
                if (response.status.isSuccess()) {
                    val respText = response.bodyAsText()
                    println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1}: Response length=${respText.length}")
                    val jsonResponse = jsonParser.parseToJsonElement(respText).jsonObject
                    val content = jsonResponse["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                        ?.get("message")?.jsonObject?.get("content")?.jsonPrimitive?.content ?: ""

                    println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1}: AI content preview='${content.take(200)}'")

                    val cleanJsonStr = content.replace(Regex("^```json\\s*"), "")
                        .replace(Regex("^```\\s*"), "")
                        .replace(Regex("\\s*```$"), "")
                        .trim()

                    // 🎯 高强度的 JSON Array 容错解析：处理外层 Root 对象 或 Markdown 包裹的情况
                    var translatedArray: JsonArray? = null
                    try {
                        val parsedElem = jsonParser.parseToJsonElement(cleanJsonStr)
                        if (parsedElem is JsonArray) {
                            translatedArray = parsedElem
                        } else if (parsedElem is JsonObject) {
                            translatedArray = parsedElem["subtitles"]?.jsonArray
                                ?: parsedElem["items"]?.jsonArray
                                ?: parsedElem["results"]?.jsonArray
                                ?: parsedElem["data"]?.jsonArray
                        }
                    } catch (_: Exception) {
                        // 正则后备提取 [ ... ]
                        val arrayMatch = Regex("\\[[\\s\\S]*\\]").find(cleanJsonStr)
                        if (arrayMatch != null) {
                            try {
                                translatedArray = jsonParser.parseToJsonElement(arrayMatch.value).jsonArray
                            } catch (_: Exception) {}
                        }
                    }

                    if (translatedArray != null) {
                        println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1}: Parsed ${translatedArray.size} translated items")
                        var matchCount = 0
                        for (item in translatedArray) {
                            if (item !is JsonObject) continue
                            val obj = item.jsonObject
                            // 🎯 修复 Bug 1：兼容 String 与 Int 类型的 id（如 "id": "0" 或 "id": 0）
                            val idRaw = obj["id"]?.jsonPrimitive
                            val idIdx = idRaw?.intOrNull ?: idRaw?.contentOrNull?.toIntOrNull()
                            if (idIdx == null) continue

                            // 🎯 修复 Bug 2：兼容多个中文翻译字段名称（zh, translation, text_zh, cn, chinese）
                            val zhText = (obj["zh"] ?: obj["translation"] ?: obj["text_zh"] ?: obj["cn"] ?: obj["chinese"])
                                ?.jsonPrimitive?.contentOrNull
                            if (zhText.isNullOrBlank()) continue

                            // 🎯 修复 Bug 3：自动识别是相对 Index (0~24) 还是全局 Index (i ~ end-1)
                            val targetGlobalIdx = if (idIdx in 0 until batch.size) {
                                i + idIdx
                            } else if (idIdx in i until end) {
                                idIdx
                            } else {
                                -1
                            }

                            if (targetGlobalIdx in result.indices) {
                                val orig = result[targetGlobalIdx]
                                result[targetGlobalIdx] = orig.copy(zh = zhText)
                                matchCount++
                            }
                        }
                        println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1}: Applied $matchCount zh translations")
                    } else {
                        println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1}: Failed to parse JSON array from AI response")
                    }
                } else {
                    val errBody = response.bodyAsText().take(300)
                    println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1}: HTTP error ${response.status}, body=$errBody")
                }
            } catch (e: Exception) {
                // 🎯 修复 Bug 4：隔离 Batch 级异常，记录日志并继续翻译下一个 Batch，不抛出导致整体流程截断
                println("[AndroidSubtitleFetcher] Batch ${i / batchSize + 1} translation exception: ${e.message}")
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

        val subtitleTranscript = segments.take(300).joinToString("\n") { seg ->
            "[${seg.timeStr}] ${seg.text}" + if (!seg.zh.isNullOrBlank()) " (${seg.zh})" else ""
        }

        val prompt = """
你是一位资深的技术博客编辑。请将以下带有时间戳的视频字幕，转换为一篇结构清晰、内容丰富的 Markdown 博客文章。

要求：
1. **输出语言**：必须使用简体中文撰写；
2. **文章结构**：使用 Markdown 格式，包含标题（使用 # 和 ##）、摘要段落、核心要点列表等；
3. **时间戳嵌入（非常重要）**：
   - 在每一个 Markdown 章节标题（如 ## 或 ###）的结尾，必须标注对应视频的时间戳标记 `[MM:SS]`，例如 `## 一、背景介绍 [01:25]`；
   - 在正文核心段落开头也可附带对应的时间戳标记如 `[08:15]`，方便读者点击跳转观看。
4. 请直接输出标准的 Markdown 正文，不要包含多余外层说明。

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
            } else {
                val errBody = response.bodyAsText().take(300)
                println("[AndroidSubtitleFetcher] generateBlogNative HTTP error ${response.status}, body=$errBody")
                throw Exception("AI API 博客生成错误 (${response.status.value}): $errBody")
            }
        } catch (e: Exception) {
            println("[AndroidSubtitleFetcher] generateBlogNative exception: ${e.message}")
            throw e
        }
    }
}
