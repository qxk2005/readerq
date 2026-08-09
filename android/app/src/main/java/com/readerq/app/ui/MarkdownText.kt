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
import androidx.compose.ui.text.style.TextDecoration
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
        verticalArrangement = Arrangement.spacedBy(8.dp)
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
                        text = parseInlineMarkdown(block.text, theme),
                        fontSize = fontSize,
                        fontWeight = FontWeight.Bold,
                        color = color,
                        modifier = Modifier.padding(top = 6.dp, bottom = 2.dp)
                    )
                }
                is MarkdownBlock.Paragraph -> {
                    Text(
                        text = parseInlineMarkdown(block.text, theme),
                        fontSize = 13.sp,
                        color = color,
                        lineHeight = 19.sp
                    )
                }
                is MarkdownBlock.ListItem -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = (block.indentLevel * 12).dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(
                            text = if (block.prefix.isNotBlank()) block.prefix else "• ",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = color.copy(alpha = 0.85f)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = parseInlineMarkdown(block.text, theme),
                            fontSize = 13.sp,
                            color = color,
                            lineHeight = 19.sp,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                is MarkdownBlock.BlockQuote -> {
                    val quoteBg = if (theme == "dark") Color(0xFF1E1E20) else Color(0xFFF2F3F5)
                    val barColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
                    
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(6.dp))
                            .background(quoteBg)
                            .padding(vertical = 4.dp, horizontal = 6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .width(3.5.dp)
                                .height(IntrinsicSize.Min)
                                .fillMaxHeight()
                                .background(barColor, RoundedCornerShape(2.dp))
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = parseInlineMarkdown(block.text, theme),
                            fontSize = 12.5.sp,
                            fontStyle = FontStyle.Italic,
                            color = color.copy(alpha = 0.9f),
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(vertical = 4.dp)
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
                            .padding(10.dp)
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
                is MarkdownBlock.Table -> {
                    MarkdownTable(
                        table = block,
                        theme = theme,
                        textColor = color
                    )
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

@Composable
fun MarkdownTable(
    table: MarkdownBlock.Table,
    theme: String,
    textColor: Color
) {
    val borderColor = if (theme == "dark") Color(0xFF30363D) else Color(0xFFD0D7DE)
    val headerBg = if (theme == "dark") Color(0xFF21262D) else Color(0xFFF6F8FA)
    val evenRowBg = if (theme == "dark") Color(0xFF161B22) else Color(0xFFFFFFFF)
    val oddRowBg = if (theme == "dark") Color(0xFF0D1117) else Color(0xFFF8F9FA)

    // 智能计算每一列的统一列宽 columnWidths
    val columnWidths = androidx.compose.runtime.remember(table) {
        table.headers.indices.map { colIndex ->
            val headerText = table.headers.getOrElse(colIndex) { "" }
            val cellTexts = table.rows.map { row -> row.getOrElse(colIndex) { "" } }
            val allTexts = listOf(headerText) + cellTexts
            
            val maxLineLen = allTexts.flatMap { text ->
                processCellHtmlBr(text).split("\n")
            }.maxOfOrNull { line ->
                line.fold(0.0) { acc, char ->
                    acc + if (char.code > 127) 1.6 else 1.0
                }
            } ?: 4.0

            val calculatedDp = (maxLineLen * 11.5).dp + 24.dp
            calculatedDp.coerceIn(100.dp, 320.dp)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, borderColor, RoundedCornerShape(8.dp))
            .horizontalScroll(rememberScrollState())
    ) {
        Column {
            // 表头 (Header Row)
            Row(
                modifier = Modifier
                    .height(IntrinsicSize.Min)
                    .background(headerBg)
            ) {
                table.headers.forEachIndexed { index, headerText ->
                    val align = table.alignments.getOrElse(index) { Alignment.Start }
                    val colWidth = columnWidths.getOrElse(index) { 120.dp }

                    Box(
                        modifier = Modifier
                            .width(colWidth)
                            .fillMaxHeight()
                            .border(width = 0.5.dp, color = borderColor.copy(alpha = 0.4f))
                            .padding(vertical = 8.dp, horizontal = 10.dp),
                        contentAlignment = when (align) {
                            Alignment.CenterHorizontally -> Alignment.Center
                            Alignment.End -> Alignment.CenterEnd
                            else -> Alignment.CenterStart
                        }
                    ) {
                        Text(
                            text = parseInlineMarkdown(processCellHtmlBr(headerText), theme),
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = textColor
                        )
                    }
                }
            }

            // 数据行 (Data Rows)
            table.rows.forEachIndexed { rowIndex, row ->
                val bg = if (rowIndex % 2 == 0) evenRowBg else oddRowBg
                Row(
                    modifier = Modifier
                        .height(IntrinsicSize.Min)
                        .background(bg)
                ) {
                    table.headers.indices.forEach { colIndex ->
                        val cellText = row.getOrElse(colIndex) { "" }
                        val align = table.alignments.getOrElse(colIndex) { Alignment.Start }
                        val colWidth = columnWidths.getOrElse(colIndex) { 120.dp }

                        Box(
                            modifier = Modifier
                                .width(colWidth)
                                .fillMaxHeight()
                                .border(width = 0.5.dp, color = borderColor.copy(alpha = 0.4f))
                                .padding(vertical = 8.dp, horizontal = 10.dp),
                            contentAlignment = when (align) {
                                Alignment.CenterHorizontally -> Alignment.Center
                                Alignment.End -> Alignment.CenterEnd
                                else -> Alignment.CenterStart
                            }
                        ) {
                            Text(
                                text = parseInlineMarkdown(processCellHtmlBr(cellText), theme),
                                fontSize = 12.sp,
                                color = textColor.copy(alpha = 0.9f),
                                lineHeight = 17.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun processCellHtmlBr(text: String): String {
    return text.replace(Regex("(?i)<br\\s*/?>"), "\n")
}

sealed class MarkdownBlock {
    data class Heading(val level: Int, val text: String) : MarkdownBlock()
    data class Paragraph(val text: String) : MarkdownBlock()
    data class ListItem(val prefix: String, val text: String, val indentLevel: Int = 0) : MarkdownBlock()
    data class BlockQuote(val text: String) : MarkdownBlock()
    data class CodeBlock(val language: String, val code: String) : MarkdownBlock()
    data class Table(
        val headers: List<String>,
        val alignments: List<Alignment.Horizontal>,
        val rows: List<List<String>>
    ) : MarkdownBlock()
    object Divider : MarkdownBlock()
}

/**
 * 预处理 LaTeX 符号与常见 MathJax 表达式转义
 */
private fun sanitizeLatexAndSymbols(text: String): String {
    var result = text

    // 1. 解包 \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}
    result = Regex("""\\(text|mathrm|mathbf|mathit|mathsf|mathtt)\{([^}]+)\}""").replace(result, "$2")

    // 2. 解包 \( formula \) 与 \[ formula \]
    result = Regex("""\\\(|\\\)""").replace(result, "")
    result = Regex("""\\\[|\\\]""").replace(result, "")

    // 3. TeX 算子与常用数学/逻辑符号字典映射
    val symbolMap = listOf(
        Regex("""\$?\\rightarrow\$?|\$?\\to\$?""") to "→",
        Regex("""\$?\\leftarrow\$?""") to "←",
        Regex("""\$?\\Rightarrow\$?|\$?\\implies\$?""") to "⇒",
        Regex("""\$?\\Leftarrow\$?|\$?\\impliedby\$?""") to "⇐",
        Regex("""\$?\\Leftrightarrow\$?|\$?\\iff\$?""") to "⇔",
        Regex("""\$?\\leftrightarrow\$?""") to "↔",
        Regex("""\$?\\mapsto\$?""") to "↦",
        Regex("""\$?\\uparrow\$?""") to "↑",
        Regex("""\$?\\downarrow\$?""") to "↓",
        Regex("""\$?\\cdot\$?""") to "·",
        Regex("""\$?\\bullet\$?""") to "•",
        Regex("""\$?\\ge\$?|\$?\\geq\$?""") to "≥",
        Regex("""\$?\\le\$?|\$?\\leq\$?""") to "≤",
        Regex("""\$?\\neq\$?|\$?\\ne\$?""") to "≠",
        Regex("""\$?\\approx\$?|\$?\\simeq\$?""") to "≈",
        Regex("""\$?\\times\$?""") to "×",
        Regex("""\$?\\div\$?""") to "÷",
        Regex("""\$?\\pm\$?""") to "±",
        Regex("""\$?\\infty\$?""") to "∞",
        Regex("""\$?\\in\$?""") to "∈",
        Regex("""\$?\\notin\$?""") to "∉",
        Regex("""\$?\\subset\$?""") to "⊂",
        Regex("""\$?\\supset\$?""") to "⊃",
        Regex("""\$?\\cap\$?""") to "∩",
        Regex("""\$?\\cup\$?""") to "∪",
        Regex("""\$?\\forall\$?""") to "∀",
        Regex("""\$?\\exists\$?""") to "∃",
        Regex("""\$?\\partial\$?""") to "∂",
        Regex("""\$?\\nabla\$?""") to "∇",
        Regex("""\$?\\dots\$?|\$?\\ldots\$?|\$?\\cdots\$?""") to "…",
        Regex("""\$?\\quad\$?""") to "  ",
        Regex("""\$?\\qquad\$?""") to "    ",
        Regex("""\$?\\alpha\$?""") to "α",
        Regex("""\$?\\beta\$?""") to "β",
        Regex("""\$?\\gamma\$?""") to "γ",
        Regex("""\$?\\delta\$?""") to "δ",
        Regex("""\$?\\epsilon\$?""") to "ε",
        Regex("""\$?\\theta\$?""") to "θ",
        Regex("""\$?\\lambda\$?""") to "λ",
        Regex("""\$?\\mu\$?""") to "μ",
        Regex("""\$?\\pi\$?""") to "π",
        Regex("""\$?\\sigma\$?""") to "σ",
        Regex("""\$?\\omega\$?""") to "ω",
        Regex("""\$?\\sum\$?""") to "∑",
        Regex("""\$?\\prod\$?""") to "∏",
        Regex("""\$?\\sqrt\$?""") to "√"
    )

    for ((pattern, replacement) in symbolMap) {
        result = pattern.replace(result, replacement)
    }

    // 处理形如 $ formula $ 的剩余 LaTeX 符号包，解包包裹字符
    val inlineMathRegex = Regex("""\$([^\$]+)\$""")
    result = inlineMathRegex.replace(result) { match ->
        match.groupValues[1].trim()
    }

    return result
}

private fun parseTableCellList(line: String): List<String> {
    var trimmed = line.trim()
    if (trimmed.startsWith("|")) trimmed = trimmed.substring(1)
    if (trimmed.endsWith("|")) trimmed = trimmed.substring(0, trimmed.length - 1)
    return trimmed.split("|").map { it.trim() }
}

private fun isTableDelimiterLine(line: String): Boolean {
    val trimmed = line.trim()
    if (!trimmed.contains("|") || !trimmed.contains("-")) return false
    val cells = parseTableCellList(trimmed)
    if (cells.isEmpty()) return false
    return cells.all { cell ->
        cell.replace(":", "").replace("-", "").isEmpty()
    }
}

private fun parseAlignments(delimiterLine: String): List<Alignment.Horizontal> {
    val cells = parseTableCellList(delimiterLine)
    return cells.map { cell ->
        val trimmed = cell.trim()
        val startsWithColon = trimmed.startsWith(":")
        val endsWithColon = trimmed.endsWith(":")
        when {
            startsWithColon && endsWithColon -> Alignment.CenterHorizontally
            endsWithColon -> Alignment.End
            else -> Alignment.Start
        }
    }
}

private fun parseMarkdownBlocks(markdown: String): List<MarkdownBlock> {
    val result = mutableListOf<MarkdownBlock>()
    val lines = markdown.lines()
    var inCodeBlock = false
    var codeLanguage = ""
    val codeLines = mutableListOf<String>()

    var idx = 0
    while (idx < lines.size) {
        val line = lines[idx]
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
            idx++
            continue
        }

        if (inCodeBlock) {
            codeLines.add(line)
            idx++
            continue
        }

        if (trimmed.isEmpty()) {
            idx++
            continue
        }

        if (trimmed == "---" || trimmed == "***" || trimmed == "___") {
            result.add(MarkdownBlock.Divider)
            idx++
            continue
        }

        // 表格判定：当前行包含 '|' 且下一行为分隔符行 '|:---|---:|'
        if (trimmed.contains("|") && idx + 1 < lines.size && isTableDelimiterLine(lines[idx + 1])) {
            val headers = parseTableCellList(lines[idx])
            val alignments = parseAlignments(lines[idx + 1])
            idx += 2

            val rows = mutableListOf<List<String>>()
            while (idx < lines.size) {
                val rowLine = lines[idx].trim()
                if (rowLine.isEmpty() || !rowLine.contains("|")) break
                rows.add(parseTableCellList(rowLine))
                idx++
            }

            result.add(MarkdownBlock.Table(headers, alignments, rows))
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
                idx++
                continue
            }
        }

        if (trimmed.startsWith("> ")) {
            result.add(MarkdownBlock.BlockQuote(trimmed.substring(2).trim()))
            idx++
            continue
        }

        // Check task list item (- [ ] / - [x])
        val taskMatch = Regex("""^(\s*)([*+-])\s+\[([ xX])\]\s+(.*)$""").find(line)
        if (taskMatch != null) {
            val indent = taskMatch.groupValues[1].length / 2
            val isChecked = taskMatch.groupValues[3].equals("x", ignoreCase = true)
            val prefix = if (isChecked) "☑ " else "☐ "
            val text = taskMatch.groupValues[4]
            result.add(MarkdownBlock.ListItem(prefix, text, indent))
            idx++
            continue
        }

        // Check unordered list (*, -, +)
        val unorderedMatch = Regex("""^(\s*)([*+-])\s+(.*)$""").find(line)
        if (unorderedMatch != null) {
            val indent = unorderedMatch.groupValues[1].length / 2
            val text = unorderedMatch.groupValues[3]
            result.add(MarkdownBlock.ListItem("• ", text, indent))
            idx++
            continue
        }

        // Check ordered list (1., 2., etc)
        val orderedMatch = Regex("""^(\s*)(\d+\.)\s+(.*)$""").find(line)
        if (orderedMatch != null) {
            val indent = orderedMatch.groupValues[1].length / 2
            val prefix = orderedMatch.groupValues[2]
            val text = orderedMatch.groupValues[3]
            result.add(MarkdownBlock.ListItem(prefix, text, indent))
            idx++
            continue
        }

        // Normal paragraph
        result.add(MarkdownBlock.Paragraph(line))
        idx++
    }

    if (inCodeBlock && codeLines.isNotEmpty()) {
        result.add(MarkdownBlock.CodeBlock(codeLanguage, codeLines.joinToString("\n")))
    }

    return result
}

private fun parseInlineMarkdown(text: String, theme: String = "light"): AnnotatedString {
    val sanitizedText = sanitizeLatexAndSymbols(text)

    return buildAnnotatedString {
        var cursor = 0
        val length = sanitizedText.length

        while (cursor < length) {
            // Hyperlink [label](url)
            if (sanitizedText[cursor] == '[') {
                val closeBracket = sanitizedText.indexOf(']', cursor + 1)
                if (closeBracket != -1 && closeBracket + 1 < length && sanitizedText[closeBracket + 1] == '(') {
                    val closeParen = sanitizedText.indexOf(')', closeBracket + 2)
                    if (closeParen != -1) {
                        val label = sanitizedText.substring(cursor + 1, closeBracket)
                        pushStyle(
                            SpanStyle(
                                color = Color(0xFF007AFF),
                                textDecoration = TextDecoration.Underline,
                                fontWeight = FontWeight.Medium
                            )
                        )
                        append(label)
                        pop()
                        cursor = closeParen + 1
                        continue
                    }
                }
            }

            // Highlight ==text==
            if (cursor + 1 < length && sanitizedText.substring(cursor).startsWith("==")) {
                val end = sanitizedText.indexOf("==", cursor + 2)
                if (end != -1) {
                    val content = sanitizedText.substring(cursor + 2, end)
                    pushStyle(
                        SpanStyle(
                            background = Color(0xFFFFE066),
                            color = Color.Black
                        )
                    )
                    append(content)
                    pop()
                    cursor = end + 2
                    continue
                }
            }

            // Strikethrough ~~text~~
            if (cursor + 1 < length && sanitizedText.substring(cursor).startsWith("~~")) {
                val end = sanitizedText.indexOf("~~", cursor + 2)
                if (end != -1) {
                    val content = sanitizedText.substring(cursor + 2, end)
                    pushStyle(SpanStyle(textDecoration = TextDecoration.LineThrough))
                    append(content)
                    pop()
                    cursor = end + 2
                    continue
                }
            }

            // Bold & Italic ***text***
            if (cursor + 2 < length && sanitizedText.substring(cursor).startsWith("***")) {
                val end = sanitizedText.indexOf("***", cursor + 3)
                if (end != -1) {
                    val content = sanitizedText.substring(cursor + 3, end)
                    pushStyle(SpanStyle(fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic))
                    append(content)
                    pop()
                    cursor = end + 3
                    continue
                }
            }

            // Bold **text** or __text__
            if (cursor + 1 < length && (sanitizedText.substring(cursor).startsWith("**") || sanitizedText.substring(cursor).startsWith("__"))) {
                val symbol = sanitizedText.substring(cursor, cursor + 2)
                val end = sanitizedText.indexOf(symbol, cursor + 2)
                if (end != -1) {
                    val content = sanitizedText.substring(cursor + 2, end)
                    pushStyle(SpanStyle(fontWeight = FontWeight.Bold))
                    append(content)
                    pop()
                    cursor = end + 2
                    continue
                }
            }

            // Inline code `code`
            if (sanitizedText[cursor] == '`') {
                val end = sanitizedText.indexOf('`', cursor + 1)
                if (end != -1) {
                    val content = sanitizedText.substring(cursor + 1, end)
                    pushStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = if (theme == "dark") Color(0xFF2D2D30) else Color(0xFFEAECEF),
                            color = if (theme == "dark") Color(0xFFF0F6FC) else Color(0xFF24292E)
                        )
                    )
                    append(" $content ")
                    pop()
                    cursor = end + 1
                    continue
                }
            }

            // Italic *text* or _text_
            if (sanitizedText[cursor] == '*' || sanitizedText[cursor] == '_') {
                val symbol = sanitizedText[cursor]
                val end = sanitizedText.indexOf(symbol, cursor + 1)
                if (end != -1 && (end == cursor + 1 || sanitizedText[end - 1] != ' ')) {
                    val content = sanitizedText.substring(cursor + 1, end)
                    pushStyle(SpanStyle(fontStyle = FontStyle.Italic))
                    append(content)
                    pop()
                    cursor = end + 1
                    continue
                }
            }

            // Regular char
            append(sanitizedText[cursor])
            cursor++
        }
    }
}
