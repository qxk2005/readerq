package com.readerq.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.readerq.app.data.HighlightEntity
import kotlinx.serialization.json.Json
import com.readerq.app.R
import androidx.compose.ui.res.painterResource
import kotlinx.serialization.encodeToString
import coil.compose.AsyncImage
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Close
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.style.TextOverflow

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NotebookView(viewModel: MainViewModel) {
    val highlights by viewModel.highlights.collectAsState()
    val doc by viewModel.selectedDoc.collectAsState()
    val theme by viewModel.theme.collectAsState()
    val allExistingTags by viewModel.allTags.collectAsState()

    val listState = rememberLazyListState()
    var editingHighlightId by remember { mutableStateOf<String?>(null) }
    var activeNotebookTab by remember { mutableStateOf("highlights") } // "highlights" or "doc_note"
    var isEditingDocNote by remember { mutableStateOf(false) }

    LaunchedEffect(viewModel) {
        viewModel.scrollNotebookToHighlightEvent.collect { hlId ->
            activeNotebookTab = "highlights"
            val index = highlights.indexOfFirst { it.id == hlId }
            if (index >= 0) {
                listState.animateScrollToItem(index + 2)
            }
        }
    }

    val subTextColor = when (theme) {
        "light" -> Color(0xFF4B5563)
        "sepia" -> Color(0xFF5C5246)
        else -> Color(0xFF9CA3AF)
    }
    val tagBg = when (theme) {
        "light" -> Color(0xFFE5E7EB)
        "sepia" -> Color(0xFFE4DFD5)
        else -> Color(0xFF2D2D2D)
    }
    val textColor = MaterialTheme.colorScheme.onSurface

    var docNote by remember(doc) { mutableStateOf(doc?.notes ?: "") }
    var docTagsList by remember(doc) {
        val tagsMap = try {
            doc?.tags_json?.let { Json.decodeFromString<Map<String, Int>>(it) } ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
        mutableStateOf(tagsMap.keys.toList())
    }
    var currentDocTagInput by remember { mutableStateOf("") }

    // Autocomplete tag candidates
    val candidates = remember(allExistingTags, currentDocTagInput, docTagsList) {
        val query = currentDocTagInput.trim()
        if (query.isEmpty()) {
            emptyList()
        } else {
            allExistingTags
                .filter { it.contains(query, ignoreCase = true) && !docTagsList.contains(it) }
                .take(5)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // 顶部 Tab 分段切换控件 (Segmented Control)
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = when (theme) {
                "light" -> Color(0xFFEBECEF)
                "sepia" -> Color(0xFFE4DFD5)
                else -> Color(0xFF252528)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(38.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(3.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                val tabs = listOf(
                    Pair("highlights", "🖍️ 高亮与批注 (${highlights.size})"),
                    Pair("doc_note", "📝 文档笔记${if (docNote.isNotBlank()) " •" else ""}")
                )
                tabs.forEach { (tabKey, label) ->
                    val isSelected = activeNotebookTab == tabKey
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(8.dp))
                            .background(
                                if (isSelected) {
                                    when (theme) {
                                        "light" -> Color.White
                                        "sepia" -> Color(0xFFF5F2EB)
                                        else -> Color(0xFF38383C)
                                    }
                                } else Color.Transparent
                            )
                            .clickable { activeNotebookTab = tabKey },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = label,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) MaterialTheme.colorScheme.primary else textColor.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (activeNotebookTab == "highlights") {
            // === Tab 1: 高亮与批注 ===
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Highlights list header with sort control
                item {
                    val sortMode by viewModel.highlightSortMode.collectAsState()
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "高亮列表 (${highlights.size})",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground,
                            fontSize = 14.sp
                        )
                        if (highlights.isNotEmpty()) {
                            val sortLabel = when (sortMode) {
                                "position_asc" -> "位置 ↑"
                                "position_desc" -> "位置 ↓"
                                "time_asc" -> "时间 ↑"
                                "time_desc" -> "时间 ↓"
                                else -> "位置 ↑"
                            }
                            OutlinedButton(
                                onClick = {
                                    val modes = listOf("position_asc", "position_desc", "time_asc", "time_desc")
                                    val idx = modes.indexOf(sortMode)
                                    viewModel.setHighlightSortMode(modes[(idx + 1) % modes.size])
                                },
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                modifier = Modifier.height(28.dp)
                            ) {
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_sort),
                                    contentDescription = "排序",
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(sortLabel, fontSize = 11.sp)
                            }
                        }
                    }
                }

                if (highlights.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("🖍️", fontSize = 32.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("暂无高亮与划线批注", color = subTextColor, fontSize = 13.sp)
                                Text("在正文中长按选择文本即可快速添加高亮", color = subTextColor.copy(alpha = 0.6f), fontSize = 11.sp)
                            }
                        }
                    }
                } else {
                    // Highlights items
                    items(highlights, key = { it.id }) { hl ->
                        NotebookHighlightCard(
                            hl = hl,
                            theme = theme,
                            viewModel = viewModel,
                            isEditing = editingHighlightId == hl.id,
                            onEditingChange = { editing ->
                                editingHighlightId = if (editing) hl.id else null
                            }
                        )
                    }
                }
            }
        } else {
            // === Tab 2: 文档笔记 (独立支持 Markdown 渲染) ===
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = when (theme) {
                            "light" -> Color(0xFFFFFFFF)
                            "sepia" -> Color(0xFFEFECE6)
                            else -> Color(0xFF1E1E1E)
                        }
                    ),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(
                        width = 1.dp,
                        color = when (theme) {
                            "light" -> Color(0xFFE5E7EB)
                            "sepia" -> Color(0xFFE4DFD5)
                            else -> Color(0xFF2D2D2D)
                        }
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "文档全局笔记",
                                fontWeight = FontWeight.Bold,
                                color = textColor,
                                fontSize = 15.sp
                            )
                            
                            if (!isEditingDocNote) {
                                TextButton(
                                    onClick = { isEditingDocNote = true },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_edit_note),
                                        contentDescription = "编辑笔记",
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(if (docNote.isBlank()) "添加笔记" else "编辑笔记", fontSize = 12.sp)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        if (isEditingDocNote) {
                            // === 编辑模式 ===
                            val inputContainerColor = if (theme == "dark") Color(0xFF28282A) else Color(0xFFEAECEF)

                            TextField(
                                value = docNote,
                                onValueChange = { docNote = it },
                                placeholder = {
                                    Text(
                                        "支持 Markdown 格式，例如：\n# 总结标题\n- 核心观点1\n**加粗** [相关链接](url)",
                                        fontSize = 13.sp,
                                        color = subTextColor.copy(alpha = 0.6f)
                                    )
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 120.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = inputContainerColor,
                                    unfocusedContainerColor = inputContainerColor,
                                    disabledContainerColor = inputContainerColor,
                                    focusedTextColor = textColor,
                                    unfocusedTextColor = textColor,
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                    disabledIndicatorColor = Color.Transparent
                                )
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            // 标签编辑部分
                            Text("文档标签", fontSize = 11.sp, color = subTextColor, fontWeight = FontWeight.Medium)
                            Spacer(modifier = Modifier.height(4.dp))

                            if (docTagsList.isNotEmpty()) {
                                FlowRow(
                                    modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    docTagsList.forEach { tag ->
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(tagBg)
                                                .clickable { docTagsList = docTagsList - tag }
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                                            ) {
                                                Text(text = "#$tag", color = subTextColor, fontSize = 11.sp)
                                                Text(text = "✕", color = subTextColor.copy(alpha = 0.7f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            }

                            TextField(
                                value = currentDocTagInput,
                                onValueChange = { input ->
                                    if (input.endsWith(",") || input.endsWith("，") || input.endsWith(" ") || input.endsWith("\n")) {
                                        val newTag = input.trim()
                                            .removeSuffix(",")
                                            .removeSuffix("，")
                                            .trim()
                                        if (newTag.isNotEmpty() && !docTagsList.contains(newTag)) {
                                            docTagsList = docTagsList + newTag
                                        }
                                        currentDocTagInput = ""
                                    } else {
                                        currentDocTagInput = input
                                    }
                                },
                                placeholder = { Text("输入新标签并以逗号或空格分割...", fontSize = 13.sp, color = subTextColor.copy(alpha = 0.6f)) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = inputContainerColor,
                                    unfocusedContainerColor = inputContainerColor,
                                    disabledContainerColor = inputContainerColor,
                                    focusedTextColor = textColor,
                                    unfocusedTextColor = textColor,
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                    disabledIndicatorColor = Color.Transparent
                                )
                            )

                            // 标签候选联想
                            if (candidates.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("匹配：", color = subTextColor, fontSize = 11.sp)
                                    candidates.forEach { candidate ->
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f))
                                                .clickable {
                                                    docTagsList = docTagsList + candidate
                                                    currentDocTagInput = ""
                                                }
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text(
                                                text = candidate,
                                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(
                                    onClick = {
                                        docNote = doc?.notes ?: ""
                                        isEditingDocNote = false
                                    }
                                ) {
                                    Text("取消", color = subTextColor)
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Button(
                                    onClick = {
                                        var finalTags = docTagsList
                                        val residual = currentDocTagInput.trim()
                                        if (residual.isNotEmpty() && !finalTags.contains(residual)) {
                                            finalTags = finalTags + residual
                                        }
                                        viewModel.updateDocumentMetadata(docNote, finalTags)
                                        currentDocTagInput = ""
                                        isEditingDocNote = false
                                    }
                                ) {
                                    Text("保存笔记与标签")
                                }
                            }
                        } else {
                            // === 预览模式 (支持全量 Markdown 格式化渲染) ===
                            if (docNote.isNotBlank()) {
                                MarkdownText(
                                    markdown = docNote,
                                    color = textColor,
                                    theme = theme,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            } else {
                                Text(
                                    "暂无全局文档总结或笔记。点击右上角“添加笔记”开始记录...",
                                    color = subTextColor.copy(alpha = 0.6f),
                                    fontSize = 13.sp,
                                    fontStyle = FontStyle.Italic
                                )
                            }

                            if (docTagsList.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(14.dp))
                                Divider(color = when (theme) {
                                    "light" -> Color(0xFFEEEEEE)
                                    "sepia" -> Color(0xFFE4DFD5)
                                    else -> Color(0xFF282828)
                                })
                                Spacer(modifier = Modifier.height(10.dp))
                                Text("文档标签", fontSize = 11.sp, color = subTextColor, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.height(6.dp))
                                FlowRow(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    docTagsList.forEach { tag ->
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(tagBg)
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text(text = "#$tag", color = subTextColor, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NotebookHighlightCard(
    hl: HighlightEntity,
    theme: String,
    viewModel: MainViewModel,
    isEditing: Boolean,
    onEditingChange: (Boolean) -> Unit
) {
    val isDark = theme == "dark"
    val allExistingTags by viewModel.allTags.collectAsState()
    
    val hlTags = remember(hl.tags_json) {
        try {
            if (hl.tags_json.isNullOrBlank()) {
                emptyList()
            } else {
                try {
                    Json.decodeFromString<List<String>>(hl.tags_json)
                } catch (e1: Exception) {
                    try {
                        val objList = Json.decodeFromString<List<com.readerq.app.api.ReadwiseExportTagItem>>(hl.tags_json)
                        objList.map { it.name }
                    } catch (e2: Exception) {
                        try {
                            val map = Json.decodeFromString<Map<String, Int>>(hl.tags_json)
                            map.keys.toList()
                        } catch (e3: Exception) {
                            emptyList()
                        }
                    }
                }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    val hlColor = when (hl.color?.lowercase()) {
        "yellow" -> Color(0xFFFDE047)
        "green" -> Color(0xFF86EFAC)
        "blue" -> Color(0xFF93C5FD)
        "purple" -> Color(0xFFC084FC)
        "red" -> Color(0xFFFCA5A5)
        else -> Color(0xFFFDE047)
    }

    val cardBg = when (theme) {
        "light" -> Color(0xFFF3F4F6)
        "sepia" -> Color(0xFFEFECE6)
        else -> Color(0xFF1E1E1E)
    }
    val mainTextColor = when (theme) {
        "light" -> Color(0xFF111827)
        "sepia" -> Color(0xFF2B251F)
        else -> Color(0xFFF3F4F6)
    }
    val subTextColor = when (theme) {
        "light" -> Color(0xFF4B5563)
        "sepia" -> Color(0xFF5C5246)
        else -> Color(0xFF9CA3AF)
    }
    val tagBg = when (theme) {
        "light" -> Color(0xFFE5E7EB)
        "sepia" -> Color(0xFFE4DFD5)
        else -> Color(0xFF2D2D2D)
    }
    val textColor = MaterialTheme.colorScheme.onBackground

    var editNoteText by remember(hl.note, isEditing) { mutableStateOf(hl.note ?: "") }
    
    // Tag Chip Input State
    var tagList by remember(hlTags, isEditing) { mutableStateOf(hlTags) }
    var currentTagInput by remember { mutableStateOf("") }

    // Autocomplete tag candidates
    val candidates = remember(allExistingTags, currentTagInput, tagList) {
        val query = currentTagInput.trim()
        if (query.isEmpty()) {
            emptyList()
        } else {
            allExistingTags
                .filter { it.contains(query, ignoreCase = true) && !tagList.contains(it) }
                .take(5)
        }
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = cardBg),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (isEditing) 1.dp else 0.dp,
                color = if (isEditing) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            )
    ) {
        Column(modifier = Modifier.padding(14.dp)) {

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = !isEditing) {
                        onEditingChange(true)
                        viewModel.triggerScrollToHighlight(hl.id)
                    }
                    .drawBehind {
                        val barWidth = 4.dp.toPx()
                        val cornerRadius = 2.dp.toPx()
                        drawRoundRect(
                            color = hlColor,
                            topLeft = Offset.Zero,
                            size = Size(width = barWidth, height = size.height),
                            cornerRadius = CornerRadius(cornerRadius, cornerRadius)
                        )
                    }
                    .padding(start = 16.dp)
            ) {
                HighlightContentWithImages(
                    text = hl.text,
                    textColor = mainTextColor,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    tagBg = tagBg
                )
            }

            if (isEditing) {
                Spacer(modifier = Modifier.height(12.dp))
                Divider(color = if (isDark) Color(0xFF333333) else Color(0xFFE5E7EB))
                Spacer(modifier = Modifier.height(12.dp))

                val inputContainerColor = if (isDark) Color(0xFF28282A) else Color(0xFFEAECEF)

                TextField(
                    value = editNoteText,
                    onValueChange = { editNoteText = it },
                    placeholder = { Text("添加高亮批注...", fontSize = 13.sp, color = subTextColor.copy(alpha = 0.6f)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = inputContainerColor,
                        unfocusedContainerColor = inputContainerColor,
                        disabledContainerColor = inputContainerColor,
                        focusedTextColor = textColor,
                        unfocusedTextColor = textColor,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        disabledIndicatorColor = Color.Transparent
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))
                
                // Tags Title & Chips Layout inside Card Editor
                Text("标签", fontSize = 11.sp, color = subTextColor, fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(4.dp))
                
                if (tagList.isNotEmpty()) {
                    FlowRow(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        tagList.forEach { tag ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(tagBg)
                                    .clickable { tagList = tagList - tag }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text(text = "#$tag", color = subTextColor, fontSize = 11.sp)
                                    Text(text = "✕", color = subTextColor.copy(alpha = 0.7f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                TextField(
                    value = currentTagInput,
                    onValueChange = { input ->
                        // Auto split and commit when pressing commas/spaces
                        if (input.endsWith(",") || input.endsWith("，") || input.endsWith(" ") || input.endsWith("\n")) {
                            val newTag = input.trim()
                                .removeSuffix(",")
                                .removeSuffix("，")
                                .trim()
                            if (newTag.isNotEmpty() && !tagList.contains(newTag)) {
                                tagList = tagList + newTag
                            }
                            currentTagInput = ""
                        } else {
                            currentTagInput = input
                        }
                    },
                    placeholder = { Text("输入新标签并以逗号或空格分割...", fontSize = 13.sp, color = subTextColor.copy(alpha = 0.6f)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = inputContainerColor,
                        unfocusedContainerColor = inputContainerColor,
                        disabledContainerColor = inputContainerColor,
                        focusedTextColor = textColor,
                        unfocusedTextColor = textColor,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        disabledIndicatorColor = Color.Transparent
                    )
                )

                // Autocomplete Suggestions Row
                if (candidates.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("匹配：", color = subTextColor, fontSize = 11.sp)
                        candidates.forEach { candidate ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f))
                                    .clickable {
                                        tagList = tagList + candidate
                                        currentTagInput = ""
                                    }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = candidate,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                    val isNarrow = maxWidth < 220.dp
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // 删除按钮
                        if (isNarrow) {
                            IconButton(
                                onClick = {
                                    viewModel.deleteHighlight(hl.id)
                                    onEditingChange(false)
                                }
                            ) {
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_delete),
                                    contentDescription = "删除",
                                    tint = subTextColor,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        } else {
                            TextButton(
                                onClick = {
                                    viewModel.deleteHighlight(hl.id)
                                    onEditingChange(false)
                                }
                            ) {
                                Icon(
                                    painter = painterResource(id = R.drawable.ic_delete),
                                    contentDescription = null,
                                    tint = subTextColor,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("删除", color = subTextColor, fontSize = 13.sp)
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(if (isNarrow) 4.dp else 8.dp)) {
                            // 取消按钮
                            if (isNarrow) {
                                IconButton(
                                    onClick = {
                                        onEditingChange(false)
                                        currentTagInput = ""
                                    }
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_close),
                                        contentDescription = "取消",
                                        tint = subTextColor,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            } else {
                                TextButton(onClick = { 
                                    onEditingChange(false)
                                    currentTagInput = ""
                                }) {
                                    Text("取消", color = subTextColor, fontSize = 13.sp)
                                }
                            }

                            // 保存按钮
                            if (isNarrow) {
                                IconButton(
                                    onClick = {
                                        var finalTags = tagList
                                        val residual = currentTagInput.trim()
                                        if (residual.isNotEmpty() && !finalTags.contains(residual)) {
                                            finalTags = finalTags + residual
                                        }
                                        viewModel.updateHighlight(hl.id, editNoteText, finalTags)
                                        onEditingChange(false)
                                        currentTagInput = ""
                                    }
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_check),
                                        contentDescription = "保存",
                                        tint = subTextColor,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            } else {
                                Button(
                                    onClick = {
                                        var finalTags = tagList
                                        val residual = currentTagInput.trim()
                                        if (residual.isNotEmpty() && !finalTags.contains(residual)) {
                                            finalTags = finalTags + residual
                                        }
                                        viewModel.updateHighlight(hl.id, editNoteText, finalTags)
                                        onEditingChange(false)
                                        currentTagInput = ""
                                    },
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_check),
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("保存", fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
            } else {
                // Render static note & tags
                if (!hl.note.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_edit_note),
                            contentDescription = "Note",
                            tint = subTextColor,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = hl.note,
                            color = subTextColor,
                            fontStyle = FontStyle.Italic,
                            fontSize = 12.sp
                        )
                    }
                }

                if (hlTags.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        hlTags.forEach { tag ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(tagBg)
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(text = "#$tag", color = subTextColor, fontSize = 10.sp)
                            }
                        }
                    }
                }

                // Created at timestamp
                if (!hl.created_at.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    val formattedTime = remember(hl.created_at) {
                        try {
                            val instant = java.time.Instant.parse(hl.created_at)
                            val zdt = instant.atZone(java.time.ZoneId.systemDefault())
                            val formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
                            zdt.format(formatter)
                        } catch (e: Exception) {
                            hl.created_at?.take(16)?.replace("T", " ") ?: ""
                        }
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_inbox),
                            contentDescription = "创建时间",
                            tint = subTextColor.copy(alpha = 0.6f),
                            modifier = Modifier.size(12.dp)
                        )
                        Text(
                            text = formattedTime,
                            color = subTextColor.copy(alpha = 0.6f),
                            fontSize = 10.sp
                        )
                    }
                }
            }
        }
    }
}

sealed class HighlightBlock {
    data class TextBlock(val text: String) : HighlightBlock()
    data class ImageBlock(val url: String, val alt: String) : HighlightBlock()
}

@Composable
fun buildMarkdownAnnotatedString(
    input: String,
    textColor: Color,
    primaryColor: Color = MaterialTheme.colorScheme.primary
): AnnotatedString {
    return remember(input, textColor, primaryColor) {
        buildAnnotatedString {
            val pattern = Regex("""(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(~~)(.*?)\5|(`)(.*?)\7|\[([^\]]+)\]\(([^)]+)\)""")
            var lastIndex = 0

            pattern.findAll(input).forEach { match ->
                val range = match.range
                if (range.first > lastIndex) {
                    append(input.substring(lastIndex, range.first))
                }

                val fullGroup = match.value
                when {
                    fullGroup.startsWith("**") || fullGroup.startsWith("__") -> {
                        val content = match.groupValues[2]
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                            append(content)
                        }
                    }
                    fullGroup.startsWith("~~") -> {
                        val content = match.groupValues[6]
                        withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) {
                            append(content)
                        }
                    }
                    fullGroup.startsWith("`") -> {
                        val content = match.groupValues[8]
                        withStyle(
                            SpanStyle(
                                fontFamily = FontFamily.Monospace,
                                background = primaryColor.copy(alpha = 0.12f),
                                color = primaryColor,
                                fontWeight = FontWeight.SemiBold
                            )
                        ) {
                            append(" $content ")
                        }
                    }
                    fullGroup.startsWith("[") -> {
                        val label = match.groupValues[9]
                        val url = match.groupValues[10]
                        pushStringAnnotation(tag = "URL", annotation = url)
                        withStyle(
                            SpanStyle(
                                color = Color(0xFF007AFF),
                                textDecoration = TextDecoration.Underline,
                                fontWeight = FontWeight.SemiBold
                            )
                        ) {
                            append(label)
                        }
                        pop()
                    }
                    fullGroup.startsWith("*") || fullGroup.startsWith("_") -> {
                        val content = match.groupValues[4]
                        withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                            append(content)
                        }
                    }
                    else -> append(fullGroup)
                }

                lastIndex = range.last + 1
            }

            if (lastIndex < input.length) {
                append(input.substring(lastIndex))
            }
        }
    }
}

@Composable
fun HighlightContentWithImages(
    text: String,
    textColor: Color,
    fontSize: androidx.compose.ui.unit.TextUnit = 13.sp,
    lineHeight: androidx.compose.ui.unit.TextUnit = 18.sp,
    fontWeight: FontWeight = FontWeight.Normal,
    tagBg: Color = Color.Gray.copy(alpha = 0.2f),
    modifier: Modifier = Modifier
) {
    var previewImageUrl by remember { mutableStateOf<String?>(null) }
    val imageRegex = remember {
        Regex("""!\[([^]]*)]\(([^)]+)\)|<img\s+[^>]*src=["']([^"']+)["'][^>]*>""", RegexOption.IGNORE_CASE)
    }
    
    val blocks = remember(text) {
        val list = mutableListOf<HighlightBlock>()
        var lastIndex = 0
        imageRegex.findAll(text).forEach { match ->
            val range = match.range
            if (range.first > lastIndex) {
                val textSegment = text.substring(lastIndex, range.first).trim()
                if (textSegment.isNotEmpty()) {
                    list.add(HighlightBlock.TextBlock(textSegment))
                }
            }
            // Group 1 & 2 for Markdown ![alt](url), Group 3 for HTML <img src="url">
            val alt = match.groups[1]?.value?.ifBlank { null } ?: "图片"
            val url = match.groups[2]?.value ?: match.groups[3]?.value ?: ""
            if (url.isNotBlank()) {
                list.add(HighlightBlock.ImageBlock(url = url, alt = alt))
            }
            lastIndex = range.last + 1
        }
        if (lastIndex < text.length) {
            val remainingText = text.substring(lastIndex).trim()
            if (remainingText.isNotEmpty()) {
                list.add(HighlightBlock.TextBlock(remainingText))
            }
        }
        if (list.isEmpty() && text.isNotBlank()) {
            list.add(HighlightBlock.TextBlock(text.trim()))
        }
        list
    }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        blocks.forEach { block ->
            when (block) {
                is HighlightBlock.TextBlock -> {
                    val annotatedText = buildMarkdownAnnotatedString(block.text, textColor)
                    Text(
                        text = annotatedText,
                        color = textColor,
                        fontSize = fontSize,
                        lineHeight = lineHeight,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                is HighlightBlock.ImageBlock -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .border(1.dp, tagBg, RoundedCornerShape(10.dp))
                            .clickable { previewImageUrl = block.url }
                    ) {
                        AsyncImage(
                            model = block.url,
                            contentDescription = block.alt,
                            contentScale = ContentScale.FillWidth,
                            modifier = Modifier
                                .fillMaxWidth()
                                .wrapContentHeight()
                        )

                        // 🔍 悬浮提示 Chip
                        Surface(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(8.dp),
                            shape = androidx.compose.foundation.shape.CircleShape,
                            color = Color.Black.copy(alpha = 0.65f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = "查看大图",
                                    tint = Color.White,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("点击查看大图", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            }
        }
    }

    // 🔍 大图全屏预览 Modal
    if (previewImageUrl != null) {
        androidx.compose.ui.window.Dialog(
            onDismissRequest = { previewImageUrl = null },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.92f))
                    .clickable { previewImageUrl = null },
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = previewImageUrl,
                    contentDescription = "大图预览",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                )

                IconButton(
                    onClick = { previewImageUrl = null },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 40.dp, end = 20.dp)
                        .background(Color.White.copy(alpha = 0.2f), androidx.compose.foundation.shape.CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "关闭",
                        tint = Color.White
                    )
                }

                Text(
                    text = "点击任意位置返回",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 32.dp)
                )
            }
        }
    }
}
