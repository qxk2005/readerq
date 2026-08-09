package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onBackground,
    theme: String = "light"
) {
    val blocks = parseMarkdownBlocks(markdown)

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        blocks.forEach { block ->
            when (block) {
                is MarkdownBlock.Heading -> {
                    val fontSize = when (block.level) {
                        1 -> 17.sp
                        2 -> 15.sp
                        else -> 14.sp
                    }
                    Text(
                        text = parseInlineMarkdown(block.text),
                        fontSize = fontSize,
                        fontWeight = FontWeight.Bold,
                        color = color,
                        modifier = Modifier.padding(top = 4.dp, bottom = 2.dp)
                    )
                }
                is MarkdownBlock.Paragraph -> {
                    Text(
                        text = parseInlineMarkdown(block.text),
                        fontSize = 13.sp,
                        color = color,
                        lineHeight = 18.sp
                    )
                }
                is MarkdownBlock.ListItem -> {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(start = (block.indentLevel * 12).dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(
                            text = if (block.prefix.isNotBlank()) block.prefix else "• ",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = color.copy(alpha = 0.8f)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = parseInlineMarkdown(block.text),
                            fontSize = 13.sp,
                            color = color,
                            lineHeight = 18.sp,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                is MarkdownBlock.BlockQuote -> {
                    val quoteBg = if (theme == "dark") Color(0xFF1E1E1E) else Color(0xFFF0F0EE)
                    val barColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
                    
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(4.dp))
                            .background(quoteBg)
                            .padding(vertical = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .width(4.dp)
                                .fillMaxHeight()
                                .background(barColor)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = parseInlineMarkdown(block.text),
                            fontSize = 12.5.sp,
                            fontStyle = FontStyle.Italic,
                            color = color.copy(alpha = 0.9f),
                            lineHeight = 17.sp,
                            modifier = Modifier.padding(vertical = 4.dp, horizontal = 4.dp)
                        )
                    }
                }
                is MarkdownBlock.CodeBlock -> {
                    val codeBg = if (theme == "dark") Color(0xFF181818) else Color(0xFFF4F4F6)
                    val codeBorder = Color.Gray.copy(alpha = 0.2f)

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(6.dp))
                            .background(codeBg)
                            .border(1.dp, codeBorder, RoundedCornerShape(6.dp))
                            .padding(8.dp)
                            .horizontalScroll(rememberScrollState())
                    ) {
                        Text(
                            text = block.code,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            color = if (theme == "dark") Color(0xFFE6EDF3) else Color(0xFF24292E),
                            lineHeight = 16.sp
                        )
                    }
                }
                is MarkdownBlock.Divider -> {
                    Divider(
                        color = color.copy(alpha = 0.15f),
                        thickness = 1.dp,
                        modifier = Modifier.padding(vertical = 6.dp)
                    )
                }
            }
        }
    }
}

sealed class MarkdownBlock {
    data class Heading(val level: Int, val text: String) : MarkdownBlock()
    data class Paragraph(val text: String) : MarkdownBlock()
    data class ListItem(val prefix: String, val text: String, val indentLevel: Int = 0) : MarkdownBlock()
    data class BlockQuote(val text: String) : MarkdownBlock()
    data class CodeBlock(val language: String, val code: String) : MarkdownBlock()
    object Divider : MarkdownBlock()
}

