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

            // 时间行之后的所有行是字幕文本
            val text = lines.subList(timeLineIndex + 1, lines.size)
                .joinToString("\n")
                .trim()
                // 移除 HTML 标签
                .replace(Regex("<[^>]+>"), "")

            if (text.isNotBlank()) {
                segments.add(
                    SubtitleSegment(
                        index = segments.size + 1,
                        startTime = startTime,
                        endTime = endTime,
                        text = text
                    )
                )
            }
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
