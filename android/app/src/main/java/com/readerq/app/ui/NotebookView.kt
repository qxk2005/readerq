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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NotebookView(viewModel: MainViewModel) {
    val highlights by viewModel.highlights.collectAsState()
    val doc by viewModel.selectedDoc.collectAsState()
    val theme by viewModel.theme.collectAsState()
    val allExistingTags by viewModel.allTags.collectAsState()

    val listState = rememberLazyListState()
    var editingHighlightId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(viewModel) {
        viewModel.scrollNotebookToHighlightEvent.collect { hlId ->
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

    LazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Document Notes Editor Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("文档笔记", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = docNote,
                        onValueChange = { docNote = it },
                        placeholder = { Text("添加文档总结或备注...") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MaterialTheme.colorScheme.onSurface,
                            unfocusedTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                        )
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    // Tags Title & Chips Layout
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

                    OutlinedTextField(
                        value = currentDocTagInput,
                        onValueChange = { input ->
                            // Auto split and commit when pressing commas/spaces/newlines
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
                        placeholder = { Text("输入新标签并以逗号或空格分割...", fontSize = 13.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = textColor,
                            unfocusedTextColor = textColor
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

                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            var finalTags = docTagsList
                            val residual = currentDocTagInput.trim()
                            if (residual.isNotEmpty() && !finalTags.contains(residual)) {
                                finalTags = finalTags + residual
                            }
                            viewModel.updateDocumentMetadata(docNote, finalTags)
                            currentDocTagInput = ""
                        },
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text("保存文档信息")
                    }
                }
            }
        }

        // Highlights list header
        item {
            Text(
                "高亮与批注 (${highlights.size})",
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp
            )
        }

        // Highlights items using modular independent card views
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
        Column(modifier = Modifier.padding(12.dp)) {
            // Parse markdown image syntax: ![description](url)
            val imageRegex = Regex("""!\[[^]]*]\((https?://[^)]+)\)""")
            val matchResult = imageRegex.find(hl.text)
            val displayImageUrl = matchResult?.groups?.get(1)?.value
            val cleanText = if (displayImageUrl != null) {
                hl.text.replace(imageRegex, "").trim()
            } else {
                hl.text
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = !isEditing) {
                        onEditingChange(true)
                        viewModel.triggerScrollToHighlight(hl.id)
                    }
            ) {
                if (displayImageUrl != null) {
                    AsyncImage(
                        model = displayImageUrl,
                        contentDescription = "Highlight Image",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 200.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, tagBg, RoundedCornerShape(8.dp))
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                if (cleanText.isNotEmpty()) {
                    Text(
                        text = cleanText,
                        color = mainTextColor,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 12.dp)
                            .drawBehind {
                                drawRect(
                                    color = hlColor,
                                    topLeft = Offset.Zero,
                                    size = Size(width = 4.dp.toPx(), height = size.height)
                                )
                            }
                    )
                }
            }

            if (isEditing) {
                Spacer(modifier = Modifier.height(12.dp))
                Divider(color = if (isDark) Color(0xFF333333) else Color(0xFFE5E7EB))
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = editNoteText,
                    onValueChange = { editNoteText = it },
                    placeholder = { Text("添加高亮笔记...", fontSize = 13.sp) },
                    label = { Text("批注", fontSize = 11.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = textColor,
                        unfocusedTextColor = textColor
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

                OutlinedTextField(
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
                    placeholder = { Text("输入新标签并以逗号或空格分割...", fontSize = 13.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = textColor,
                        unfocusedTextColor = textColor
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
            }
        }
    }
}