private fun parseMarkdownBlocks(markdown: String): List<MarkdownBlock> {
    val result = mutableListOf<MarkdownBlock>()
    val lines = markdown.lines()
    var inCodeBlock = false
    var codeLanguage = ""
    val codeLines = mutableListOf<String>()

    for (line in lines) {
        val trimmed = line.trim()

        if (trimmed.startsWith("```")) {
            if (inCodeBlock) {
                result.add(MarkdownBlock.CodeBlock(codeLanguage, codeLines.joinToString("\n")))
                codeLines.clear()
                inCodeBlock = false
            } else {
                inCodeBlock = true
                codeLanguage = trimmed.removePrefix("```").trim()
            }
            continue
        }

        if (inCodeBlock) {
            codeLines.add(line)
            continue
        }

        if (trimmed.isEmpty()) {
            continue
        }

        if (trimmed == "---" || trimmed == "***" || trimmed == "___") {
            result.add(MarkdownBlock.Divider)
            continue
        }

        if (trimmed.startsWith("#")) {
            var level = 0
            while (level < trimmed.length && trimmed[level] == '#') {
                level++
            }
            if (level in 1..6 && level < trimmed.length && trimmed[level] == ' ') {
                val text = trimmed.substring(level + 1).trim()
                result.add(MarkdownBlock.Heading(level.coerceAtMost(3), text))
                continue
            }
        }

        if (trimmed.startsWith("> ")) {
            result.add(MarkdownBlock.BlockQuote(trimmed.substring(2).trim()))
            continue
        }

        // Check unordered list (*, -, +)
        val unorderedMatch = Regex("""^(\s*)([*+-])\s+(.*)$""").find(line)
        if (unorderedMatch != null) {
            val indent = unorderedMatch.groupValues[1].length / 2
            val text = unorderedMatch.groupValues[3]
            result.add(MarkdownBlock.ListItem("• ", text, indent))
            continue
        }

        // Check ordered list (1., 2., etc)
        val orderedMatch = Regex("""^(\s*)(\d+\.)\s+(.*)$""").find(line)
        if (orderedMatch != null) {
            val indent = orderedMatch.groupValues[1].length / 2
            val prefix = orderedMatch.groupValues[2]
            val text = orderedMatch.groupValues[3]
            result.add(MarkdownBlock.ListItem(prefix, text, indent))
            continue
        }

        // Normal paragraph
        result.add(MarkdownBlock.Paragraph(line))
    }

    if (inCodeBlock && codeLines.isNotEmpty()) {
        result.add(MarkdownBlock.CodeBlock(codeLanguage, codeLines.joinToString("\n")))
    }

    return result
}

private fun parseInlineMarkdown(text: String): AnnotatedString {
    return buildAnnotatedString {
        var cursor = 0
        val length = text.length

        while (cursor < length) {
            // Bold & Italic ***text***
            if (cursor + 2 < length && text.substring(cursor).startsWith("***")) {
                val end = text.indexOf("***", cursor + 3)
                if (end != -1) {
                    val content = text.substring(cursor + 3, end)
                    pushStyle(SpanStyle(fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic))
                    append(content)
                    pop()
                    cursor = end + 3
                    continue
                }
            }

            // Bold **text** or __text__
            if (cursor + 1 < length && (text.substring(cursor).startsWith("**") || text.substring(cursor).startsWith("__"))) {
                val symbol = text.substring(cursor, cursor + 2)
                val end = text.indexOf(symbol, cursor + 2)
                if (end != -1) {
                    val content = text.substring(cursor + 2, end)
                    pushStyle(SpanStyle(fontWeight = FontWeight.Bold))
                    append(content)
                    pop()
                    cursor = end + 2
                    continue
                }
            }

            // Inline code `code`
            if (text[cursor] == '`') {
                val end = text.indexOf('`', cursor + 1)
                if (end != -1) {
                    val content = text.substring(cursor + 1, end)
                    pushStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = Color.Gray.copy(alpha = 0.15f)
                        )
                    )
                    append(" $content ")
                    pop()
                    cursor = end + 1
                    continue
                }
            }

            // Italic *text* or _text_
            if (text[cursor] == '*' || text[cursor] == '_') {
                val symbol = text[cursor]
                val end = text.indexOf(symbol, cursor + 1)
                if (end != -1 && (end == cursor + 1 || text[end - 1] != ' ')) {
                    val content = text.substring(cursor + 1, end)
                    pushStyle(SpanStyle(fontStyle = FontStyle.Italic))
                    append(content)
                    pop()
                    cursor = end + 1
                    continue
                }
            }

            // Regular char
            append(text[cursor])
            cursor++
        }
    }
}
