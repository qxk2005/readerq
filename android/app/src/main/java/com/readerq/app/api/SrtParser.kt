package com.readerq.app.api

import com.readerq.app.api.SubtitleSegment

/**
 * SRT 字幕文件解析器
 * 将标准 SRT 格式字幕文件解析为结构化的 SubtitleSegment 列表
 */
object SrtParser {

    /**
     * 解析 SRT 字幕内容
     * @param srtContent SRT 格式的字幕文本
     * @return 解析后的字幕段落列表
     */
    fun parse(srtContent: String): List<SubtitleSegment> {
        val segments = mutableListOf<SubtitleSegment>()
        // 用空行分割字幕块
        val blocks = srtContent.replace("\r\n", "\n").replace("\r", "\n")
            .trim()
            .split(Regex("\n\\s*\n"))

        for (block in blocks) {
            val lines = block.trim().split("\n")
            if (lines.size < 2) continue

            // 第一行是序号（可选跳过）
            // 找到时间戳行 (格式: 00:00:00,000 --> 00:00:00,000)
            var timeLineIndex = -1
            for (i in lines.indices) {
                if (lines[i].contains("-->")) {
                    timeLineIndex = i
                    break
                }
            }
            if (timeLineIndex < 0) continue

            val timeLine = lines[timeLineIndex]
            val timeParts = timeLine.split("-->")
            if (timeParts.size != 2) continue

            val startTime = parseTimestamp(timeParts[0].trim())
            val endTime = parseTimestamp(timeParts[1].trim())

            if (startTime < 0 || endTime < 0) continue

            val textLines = lines.subList(timeLineIndex + 1, lines.size)
                .map { it.trim().replace(Regex("<[^>]+>"), "") }
                .filter { it.isNotBlank() }

            if (textLines.isNotEmpty()) {
                val fullText = textLines.joinToString("\n")
                var extractedZh: String? = null
                var extractedEn: String? = null

                if (textLines.size >= 2) {
                    val hasChinese0 = textLines[0].contains(Regex("[\\u4e00-\\u9fa5]"))
                    val hasChinese1 = textLines[1].contains(Regex("[\\u4e00-\\u9fa5]"))
                    if (hasChinese0 && !hasChinese1) {
                        extractedZh = textLines[0]
                        extractedEn = textLines.subList(1, textLines.size).joinToString(" ")
                    } else if (!hasChinese0 && hasChinese1) {
                        extractedEn = textLines[0]
                        extractedZh = textLines.subList(1, textLines.size).joinToString(" ")
                    } else {
                        extractedZh = textLines[0]
                        extractedEn = textLines.subList(1, textLines.size).joinToString(" ")
                    }
                } else {
                    val single = textLines[0]
                    if (single.contains(Regex("[\\u4e00-\\u9fa5]"))) {
                        extractedZh = single
                    } else {
                        extractedEn = single
                    }
                }

                segments.add(
                    SubtitleSegment(
                        index = segments.size + 1,
                        startTime = startTime,
                        endTime = endTime,
                        text = fullText,
                        zh = extractedZh,
                        en = extractedEn
                    )
                )
            }
        }

        return segments
    }

    /**
     * 智能解析任意字幕内容 (优先解析双语 JSON，若为 SRT 格式则解析 SRT)
     */
    fun parseAnySubtitle(rawContent: String): List<SubtitleSegment> {
        val trimmed = rawContent.trim()
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            val jsonSegments = parseBilingualJson(trimmed)
            if (jsonSegments.isNotEmpty()) {
                return jsonSegments
            }
        }
        return parse(rawContent)
    }

    /**
     * 解析前端/服务端传回的 bilingual_json 字符串
     */
    fun parseBilingualJson(jsonContent: String): List<SubtitleSegment> {
        val segments = mutableListOf<SubtitleSegment>()
        try {
            val jsonArray = org.json.JSONArray(jsonContent)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val time = obj.optDouble("time", 0.0)
                val text = obj.optString("text", "")
                val zh = obj.optString("zh", "")
                val en = obj.optString("en", "")
                val timeStr = obj.optString("timeStr", "")
                val startTime = if (time > 0) time else parseTimestamp(timeStr)

                if (text.isNotBlank() || zh.isNotBlank()) {
                    segments.add(
                        SubtitleSegment(
                            index = i + 1,
                            startTime = Math.max(0.0, startTime),
                            endTime = Math.max(0.0, startTime) + 4.0,
                            text = text.ifBlank { zh },
                            zh = zh.ifBlank { null },
                            en = en.ifBlank { null }
                        )
                    )
                }
            }
        } catch (e: Exception) {
            // ignore
        }
        return segments
    }

    /**
     * 解析 SRT 时间戳格式: HH:MM:SS,mmm 或 HH:MM:SS.mmm
     * @return 秒数（含毫秒精度），解析失败返回 -1.0
     */
    private fun parseTimestamp(timestamp: String): Double {
        // 支持逗号和点作为毫秒分隔符
        val cleaned = timestamp.replace(",", ".")
        val parts = cleaned.split(":")

        return try {
            when (parts.size) {
                3 -> {
                    val hours = parts[0].trim().toInt()
                    val minutes = parts[1].trim().toInt()
                    val seconds = parts[2].trim().toDouble()
                    hours * 3600.0 + minutes * 60.0 + seconds
                }
                2 -> {
                    val minutes = parts[0].trim().toInt()
                    val seconds = parts[1].trim().toDouble()
                    minutes * 60.0 + seconds
                }
                else -> -1.0
            }
        } catch (e: NumberFormatException) {
            -1.0
        }
    }

    /**
     * 格式化秒数为 MM:SS 格式
     */
    fun formatTime(seconds: Double): String {
        val totalSeconds = seconds.toInt()
        val mins = totalSeconds / 60
        val secs = totalSeconds % 60
        return "%d:%02d".format(mins, secs)
    }
}
